import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const origin = "https://backedit.co";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const events = new Set([
  "share_opened",
  "share_x",
  "share_reddit",
  "share_linkedin",
  "share_whatsapp",
  "share_instagram",
  "share_copy_link",
  "share_poster_download",
]);
const contexts = new Set(["owner_launch", "owner_general", "backer", "visitor", "project_update"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST")
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: cors });
  const payload = await request.json().catch(() => ({}));
  if (
    typeof payload.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug) ||
    !events.has(payload.event) ||
    !contexts.has(payload.context)
  )
    return Response.json({ error: "invalid_event" }, { status: 400, headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("slug", payload.slug)
    .eq("status", "live")
    .is("admin_archived_at", null)
    .is("admin_suspended_at", null)
    .maybeSingle();
  if (!project)
    return Response.json({ error: "project_unavailable" }, { status: 404, headers: cors });

  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  await admin.from("project_share_events").insert({
    project_id: project.id,
    user_id: auth.user?.id ?? null,
    event_type: payload.event,
    context: payload.context,
  });
  return Response.json({ recorded: true }, { headers: cors });
});
