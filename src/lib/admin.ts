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

export type AdminProject = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  status: string;
  initial_backed_amount: number;
  successful_backed_amount: number;
  created_at: string;
  admin_archived_at: string | null;
  profiles: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type AdminUser = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  is_admin: boolean;
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
