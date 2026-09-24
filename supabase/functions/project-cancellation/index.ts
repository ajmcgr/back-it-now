import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { renderBackedEmail, sendResendEmail } from "../_shared/backed-email.ts";
import { processProjectCancellation } from "../_shared/project-cancellation.ts";

const origin = "https://backedit.co";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const stripeClient = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key?.startsWith("sk_live_") && !key?.startsWith("rk_live_"))
    throw new Error("stripe_live_key_required");
  return new Stripe(key);
};

async function sendCancellationEmails(
  db: ReturnType<typeof adminClient>,
  cancellationId: string,
  project: { name: string; slug: string },
) {
  const { data } = await db
    .from("project_cancellation_refunds")
    .select("backing_id, backings!inner(backer_email)")
    .eq("cancellation_id", cancellationId);
  for (const row of data ?? []) {
    const backing = row.backings as unknown as { backer_email: string | null };
    if (!backing.backer_email) continue;
    const key = `project-cancelled:${cancellationId}:${row.backing_id}`;
    await db.from("email_deliveries").insert({
      dedupe_key: key,
      event_type: "project_cancelled",
      backing_id: row.backing_id,
      recipient_email: backing.backer_email,
    });
    const { data: delivery } = await db
      .from("email_deliveries")
      .select("id, status")
      .eq("dedupe_key", key)
      .maybeSingle();
    if (!delivery || delivery.status === "sent") continue;
    const response = await sendResendEmail({
      to: backing.backer_email,
      subject: `Project cancelled: ${project.name}`,
      email: renderBackedEmail({
        title: `${project.name} was cancelled`,
        preheader: "Your eligible backing is being refunded.",
        body: "The creator cancelled this project, so it is no longer accepting backings. Your eligible backing is being refunded in full. Your bank or card provider may take additional time to post the refund.",
        ctaLabel: "View project",
        ctaUrl: `${origin}/projects/${project.slug}`,
      }),
      idempotencyKey: key,
    });
    await db
      .from("email_deliveries")
      .update(
        response.ok
          ? { status: "sent", sent_at: new Date().toISOString(), last_error: null }
          : { status: "failed", last_error: "resend_delivery_failed" },
      )
      .eq("id", delivery.id);
  }
}

async function loadStatus(db: ReturnType<typeof adminClient>, projectId: string) {
  const { data: cancellation } = await db
    .from("project_cancellations")
    .select("id, status, eligible_refund_count, eligible_refund_amount, initiated_at, completed_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cancellation) return null;
  const { data: rows } = await db
    .from("project_cancellation_refunds")
    .select("status, requested_amount")
    .eq("cancellation_id", cancellation.id);
  const counts = { queued: 0, processing: 0, pending: 0, succeeded: 0, failed: 0, excluded: 0 };
  let refundedAmount = 0;
  for (const row of rows ?? []) {
    counts[row.status as keyof typeof counts] += 1;
    if (row.status === "succeeded") refundedAmount += row.requested_amount;
  }
  return { ...cancellation, counts, refundedAmount };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "authentication_required" });
  const db = adminClient();
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return reply(401, { error: "authentication_required" });

  try {
    const body = await request.json();
    if (body.action === "admin-list") {
      const { data: isAdmin } = await db.rpc("is_backed_admin", { p_actor_id: auth.user.id });
      if (!isAdmin) return reply(403, { error: "project_cancellation_forbidden" });
      const { data, error } = await db
        .from("project_cancellations")
        .select(
          "project_id, status, eligible_refund_count, eligible_refund_amount, project_cancellation_refunds(status, requested_amount)",
        );
      if (error) throw error;
      return reply(200, { cancellations: data ?? [] });
    }
    const slug = typeof body.slug === "string" ? body.slug : "";
    const { data: project } = await db
      .from("projects")
      .select("id, creator_id, slug, name, status")
      .eq("slug", slug)
      .maybeSingle();
    if (!project) return reply(404, { error: "project_not_found" });
    const { data: canCancel } = await db.rpc("can_cancel_project", {
      p_project_id: project.id,
      p_actor_id: auth.user.id,
    });
    if (!canCancel) return reply(403, { error: "project_cancellation_forbidden" });

    if (body.action === "preview") {
      if (project.status !== "live") return reply(409, { error: "project_not_cancellable" });
      const { data: backings, error } = await db
        .from("backings")
        .select("gross_amount, refund_amount, stripe_payment_intent_id, stripe_charge_id")
        .eq("project_id", project.id)
        .eq("status", "paid")
        .not("paid_at", "is", null)
        .not("stripe_payment_intent_id", "is", null)
        .not("stripe_charge_id", "is", null);
      if (error) throw error;
      const api = stripeClient();
      let eligibleCount = 0;
      let eligibleAmount = 0;
      for (const backing of backings ?? []) {
        const remaining = Math.max(0, backing.gross_amount - (backing.refund_amount ?? 0));
        if (!remaining || !backing.stripe_payment_intent_id) continue;
        const intent = await api.paymentIntents.retrieve(backing.stripe_payment_intent_id, {
          expand: ["latest_charge"],
        });
        const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
        if (
          !intent.livemode ||
          intent.status !== "succeeded" ||
          !charge ||
          charge.id !== backing.stripe_charge_id
        )
          continue;
        const stripeRemaining = Math.max(0, charge.amount - charge.amount_refunded);
        if (!stripeRemaining) continue;
        eligibleCount += 1;
        eligibleAmount += Math.min(remaining, stripeRemaining);
      }
      return reply(200, { eligibleCount, eligibleAmount, currency: "usd" });
    }

    if (body.action === "status")
      return reply(200, { cancellation: await loadStatus(db, project.id) });

    if (body.action !== "start" && body.action !== "retry")
      return reply(400, { error: "unknown_action" });
    if (body.action === "start" && body.confirmation !== "CANCEL")
      return reply(422, { error: "cancellation_confirmation_required" });

    let cancellation = await loadStatus(db, project.id);
    if (!cancellation) {
      const { data: cancellationId, error } = await db.rpc("begin_project_cancellation", {
        p_project_id: project.id,
        p_actor_id: auth.user.id,
      });
      if (error || !cancellationId) throw error ?? new Error("cancellation_start_failed");
      const { data: intents } = await db
        .from("checkout_backing_intents")
        .select("checkout_session_id")
        .eq("project_id", project.id)
        .is("converted_at", null);
      const api = stripeClient();
      for (const intent of intents ?? []) {
        try {
          await api.checkout.sessions.expire(intent.checkout_session_id);
        } catch {
          // A completed/expired session cannot be expired. The verified webhook
          // still records it, and cancellation reconciliation picks it up.
        }
      }
      cancellation = await loadStatus(db, project.id);
    }
    if (!cancellation) throw new Error("cancellation_not_found");
    await sendCancellationEmails(db, cancellation.id, project);
    await processProjectCancellation(db, stripeClient(), cancellation.id);
    return reply(200, { cancellation: await loadStatus(db, project.id) });
  } catch (error) {
    console.error(
      "project_cancellation_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return reply(500, { error: "project_cancellation_unavailable" });
  }
});
