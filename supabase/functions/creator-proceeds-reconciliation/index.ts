import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { processProjectCancellation } from "../_shared/project-cancellation.ts";

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const stripe = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key?.startsWith("sk_live_")) throw new Error("stripe_live_key_required");
  return new Stripe(key);
};

async function attemptTransfer(
  db: ReturnType<typeof admin>,
  api: Stripe,
  backing: {
    id: string;
    project_id: string;
    gross_amount: number;
    creator_proceeds_amount: number;
    currency: string;
    stripe_charge_id: string | null;
    refund_amount: number | null;
  },
) {
  const { data: project } = await db
    .from("projects")
    .select("creator_id, status")
    .eq("id", backing.project_id)
    .maybeSingle();
  if (!project || project.status !== "live") {
    await db
      .from("backings")
      .update({ transfer_status: "not_required", transfer_failure_reason: "project_not_live" })
      .eq("id", backing.id)
      .is("stripe_transfer_id", null);
    return "not_required";
  }
  const { data: creator } = project
    ? await db
        .from("profiles")
        .select("stripe_account_id")
        .eq("id", project.creator_id)
        .maybeSingle()
    : { data: null };
  if (!creator?.stripe_account_id) {
    await db
      .from("backings")
      .update({ transfer_status: "pending", transfer_failure_reason: "creator_connect_not_ready" })
      .eq("id", backing.id);
    return "pending";
  }
  const account = await api.accounts.retrieve(creator.stripe_account_id);
  if (!account.payouts_enabled || account.capabilities?.transfers !== "active") {
    await db
      .from("backings")
      .update({ transfer_status: "pending", transfer_failure_reason: "creator_payout_not_ready" })
      .eq("id", backing.id);
    return "pending";
  }
  const refunded = Math.max(0, backing.refund_amount ?? 0);
  const reversalTarget = Math.min(
    backing.creator_proceeds_amount,
    Math.round((backing.creator_proceeds_amount * refunded) / backing.gross_amount),
  );
  const amount = Math.max(0, backing.creator_proceeds_amount - reversalTarget);
  if (amount === 0) {
    await db
      .from("backings")
      .update({ transfer_status: "not_required", transfer_failure_reason: null })
      .eq("id", backing.id)
      .is("stripe_transfer_id", null);
    return "not_required";
  }
  if (!backing.stripe_charge_id) {
    await db
      .from("backings")
      .update({ transfer_status: "failed", transfer_failure_reason: "missing_source_charge" })
      .eq("id", backing.id);
    return "failed";
  }
  const transfer = await api.transfers.create(
    {
      amount,
      currency: backing.currency,
      destination: creator.stripe_account_id,
      source_transaction: backing.stripe_charge_id,
      metadata: { backed_backing_id: backing.id, backed_project_id: backing.project_id },
    },
    { idempotencyKey: `backed-transfer-${backing.id}` },
  );
  await db
    .from("backings")
    .update({
      stripe_transfer_id: transfer.id,
      transfer_status: "created",
      transfer_created_at: new Date().toISOString(),
      transfer_failure_reason: null,
    })
    .eq("id", backing.id)
    .is("stripe_transfer_id", null);
  return "created";
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("SETTLEMENT_CRON_SECRET");
  if (req.method !== "POST" || !secret || req.headers.get("x-settlement-secret") !== secret)
    return new Response("unauthorized", { status: 401 });
  try {
    const db = admin();
    const api = stripe();
    const { data: backings, error } = await db
      .from("backings")
      .select(
        "id, project_id, gross_amount, creator_proceeds_amount, currency, stripe_charge_id, refund_amount",
      )
      .eq("status", "paid")
      .in("transfer_status", ["pending", "failed"])
      .is("stripe_transfer_id", null)
      .limit(100);
    if (error) throw error;
    const results = await Promise.allSettled(
      (backings ?? []).map((backing) => attemptTransfer(db, api, backing)),
    );
    const { data: cancellations, error: cancellationError } = await db
      .from("project_cancellations")
      .select("id")
      .in("status", ["processing", "attention_required"])
      .limit(20);
    if (cancellationError) throw cancellationError;
    const cancellationResults = [];
    for (const cancellation of cancellations ?? []) {
      cancellationResults.push(await processProjectCancellation(db, api, cancellation.id, 50));
    }
    return Response.json({
      processed: results.length,
      created: results.filter((r) => r.status === "fulfilled" && r.value === "created").length,
      cancellations: cancellationResults.length,
    });
  } catch {
    return new Response("creator_proceeds_reconciliation_failed", { status: 500 });
  }
});
