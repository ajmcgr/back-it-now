import type Stripe from "npm:stripe@18.5.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";

type CheckoutIntent = {
  project_id: string;
  reward_id: string | null;
  reservation_id: string | null;
  backer_id: string | null;
  amount: number;
  currency: string;
  released_at: string | null;
};

export class CheckoutReconciliationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 409,
  ) {
    super(code);
  }
}

const normalizeOptionalId = (value: string | null | undefined) => value || null;

export async function finalizeBackingFromStripe(
  api: Stripe,
  admin: SupabaseClient,
  input: {
    sessionId: string;
    expectedProjectSlug?: string;
    requesterId?: string | null;
    trustedWebhook?: boolean;
  },
) {
  if (!/^cs_live_[A-Za-z0-9]+$/.test(input.sessionId))
    throw new CheckoutReconciliationError("invalid_checkout_session", 400);

  const session = await api.checkout.sessions.retrieve(input.sessionId, {
    expand: ["payment_intent.latest_charge.balance_transaction"],
  });
  if (!session.livemode || session.mode !== "payment")
    throw new CheckoutReconciliationError("invalid_checkout_environment");
  if (session.status !== "complete" || session.payment_status !== "paid")
    throw new CheckoutReconciliationError("payment_not_confirmed");

  const { data: checkoutIntent, error: intentError } = await admin
    .from("checkout_backing_intents")
    .select("project_id, reward_id, reservation_id, backer_id, amount, currency, released_at")
    .eq("checkout_session_id", session.id)
    .maybeSingle();
  const intent = checkoutIntent as CheckoutIntent | null;
  if (intentError || !intent) throw new CheckoutReconciliationError("checkout_not_found", 404);
  if (intent.released_at) throw new CheckoutReconciliationError("checkout_released");
  if (!input.trustedWebhook && intent.backer_id && input.requesterId !== intent.backer_id)
    throw new CheckoutReconciliationError("checkout_owner_mismatch", 403);

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, slug")
    .eq("id", intent.project_id)
    .maybeSingle();
  if (projectError || !project) throw new CheckoutReconciliationError("project_not_found", 404);
  if (input.expectedProjectSlug && project.slug !== input.expectedProjectSlug)
    throw new CheckoutReconciliationError("checkout_project_mismatch", 403);

  if (
    normalizeOptionalId(session.metadata?.project_id) !== intent.project_id ||
    normalizeOptionalId(session.metadata?.reward_id) !== intent.reward_id ||
    normalizeOptionalId(session.metadata?.reservation_id) !== intent.reservation_id
  )
    throw new CheckoutReconciliationError("checkout_metadata_mismatch");
  if (session.amount_total !== intent.amount || session.currency !== intent.currency.toLowerCase())
    throw new CheckoutReconciliationError("checkout_amount_mismatch");

  let paymentIntent: Stripe.PaymentIntent;
  if (typeof session.payment_intent === "object" && session.payment_intent)
    paymentIntent = session.payment_intent as Stripe.PaymentIntent;
  else if (typeof session.payment_intent === "string")
    paymentIntent = await api.paymentIntents.retrieve(session.payment_intent, {
      expand: ["latest_charge.balance_transaction"],
    });
  else throw new CheckoutReconciliationError("payment_intent_missing");

  if (
    !paymentIntent.livemode ||
    paymentIntent.status !== "succeeded" ||
    paymentIntent.amount_received < intent.amount ||
    paymentIntent.currency !== intent.currency.toLowerCase() ||
    normalizeOptionalId(paymentIntent.metadata?.project_id) !== intent.project_id ||
    normalizeOptionalId(paymentIntent.metadata?.reward_id) !== intent.reward_id ||
    normalizeOptionalId(paymentIntent.metadata?.reservation_id) !== intent.reservation_id
  )
    throw new CheckoutReconciliationError("payment_intent_mismatch");

  const stripeEmail = session.customer_details?.email ?? session.customer_email ?? "";
  if (intent.backer_id) {
    const { data: authUser } = await admin.auth.admin.getUserById(intent.backer_id);
    const canonicalEmail = authUser.user?.email?.trim().toLowerCase();
    if (canonicalEmail && stripeEmail.trim().toLowerCase() !== canonicalEmail)
      throw new CheckoutReconciliationError("checkout_identity_mismatch", 403);
  }

  const charge =
    typeof paymentIntent.latest_charge === "object" ? paymentIntent.latest_charge : null;
  if (!charge || charge.status !== "succeeded" || charge.paid !== true)
    throw new CheckoutReconciliationError("charge_not_confirmed");
  const balance =
    typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;

  const { data, error } = await admin.rpc("finalize_stripe_checkout", {
    p_checkout_session_id: session.id,
    p_payment_intent_id: paymentIntent.id,
    p_processing_fee_amount: balance?.fee ?? 0,
    p_backer_email: stripeEmail,
    p_stripe_charge_id: charge.id,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.backing_id) throw new CheckoutReconciliationError("backing_not_finalized", 500);

  if (balance?.id) {
    const { error: balanceError } = await admin
      .from("backings")
      .update({ stripe_balance_transaction_id: balance.id })
      .eq("id", result.backing_id);
    if (balanceError) throw balanceError;
  }

  return {
    backingId: result.backing_id as string,
    projectId: result.project_id as string,
    projectSlug: project.slug as string,
    amount: intent.amount,
    currency: intent.currency,
    customerEmail: stripeEmail,
  };
}
