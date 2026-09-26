import { publicSupabase } from "@/lib/supabase";

export const BLOG_FALLBACK_IMAGE = "/header-logo.png";

export type BlogImage = {
  slug: string;
  publicUrl: string;
  updatedAt: string;
};

export async function loadBlogImages() {
  if (!publicSupabase) return new Map<string, BlogImage>();

  const { data, error } = await publicSupabase
    .from("blog_images")
    .select("slug, public_url, updated_at");
  if (error) return new Map<string, BlogImage>();

  return new Map(
    (data ?? []).map((image) => [
      image.slug,
      {
        slug: image.slug,
        publicUrl: image.public_url,
        updatedAt: image.updated_at,
      },
    ]),
  );
}

export function resolveBlogImage(images: Map<string, BlogImage>, slug: string) {
  return images.get(slug)?.publicUrl ?? BLOG_FALLBACK_IMAGE;
}
