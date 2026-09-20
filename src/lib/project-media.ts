export type ProjectImageMedia = {
  type: "image";
  url: string;
  storagePath?: string;
};

export type ProjectYouTubeMedia = {
  type: "youtube";
  videoId: string;
};

export type ProjectMediaItem = ProjectImageMedia | ProjectYouTubeMedia;

const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function normalizeYouTubeUrl(value: string): ProjectYouTubeMedia | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";
    if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") ?? "";
      else {
        const [kind, id] = url.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(kind)) videoId = id ?? "";
      }
    }
    return youtubeIdPattern.test(videoId) ? { type: "youtube", videoId } : null;
  } catch {
    return null;
  }
}

export function projectMediaFromUnknown(value: unknown): ProjectMediaItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const media = item as Record<string, unknown>;
    if (media.type === "image" && typeof media.url === "string" && media.url.trim()) {
      return [
        {
          type: "image" as const,
          url: media.url,
          ...(typeof media.storagePath === "string" && media.storagePath
            ? { storagePath: media.storagePath }
            : {}),
        },
      ];
    }
    if (
      media.type === "youtube" &&
      typeof media.videoId === "string" &&
      youtubeIdPattern.test(media.videoId)
    ) {
      return [{ type: "youtube" as const, videoId: media.videoId }];
    }
    return [];
  });
}

export function youtubeThumbnail(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
