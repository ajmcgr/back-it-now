import socialCardAsset from "@/assets/backed-social-card-2026-09-23.png.asset.json";

export const SITE_NAME = "Backed";
export const SITE_URL = "https://backedit.co";
const SOCIAL_IMAGE_ENDPOINT =
  "https://zlzaxgsyczfeepwidjii.supabase.co/functions/v1/project-social-image";
export const DEFAULT_SOCIAL_IMAGE = socialCardAsset.url;

type PublicSeoOptions = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function absoluteUrl(path: string) {
  if (/^https:\/\//i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}

export function publicSeo({
  title,
  description,
  path,
  image = DEFAULT_SOCIAL_IMAGE,
  type = "website",
  jsonLd,
}: PublicSeoOptions) {
  const canonical = absoluteUrl(path);
  const socialImage = image ? absoluteUrl(image) : DEFAULT_SOCIAL_IMAGE;
  const usesDefaultSocialImage = socialImage === absoluteUrl(DEFAULT_SOCIAL_IMAGE);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: canonical },
      { property: "og:image", content: socialImage },
      { property: "og:image:secure_url", content: socialImage },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: socialImage },
      { name: "twitter:image:alt", content: title },
    ],
    links: [{ rel: "canonical", href: canonical }],
    ...(jsonLd
      ? {
          scripts: [
            {
              type: "application/ld+json",
              children: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
            },
          ],
        }
      : {}),
  };
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

type ProjectSocialImageOptions = {
  slug: string;
  name: string;
  summary: string;
  creator: string;
  amountBacked: number;
  goal: number;
  backers: number;
};

export function projectSocialImageUrl(project: ProjectSocialImageOptions) {
  const values = [
    project.name,
    project.summary,
    project.creator,
    project.amountBacked,
    project.goal,
    project.backers,
  ];
  const params = new URLSearchParams({
    slug: project.slug,
    name: project.name.slice(0, 90),
    summary: project.summary.slice(0, 180),
    creator: project.creator.slice(0, 70),
    raised: String(Math.max(0, Math.round(project.amountBacked * 100))),
    goal: String(Math.max(0, Math.round(project.goal * 100))),
    backers: String(Math.max(0, Math.floor(project.backers))),
    v: fingerprint(values.join("|")),
  });
  return `${SOCIAL_IMAGE_ENDPOINT}?${params.toString()}`;
}

export function privateSeo(title: string) {
  return {
    meta: [
      { title },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "googlebot", content: "noindex, nofollow, noarchive" },
    ],
  };
}

export function trimDescription(value: string, fallback: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
