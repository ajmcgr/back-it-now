import { supabase } from "@/lib/supabase";

export type FavoriteState = {
  isFavorited: boolean;
  favoriteCount: number;
};

function fromRow(row: Record<string, unknown> | null | undefined): FavoriteState {
  return {
    isFavorited: row?.["is_favorited"] === true,
    favoriteCount:
      typeof row?.["favorite_count"] === "number" ? Math.max(0, row["favorite_count"]) : 0,
  };
}

export async function loadProjectFavoriteState(slug: string): Promise<FavoriteState | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await supabase.rpc("get_project_favorite_state", {
    p_project_slug: slug,
  });
  if (error) throw new Error("favorite_state_unavailable");
  return fromRow((data?.[0] as Record<string, unknown> | undefined) ?? null);
}

export async function setProjectFavorite(slug: string, favorite: boolean) {
  if (!supabase) throw new Error("favorites_unavailable");
  const { data, error } = await supabase.rpc("set_project_favorite", {
    p_project_slug: slug,
    p_favorite: favorite,
  });
  if (error) throw new Error("favorite_update_failed");
  return fromRow((data?.[0] as Record<string, unknown> | undefined) ?? null);
}
