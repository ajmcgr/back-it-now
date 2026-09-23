import { supabase } from "@/lib/supabase";

export type CreatorFollowState = {
  isFollowing: boolean;
  followerCount: number;
};

function fromRow(row: Record<string, unknown> | null | undefined): CreatorFollowState {
  return {
    isFollowing: row?.["is_following"] === true,
    followerCount:
      typeof row?.["follower_count"] === "number" ? Math.max(0, row["follower_count"]) : 0,
  };
}

export async function loadCreatorFollowState(username: string) {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await supabase.rpc("get_creator_follow_state", {
    p_creator_username: username,
  });
  if (error) throw new Error("creator_follow_state_unavailable");
  return fromRow((data?.[0] as Record<string, unknown> | undefined) ?? null);
}

export async function setCreatorFollow(username: string, follow: boolean) {
  if (!supabase) throw new Error("creator_follow_unavailable");
  const { data, error } = await supabase.rpc("set_creator_follow", {
    p_creator_username: username,
    p_follow: follow,
  });
  if (error) throw new Error("creator_follow_update_failed");
  return fromRow((data?.[0] as Record<string, unknown> | undefined) ?? null);
}
