import Stripe from "npm:stripe@18.5.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";

type Admin = SupabaseClient;

type CancellationWork = {
  id: string;
  cancellation_id: string;
  project_id: string;
  backing_id: string;
  requested_amount: number;
  status: "queued" | "processing" | "pending" | "succeeded" | "failed" | "excluded";
  stripe_refund_id: string | null;
  attempt_count: number;
  updated_at: string;
  backings: {
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    stripe_transfer_id: string | null;
    creator_stripe_account_id: string | null;
    gross_amount: number;
    creator_proceeds_amount: number;
    refund_amount: number | null;
    currency: string;
    paid_at: string | null;
  };
};

const normalizedRefundStatus = (status: Stripe.Refund.Status | null) =>
  status === "succeeded"
    ? "succeeded"
    : status === "failed" || status === "canceled"
      ? "failed"
      : "pending";

async function persistRefund(
  db: Admin,
  work: CancellationWork,
  refund: Stripe.Refund,
  reversal: { id: string; amount: number } | null,
) {
  const status = normalizedRefundStatus(refund.status);
  const { data: existing } = await db
    .from("backing_refunds")
    .select("stripe_refund_id")
    .eq("stripe_refund_id", refund.id)
    .maybeSingle();
  const refundValues: Record<string, unknown> = {
    backing_id: work.backing_id,
    amount: refund.amount,
    status,
    project_cancellation_id: work.cancellation_id,
    updated_at: new Date().toISOString(),
  };
  if (reversal) {
    refundValues.transfer_reversal_id = reversal.id;
    refundValues.transfer_reversal_amount = reversal.amount;
    refundValues.reversal_status = "created";
  }
  const refundWrite = existing
    ? db.from("backing_refunds").update(refundValues).eq("stripe_refund_id", refund.id)
    : db.from("backing_refunds").insert({
        stripe_refund_id: refund.id,
        transfer_reversal_id: reversal?.id ?? null,
        transfer_reversal_amount: reversal?.amount ?? 0,
        reversal_status: reversal ? "created" : "not_required",
        ...refundValues,
      });
  const { error: refundError } = await refundWrite;
  if (refundError) throw refundError;

  const { error: workError } = await db
    .from("project_cancellation_refunds")
    .update({
      stripe_refund_id: refund.id,
      stripe_transfer_reversal_id: reversal?.id ?? null,
      transfer_reversal_amount: reversal?.amount ?? 0,
      status,
      failure_code: status === "failed" ? `stripe_refund_${refund.status ?? "failed"}` : null,
      completed_at: status === "succeeded" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", work.id);
  if (workError) throw workError;

  const { error: canonicalError } = await db.rpc("record_stripe_refund", {
    p_stripe_refund_id: refund.id,
    p_payment_intent_id: work.backings.stripe_payment_intent_id,
    p_amount: refund.amount,
    p_status: status,
  });
  if (canonicalError) throw canonicalError;
}

async function findExistingCancellationRefund(
  api: Stripe,
  work: CancellationWork,
): Promise<Stripe.Refund | null> {
  if (work.stripe_refund_id) {
    try {
      const refund = await api.refunds.retrieve(work.stripe_refund_id);
      if (normalizedRefundStatus(refund.status) !== "failed") return refund;
    } catch {
      // Fall through to the metadata lookup. A transient retrieve failure must
      // not cause a second refund without checking Stripe first.
    }
  }
  if (!work.backings.stripe_payment_intent_id) return null;
  const refunds = await api.refunds.list({
    payment_intent: work.backings.stripe_payment_intent_id,
    limit: 100,
  });
  return (
    refunds.data.find(
      (refund) =>
        refund.metadata?.backed_cancellation_refund_id === work.id &&
        normalizedRefundStatus(refund.status) !== "failed",
    ) ?? null
  );
}

async function reverseTransferredCreatorFunds(
  api: Stripe,
  db: Admin,
  work: CancellationWork,
): Promise<{ id: string; amount: number } | null> {
  let transferId = work.backings.stripe_transfer_id;
  if (!transferId && work.backings.creator_stripe_account_id) {
    const created = work.backings.paid_at
      ? { gte: Math.max(0, Math.floor(new Date(work.backings.paid_at).getTime() / 1000) - 3600) }
      : undefined;
    for await (const candidate of api.transfers.list({
      destination: work.backings.creator_stripe_account_id,
      created,
      limit: 100,
    })) {
      if (candidate.metadata?.backed_backing_id !== work.backing_id) continue;
      transferId = candidate.id;
      await db
        .from("backings")
        .update({
          stripe_transfer_id: candidate.id,
          transfer_status: candidate.amount_reversed >= candidate.amount ? "reversed" : "created",
          transfer_failure_reason: null,
        })
        .eq("id", work.backing_id)
        .is("stripe_transfer_id", null);
      break;
    }
  }
  if (!transferId) return null;
  const transfer = await api.transfers.retrieve(transferId);
  if (!transfer.livemode) throw new Error("test_mode_transfer_excluded");
  if (
    work.backings.creator_stripe_account_id &&
    String(transfer.destination) !== work.backings.creator_stripe_account_id
  )
    throw new Error("transfer_destination_mismatch");
  const amount = Math.max(0, transfer.amount - transfer.amount_reversed);
  if (!amount) {
    const existing = transfer.reversals?.data.find(
      (item) => item.metadata?.backed_cancellation_refund_id === work.id,
    );
    return existing ? { id: existing.id, amount: existing.amount } : null;
  }
  const reversal = await api.transfers.createReversal(
    transferId,
    {
      amount,
      metadata: {
        backed_project_id: work.project_id,
        backed_backing_id: work.backing_id,
        backed_cancellation_refund_id: work.id,
      },
    },
    { idempotencyKey: `backed-cancel-reversal-${work.cancellation_id}-${work.backing_id}` },
  );
  return { id: reversal.id, amount: reversal.amount };
}

async function processOne(db: Admin, api: Stripe, work: CancellationWork) {
  const nextAttempt = work.attempt_count + 1;
  const staleProcessing =
    work.status === "processing" && Date.now() - new Date(work.updated_at).getTime() > 10 * 60_000;
  if (work.status === "processing" && !staleProcessing) return "busy";
  const { data: claimed, error: claimError } = await db
    .from("project_cancellation_refunds")
    .update({
      status: "processing",
      attempt_count: nextAttempt,
      last_attempt_at: new Date().toISOString(),
      failure_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", work.id)
    .eq("status", work.status)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return "busy";

  try {
    const paymentIntentId = work.backings.stripe_payment_intent_id;
    const chargeId = work.backings.stripe_charge_id;
    if (!paymentIntentId || !chargeId) throw new Error("missing_canonical_payment_evidence");
    const intent = await api.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (!intent.livemode) throw new Error("test_mode_payment_excluded");
    if (intent.status !== "succeeded" || !charge || charge.id !== chargeId)
      throw new Error("payment_not_refundable");
    if (charge.amount !== work.backings.gross_amount) throw new Error("payment_amount_mismatch");

    const existingRefund = await findExistingCancellationRefund(api, work);
    if (existingRefund) {
      const reversal = await reverseTransferredCreatorFunds(api, db, work);
      await persistRefund(db, work, existingRefund, reversal);
      return normalizedRefundStatus(existingRefund.status);
    }

    const remaining = Math.max(0, charge.amount - charge.amount_refunded);
    if (!remaining) {
      const refunds = await api.refunds.list({ payment_intent: intent.id, limit: 100 });
      for (const refund of refunds.data) {
        await db.rpc("record_stripe_refund", {
          p_stripe_refund_id: refund.id,
          p_payment_intent_id: intent.id,
          p_amount: refund.amount,
          p_status: normalizedRefundStatus(refund.status),
        });
      }
      await db
        .from("project_cancellation_refunds")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", work.id);
      return "succeeded";
    }
    const requested = Math.min(remaining, work.requested_amount);
    const reversal = await reverseTransferredCreatorFunds(api, db, work);
    if (reversal) {
      const { error: reversalError } = await db
        .from("project_cancellation_refunds")
        .update({
          stripe_transfer_reversal_id: reversal.id,
          transfer_reversal_amount: reversal.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", work.id);
      if (reversalError) throw reversalError;
    }
    if (!work.backings.stripe_transfer_id) {
      await db
        .from("backings")
        .update({ transfer_status: "not_required", transfer_failure_reason: "project_cancelled" })
        .eq("id", work.backing_id)
        .is("stripe_transfer_id", null);
    }
    const refund = await api.refunds.create(
      {
        payment_intent: intent.id,
        amount: requested,
        reason: "requested_by_customer",
        metadata: {
          backed_project_id: work.project_id,
          backed_backing_id: work.backing_id,
          backed_cancellation_id: work.cancellation_id,
          backed_cancellation_refund_id: work.id,
        },
      },
      {
        idempotencyKey: `backed-cancel-refund-${work.cancellation_id}-${work.backing_id}-${nextAttempt}`,
      },
    );
    await persistRefund(db, work, refund, reversal);
    return normalizedRefundStatus(refund.status);
  } catch (error) {
    const code = error instanceof Error ? error.message : "refund_processing_failed";
    const excluded =
      code === "test_mode_payment_excluded" || code === "test_mode_transfer_excluded";
    await db
      .from("project_cancellation_refunds")
      .update({
        status: excluded ? "excluded" : "failed",
        failure_code: code.slice(0, 160),
        completed_at: excluded ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", work.id);
    return excluded ? "excluded" : "failed";
  }
}

export async function processProjectCancellation(
  db: Admin,
  api: Stripe,
  cancellationId: string,
  limit = 50,
) {
  const { data: cancellation, error: cancellationError } = await db
    .from("project_cancellations")
    .select("project_id")
    .eq("id", cancellationId)
    .maybeSingle();
  if (cancellationError || !cancellation)
    throw cancellationError ?? new Error("cancellation_not_found");
  const { data: paidBackings, error: backingError } = await db
    .from("backings")
    .select("id")
    .eq("project_id", cancellation.project_id)
    .eq("status", "paid");
  if (backingError) throw backingError;
  for (const backing of paidBackings ?? []) {
    await db.rpc("queue_cancellation_backing", { p_backing_id: backing.id });
  }
  const { data, error } = await db
    .from("project_cancellation_refunds")
    .select(
      "id, cancellation_id, project_id, backing_id, requested_amount, status, stripe_refund_id, attempt_count, updated_at, backings!inner(stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, creator_stripe_account_id, gross_amount, creator_proceeds_amount, refund_amount, currency, paid_at)",
    )
    .eq("cancellation_id", cancellationId)
    .in("status", ["queued", "failed", "pending", "processing"])
    .order("created_at")
    .limit(limit);
  if (error) throw error;
  const results = [];
  for (const raw of data ?? []) {
    const work = raw as unknown as CancellationWork;
    results.push(await processOne(db, api, work));
  }
  await db.rpc("refresh_project_cancellation", { p_project_id: cancellation.project_id });
  return results;
}
