import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadCreatorFollowState, setCreatorFollow } from "@/lib/creator-follows";
import { supabase } from "@/lib/supabase";

export function CreatorFollowButton({
  username,
  initialCount,
}: {
  username: string;
  initialCount: number;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const restoredIntent = useRef(false);

  const updateFollow = useCallback(
    async (next: boolean) => {
      if (saving) return;
      const previousFollowing = following;
      const previousCount = count;
      setSaving(true);
      setMessage("");
      setFollowing(next);
      setCount((value) => Math.max(0, value + (next ? 1 : -1)));
      try {
        const canonical = await setCreatorFollow(username, next);
        setFollowing(canonical.isFollowing);
        setCount(canonical.followerCount);
      } catch {
        setFollowing(previousFollowing);
        setCount(previousCount);
        setMessage("We couldn’t update this follow. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [count, following, saving, username],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setAuthenticated(Boolean(data.session));
      if (!data.session) return;
      try {
        const state = await loadCreatorFollowState(username);
        if (!cancelled && state) {
          setFollowing(state.isFollowing);
          setCount(state.followerCount);
        }
      } catch {
        // The public follower count remains usable if private state cannot load.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!authenticated || restoredIntent.current || saving) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("follow") !== "1") return;
    restoredIntent.current = true;
    void updateFollow(true).finally(() => {
      params.delete("follow");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    });
  }, [authenticated, saving, updateFollow]);

  const handleClick = () => {
    if (!authenticated) {
      const next = `/${username}?follow=1`;
      window.location.assign(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    void updateFollow(!following);
  };

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant={following ? "outline" : "default"}
        aria-pressed={following}
        disabled={saving}
        onClick={handleClick}
      >
        {following ? "Following" : "Follow"}
      </Button>
      <span className="ml-3 text-sm text-muted-foreground">
        {count} {count === 1 ? "follower" : "followers"}
      </span>
      {message ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
