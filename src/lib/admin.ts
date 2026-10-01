import { supabase } from "@/lib/supabase";

export type AdminTotals = {
  users: number;
  projects: number;
  amountBacked: number;
  backers: number;
  comments: number;
};

export type AdminOverview = {
  totals: AdminTotals;
  pastSevenDays: AdminTotals;
};

export type AdminProjectComplianceFlag = {
  reason: string;
  status: "open" | "resolved";
};

export type AdminProjectAttestation = {
  id: string;
  accepted_at: string;
  acceptable_use_version: string;
  terms_version: string;
  attestation_type: string;
  benefits_third_party_or_cause: boolean;
};

export type AdminProjectReview = {
  reviewed_at: string;
  review_outcome: "approved" | "rejected" | "needs_information";
  review_note: string;
  evidence_urls: string[];
  stripe_connect_ready: boolean;
  acceptable_use_version: string;
};

export type AdminProjectReward = {
  title: string;
  description: string;
  amount: number;
  total_quantity: number;
};

export type AdminProject = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  image_url: string | null;
  gallery_media: unknown;
  category: string;
  external_website: string | null;
  location: string | null;
  project_dates: string | null;
  funding_goal_amount: number;
  deadline_at: string | null;
  status: string;
  initial_backed_amount: number;
  successful_backed_amount: number;
  created_at: string;
  admin_archived_at: string | null;
  compliance_review_status:
    "not_required" | "pending" | "needs_information" | "approved" | "rejected";
  compliance_intended_status: "live" | "prelaunch" | null;
  compliance_benefits_third_party_or_cause: boolean | null;
  compliance_reviewed_at: string | null;
  compliance_review_outcome: "approved" | "rejected" | "needs_information" | null;
  project_compliance_flags: AdminProjectComplianceFlag[] | AdminProjectComplianceFlag | null;
  project_compliance_attestations: AdminProjectAttestation[] | AdminProjectAttestation | null;
  project_compliance_reviews: AdminProjectReview[] | AdminProjectReview | null;
  rewards: AdminProjectReward[] | AdminProjectReward | null;
  profiles: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
    stripe_requirements_due: string[];
  };
  project_cancellations: {
    status: string;
    eligible_refund_count: number;
    eligible_refund_amount: number;
    project_cancellation_refunds: Array<{ status: string; requested_amount: number }>;
  } | null;
};

export async function retryProjectCancellation(slug: string) {
  if (!supabase) throw new Error("admin_unavailable");
  const { data, error } = await supabase.functions.invoke("project-cancellation", {
    body: { action: "retry", slug },
  });
  if (error || data?.error) throw new Error(data?.error || "cancellation_retry_failed");
  return data;
}

export async function loadProjectCancellationSummaries() {
  if (!supabase) throw new Error("admin_unavailable");
  const { data, error } = await supabase.functions.invoke("project-cancellation", {
    body: { action: "admin-list" },
  });
  if (error || data?.error) throw new Error(data?.error || "cancellation_list_failed");
  return (data?.cancellations ?? []) as Array<{
    project_id: string;
    status: string;
    eligible_refund_count: number;
    eligible_refund_amount: number;
    project_cancellation_refunds: Array<{ status: string; requested_amount: number }>;
  }>;
}

export type AdminUser = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  is_admin: boolean;
  receive_product_news: boolean;
  newsletter_sync_status: "not_subscribed" | "pending" | "subscribed" | "failed" | "no_email";
};

export type AdminComment = {
  id: string;
  body: string;
  created_at: string;
  profiles: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  projects: { id: string; slug: string; name: string };
};

export type AdminNewsletterPeriod = "week" | "month" | "all";

export type AdminNewsletterProject = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  image_url: string | null;
  category: string;
  creator_name: string;
  backed_amount: number;
  backer_count: number;
  favorite_count: number;
  comment_count: number;
  status: "prelaunch" | "live";
  url: string;
};

export type AdminNewsletterSections = {
  trending: AdminNewsletterProject[];
  latest: AdminNewsletterProject[];
  mostBacked: AdminNewsletterProject[];
  mostFavorited: AdminNewsletterProject[];
  mostDiscussed: AdminNewsletterProject[];
};

export type AdminNewsletterResponse = {
  period: AdminNewsletterPeriod;
  sections: AdminNewsletterSections;
};

export async function invokeAdmin<T>(action: string, payload: Record<string, unknown> = {}) {
  if (!supabase) throw new Error("admin_unavailable");
  const { data, error } = await supabase.functions.invoke("admin-projects", {
    body: { action, ...payload },
  });
  if (error || data?.error) throw new Error(data?.error || "admin_request_failed");
  return data as T;
}
