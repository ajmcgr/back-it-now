import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const stripe = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key?.startsWith("sk_live_")) throw new Error("stripe_live_key_required");
  return new Stripe(key);
};

async function deliverConfirmation(
  admin: ReturnType<typeof createClient>,
  deliveryId: string | null,
  backingId: string,
) {
  if (!deliveryId) return;
  const { data: delivery } = await admin
    .from("email_deliveries")
    .select("id, recipient_email, status")
    .eq("id", deliveryId)
    .single();
  if (!delivery || delivery.status === "sent") return;
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `backing-confirmation:${backingId}`,
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL") || "Backed <hello@backedit.co>",
      to: [delivery.recipient_email],
      subject: "Your Backed confirmation",
      html: "<p>Your backing is confirmed. If the campaign does not reach its goal by the deadline, it will be refunded.</p>",
    }),
  });
  if (!res.ok) {
    await admin
      .from("email_deliveries")
      .update({ status: "failed", last_error: "resend_delivery_failed" })
      .eq("id", delivery.id);
    return;
  }
  const result = await res.json();
  await admin
    .from("email_deliveries")
    .update({ status: "sent", resend_email_id: result.id, sent_at: new Date().toISOString() })
    .eq("id", delivery.id);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  try {
    const api = stripe();
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!secret?.startsWith("whsec_")) throw new Error("stripe_webhook_secret_required");
    const event = api.webhooks.constructEvent(
      await req.text(),
      req.headers.get("stripe-signature") ?? "",
      secret,
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: inserted } = await admin
      .from("webhook_events")
      .insert({ stripe_event_id: event.id, event_type: event.type });
    if (inserted?.code === "23505") return Response.json({ received: true, duplicate: true });
    if (inserted) throw inserted;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid" || !session.payment_intent)
        return Response.json({ received: true });
      const intent = await api.paymentIntents.retrieve(String(session.payment_intent), {
        expand: ["latest_charge.balance_transaction"],
      });
      const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
      const balance =
        charge && typeof charge.balance_transaction === "object"
          ? charge.balance_transaction
          : null;
      const { data, error } = await admin.rpc("finalize_stripe_checkout", {
        p_checkout_session_id: session.id,
        p_payment_intent_id: intent.id,
        p_processing_fee_amount: balance?.fee ?? 0,
        p_backer_email: session.customer_details?.email ?? "",
        p_stripe_charge_id: charge?.id ?? null,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (result) await deliverConfirmation(admin, result.email_delivery_id, result.backing_id);
    }
    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await admin.rpc("release_checkout_reservation", { p_checkout_session_id: session.id });
    }
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await admin
        .from("profiles")
        .update({
          stripe_onboarding_complete: account.details_submitted,
          stripe_charges_enabled: account.charges_enabled,
          stripe_payouts_enabled: account.payouts_enabled,
        })
        .eq("stripe_account_id", account.id);
    }
    if (event.type === "transfer.created") {
      const transfer = event.data.object as Stripe.Transfer;
      await admin
        .from("backings")
        .update({ transferred_at: new Date().toISOString(), transfer_failure_reason: null })
        .eq("stripe_transfer_id", transfer.id)
        .is("transferred_at", null);
    }
    if (event.type === "transfer.reversed") {
      const transfer = event.data.object as Stripe.Transfer;
      await admin
        .from("backings")
        .update({ transfer_failure_reason: "transfer_reversed" })
        .eq("stripe_transfer_id", transfer.id);
    }
    if (event.type === "refund.updated") {
      const refund = event.data.object as Stripe.Refund;
      const status =
        refund.status === "succeeded"
          ? "succeeded"
          : refund.status === "failed"
            ? "failed"
            : "pending";
      await admin
        .from("backings")
        .update({
          refund_status: status,
          refunded_at: status === "succeeded" ? new Date().toISOString() : null,
          status: status === "succeeded" ? "refunded" : "paid",
        })
        .eq("stripe_refund_id", refund.id);
    }
    return Response.json({ received: true });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "webhook_error", { status: 400 });
  }
});
