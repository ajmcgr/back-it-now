export type CreatorPayoutProfile = {
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_requirements_due: string[];
  stripe_requirements_past_due: string[];
  stripe_requirements_pending_verification: string[];
  stripe_disabled_reason: string | null;
};

export type StripeStatusResponse = {
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  requirementsDue?: unknown;
  requirementsPastDue?: unknown;
  requirementsPendingVerification?: unknown;
  disabledReason?: unknown;
};

export type PayoutState =
  "not_connected" | "incomplete" | "pending" | "action_required" | "payouts_not_ready" | "ready";

export type PayoutContent = {
  heading: string;
  copy: string;
  cta: string | null;
  action: "onboarding" | "dashboard";
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function applyStripeStatus<T extends CreatorPayoutProfile>(
  profile: T,
  account: StripeStatusResponse,
): T {
  return {
    ...profile,
    stripe_onboarding_complete: Boolean(account.detailsSubmitted),
    stripe_charges_enabled: Boolean(account.chargesEnabled),
    stripe_payouts_enabled: Boolean(account.payoutsEnabled),
    stripe_requirements_due: stringArray(account.requirementsDue),
    stripe_requirements_past_due: stringArray(account.requirementsPastDue),
    stripe_requirements_pending_verification: stringArray(account.requirementsPendingVerification),
    stripe_disabled_reason:
      typeof account.disabledReason === "string" ? account.disabledReason : null,
  };
}

export function getPayoutState(profile: CreatorPayoutProfile): PayoutState {
  if (!profile.stripe_account_id) return "not_connected";
  if (profile.stripe_charges_enabled && profile.stripe_payouts_enabled) return "ready";
  if (!profile.stripe_onboarding_complete) return "incomplete";

  const disabledReason = profile.stripe_disabled_reason ?? "";
  const isUnderReview =
    profile.stripe_requirements_pending_verification.length > 0 ||
    disabledReason === "under_review" ||
    disabledReason === "requirements.pending_verification";
  if (isUnderReview) return "pending";

  const needsAction =
    profile.stripe_requirements_due.length > 0 ||
    profile.stripe_requirements_past_due.length > 0 ||
    disabledReason.startsWith("requirements.") ||
    disabledReason.startsWith("action_required.") ||
    disabledReason.startsWith("rejected.");
  if (needsAction) return "action_required";
  if (profile.stripe_charges_enabled && !profile.stripe_payouts_enabled) return "payouts_not_ready";
  return "pending";
}

export const payoutContent: Record<PayoutState, PayoutContent> = {
  not_connected: {
    heading: "Set up payouts",
    copy: "Connect with Stripe to receive money from projects you create on Backed.",
    cta: "Set up payouts",
    action: "onboarding",
  },
  incomplete: {
    heading: "Finish setting up payouts",
    copy: "Stripe needs a few more details before you can receive payouts.",
    cta: "Resume Stripe setup",
    action: "onboarding",
  },
  pending: {
    heading: "Payout setup is being reviewed",
    copy: "Stripe is reviewing your information. We'll update your payout status when the review is complete.",
    cta: "View Stripe account",
    action: "dashboard",
  },
  action_required: {
    heading: "Action required for payouts",
    copy: "Stripe needs some additional information before you can receive payouts.",
    cta: "Update Stripe details",
    action: "onboarding",
  },
  payouts_not_ready: {
    heading: "Payouts aren't ready yet",
    copy: "Your Stripe account is connected, but payouts to your bank aren't available yet.",
    cta: "Review Stripe account",
    action: "dashboard",
  },
  ready: {
    heading: "Payouts are ready",
    copy: "Your Stripe account is connected and ready to receive creator proceeds.",
    cta: "Manage payouts",
    action: "dashboard",
  },
};
