import { projects, type Project } from "@/lib/projects";
import { publicSupabase } from "@/lib/supabase";

export type CanonicalProjectCreator = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type CanonicalProjectPresentation = {
  creator: CanonicalProjectCreator;
  imageUrl: string | null;
  galleryUrls: string[];
  name: string;
  summary: string;
  description: string;
  category: string;
  externalWebsite: string | null;
  location: string | null;
  projectDates: string | null;
  fundingGoalAmount: number;
  initialBackedAmount: number;
  successfulBackedAmount: number;
  successfulBackerCount: number;
  deadlineAt: string | null;
  rewardTitle: string | null;
  rewardDescription: string | null;
  rewardAmount: number | null;
  rewardTotalQuantity: number | null;
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

export async function loadCanonicalProjectPresentation(slug: string) {
  if (!publicSupabase) return null;
  const { data, error } = await publicSupabase
    .from("public_profile_projects")
    .select(
      "creator_username, creator_display_name, creator_avatar_url, image_url, gallery_urls, name, summary, description, category, external_website, location, project_dates, funding_goal_amount, initial_backed_amount, successful_backed_amount, successful_backer_count, deadline_at, reward_title, reward_description, reward_amount, reward_total_quantity, reward_available_quantity",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Public project data is temporarily unavailable.");
  return data ? presentationFromPublicRow(data as Record<string, unknown>) : null;
}

export async function loadCanonicalProjects() {
  if (!publicSupabase) return [];
  const { data, error } = await publicSupabase.from("public_profile_projects").select("*");
  if (error || !data) return [];
  return data.flatMap((row) => {
    const presentation = presentationFromPublicRow(row as Record<string, unknown>);
    return presentation && typeof row.slug === "string" ? [{ slug: row.slug, presentation }] : [];
  });
}

/** Converts the single public database presentation into the existing card/page model. */
export function presentationAsProject(
  slug: string,
  presentation: CanonicalProjectPresentation,
): Project {
  return {
    slug,
    title: presentation.name,
    tagline: presentation.summary,
    creator: presentation.creator.displayName || presentation.creator.username,
    creatorUsername: presentation.creator.username,
    creatorAvatarUrl: presentation.creator.avatarUrl,
    handle: presentation.creator.username,
    initials: presentation.creator.username.slice(0, 2).toUpperCase(),
    description:
      presentation.description?.split(/\n{2,}/).find((paragraph) => paragraph.trim()) ??
      presentation.summary,
    story: presentation.description ? presentation.description.split(/\n{2,}/).filter(Boolean) : [],
    coverImage: presentation.imageUrl ?? "",
    gallery: [presentation.imageUrl, ...presentation.galleryUrls].filter((value): value is string =>
      Boolean(value),
    ),
    category: presentation.category,
    location: presentation.location ?? "",
    projectDates: presentation.projectDates ?? "",
    externalWebsite: presentation.externalWebsite ?? "",
    status: "live",
    deadline: presentation.deadlineAt ?? new Date().toISOString(),
    initialBackedAmount: presentation.initialBackedAmount / 100,
    successfulBackingAmount: presentation.successfulBackedAmount / 100,
    successfulBackingCount: presentation.successfulBackerCount,
    goal: presentation.fundingGoalAmount / 100,
    reward: {
      name: presentation.rewardTitle ?? "Support this project",
      description: presentation.rewardDescription ?? "",
      ...(presentation.rewardAmount ? { minimumAmount: presentation.rewardAmount / 100 } : {}),
      includes: [],
      totalQuantity: presentation.rewardTotalQuantity,
      successfulBackingCount: presentation.successfulBackerCount,
      availabilityLabel: "available",
    },
  };
}

export function presentationFromPublicRow(
  data: Record<string, unknown>,
): CanonicalProjectPresentation | null {
  const username = typeof data["creator_username"] === "string" ? data["creator_username"] : null;
  if (!username) return null;
  return {
    creator: {
      username,
      displayName:
        typeof data["creator_display_name"] === "string" ? data["creator_display_name"] : null,
      avatarUrl: typeof data["creator_avatar_url"] === "string" ? data["creator_avatar_url"] : null,
    },
    imageUrl: typeof data["image_url"] === "string" ? data["image_url"] : null,
    galleryUrls: Array.isArray(data["gallery_urls"])
      ? data["gallery_urls"].filter((value): value is string => typeof value === "string")
      : [],
    name: typeof data["name"] === "string" ? data["name"] : "Untitled project",
    summary: typeof data["summary"] === "string" ? data["summary"] : "",
    description: typeof data["description"] === "string" ? data["description"] : "",
    category: typeof data["category"] === "string" ? data["category"] : "Other",
    externalWebsite: typeof data["external_website"] === "string" ? data["external_website"] : null,
    location: typeof data["location"] === "string" ? data["location"] : null,
    projectDates: typeof data["project_dates"] === "string" ? data["project_dates"] : null,
    fundingGoalAmount:
      typeof data["funding_goal_amount"] === "number" ? data["funding_goal_amount"] : 0,
    initialBackedAmount:
      typeof data["initial_backed_amount"] === "number" ? data["initial_backed_amount"] : 0,
    successfulBackedAmount:
      typeof data["successful_backed_amount"] === "number" ? data["successful_backed_amount"] : 0,
    successfulBackerCount:
      typeof data["successful_backer_count"] === "number" ? data["successful_backer_count"] : 0,
    deadlineAt: typeof data["deadline_at"] === "string" ? data["deadline_at"] : null,
    rewardTitle: typeof data["reward_title"] === "string" ? data["reward_title"] : null,
    rewardDescription:
      typeof data["reward_description"] === "string" ? data["reward_description"] : null,
    rewardAmount: typeof data["reward_amount"] === "number" ? data["reward_amount"] : null,
    rewardTotalQuantity:
      typeof data["reward_total_quantity"] === "number" ? data["reward_total_quantity"] : null,
    rewardAvailableQuantity:
      typeof data["reward_available_quantity"] === "number"
        ? data["reward_available_quantity"]
        : null,
  };
}
