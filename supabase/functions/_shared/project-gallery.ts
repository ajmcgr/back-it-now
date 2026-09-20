export type GalleryMedia =
  { type: "image"; url: string; storagePath?: string } | { type: "youtube"; videoId: string };

const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function normalizeYouTubeId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (youtubeIdPattern.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
      else {
        const [kind, pathId] = url.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(kind)) id = pathId ?? "";
      }
    }
    return youtubeIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function sanitizeGalleryMedia(
  value: unknown,
  options: {
    imagePathPrefix: string;
    storagePublicPrefix: string;
    allowBackedAssets?: boolean;
  },
): GalleryMedia[] | null {
  if (!Array.isArray(value) || value.length > 12) return null;
  const sanitized: GalleryMedia[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const media = item as Record<string, unknown>;
    if (media.type === "youtube") {
      const videoId = normalizeYouTubeId(media.videoId ?? media.url);
      if (!videoId) return null;
      sanitized.push({ type: "youtube", videoId });
      continue;
    }
    if (media.type !== "image") return null;
    if (
      options.allowBackedAssets &&
      typeof media.url === "string" &&
      media.url.startsWith("https://backedit.co/") &&
      typeof media.storagePath !== "string"
    ) {
      sanitized.push({ type: "image", url: media.url });
      continue;
    }
    if (typeof media.storagePath !== "string") return null;
    const storagePath = media.storagePath.trim();
    if (!storagePath.startsWith(options.imagePathPrefix)) return null;
    sanitized.push({
      type: "image",
      storagePath,
      url: `${options.storagePublicPrefix}${storagePath}`,
    });
  }
  return sanitized;
}

export function storedGalleryMedia(value: unknown): GalleryMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const media = item as Record<string, unknown>;
    if (media.type === "youtube") {
      const videoId = normalizeYouTubeId(media.videoId);
      return videoId ? [{ type: "youtube" as const, videoId }] : [];
    }
    if (media.type === "image" && typeof media.url === "string") {
      return [
        {
          type: "image" as const,
          url: media.url,
          ...(typeof media.storagePath === "string" ? { storagePath: media.storagePath } : {}),
        },
      ];
    }
    return [];
  });
}
