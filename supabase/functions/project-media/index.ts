import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://backedit.co",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const form = await request.formData();
    const scope = form.get("scope");
    const file = form.get("file");
    if (!(file instanceof File)) return reply(400, { error: "image_required" });
    if (!allowedTypes.has(file.type)) return reply(400, { error: "unsupported_image_type" });
    if (!file.size || file.size > maxBytes) return reply(400, { error: "image_too_large" });

    let prefix = "";
    if (scope === "draft") {
      const draftId = form.get("draftId");
      const secret = form.get("secret");
      if (typeof draftId !== "string" || typeof secret !== "string" || secret.length < 32)
        return reply(401, { error: "invalid_draft_capability" });
      const { data: draft } = await admin
        .from("project_drafts")
        .select("id")
        .eq("id", draftId)
        .eq("secret_hash", await hash(secret))
        .is("owner_id", null)
        .maybeSingle();
      if (!draft) return reply(403, { error: "draft_not_available" });
      prefix = `drafts/${draft.id}`;
    } else if (scope === "project") {
      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      const slug = form.get("slug");
      if (!token || typeof slug !== "string")
        return reply(401, { error: "authentication_required" });
      const { data: auth } = await admin.auth.getUser(token);
      if (!auth.user) return reply(401, { error: "authentication_required" });
      const { data: project } = await admin
        .from("projects")
        .select("id")
        .eq("slug", slug)
        .eq("creator_id", auth.user.id)
        .maybeSingle();
      if (!project) return reply(403, { error: "project_access_denied" });
      prefix = `projects/${project.id}`;
    } else {
      return reply(400, { error: "invalid_upload_scope" });
    }

    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${prefix}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from("project-media").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
    });
    if (uploadError) return reply(500, { error: "image_upload_failed" });
    const { data: publicUrl } = admin.storage.from("project-media").getPublicUrl(path);
    return reply(200, { path, url: publicUrl.publicUrl });
  } catch {
    return reply(400, { error: "invalid_upload" });
  }
});
