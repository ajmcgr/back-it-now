import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";

const origin = "https://backedit.co";
const ownerAdminUserId = "ce29db8a-c666-4688-9cc9-dbbfead8bbfc";
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
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function authorize(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const admin = adminClient();
  const token = authorization.slice("Bearer ".length);
  const { data, error } = await admin.auth.getUser(token);
  if (error || data.user?.id !== ownerAdminUserId) return null;

  return { admin, userId: ownerAdminUserId, token };
}

async function listAuthUsers(admin: SupabaseClient) {
  const users = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return users;
}

async function loadOverview(admin: SupabaseClient) {
  const [profilesResult, projectsResult, commentsResult, backingsResult] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .is("admin_archived_at", null),
    admin
      .from("project_comments")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "visible")
      .is("deleted_at", null),
    admin.from("backings").select("gross_amount").eq("status", "paid"),
  ]);

  for (const result of [profilesResult, projectsResult, commentsResult, backingsResult]) {
    if (result.error) throw result.error;
  }

  const paidBackings = backingsResult.data ?? [];
  return {
    users: profilesResult.count ?? 0,
    projects: projectsResult.count ?? 0,
    amountBacked: paidBackings.reduce((sum, backing) => sum + backing.gross_amount, 0),
    backers: paidBackings.length,
    comments: commentsResult.count ?? 0,
  };
}

async function loadProjects(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("projects")
    .select(
      "id, slug, name, image_url, status, initial_backed_amount, successful_backed_amount, created_at, admin_archived_at, profiles!inner(username, display_name, avatar_url)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function loadUsers(admin: SupabaseClient) {
  const [{ data: profiles, error }, authUsers] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, username, avatar_url, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    listAuthUsers(admin),
  ]);
  if (error) throw error;

  const authById = new Map(authUsers.map((user) => [user.id, user]));
  return (profiles ?? []).map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    username: profile.username,
    avatar_url: profile.avatar_url,
    created_at: profile.created_at,
    email: authById.get(profile.id)?.email ?? null,
    is_admin: profile.id === ownerAdminUserId,
  }));
}

async function loadComments(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("project_comments")
    .select(
      "id, body, created_at, profiles!inner(username, display_name, avatar_url), projects!inner(id, slug, name)",
    )
    .eq("moderation_status", "visible")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function deleteProject(admin: SupabaseClient, projectId: string) {
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, admin_archived_at")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return json({ error: "project_not_found" }, 404);
  if (project.admin_archived_at) return json({ deleted: true, mode: "archived" });

  const { error } = await admin
    .from("projects")
    .update({ admin_archived_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw error;
  return json({ deleted: true, mode: "archived" });
}

async function deleteUser(admin: SupabaseClient, userId: string) {
  if (userId === ownerAdminUserId) return json({ error: "owner_admin_cannot_be_deleted" }, 400);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.deleted_at) return json({ error: "user_not_found" }, 404);

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
    user_metadata: {},
  });
  if (banError) throw banError;

  const deletedAt = new Date().toISOString();
  const [projectsResult, profileResult, backingsResult] = await Promise.all([
    admin
      .from("projects")
      .update({ admin_archived_at: deletedAt })
      .eq("creator_id", userId)
      .is("admin_archived_at", null),
    admin
      .from("profiles")
      .update({
        display_name: "Deleted Backed user",
        username: null,
        avatar_url: null,
        bio: null,
        email: null,
        x_user_id: null,
        x_username: null,
        receive_project_updates: false,
        receive_product_news: false,
        receive_favorite_project_updates: false,
        receive_project_launches: false,
        receive_creator_new_projects: false,
        receive_my_project_activity: false,
        deleted_at: deletedAt,
      })
      .eq("id", userId),
    admin.from("backings").update({ backer_email: null }).eq("backer_id", userId),
  ]);
  for (const result of [projectsResult, profileResult, backingsResult]) {
    if (result.error) throw result.error;
  }

  return json({ deleted: true, mode: "deactivated" });
}

async function deleteComment(admin: SupabaseClient, token: string, commentId: string) {
  const { data: comment, error: commentError } = await admin
    .from("project_comments")
    .select("id, moderation_status, deleted_at, projects!inner(slug)")
    .eq("id", commentId)
    .maybeSingle();
  if (commentError) throw commentError;
  if (!comment) return json({ error: "comment_not_found" }, 404);
  if (comment.moderation_status !== "visible" || comment.deleted_at) {
    return json({ deleted: true });
  }

  const actorClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { error: moderationError } = await actorClient.rpc("moderate_project_comment", {
    p_project_slug: comment.projects.slug,
    p_comment_id: comment.id,
  });
  if (moderationError) throw moderationError;
  return json({ deleted: true });
}

function stringId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const actor = await authorize(request);
  if (!actor) return json({ error: "admin_required" }, 403);

  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === "string" ? payload.action : "overview";

  try {
    if (action === "status") return json({ isAdmin: true });
    if (action === "overview") return json({ totals: await loadOverview(actor.admin) });
    if (action === "list_projects" || action === "list")
      return json({ projects: await loadProjects(actor.admin) });
    if (action === "list_users") return json({ users: await loadUsers(actor.admin) });
    if (action === "list_comments") return json({ comments: await loadComments(actor.admin) });

    if (action === "delete_project" || action === "delete") {
      const projectId = stringId(payload.projectId);
      return projectId
        ? await deleteProject(actor.admin, projectId)
        : json({ error: "project_required" }, 400);
    }
    if (action === "delete_user") {
      const userId = stringId(payload.userId);
      return userId ? await deleteUser(actor.admin, userId) : json({ error: "user_required" }, 400);
    }
    if (action === "delete_comment") {
      const commentId = stringId(payload.commentId);
      return commentId
        ? await deleteComment(actor.admin, actor.token, commentId)
        : json({ error: "comment_required" }, 400);
    }

    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    console.error("admin_operation_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "admin_operation_failed" }, 500);
  }
});
