import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sanitizeGalleryMedia } from "../_shared/project-gallery.ts";
import { deliverProjectLaunchEmails } from "../_shared/audience-email.ts";

const cors = {
  "Access-Control-Allow-Origin": "https://backedit.co",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("incomplete_draft"))
    return "Add a title, summary, cover image, funding goal, deadline, and reward before publishing.";
  if (message.includes("invalid_external_website")) return "Use a valid HTTPS website address.";
  if (message.includes("draft_owned_by_another_user"))
    return "This draft belongs to a different Backed account.";
  if (message.includes("draft_not_found")) return "This draft is no longer available.";
  return "We could not publish this project. Please check the details and try again.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await request.json();
    const secret = typeof body.secret === "string" ? body.secret : "";
    if (secret.length < 32) return respond({ error: "invalid_draft_secret" }, 400);
    const secretHash = await hash(secret);

    if (body.action === "create") {
      const { data, error } = await admin
        .from("project_drafts")
        .insert({ secret_hash: secretHash, payload: body.payload ?? {} })
        .select("id")
        .single();
      if (error) throw error;
      return respond({ id: data.id });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (body.action === "save") {
      const { data, error } = await admin
        .from("project_drafts")
        .update({ payload: body.payload ?? {} })
        .eq("id", id)
        .eq("secret_hash", secretHash)
        .is("owner_id", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return respond({ error: "draft_not_found_or_claimed" }, 404);
      return respond({ id: data.id });
    }

    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer) return respond({ error: "authentication_required" }, 401);
    const { data: auth, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !auth.user) return respond({ error: "authentication_required" }, 401);

    if (body.action === "publish") {
      const { data: pendingDraft } = await admin
        .from("project_drafts")
        .select("payload")
        .eq("id", id)
        .eq("secret_hash", secretHash)
        .maybeSingle();
      if (!pendingDraft) return respond({ error: "This draft is no longer available." }, 404);
      const pendingPayload = (pendingDraft.payload ?? {}) as Record<string, unknown>;
      const storagePublicPrefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/project-media/`;
      const galleryMedia = sanitizeGalleryMedia(pendingPayload.galleryMedia ?? [], {
        imagePathPrefix: `drafts/${id}/`,
        storagePublicPrefix,
      });
      if (galleryMedia === null)
        return respond({ error: "Check the project gallery and try again." }, 422);
      const { error: sanitizeError } = await admin
        .from("project_drafts")
        .update({ payload: { ...pendingPayload, galleryMedia } })
        .eq("id", id)
        .eq("secret_hash", secretHash);
      if (sanitizeError) return respond({ error: "Could not validate the project gallery." }, 422);

      const { data, error } = await admin.rpc("publish_project_draft", {
        p_draft_id: id,
        p_secret_hash: secretHash,
        p_user_id: auth.user.id,
      });
      if (error || !data?.[0]) return respond({ error: messageFor(error) }, 422);

      const project = data[0] as { project_id: string; project_slug: string };
      const { data: draft } = await admin
        .from("project_drafts")
        .select("payload")
        .eq("id", id)
        .eq("owner_id", auth.user.id)
        .maybeSingle();
      const payload = (draft?.payload ?? {}) as Record<string, unknown>;
      const coverPath =
        typeof payload.coverPath === "string" && payload.coverPath.startsWith(`drafts/${id}/`)
          ? payload.coverPath
          : null;
      const orderedGallery =
        sanitizeGalleryMedia(payload.galleryMedia ?? [], {
          imagePathPrefix: `drafts/${id}/`,
          storagePublicPrefix,
        }) ?? [];
      const sourcePaths = [
        ...(coverPath ? [coverPath] : []),
        ...orderedGallery.flatMap((item) =>
          item.type === "image" && item.storagePath ? [item.storagePath] : [],
        ),
      ];
      const moved = new Map<string, { path: string; url: string }>();
      for (const sourcePath of sourcePaths) {
        const filename = sourcePath.split("/").pop();
        if (!filename) continue;
        const destinationPath = `projects/${project.project_id}/${filename}`;
        const { error: moveError } = await admin.storage
          .from("project-media")
          .move(sourcePath, destinationPath);
        if (moveError) continue;
        const { data: publicUrl } = admin.storage
          .from("project-media")
          .getPublicUrl(destinationPath);
        moved.set(sourcePath, { path: destinationPath, url: publicUrl.publicUrl });
      }
      const movedCover = coverPath ? moved.get(coverPath) : null;
      const publishedGallery = orderedGallery.flatMap((item) => {
        if (item.type === "youtube") return [item];
        const published = item.storagePath ? moved.get(item.storagePath) : null;
        return published
          ? [{ type: "image" as const, url: published.url, storagePath: published.path }]
          : [];
      });
      if (movedCover) {
        await admin
          .from("projects")
          .update({ image_url: movedCover.url, gallery_media: publishedGallery })
          .eq("id", project.project_id)
          .eq("creator_id", auth.user.id);
      }
      const { data: publishedProject } = await admin
        .from("projects")
        .select("id, slug, name, status")
        .eq("id", project.project_id)
        .maybeSingle();
      let notifications = { sent: 0, failed: 0 };
      if (publishedProject?.status === "live") {
        const { data: launchEvent } = await admin
          .from("project_launch_events")
          .select("id")
          .eq("project_id", project.project_id)
          .maybeSingle();
        if (launchEvent) {
          notifications = await deliverProjectLaunchEmails(
            admin,
            {
              id: publishedProject.id,
              slug: publishedProject.slug,
              name: publishedProject.name,
            },
            launchEvent.id,
          );
        }
      }
      return respond({
        id: project.project_id,
        slug: project.project_slug,
        status: publishedProject?.status ?? "live",
        notifications,
      });
    }
    return respond({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("project-drafts request failed", error instanceof Error ? error.name : "unknown");
    return respond({ error: "project_draft_request_failed" }, 500);
  }
});
