import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://backedit.co",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};

const response = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return response(401, { error: "Authentication required." });

  const token = authorization.slice("Bearer ".length);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return response(401, { error: "Authentication required." });

  const { confirmation } = await request.json().catch(() => ({}));
  if (confirmation !== "DELETE")
    return response(400, { error: "Enter DELETE to confirm account deletion." });

  const userId = auth.user.id;
  const [{ data: activeProjects }, { data: pendingBackings }, { data: pendingCreatorSettlements }] =
    await Promise.all([
      admin
        .from("projects")
        .select("id")
        .eq("creator_id", userId)
        .in("status", ["live", "funded"])
        .limit(1),
      admin
        .from("backings")
        .select("id")
        .eq("backer_id", userId)
        .or("status.eq.pending,refund_status.eq.pending")
        .limit(1),
      admin
        .from("project_settlements")
        .select("project_id,projects!inner(creator_id)")
        .eq("projects.creator_id", userId)
        .in("status", ["pending", "payout_pending"])
        .limit(1),
    ]);

  if (activeProjects?.length || pendingBackings?.length || pendingCreatorSettlements?.length) {
    return response(409, {
      error: "Your account cannot be deleted while projects, refunds, or payouts are still active.",
    });
  }

  // Financial rows retain their immutable accounting references. The profile is
  // anonymized and the Auth user is permanently banned, which preserves foreign
  // key integrity while revoking all future access.
  const { error: profileError } = await admin
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
      deleted_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (profileError) return response(500, { error: "Could not anonymize this account." });

  await admin.from("backings").update({ backer_email: null }).eq("backer_id", userId);
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
    user_metadata: {},
  });
  if (banError) return response(500, { error: "Could not revoke account access." });

  return response(200, { deleted: true });
});
