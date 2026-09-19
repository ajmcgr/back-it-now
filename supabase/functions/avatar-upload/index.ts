import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://backedit.co",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const response = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "method_not_allowed" });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return response(401, { error: "authentication_required" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: auth, error: authError } = await admin.auth.getUser(
    authorization.slice("Bearer ".length),
  );
  if (authError || !auth.user) return response(401, { error: "authentication_required" });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return response(400, { error: "image_required" });
    if (!allowedTypes.has(file.type)) return response(400, { error: "unsupported_image_type" });
    if (file.size === 0 || file.size > maxBytes) return response(400, { error: "image_too_large" });

    // The browser never supplies a user ID or path. A single stable filename
    // means replacements cannot accumulate orphaned avatar objects.
    const path = `${auth.user.id}/avatar`;
    const { error: uploadError } = await admin.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (uploadError) return response(500, { error: "avatar_upload_failed" });

    const { data: publicUrl } = admin.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
    const { error: profileError } = await admin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", auth.user.id);
    if (profileError) return response(500, { error: "avatar_profile_update_failed" });

    return response(200, { avatarUrl });
  } catch {
    return response(400, { error: "invalid_upload" });
  }
});
