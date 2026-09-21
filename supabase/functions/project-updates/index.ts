import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderBackedEmail, sendResendEmail } from "../_shared/backed-email.ts";

const cors = {
  "Access-Control-Allow-Origin": "https://backedit.co",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type CanonicalUpdate = {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  published_at: string;
  updated_at: string;
  created?: boolean;
};

const canonical = (value: CanonicalUpdate, imageUrl: string | null) => ({
  id: value.id,
  title: value.title,
  body: value.body,
  imagePath: value.image_path,
  imageUrl,
  publishedAt: value.published_at,
  updatedAt: value.updated_at,
});

const excerpt = (body: string) => {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}…` : compact;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "authentication_required" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return reply(500, { error: "updates_unavailable" });

  const admin = createClient(url, serviceKey);
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return reply(401, { error: "authentication_required" });

    const input = (await request.json()) as Record<string, unknown>;
    const action = input["action"];
    const slug = typeof input["slug"] === "string" ? input["slug"] : "";
    if (!slugPattern.test(slug)) return reply(400, { error: "invalid_project" });

    if (action === "delete") {
      const updateId = typeof input["updateId"] === "string" ? input["updateId"] : "";
      if (!uuidPattern.test(updateId)) return reply(400, { error: "invalid_update" });
      const { data, error } = await userClient.rpc("delete_project_update", {
        p_project_slug: slug,
        p_update_id: updateId,
      });
      if (error) {
        if (error.message.includes("project_access_denied"))
          return reply(403, { error: "project_access_denied" });
        if (error.message.includes("update_not_found"))
          return reply(404, { error: "update_not_found" });
        throw error;
      }
      return reply(200, { deleted: data === true });
    }

    const title = typeof input["title"] === "string" ? input["title"].trim() : "";
    const body = typeof input["body"] === "string" ? input["body"].trim() : "";
    const imagePath =
      typeof input["imagePath"] === "string" && input["imagePath"].trim()
        ? input["imagePath"].trim()
        : null;
    if (!title || title.length > 160) return reply(400, { error: "invalid_update_title" });
    if (!body || body.length > 20000) return reply(400, { error: "invalid_update_body" });

    let update: CanonicalUpdate | null = null;
    if (action === "create") {
      const idempotencyKey =
        typeof input["idempotencyKey"] === "string" ? input["idempotencyKey"] : "";
      if (!uuidPattern.test(idempotencyKey))
        return reply(400, { error: "invalid_idempotency_key" });
      const { data, error } = await userClient.rpc("create_project_update", {
        p_project_slug: slug,
        p_title: title,
        p_body: body,
        p_image_path: imagePath,
        p_idempotency_key: idempotencyKey,
      });
      if (error) {
        if (error.message.includes("project_access_denied"))
          return reply(403, { error: "project_access_denied" });
        if (error.message.includes("invalid_update_image"))
          return reply(400, { error: "invalid_update_image" });
        throw error;
      }
      update = (data?.[0] as CanonicalUpdate | undefined) ?? null;
    } else if (action === "update") {
      const updateId = typeof input["updateId"] === "string" ? input["updateId"] : "";
      if (!uuidPattern.test(updateId)) return reply(400, { error: "invalid_update" });
      const { data, error } = await userClient.rpc("update_project_update", {
        p_project_slug: slug,
        p_update_id: updateId,
        p_title: title,
        p_body: body,
        p_image_path: imagePath,
      });
      if (error) {
        if (error.message.includes("project_access_denied"))
          return reply(403, { error: "project_access_denied" });
        if (error.message.includes("update_not_found"))
          return reply(404, { error: "update_not_found" });
        if (error.message.includes("invalid_update_image"))
          return reply(400, { error: "invalid_update_image" });
        throw error;
      }
      update = (data?.[0] as CanonicalUpdate | undefined) ?? null;
    } else {
      return reply(400, { error: "invalid_action" });
    }

    if (!update) throw new Error("canonical_update_missing");

    let notificationsSent = 0;
    let notificationsFailed = 0;
    if (action === "create") {
      const { data: project } = await admin
        .from("projects")
        .select("name")
        .eq("slug", slug)
        .maybeSingle();
      const { data: deliveries } = await admin
        .from("email_deliveries")
        .select("id, dedupe_key, recipient_email, status")
        .eq("event_type", "project_update")
        .like("dedupe_key", `project-update:${update.id}:%`)
        .in("status", ["pending", "failed"]);

      for (const delivery of deliveries ?? []) {
        try {
          const response = await sendResendEmail({
            to: delivery.recipient_email,
            subject: `${project?.name ?? "A project you backed"} posted an update`,
            email: renderBackedEmail({
              title: `${project?.name ?? "A project you backed"} posted an update`,
              preheader: update.title,
              body: `${update.title}\n\n${excerpt(update.body)}`,
              ctaLabel: "Read the update",
              ctaUrl: `https://backedit.co/projects/${slug}/updates/${update.id}`,
              footer:
                "You’re receiving this because you backed this project and enabled project updates.",
            }),
            idempotencyKey: delivery.dedupe_key,
          });
          let resendEmailId: string | null = null;
          if (response.ok) {
            const result = (await response.json().catch(() => null)) as { id?: string } | null;
            resendEmailId = result?.id ?? null;
          }
          await admin
            .from("email_deliveries")
            .update(
              response.ok
                ? {
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    resend_email_id: resendEmailId,
                    last_error: null,
                  }
                : { status: "failed", last_error: "resend_delivery_failed" },
            )
            .eq("id", delivery.id);
          if (response.ok) notificationsSent += 1;
          else notificationsFailed += 1;
        } catch {
          notificationsFailed += 1;
          await admin
            .from("email_deliveries")
            .update({ status: "failed", last_error: "resend_delivery_failed" })
            .eq("id", delivery.id);
        }
      }
    }

    const imageUrl = update.image_path
      ? admin.storage.from("project-media").getPublicUrl(update.image_path).data.publicUrl
      : null;
    return reply(200, {
      update: canonical(update, imageUrl),
      created: action === "create" ? update.created === true : undefined,
      notifications: { sent: notificationsSent, failed: notificationsFailed },
    });
  } catch (error) {
    console.error(
      "project_updates_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return reply(500, { error: "updates_unavailable" });
  }
});
