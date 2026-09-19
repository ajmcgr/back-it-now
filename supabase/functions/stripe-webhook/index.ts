import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { renderBackedEmail, sendResendEmail } from "../_shared/backed-email.ts";

const stripe = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key?.startsWith("sk_live_")) throw new Error("stripe_live_key_required");
  return new Stripe(key);
};
const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
type Admin = ReturnType<typeof adminClient>;

async function sendDelivery(
  admin: Admin,
  input: {
    key: string;
    event: string;
    backingId: string;
    to: string;
    subject: string;
    title: string;
    body: string;
    ctaLabel?: string;
    ctaUrl?: string;
  },
) {
  if (!input.to) return;
  await admin.from("email_deliveries").insert({
    dedupe_key: input.key,
    event_type: input.event,
    backing_id: input.backingId,
    recipient_email: input.to,
  });
  const { data: delivery } = await admin
    .from("email_deliveries")
    .select("id, status")
    .eq("dedupe_key", input.key)
    .maybeSingle();
  if (!delivery || delivery.status === "sent") return;
  const response = await sendResendEmail({
    to: input.to,
    subject: input.subject,
    email: renderBackedEmail({
      title: input.title,
      preheader: input.title,
      body: input.body,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
    }),
    idempotencyKey: input.key,
  });
  await admin
    .from("email_deliveries")
    .update(
      response.ok
        ? { status: "sent", sent_at: new Date().toISOString(), last_error: null }
        : { status: "failed", last_error: "resend_delivery_failed" },
    )
    .eq("id", delivery.id);
}

async function sendShareMilestones(admin: Admin, backingId: string) {
  const { data: backing } = await admin
    .from("backings")
    .select("project_id")
    .eq("id", backingId)
    .maybeSingle();
  if (!backing) return;
  const { data: project } = await admin
    .from("projects")
    .select(
      "id, slug, name, creator_id, funding_goal_amount, initial_backed_amount, successful_backed_amount, successful_backer_count",
    )
    .eq("id", backing.project_id)
    .maybeSingle();
  if (!project) return;
  const { data: creator } = await admin
    .from("profiles")
    .select("email")
    .eq("id", project.creator_id)
    .maybeSingle();
  if (!creator?.email) return;

  const amount = project.initial_backed_amount + project.successful_backed_amount;
  const percent = project.funding_goal_amount
    ? Math.floor((amount / project.funding_goal_amount) * 100)
    : 0;
  const milestones: Array<{ key: string; label: string }> = [];
  for (const count of [1, 5, 10, 25, 50, 100]) {
    if (project.successful_backer_count >= count)
      milestones.push({ key: `backers:${count}`, label: `${count} backers` });
  }
  for (const threshold of [25, 50, 75, 100]) {
    if (percent >= threshold)
      milestones.push({ key: `funded:${threshold}`, label: `${threshold}% funded` });
  }
  for (const milestone of milestones) {
    const { error } = await admin.from("project_share_milestones").insert({
      project_id: project.id,
      milestone_key: milestone.key,
    });
    if (error?.code === "23505") continue;
    if (error) continue;
    await sendDelivery(admin, {
      key: `project-milestone:${project.id}:${milestone.key}`,
      event: "project_milestone",
      backingId,
      to: creator.email,
      subject: `${project.name} just hit ${milestone.label}`,
      title: `${project.name} just hit ${milestone.label} 🎉`,
      body: `Your project now has ${Math.round(amount / 100)} backed and ${project.successful_backer_count} backers. Keep the momentum going.`,
      ctaLabel: `Share ${project.name}`,
      ctaUrl: `https://backedit.co/projects/${project.slug}?share=1`,
    });
  }
}

async function attemptCreatorTransfer(admin: Admin, api: Stripe, backingId: string) {
  const { data: backing } = await admin
    .from("backings")
    .select(
      "id, project_id, gross_amount, creator_proceeds_amount, currency, status, stripe_charge_id, stripe_transfer_id, refund_amount",
    )
    .eq("id", backingId)
    .maybeSingle();
  if (!backing || backing.status !== "paid" || backing.stripe_transfer_id) return;
  const { data: project } = await admin
    .from("projects")
    .select("creator_id")
    .eq("id", backing.project_id)
    .maybeSingle();
  const { data: creator } = project
    ? await admin
        .from("profiles")
        .select("stripe_account_id")
        .eq("id", project.creator_id)
        .maybeSingle()
    : { data: null };
  if (!creator?.stripe_account_id) {
    await admin
      .from("backings")
      .update({ transfer_status: "pending", transfer_failure_reason: "creator_connect_not_ready" })
      .eq("id", backing.id);
    return;
  }
  const account = await api.accounts.retrieve(creator.stripe_account_id);
  if (!account.payouts_enabled || account.capabilities?.transfers !== "active") {
    await admin
      .from("backings")
      .update({ transfer_status: "pending", transfer_failure_reason: "creator_payout_not_ready" })
      .eq("id", backing.id);
    return;
  }
  const refunded = Math.max(0, backing.refund_amount ?? 0);
  const reversalTarget = Math.min(
    backing.creator_proceeds_amount,
    Math.round((backing.creator_proceeds_amount * refunded) / backing.gross_amount),
  );
  const amount = Math.max(0, backing.creator_proceeds_amount - reversalTarget);
  if (amount === 0) {
    await admin
      .from("backings")
      .update({ transfer_status: "not_required", transfer_failure_reason: null })
      .eq("id", backing.id)
      .is("stripe_transfer_id", null);
    return;
  }
  if (!backing.stripe_charge_id) {
    await admin
      .from("backings")
      .update({ transfer_status: "failed", transfer_failure_reason: "missing_source_charge" })
      .eq("id", backing.id);
    return;
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
  await admin
    .from("backings")
    .update({
      stripe_transfer_id: transfer.id,
      transfer_status: "created",
      transfer_created_at: new Date().toISOString(),
      transfer_failure_reason: null,
    })
    .eq("id", backing.id)
    .is("stripe_transfer_id", null);
}

async function reverseCreatorTransfer(
  admin: Admin,
  api: Stripe,
  backingId: string,
  refundId: string,
) {
  const { data: backing } = await admin
    .from("backings")
    .select("id, gross_amount, creator_proceeds_amount, stripe_transfer_id")
    .eq("id", backingId)
    .maybeSingle();
  if (!backing?.stripe_transfer_id) return;
  const { data: refunds } = await admin
    .from("backing_refunds")
    .select("amount, status, transfer_reversal_amount, reversal_status")
    .eq("backing_id", backing.id);
  const succeeded = (refunds ?? []).filter((refund) => refund.status === "succeeded");
  const totalRefunded = succeeded.reduce((sum, refund) => sum + refund.amount, 0);
  const target = Math.min(
    backing.creator_proceeds_amount,
    Math.round((backing.creator_proceeds_amount * totalRefunded) / backing.gross_amount),
  );
  const allocated = (refunds ?? [])
    .filter((refund) => ["pending", "created", "confirmed"].includes(refund.reversal_status))
    .reduce((sum, refund) => sum + refund.transfer_reversal_amount, 0);
  const needed = Math.max(0, target - allocated);
  if (!needed) return;
  const reversal = await api.transfers.createReversal(
    backing.stripe_transfer_id,
    { amount: needed, metadata: { backed_backing_id: backing.id, backed_refund_id: refundId } },
    { idempotencyKey: `backed-transfer-reversal-${backing.id}-${refundId}` },
  );
  await admin
    .from("backing_refunds")
    .update({
      transfer_reversal_id: reversal.id,
      transfer_reversal_amount: needed,
      reversal_status: "created",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_refund_id", refundId)
    .is("transfer_reversal_id", null);
}

Deno.serve(async (req) => {
  try {
    const api = stripe();
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!secret?.startsWith("whsec_")) throw new Error("stripe_webhook_secret_required");
    const event = api.webhooks.constructEvent(
      await req.text(),
      req.headers.get("stripe-signature") ?? "",
      secret,
    );
    const admin = adminClient();
    const { data: prior } = await admin
      .from("webhook_events")
      .select("stripe_event_id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (prior) return Response.json({ received: true, duplicate: true });

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" && session.payment_intent) {
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
        if (result?.backing_id) {
          if (balance?.id)
            await admin
              .from("backings")
              .update({ stripe_balance_transaction_id: balance.id })
              .eq("id", result.backing_id);
          const { data: project } = await admin
            .from("projects")
            .select("id, slug, name, creator_id")
            .eq("id", result.project_id)
            .maybeSingle();
          await sendDelivery(admin, {
            key: `backing-confirmation:${result.backing_id}`,
            event: "backing_confirmation",
            backingId: result.backing_id,
            to: session.customer_details?.email ?? "",
            subject: "Your Backed confirmation",
            title: "Your backing is confirmed",
            body: "Thanks for backing this project. Your support has been recorded. Help make it happen by sharing the project with your community.",
            ctaLabel: project ? "Share project" : undefined,
            ctaUrl: project ? `https://backedit.co/projects/${project.slug}` : undefined,
          });
          const { data: creator } = project
            ? await admin
                .from("profiles")
                .select("email")
                .eq("id", project.creator_id)
                .maybeSingle()
            : { data: null };
          if (project && creator?.email)
            await sendDelivery(admin, {
              key: `creator-new-backing:${result.backing_id}`,
              event: "creator_new_backing",
              backingId: result.backing_id,
              to: creator.email,
              subject: `Someone backed ${project.name}`,
              title: `Someone backed ${project.name} 🎉`,
              body: "You have a new successful backing. Keep the momentum going by sharing your project.",
              ctaLabel: "Share your project",
              ctaUrl: `https://backedit.co/projects/${project.slug}?share=1`,
            });
          await sendShareMilestones(admin, result.backing_id);
          await attemptCreatorTransfer(admin, api, result.backing_id);
        }
      }
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
          stripe_requirements_due: account.requirements?.currently_due ?? [],
        })
        .eq("stripe_account_id", account.id);
    }

    if (event.type === "transfer.created") {
      const transfer = event.data.object as Stripe.Transfer;
      const { data: backing } = await admin
        .from("backings")
        .update({
          transfer_status: "confirmed",
          transferred_at: new Date().toISOString(),
          transfer_failure_reason: null,
        })
        .eq("stripe_transfer_id", transfer.id)
        .select("id, project_id")
        .maybeSingle();
      if (backing) {
        const { data: project } = await admin
          .from("projects")
          .select("creator_id")
          .eq("id", backing.project_id)
          .maybeSingle();
        const { data: creator } = project
          ? await admin.from("profiles").select("email").eq("id", project.creator_id).maybeSingle()
          : { data: null };
        if (creator?.email)
          await sendDelivery(admin, {
            key: `creator-transfer:${backing.id}:${transfer.id}`,
            event: "creator_transfer",
            backingId: backing.id,
            to: creator.email,
            subject: "Creator funds are on the way",
            title: "Creator funds allocated",
            body: "A backing has been allocated to your connected Stripe account. Stripe handles payout timing to your bank account.",
          });
      }
    }

    if (event.type === "transfer.reversed") {
      const transfer = event.data.object as Stripe.Transfer;
      await admin
        .from("backings")
        .update({ transfer_status: "reversed", transfer_reversed_at: new Date().toISOString() })
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
      const { data: backingId, error } = await admin.rpc("record_stripe_refund", {
        p_stripe_refund_id: refund.id,
        p_payment_intent_id: String(refund.payment_intent),
        p_amount: refund.amount,
        p_status: status,
      });
      if (error) throw error;
      if (backingId && status === "succeeded") {
        await reverseCreatorTransfer(admin, api, backingId, refund.id);
        const { data: backing } = await admin
          .from("backings")
          .select("backer_email")
          .eq("id", backingId)
          .maybeSingle();
        if (backing?.backer_email)
          await sendDelivery(admin, {
            key: `refund:${refund.id}`,
            event: "refund_confirmation",
            backingId,
            to: backing.backer_email,
            subject: "Your Backed refund",
            title: "Your refund is confirmed",
            body: "Your refund has been issued through Stripe. Your bank may take additional time to post it.",
          });
      }
    }

    if (event.type.startsWith("charge.dispute.")) {
      const dispute = event.data.object as Stripe.Dispute;
      const status = ["needs_response", "under_review", "won", "lost"].includes(dispute.status)
        ? dispute.status
        : "under_review";
      await admin.rpc("record_stripe_dispute", {
        p_stripe_dispute_id: dispute.id,
        p_payment_intent_id: String(dispute.payment_intent),
        p_amount: dispute.amount,
        p_status: status,
      });
    }

    const { error: auditError } = await admin
      .from("webhook_events")
      .insert({ stripe_event_id: event.id, event_type: event.type });
    if (auditError?.code !== "23505" && auditError) throw auditError;
    return Response.json({ received: true });
  } catch {
    return new Response("webhook_error", { status: 400 });
  }
});
