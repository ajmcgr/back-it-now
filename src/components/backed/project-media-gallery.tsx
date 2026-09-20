import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ProjectMediaItem, youtubeThumbnail } from "@/lib/project-media";

type ProjectMediaGalleryProps = {
  coverUrl: string | null;
  media: ProjectMediaItem[];
  projectTitle: string;
};

export function ProjectMediaGallery({ coverUrl, media, projectTitle }: ProjectMediaGalleryProps) {
  const items = useMemo<ProjectMediaItem[]>(() => {
    const ordered = coverUrl ? [{ type: "image" as const, url: coverUrl }, ...media] : media;
    const seen = new Set<string>();
    return ordered.filter((item) => {
      const key = item.type === "image" ? `image:${item.url}` : `youtube:${item.videoId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [coverUrl, media]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const selected = items[selectedIndex];

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
    setPlayingVideoId(null);
  }, [items.length]);

  const move = (direction: -1 | 1) => {
    if (items.length < 2) return;
    setSelectedIndex((current) => (current + direction + items.length) % items.length);
    setPlayingVideoId(null);
  };

  if (!selected) return <div className="aspect-[16/10] rounded-md bg-secondary" />;

  return (
    <section
      aria-label={`${projectTitle} media gallery`}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") move(-1);
        if (event.key === "ArrowRight") move(1);
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const distance =
          (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
      }}
    >
      <div className="group relative overflow-hidden rounded-md border border-border bg-black">
        <div className="aspect-[16/10]">
          {selected.type === "image" ? (
            <img
              src={selected.url}
              alt={`${projectTitle} — media ${selectedIndex + 1}`}
              width={1200}
              height={750}
              fetchPriority={selectedIndex === 0 ? "high" : "auto"}
              className="size-full object-cover"
            />
          ) : playingVideoId === selected.videoId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${selected.videoId}?autoplay=1&rel=0`}
              title={`${projectTitle} video`}
              className="size-full border-0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button
              type="button"
              className="relative size-full"
              onClick={() => setPlayingVideoId(selected.videoId)}
              aria-label={`Play ${projectTitle} video`}
            >
              <img
                src={youtubeThumbnail(selected.videoId)}
                alt={`${projectTitle} video thumbnail`}
                onError={(event) => {
                  if (!event.currentTarget.src.endsWith("/mqdefault.jpg"))
                    event.currentTarget.src = `https://i.ytimg.com/vi/${selected.videoId}/mqdefault.jpg`;
                }}
                className="size-full object-cover"
              />
              <span className="absolute inset-0 grid place-items-center bg-black/15">
                <span className="grid size-16 place-items-center rounded-full bg-black text-white shadow-lg transition-transform hover:scale-105">
                  <Play className="ml-1 size-7 fill-current" />
                </span>
              </span>
            </button>
          )}
        </div>
        {items.length > 1 ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Previous media"
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 shadow-sm"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Next media"
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 shadow-sm"
            >
              <ChevronRight />
            </Button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white md:hidden">
              {selectedIndex + 1} / {items.length}
            </span>
          </>
        ) : null}
      </div>
      {items.length > 1 ? (
        <div className="mt-3 hidden grid-cols-5 gap-3 md:grid">
          {items.map((item, index) => (
            <button
              key={`${item.type === "image" ? item.url : item.videoId}-${index}`}
              type="button"
              aria-label={`Show media ${index + 1}`}
              aria-current={selectedIndex === index}
              onClick={() => {
                setSelectedIndex(index);
                setPlayingVideoId(null);
              }}
              className={`relative overflow-hidden rounded-md border-2 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedIndex === index ? "border-foreground" : "border-transparent hover:border-muted-foreground/40"}`}
            >
              <img
                src={item.type === "image" ? item.url : youtubeThumbnail(item.videoId)}
                alt=""
                loading="lazy"
                onError={(event) => {
                  if (
                    item.type === "youtube" &&
                    !event.currentTarget.src.endsWith("/mqdefault.jpg")
                  )
                    event.currentTarget.src = `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`;
                }}
                className="aspect-[4/3] w-full object-cover"
              />
              {item.type === "youtube" ? (
                <span className="absolute inset-0 grid place-items-center bg-black/10">
                  <span className="grid size-8 place-items-center rounded-full bg-black text-white">
                    <Play className="ml-0.5 size-4 fill-current" />
                  </span>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
