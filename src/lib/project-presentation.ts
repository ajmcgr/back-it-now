import { useEffect, useState } from "react";
import { projects } from "@/lib/projects";
import { publicSupabase } from "@/lib/supabase";

export type CanonicalProjectCreator = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type CanonicalProjectPresentation = {
  creator: CanonicalProjectCreator;
  imageUrl: string | null;
  rewardAvailableQuantity: number | null;
};

type CoverSource = {
  slug: string;
  imageUrl?: string | null;
  coverImage?: string | null;
  gallery?: string[] | null;
};

function usableImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Resolve public project media the same way on every surface. Database cover
 * media takes precedence; legacy catalog media is retained solely as a
 * read-only fallback for existing projects that have not stored image_url.
 */
export function resolveProjectCover({ slug, imageUrl, coverImage, gallery }: CoverSource) {
  const catalogProject = projects.find((project) => project.slug === slug);
  return (
    usableImageUrl(imageUrl) ??
    usableImageUrl(coverImage) ??
    usableImageUrl(gallery?.[0]) ??
    usableImageUrl(catalogProject?.coverImage) ??
    usableImageUrl(catalogProject?.gallery[0])
  );
}

/**
 * Public creator data is always derived from projects.creator_id -> profiles,
 * never from local seed strings or project title fields.
 */
export function useCanonicalProjectPresentation(slug: string) {
  const [presentation, setPresentation] = useState<CanonicalProjectPresentation | null>(null);

  useEffect(() => {
    let active = true;

    if (!publicSupabase) {
      setPresentation(null);
      return () => {
        active = false;
      };
    }

    void publicSupabase
      .from("public_profile_projects")
      .select(
        "creator_username, creator_display_name, creator_avatar_url, image_url, reward_available_quantity",
      )
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error || !data?.creator_username) return;
        setPresentation({
          creator: {
            username: data.creator_username,
            displayName: data.creator_display_name,
            avatarUrl: data.creator_avatar_url,
          },
          imageUrl: data.image_url,
          rewardAvailableQuantity:
            typeof data.reward_available_quantity === "number"
              ? data.reward_available_quantity
              : null,
        });
      });

    return () => {
      active = false;
    };
  }, [slug]);

  return presentation;
}
