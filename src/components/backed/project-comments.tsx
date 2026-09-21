import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { loadProjectComments, type ProjectComment } from "@/lib/project-comments";
import { supabase } from "@/lib/supabase";

const MAX_COMMENT_LENGTH = 2000;

const timestamp = (value: string) => {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(value));
};

export function ProjectComments({
  slug,
  onCountChange,
}: {
  slug: string;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [avatar, setAvatar] = useState<{
    avatarUrl: string | null;
    displayName: string | null;
    username: string | null;
  }>({ avatarUrl: null, displayName: null, username: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<ProjectComment | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirming, setConfirming] = useState<{
    comment: ProjectComment;
    action: "delete" | "moderate";
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const next = await loadProjectComments(slug, authenticated);
      setComments(next);
      onCountChange?.(next.length);
    } catch {
      setLoadError("Comments are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [authenticated, onCountChange, slug]);

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
      if (cancelled || !data.session || !supabase) return;
      setAuthenticated(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url, display_name, username")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!cancelled && profile) {
        setAvatar({
          avatarUrl: profile.avatar_url,
          displayName: profile.display_name,
          username: profile.username,
        });
      }
    };
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const authHref = useMemo(
    () => `/auth?next=${encodeURIComponent(`/projects/${slug}#comments`)}`,
    [slug],
  );

  const invoke = async (payload: Record<string, unknown>) => {
    if (!supabase) throw new Error("comments_unavailable");
    const { data, error } = await supabase.functions.invoke("project-comments", {
      body: { slug, ...payload },
    });
    if (error || data?.error) throw new Error(data?.error || "comments_unavailable");
    return data;
  };

  const post = async () => {
    const nextBody = body.trim();
    if (!nextBody || nextBody.length > MAX_COMMENT_LENGTH || saving) return;
    setSaving(true);
    setActionError("");
    try {
      await invoke({ action: "create", body: nextBody, idempotencyKey: crypto.randomUUID() });
      setBody("");
      await refresh();
    } catch (error) {
      setActionError(
        error instanceof Error && error.message === "comment_rate_limited"
          ? "You’re commenting too quickly. Wait a minute and try again."
          : "Your comment couldn’t be posted. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    const nextBody = editBody.trim();
    if (!editing || !nextBody || nextBody.length > MAX_COMMENT_LENGTH || saving) return;
    setSaving(true);
    setActionError("");
    try {
      await invoke({ action: "update", commentId: editing.id, body: nextBody });
      setEditing(null);
      setEditBody("");
      await refresh();
    } catch {
      setActionError("Your changes couldn’t be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirming || saving) return;
    setSaving(true);
    setActionError("");
    try {
      await invoke({
        action: confirming.action === "delete" ? "delete" : "moderate",
        commentId: confirming.comment.id,
      });
      setConfirming(null);
      await refresh();
    } catch {
      setActionError("That comment couldn’t be removed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="comments"
      aria-labelledby="project-comments-heading"
      className="w-full max-w-3xl py-4 sm:py-8"
    >
      <h2 id="project-comments-heading" className="text-2xl font-semibold">
        Comments
      </h2>

      {authenticated ? (
        <div className="mt-7 flex items-start gap-3">
          <ProfileAvatar
            avatarUrl={avatar.avatarUrl}
            displayName={avatar.displayName}
            username={avatar.username}
            className="mt-1 size-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <Textarea
              value={body}
              maxLength={MAX_COMMENT_LENGTH}
              rows={4}
              placeholder="Add a comment..."
              aria-label="Add a comment"
              onChange={(event) => setBody(event.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {body.length.toLocaleString()}/{MAX_COMMENT_LENGTH.toLocaleString()}
              </span>
              <Button disabled={!body.trim() || saving} onClick={() => void post()}>
                {saving ? "Posting…" : "Post comment"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-7 rounded-md border border-border p-5">
          <p className="font-semibold">Join the conversation</p>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to comment on this project.</p>
          <Button asChild className="mt-4">
            <a href={authHref}>Sign in to comment</a>
          </Button>
        </div>
      )}

      {actionError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-8 space-y-4" aria-label="Loading comments">
          {[0, 1].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : loadError ? (
        <div className="mt-8 rounded-md border border-border p-5 text-sm">
          <p>{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="py-10">
          <p className="font-semibold">No comments yet.</p>
          <p className="mt-1 text-muted-foreground">
            {authenticated ? "Be the first to comment." : "Sign in to comment."}
          </p>
        </div>
      ) : (
        <div className="mt-8 divide-y divide-border border-y border-border">
          {comments.map((comment) => {
            const name = comment.displayName || comment.username || "Backed user";
            const identity = (
              <div className="flex min-w-0 items-center gap-3">
                <ProfileAvatar
                  avatarUrl={comment.avatarUrl}
                  displayName={comment.displayName}
                  username={comment.username}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{name}</span>
                    {comment.isCreator ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        Creator
                      </span>
                    ) : null}
                  </div>
                  {comment.username ? (
                    <span className="block truncate text-sm text-muted-foreground">
                      @{comment.username}
                    </span>
                  ) : null}
                </div>
              </div>
            );
            const edited = comment.updatedAt !== comment.createdAt;
            return (
              <article key={comment.id} className="py-6">
                <div className="flex items-start justify-between gap-4">
                  {comment.username ? (
                    <Link
                      to="/$username"
                      params={{ username: comment.username }}
                      className="min-w-0 rounded-md transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {identity}
                    </Link>
                  ) : (
                    identity
                  )}
                  {comment.isOwn || (comment.canModerate && !comment.isOwn) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Comment actions">
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {comment.isOwn ? (
                          <>
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(comment);
                                setEditBody(comment.body);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setConfirming({ comment, action: "delete" })}
                            >
                              Delete
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setConfirming({ comment, action: "moderate" })}
                          >
                            Remove comment
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                {editing?.id === comment.id ? (
                  <div className="mt-4 pl-0 sm:pl-[52px]">
                    <Textarea
                      value={editBody}
                      maxLength={MAX_COMMENT_LENGTH}
                      rows={4}
                      aria-label="Edit comment"
                      onChange={(event) => setEditBody(event.target.value)}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(null);
                          setEditBody("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button disabled={!editBody.trim() || saving} onClick={() => void saveEdit()}>
                        {saving ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 sm:pl-[52px]">
                      {comment.body}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground sm:pl-[52px]">
                      {timestamp(comment.createdAt)}
                      {edited ? " · Edited" : ""}
                    </p>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.action === "delete" ? "Delete this comment?" : "Remove this comment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>It will no longer appear publicly.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {saving ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
