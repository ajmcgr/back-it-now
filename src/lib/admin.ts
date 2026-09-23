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

export async function invokeAdmin<T>(action: string, payload: Record<string, unknown> = {}) {
  if (!supabase) throw new Error("admin_unavailable");
  const { data, error } = await supabase.functions.invoke("admin-projects", {
    body: { action, ...payload },
  });
  if (error || data?.error) throw new Error(data?.error || "admin_request_failed");
  return data as T;
}
