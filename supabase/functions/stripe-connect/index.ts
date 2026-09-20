import Stripe from "npm:stripe@18.5.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";

const origin = "https://backedit.co";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const stripe = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key?.startsWith("sk_live_") && !key?.startsWith("rk_live_"))
    throw new Error("stripe_live_key_required");
  return new Stripe(key);
};

type Profile = {
  stripe_account_id: string | null;
  stripe_connect_generation: number;
  stripe_reset_in_progress: boolean;
};

type ResetResult = {
  eligible: boolean;
  reason: string | null;
  contactSupport: boolean;
};

type ResetClaim = {
  claimed?: boolean;
  reason?: string;
  resetId?: string;
  recoverable?: boolean;
};

const isDeletedAccount = (
  account: Stripe.Account | Stripe.DeletedAccount,
): account is Stripe.DeletedAccount => "deleted" in account && account.deleted === true;

const needsSupport = (reason: string | null) =>
  [
    "financial_history",
    "unresolved_refunds",
    "unresolved_disputes",
    "stripe_balance",
    "stripe_payout_history",
    "stripe_account_not_deletable",
    "stripe_account_ownership",
  ].includes(reason ?? "");

const resetResult = (eligible: boolean, reason: string | null): ResetResult => ({
  eligible,
  reason,
  contactSupport: !eligible && needsSupport(reason),
});

async function inspectStripeReset(
  api: Stripe,
  account: Stripe.Account | Stripe.DeletedAccount,
  profileId: string,
): Promise<ResetResult> {
  if (isDeletedAccount(account)) return resetResult(false, "stripe_account_deleted");
  if (account.metadata?.backed_profile_id !== profileId)
    return resetResult(false, "stripe_account_ownership");
  if (account.details_submitted) return resetResult(false, "onboarding_complete");

  const controllerLosses = account.controller?.losses?.payments;
  const platformControlled = account.type === "express" || account.type === "custom";
  if (!platformControlled || (controllerLosses && controllerLosses !== "application"))
    return resetResult(false, "stripe_account_not_deletable");

  const [balance, payouts] = await Promise.all([
    api.balance.retrieve({ stripeAccount: account.id }),
    api.payouts.list({ limit: 1 }, { stripeAccount: account.id }),
  ]);
  const balanceBuckets = [
    balance.available,
    balance.pending,
    balance.connect_reserved ?? [],
    balance.instant_available ?? [],
    balance.refund_and_dispute_prefunding?.available ?? [],
    balance.refund_and_dispute_prefunding?.pending ?? [],
  ];
  if (balanceBuckets.some((bucket) => bucket.some((entry) => entry.amount !== 0)))
    return resetResult(false, "stripe_balance");
  if (payouts.data.length > 0) return resetResult(false, "stripe_payout_history");
  return resetResult(true, null);
}

async function inspectReset(
  admin: SupabaseClient,
  api: Stripe,
  profileId: string,
  account: Stripe.Account | Stripe.DeletedAccount,
): Promise<ResetResult> {
  const { data, error } = await admin.rpc("inspect_stripe_connect_reset", {
    p_profile_id: profileId,
    p_stripe_account_id: account.id,
  });
  if (error) throw error;
  if (!data?.eligible) return resetResult(false, data?.reason ?? "financial_history");
  return inspectStripeReset(api, account, profileId);
}

async function releaseReset(
  admin: SupabaseClient,
  profileId: string,
  accountId: string,
  resetId: string,
  failureCode: string,
) {
  const { error } = await admin.rpc("release_stripe_connect_reset", {
    p_profile_id: profileId,
    p_stripe_account_id: accountId,
    p_reset_id: resetId,
    p_failure_code: failureCode,
  });
  if (error) console.error("stripe_connect_reset_release_failed", error.message);
}

async function completeReset(
  admin: SupabaseClient,
  profileId: string,
  accountId: string,
  resetId: string,
) {
  const { data, error } = await admin.rpc("complete_stripe_connect_reset", {
    p_profile_id: profileId,
    p_stripe_account_id: accountId,
    p_reset_id: resetId,
  });
  if (error || data !== true) throw error ?? new Error("reset_completion_failed");
}

function stripeFailureCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string")
    return error.code;
  return "stripe_delete_failed";
}

async function resetConnectAccount(
  admin: SupabaseClient,
  api: Stripe,
  profileId: string,
  accountId: string,
) {
  const { data, error } = await admin.rpc("claim_stripe_connect_reset", {
    p_profile_id: profileId,
    p_stripe_account_id: accountId,
  });
  if (error) throw error;
  const claim = (data ?? {}) as ResetClaim;
  if (!claim.claimed && !(claim.reason === "reset_in_progress" && claim.recoverable)) {
    return response(
      {
        error: claim.reason === "reset_in_progress" ? "reset_in_progress" : "reset_not_available",
        contactSupport: needsSupport(claim.reason ?? null),
      },
      409,
    );
  }
  if (!claim.resetId) throw new Error("reset_claim_missing");

  let deletionAttempted = false;
  try {
    const account = await api.accounts.retrieve(accountId);
    if (isDeletedAccount(account)) {
      await completeReset(admin, profileId, accountId, claim.resetId);
      return response({ reset: true, alreadyDeleted: true });
    }
    // The atomic database claim already revalidated all Backed financial state.
    // While claimed, the profile is intentionally marked reset-in-progress.
    const eligibility = await inspectStripeReset(api, account, profileId);
    if (!eligibility.eligible) {
      await releaseReset(
        admin,
        profileId,
        accountId,
        claim.resetId,
        eligibility.reason ?? "unsafe",
      );
      return response(
        {
          error: "reset_not_available",
          contactSupport: eligibility.contactSupport,
        },
        409,
      );
    }

    deletionAttempted = true;
    const deleted = await api.accounts.del(accountId);
    if (!deleted.deleted) throw new Error("stripe_delete_not_confirmed");
    await completeReset(admin, profileId, accountId, claim.resetId);
    return response({ reset: true });
  } catch (error) {
    const failureCode = stripeFailureCode(error);
    console.error(
      "stripe_connect_reset_failed",
      failureCode,
      error instanceof Error ? error.message : "unknown_error",
    );

    // A network failure can happen after Stripe has accepted deletion. Confirm
    // the account state before deciding whether it is safe to release the lock.
    if (deletionAttempted) {
      try {
        const account = await api.accounts.retrieve(accountId);
        if (isDeletedAccount(account)) {
          await completeReset(admin, profileId, accountId, claim.resetId);
          return response({ reset: true, recovered: true });
        }
        await releaseReset(admin, profileId, accountId, claim.resetId, failureCode);
      } catch (recoveryError) {
        console.error(
          "stripe_connect_reset_recovery_failed",
          recoveryError instanceof Error ? recoveryError.message : "unknown_error",
        );
      }
    } else {
      await releaseReset(admin, profileId, accountId, claim.resetId, failureCode);
    }
    return response({ error: "reset_failed_unchanged" }, 502);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return response({ error: "authentication_required" }, 401);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return response({ error: "authentication_required" }, 401);
    const { action = "onboarding", confirmation } = await req
      .json()
      .catch(() => ({ action: "onboarding", confirmation: undefined }));
    if (!["onboarding", "dashboard", "status", "reset"].includes(action))
      return response({ error: "invalid_action" }, 400);
    if (action === "reset" && confirmation !== "START_OVER")
      return response({ error: "confirmation_required" }, 400);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_account_id, stripe_connect_generation, stripe_reset_in_progress")
      .eq("id", auth.user.id)
      .single<Profile>();
    if (profileError || !profile) return response({ error: "profile_unavailable" }, 409);
    const api = stripe();

    if (action === "reset") {
      if (!profile.stripe_account_id) return response({ reset: true, alreadyReset: true });
      return resetConnectAccount(admin, api, auth.user.id, profile.stripe_account_id);
    }

    if (profile.stripe_reset_in_progress) return response({ error: "reset_in_progress" }, 409);

    let account: Stripe.Account | Stripe.DeletedAccount | null = profile.stripe_account_id
      ? await api.accounts.retrieve(profile.stripe_account_id)
      : null;

    if (account && isDeletedAccount(account))
      return response({ error: "connect_account_unavailable" }, 409);

    if (!account && action === "status")
      return response({ account: null, reset: resetResult(false, null) });
    if (!account && action === "dashboard")
      return response({ error: "connect_account_unavailable" }, 409);

    if (!account) {
      const created = await api.accounts.create(
        {
          type: "express",
          email: auth.user.email ?? undefined,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { backed_profile_id: auth.user.id },
        },
        {
          idempotencyKey: `backed-connect-account-${auth.user.id}-${profile.stripe_connect_generation}`,
        },
      );
      const { data: associated, error: updateError } = await admin
        .from("profiles")
        .update({
          stripe_account_id: created.id,
          stripe_onboarding_complete: created.details_submitted,
          stripe_charges_enabled: created.charges_enabled,
          stripe_payouts_enabled: created.payouts_enabled,
          stripe_requirements_due: created.requirements?.currently_due ?? [],
        })
        .eq("id", auth.user.id)
        .eq("stripe_connect_generation", profile.stripe_connect_generation)
        .eq("stripe_reset_in_progress", false)
        .is("stripe_account_id", null)
        .select("stripe_account_id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (associated?.stripe_account_id !== created.id) {
        const { data: current, error: currentError } = await admin
          .from("profiles")
          .select("stripe_account_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (currentError || current?.stripe_account_id !== created.id)
          throw currentError ?? new Error("connect_account_association_failed");
      }
      const { error: auditError } = await admin.rpc("record_stripe_connect_replacement", {
        p_profile_id: auth.user.id,
        p_new_stripe_account_id: created.id,
      });
      if (auditError) console.error("stripe_connect_replacement_audit_failed", auditError.message);
      account = created;
    } else {
      const { error: updateError } = await admin
        .from("profiles")
        .update({
          stripe_onboarding_complete: account.details_submitted,
          stripe_charges_enabled: account.charges_enabled,
          stripe_payouts_enabled: account.payouts_enabled,
          stripe_requirements_due: account.requirements?.currently_due ?? [],
        })
        .eq("id", auth.user.id)
        .eq("stripe_account_id", account.id)
        .eq("stripe_reset_in_progress", false);
      if (updateError) throw updateError;
    }

    if (action === "status") {
      const reset = await inspectReset(admin, api, auth.user.id, account);
      return response({
        account: {
          detailsSubmitted: account.details_submitted,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          requirementsDue: account.requirements?.currently_due ?? [],
          requirementsPastDue: account.requirements?.past_due ?? [],
          requirementsPendingVerification: account.requirements?.pending_verification ?? [],
          disabledReason: account.requirements?.disabled_reason ?? null,
        },
        reset,
      });
    }
    if (action === "dashboard" && account.details_submitted) {
      const login = await api.accounts.createLoginLink(account.id);
      return response({ onboardingUrl: login.url });
    }
    const link = await api.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      refresh_url: `${origin}/settings?stripe=refresh`,
      return_url: `${origin}/settings?stripe=return`,
    });
    return response({ onboardingUrl: link.url });
  } catch (error) {
    console.error(
      "stripe_connect_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return response({ error: "connect_unavailable" }, 500);
  }
});
