import { publicSupabase } from "@/lib/supabase";

export type ProjectUpdate = {
  id: string;
  title: string;
  body: string;
  imagePath: string | null;
  imageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
};

type PublicProjectUpdateRow = {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  published_at: string;
  updated_at: string;
};

const publicImageUrl = (path: string | null) => {
  if (!path || !publicSupabase) return null;
  return publicSupabase.storage.from("project-media").getPublicUrl(path).data.publicUrl;
};

const fromRow = (row: PublicProjectUpdateRow): ProjectUpdate => ({
  id: row.id,
  title: row.title,
  body: row.body,
  imagePath: row.image_path,
  imageUrl: publicImageUrl(row.image_path),
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
});

export async function loadProjectUpdates(slug: string, updateId?: string) {
  if (!publicSupabase) return [];
  const { data, error } = await publicSupabase.rpc("list_project_updates", {
    p_project_slug: slug,
    p_update_id: updateId ?? null,
  });
  if (error) throw new Error("Project updates are temporarily unavailable.");
  return ((data ?? []) as PublicProjectUpdateRow[]).map(fromRow);
}

export const projectUpdateUrl = (slug: string, updateId: string) =>
  `https://backedit.co/projects/${slug}/updates/${updateId}`;

export function projectUpdateShareUrls(
  slug: string,
  projectName: string,
  update: Pick<ProjectUpdate, "id" | "title">,
) {
  const url = projectUpdateUrl(slug, update.id);
  const copy = `New update from ${projectName}: ${update.title}`;
  const withUtm = (source: string) =>
    `${url}?utm_source=${encodeURIComponent(source)}&utm_medium=social&utm_campaign=project_update`;
  return {
    url,
    x: `https://x.com/intent/post?text=${encodeURIComponent(`${copy}\n\n${withUtm("x")}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(withUtm("linkedin"))}`,
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(withUtm("reddit"))}&title=${encodeURIComponent(copy)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${copy}\n\n${withUtm("whatsapp")}`)}`,
  };
}
