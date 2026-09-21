import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
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

type CreatedComment = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  created: boolean;
};

const excerpt = (body: string) => {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length > 240 ? `${compact.slice(0, 237)}…` : compact;
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
  if (!url || !serviceKey || !anonKey) return reply(500, { error: "comments_unavailable" });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return reply(401, { error: "authentication_required" });

    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof input.action === "string" ? input.action : "";
    const slug = typeof input.slug === "string" ? input.slug : "";
    if (!slugPattern.test(slug)) return reply(400, { error: "invalid_project" });

    if (action === "create") {
      const body = typeof input.body === "string" ? input.body.trim() : "";
      const idempotencyKey = typeof input.idempotencyKey === "string" ? input.idempotencyKey : "";
      if (!body || body.length > 2000) return reply(400, { error: "invalid_comment_body" });
      if (!uuidPattern.test(idempotencyKey))
        return reply(400, { error: "invalid_idempotency_key" });

      const { data, error } = await userClient.rpc("create_project_comment", {
        p_project_slug: slug,
        p_body: body,
        p_idempotency_key: idempotencyKey,
      });
      if (error) {
        if (error.message.includes("comment_rate_limited"))
          return reply(429, { error: "comment_rate_limited" });
        if (error.message.includes("project_comments_unavailable"))
          return reply(403, { error: "project_comments_unavailable" });
        if (error.message.includes("profile_required"))
          return reply(403, { error: "profile_required" });
        throw error;
      }

      const comment = (data?.[0] as CreatedComment | undefined) ?? null;
      if (!comment) throw new Error("canonical_comment_missing");

      if (comment.created) {
        const [{ data: project }, { data: author }, { data: delivery }] = await Promise.all([
          admin.from("projects").select("name").eq("slug", slug).maybeSingle(),
          admin
            .from("profiles")
            .select("display_name, username")
            .eq("id", auth.user.id)
            .maybeSingle(),
          admin
            .from("email_deliveries")
            .select("id, dedupe_key, recipient_email, status")
            .eq("dedupe_key", `project-comment:${comment.id}`)
            .in("status", ["pending", "failed"])
            .maybeSingle(),
        ]);

        if (delivery) {
          try {
            const authorName = author?.display_name || author?.username || "A Backed user";
            const response = await sendResendEmail({
              to: delivery.recipient_email,
              subject: `New comment on ${project?.name ?? "your project"}`,
              email: renderBackedEmail({
                title: `New comment on ${project?.name ?? "your project"}`,
                preheader: `${authorName} commented on your project.`,
                body: `${authorName} commented:\n\n“${excerpt(comment.body)}”`,
                ctaLabel: "View comment",
                ctaUrl: `https://backedit.co/projects/${slug}#comments`,
                footer: "You’re receiving this because you created this project on Backed.",
              }),
              idempotencyKey: delivery.dedupe_key,
            });
            const result = response.ok
              ? ((await response.json().catch(() => null)) as { id?: string } | null)
              : null;
            await admin
              .from("email_deliveries")
              .update(
                response.ok
                  ? {
                      status: "sent",
                      sent_at: new Date().toISOString(),
                      resend_email_id: result?.id ?? null,
                      last_error: null,
                    }
                  : { status: "failed", last_error: "resend_delivery_failed" },
              )
              .eq("id", delivery.id);
          } catch {
            await admin
              .from("email_deliveries")
              .update({ status: "failed", last_error: "resend_delivery_failed" })
              .eq("id", delivery.id);
          }
        }
      }

      return reply(200, { comment, created: comment.created });
    }

    const commentId = typeof input.commentId === "string" ? input.commentId : "";
    if (!uuidPattern.test(commentId)) return reply(400, { error: "invalid_comment" });

    if (action === "update") {
      const body = typeof input.body === "string" ? input.body.trim() : "";
      if (!body || body.length > 2000) return reply(400, { error: "invalid_comment_body" });
      const { data, error } = await userClient.rpc("update_project_comment", {
        p_project_slug: slug,
        p_comment_id: commentId,
        p_body: body,
      });
      if (error) {
        if (error.message.includes("comment_access_denied"))
          return reply(403, { error: "comment_access_denied" });
        throw error;
      }
      return reply(200, { updated: data === true });
    }

    if (action === "delete" || action === "moderate") {
      const functionName =
        action === "delete" ? "delete_project_comment" : "moderate_project_comment";
      const { data, error } = await userClient.rpc(functionName, {
        p_project_slug: slug,
        p_comment_id: commentId,
      });
      if (error) {
        if (
          error.message.includes("comment_access_denied") ||
          error.message.includes("comment_moderation_denied") ||
          error.message.includes("use_delete_own_comment")
        )
          return reply(403, { error: "comment_access_denied" });
        if (error.message.includes("comment_not_found"))
          return reply(404, { error: "comment_not_found" });
        throw error;
      }
      return reply(200, { removed: data === true });
    }

    return reply(400, { error: "invalid_action" });
  } catch (error) {
    console.error(
      "project_comments_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return reply(500, { error: "comments_unavailable" });
  }
});
