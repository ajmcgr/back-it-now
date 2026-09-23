import { Heart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadProjectFavoriteState, setProjectFavorite } from "@/lib/project-favorites";
import { supabase } from "@/lib/supabase";

export function ProjectFavoriteButton({
  slug,
  initialCount,
}: {
  slug: string;
  initialCount: number;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(initialCount);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const restoredIntent = useRef(false);

  const updateFavorite = useCallback(
    async (next: boolean) => {
      if (isSaving) return;
      setMessage("");
      setIsSaving(true);
      const previousState = isFavorited;
      const previousCount = favoriteCount;
      setIsFavorited(next);
      setFavoriteCount((count) => Math.max(0, count + (next ? 1 : -1)));
      try {
        const canonical = await setProjectFavorite(slug, next);
        setIsFavorited(canonical.isFavorited);
        setFavoriteCount(canonical.favoriteCount);
      } catch {
        setIsFavorited(previousState);
        setFavoriteCount(previousCount);
        setMessage("We couldn’t update your favorites. Please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [favoriteCount, isFavorited, isSaving, slug],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setIsAuthenticated(Boolean(data.session));
      if (!data.session) return;
      try {
        const state = await loadProjectFavoriteState(slug);
        if (!cancelled && state) {
          setIsFavorited(state.isFavorited);
          setFavoriteCount(state.favoriteCount);
        }
      } catch {
        // The public aggregate remains usable if the private state cannot load.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!isAuthenticated || restoredIntent.current || isSaving) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("favorite") !== "1") return;
    restoredIntent.current = true;
    void updateFavorite(true).finally(() => {
      params.delete("favorite");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    });
  }, [isAuthenticated, isSaving, updateFavorite]);

  const handleClick = () => {
    if (!isAuthenticated) {
      const next = `/projects/${slug}?favorite=1`;
      window.location.assign(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    void updateFavorite(!isFavorited);
  };

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        aria-pressed={isFavorited}
        aria-label={isFavorited ? "Remove from favorites" : "Favorite project"}
        disabled={isSaving}
        onClick={handleClick}
      >
        <Heart className={isFavorited ? "fill-current" : ""} aria-hidden="true" />
        {isFavorited ? "Favorited" : "Favorite"}
        <span className="text-muted-foreground">{favoriteCount}</span>
      </Button>
      {message ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
