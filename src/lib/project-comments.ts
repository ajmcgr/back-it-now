import { publicSupabase, supabase } from "@/lib/supabase";

export type ProjectComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isCreator: boolean;
  isOwn: boolean;
  canModerate: boolean;
};

type ProjectCommentRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_creator: boolean;
  is_own: boolean;
  can_moderate: boolean;
};

const fromRow = (row: ProjectCommentRow): ProjectComment => ({
  id: row.id,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  displayName: row.display_name,
  username: row.username,
  avatarUrl: row.avatar_url,
  isCreator: row.is_creator,
  isOwn: row.is_own,
  canModerate: row.can_moderate,
});

export async function loadProjectComments(slug: string, authenticated = false) {
  const client = authenticated ? supabase : publicSupabase;
  if (!client) return [];
  const { data, error } = await client.rpc("list_project_comments", {
    p_project_slug: slug,
  });
  if (error) throw new Error("Comments are temporarily unavailable.");
  return ((data ?? []) as ProjectCommentRow[]).map(fromRow);
}
