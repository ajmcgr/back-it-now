import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { deliverProjectLaunchEmails } from "../_shared/audience-email.ts";

const cors = {
  "Access-Control-Allow-Origin": "https://backedit.co",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "authentication_required" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return reply(500, { error: "project_launch_unavailable" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return reply(401, { error: "authentication_required" });
    const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const slug = typeof input.slug === "string" ? input.slug : "";
    if (!slugPattern.test(slug)) return reply(400, { error: "invalid_project" });
    if (input.complianceAttested !== true)
      return reply(422, { error: "compliance_attestation_required" });
    if (typeof input.benefitsThirdPartyOrCause !== "boolean")
      return reply(422, { error: "compliance_beneficiary_answer_required" });

    const { data: complianceStatus, error: complianceError } = await admin.rpc(
      "record_existing_project_compliance",
      {
        p_project_slug: slug,
        p_user_id: auth.user.id,
        p_benefits_third_party_or_cause: input.benefitsThirdPartyOrCause,
      },
    );
    if (complianceError) {
      if (complianceError.message.includes("project_launch_denied"))
        return reply(403, { error: "project_launch_denied" });
      if (complianceError.message.includes("project_not_prelaunch"))
        return reply(409, { error: "project_not_prelaunch" });
      throw complianceError;
    }
    if (complianceStatus === "pending_review") {
      return reply(200, { slug, status: "pending_review", launched: false });
    }

    const { data, error } = await userClient.rpc("launch_prelaunch_project", {
      p_project_slug: slug,
    });
    if (error) {
      if (error.message.includes("project_launch_denied"))
        return reply(403, { error: "project_launch_denied" });
      if (error.message.includes("project_not_prelaunch"))
        return reply(409, { error: "project_not_prelaunch" });
      throw error;
    }
    const result = data?.[0] as
      | {
          project_id: string;
          project_slug: string;
          launched: boolean;
          launch_event_id: string | null;
        }
      | undefined;
    if (!result) throw new Error("project_launch_result_missing");

    const { data: project } = await admin
      .from("projects")
      .select("id, slug, name")
      .eq("id", result.project_id)
      .single();
    const notifications =
      project && result.launch_event_id
        ? await deliverProjectLaunchEmails(admin, project, result.launch_event_id)
        : { sent: 0, failed: 0 };

    return reply(200, { launched: result.launched, slug: result.project_slug, notifications });
  } catch (error) {
    console.error("project_lifecycle_failed", error instanceof Error ? error.message : "unknown");
    return reply(500, { error: "project_launch_unavailable" });
  }
});
