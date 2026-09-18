import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const stripe = () => new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const email = async (
  db: ReturnType<typeof admin>,
  key: string,
  to: string,
  subject: string,
  html: string,
) => {
  const { data } = await db
    .from("email_deliveries")
    .insert({ dedupe_key: key, event_type: key.split(":")[0], recipient_email: to })
    .select("id")
    .maybeSingle();
  if (!data) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL") || "Backed <hello@backedit.co>",
      to: [to],
      subject,
      html,
    }),
  });
  await db
    .from("email_deliveries")
    .update(
      r.ok
        ? { status: "sent", sent_at: new Date().toISOString() }
        : { status: "failed", last_error: "delivery_failed" },
    )
    .eq("id", data.id);
};

Deno.serve(async (req) => {
  if (
    req.method !== "POST" ||
    req.headers.get("x-settlement-secret") !== Deno.env.get("SETTLEMENT_CRON_SECRET")
  )
    return new Response("unauthorized", { status: 401 });
  const db = admin();
  const api = stripe();
  let handled = 0;
  const { data: campaigns } = await db
    .from("projects")
    .select("id, creator_id, funding_goal_amount, successful_backed_amount, currency")
    .eq("status", "live")
    .lte("deadline_at", new Date().toISOString());
  for (const campaign of campaigns ?? []) {
    const { data: locked } = await db.rpc("begin_campaign_settlement", {
      p_project_id: campaign.id,
    });
    if (!locked) continue;
    handled++;
    const { data: backings } = await db
      .from("backings")
      .select(
        "id, gross_amount, net_creator_proceeds_amount, stripe_charge_id, stripe_payment_intent_id, backer_email, stripe_transfer_id, stripe_refund_id, refund_status",
      )
      .eq("project_id", campaign.id)
      .eq("status", "paid");
    const paid = backings ?? [];
    if (campaign.successful_backed_amount >= campaign.funding_goal_amount) {
      const { data: creator } = await db
        .from("profiles")
        .select("email, stripe_account_id")
        .eq("id", campaign.creator_id)
        .single();
      if (!creator?.stripe_account_id) {
        await db
          .from("project_settlements")
          .update({ status: "pending", failure_reason: "payout_pending" })
          .eq("project_id", campaign.id);
        continue;
      }
      const account = await api.accounts.retrieve(creator.stripe_account_id);
      if (!account.payouts_enabled) {
        await db
          .from("project_settlements")
          .update({ status: "pending", failure_reason: "payout_pending" })
          .eq("project_id", campaign.id);
        continue;
      }
      for (const backing of paid.filter((b) => !b.stripe_transfer_id)) {
        if (!backing.stripe_charge_id) {
          await db
            .from("backings")
            .update({ transfer_failure_reason: "missing_charge" })
            .eq("id", backing.id);
          continue;
        }
        try {
          const transfer = await api.transfers.create(
            {
              amount: backing.net_creator_proceeds_amount,
              currency: campaign.currency,
              destination: creator.stripe_account_id,
              source_transaction: backing.stripe_charge_id,
              metadata: { backed_backing_id: backing.id, backed_project_id: campaign.id },
            },
            { idempotencyKey: `backed-transfer-${backing.id}` },
          );
          await db
            .from("backings")
            .update({
              stripe_transfer_id: transfer.id,
              transferred_at: new Date().toISOString(),
              transfer_failure_reason: null,
            })
            .eq("id", backing.id)
            .is("stripe_transfer_id", null);
        } catch {
          await db
            .from("backings")
            .update({ transfer_failure_reason: "retryable_transfer_failure" })
            .eq("id", backing.id);
        }
      }
      const { count } = await db
        .from("backings")
        .select("id", { count: "exact", head: true })
        .eq("project_id", campaign.id)
        .eq("status", "paid")
        .is("stripe_transfer_id", null);
      if (count === 0) {
        await db
          .from("projects")
          .update({ status: "funded", settled_at: new Date().toISOString() })
          .eq("id", campaign.id);
        await db
          .from("project_settlements")
          .update({ status: "succeeded", settled_at: new Date().toISOString() })
          .eq("project_id", campaign.id);
        if (creator.email)
          await email(
            db,
            `campaign-success:${campaign.id}`,
            creator.email,
            "Your Backed campaign succeeded",
            "<p>Your campaign reached its funding goal.</p>",
          );
      }
    } else {
      for (const backing of paid.filter((b) => !b.stripe_refund_id)) {
        try {
          const refund = await api.refunds.create(
            {
              payment_intent: backing.stripe_payment_intent_id!,
              metadata: { backed_backing_id: backing.id, backed_project_id: campaign.id },
            },
            { idempotencyKey: `backed-refund-${backing.id}` },
          );
          await db
            .from("backings")
            .update({
              stripe_refund_id: refund.id,
              refund_amount: backing.gross_amount,
              refund_status: refund.status === "succeeded" ? "succeeded" : "pending",
            })
            .eq("id", backing.id)
            .is("stripe_refund_id", null);
        } catch {
          await db.from("backings").update({ refund_status: "failed" }).eq("id", backing.id);
        }
      }
      const { count } = await db
        .from("backings")
        .select("id", { count: "exact", head: true })
        .eq("project_id", campaign.id)
        .eq("status", "paid")
        .neq("refund_status", "succeeded");
      if (count === 0) {
        await db
          .from("projects")
          .update({ status: "unsuccessful", settled_at: new Date().toISOString() })
          .eq("id", campaign.id);
        await db
          .from("project_settlements")
          .update({
            status: "succeeded",
            settled_at: new Date().toISOString(),
            gross_amount: 0,
            platform_fee_amount: 0,
            processing_fee_amount: 0,
            creator_proceeds_amount: 0,
          })
          .eq("project_id", campaign.id);
      }
    }
  }
  return Response.json({ handled });
});
