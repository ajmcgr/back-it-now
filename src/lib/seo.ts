export const SITE_NAME = "Backed";
export const SITE_URL = "https://backedit.co";
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/logo.png`;

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
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: socialImage },
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
