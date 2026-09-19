import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const origin = "https://backedit.co";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function authorize(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const admin = adminClient();
  const { data: auth, error } = await admin.auth.getUser(token);
  if (error || !auth.user) return null;
  const { data: membership } = await admin
    .schema("private")
    .from("backed_admins")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return membership ? { admin, userId: auth.user.id } : { admin, userId: null };
}

async function audit(
  admin: ReturnType<typeof adminClient>,
  adminUserId: string,
  action: string,
  projectId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await admin.schema("private").from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action,
    project_id: projectId,
    metadata,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const actor = await authorize(request);
  if (!actor) return json({ error: "authentication_required" }, 401);
  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === "string" ? payload.action : "status";
  if (action === "status") return json({ isAdmin: Boolean(actor.userId) });
  if (!actor.userId) return json({ error: "admin_required" }, 403);

  try {
    if (action === "list") {
      const { data: projects, error } = await actor.admin
        .from("projects")
        .select(
          "id, slug, name, summary, description, image_url, status, funding_goal_amount, initial_backed_amount, successful_backed_amount, successful_backer_count, deadline_at, created_at, admin_archived_at, admin_suspended_at, profiles!inner(username, display_name, avatar_url)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const totals = (projects ?? []).reduce(
        (result, project) => ({
          live:
            result.live +
            (project.status === "live" && !project.admin_archived_at && !project.admin_suspended_at
              ? 1
              : 0),
          draft: result.draft + (project.status === "draft" ? 1 : 0),
          ended: result.ended + (project.status !== "live" ? 1 : 0),
          volume: result.volume + project.initial_backed_amount + project.successful_backed_amount,
          backings: result.backings + project.successful_backer_count,
        }),
        { live: 0, draft: 0, ended: 0, volume: 0, backings: 0 },
      );
      return json({ projects: projects ?? [], totals });
    }

    const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
    if (!projectId) return json({ error: "project_required" }, 400);
    const { data: project, error: projectError } = await actor.admin
      .from("projects")
      .select("id, name, funding_goal_amount, deadline_at")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !project) return json({ error: "project_not_found" }, 404);

    if (action === "update") {
      const patch = payload.patch && typeof payload.patch === "object" ? payload.patch : {};
      const update: Record<string, string | number | null> = {};
      for (const key of ["name", "summary", "description", "image_url"] as const) {
        if (typeof patch[key] === "string") update[key] = patch[key].trim();
      }
      if (typeof patch.deadline_at === "string" && !Number.isNaN(Date.parse(patch.deadline_at)))
        update.deadline_at = new Date(patch.deadline_at).toISOString();
      if (!Object.keys(update).length) return json({ error: "no_valid_changes" }, 400);
      const { error } = await actor.admin.from("projects").update(update).eq("id", projectId);
      if (error) throw error;
      await audit(actor.admin, actor.userId, "project_updated", projectId, {
        fields: Object.keys(update),
      });
      return json({ updated: true });
    }

    if (action === "archive" || action === "suspend" || action === "restore") {
      const update =
        action === "archive"
          ? { admin_archived_at: new Date().toISOString() }
          : action === "suspend"
            ? { admin_suspended_at: new Date().toISOString() }
            : { admin_archived_at: null, admin_suspended_at: null };
      const { error } = await actor.admin.from("projects").update(update).eq("id", projectId);
      if (error) throw error;
      await audit(
        actor.admin,
        actor.userId,
        action === "archive"
          ? "project_archived"
          : action === "suspend"
            ? "project_suspended"
            : "project_restored",
        projectId,
      );
      return json({ action });
    }

    if (action === "delete") {
      const { error } = await actor.admin
        .from("projects")
        .update({ admin_archived_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) throw error;
      await audit(actor.admin, actor.userId, "project_archived", projectId, {
        reason: "safe_delete",
      });
      return json({ archived: true });
    }
    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    console.error(
      "admin_projects_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({ error: "admin_operation_failed" }, 500);
  }
});
