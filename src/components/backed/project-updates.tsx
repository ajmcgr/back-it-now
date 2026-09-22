import { ImagePlus, Pencil, Share2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  loadProjectUpdates,
  projectUpdateShareUrls,
  type ProjectUpdate,
} from "@/lib/project-updates";
import { trackShare } from "@/lib/project-share";
import { supabase } from "@/lib/supabase";

type ComposerState = {
  mode: "create" | "edit";
  updateId: string | null;
  title: string;
  body: string;
  imagePath: string | null;
  imageUrl: string | null;
  idempotencyKey: string;
};

const blankComposer = (): ComposerState => ({
  mode: "create",
  updateId: null,
  title: "",
  body: "",
  imagePath: null,
  imageUrl: null,
  idempotencyKey: crypto.randomUUID(),
});

const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const wasMateriallyUpdated = (update: ProjectUpdate) =>
  new Date(update.updatedAt).getTime() - new Date(update.publishedAt).getTime() > 60_000;

function UpdateShareDialog({
  slug,
  projectName,
  update,
  open,
  onOpenChange,
}: {
  slug: string;
  projectName: string;
  update: ProjectUpdate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const links = useMemo(
    () => (update ? projectUpdateShareUrls(slug, projectName, update) : null),
    [projectName, slug, update],
  );

  const record = (event: string) => trackShare(slug, event, "project_update");
  const copyLink = async () => {
    if (!links) return;
    await navigator.clipboard.writeText(links.url);
    record("share_copy_link");
    setCopied(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setCopied(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share update</DialogTitle>
          <DialogDescription>Let people know what’s new with {projectName}.</DialogDescription>
        </DialogHeader>
        {links ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              ["X", links.x, "share_x"],
              ["LinkedIn", links.linkedin, "share_linkedin"],
              ["Reddit", links.reddit, "share_reddit"],
              ["WhatsApp", links.whatsapp, "share_whatsapp"],
            ].map(([label, href, event]: [string, string, string]) => (
              <Button key={label} asChild variant="outline">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => record(event)}
                >
                  {label}
                </a>
              </Button>
            ))}
            <Button variant="outline" className="col-span-2" onClick={() => void copyLink()}>
              {copied ? "Link copied" : "Copy link"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ProjectUpdates({
  slug,
  projectName,
  isOwner,
}: {
  slug: string;
  projectName: string;
  isOwner: boolean;
}) {
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareUpdate, setShareUpdate] = useState<ProjectUpdate | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      setUpdates(await loadProjectUpdates(slug));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = () => {
    setComposer(blankComposer());
    setFormError("");
    setComposerOpen(true);
  };

  const openEdit = (update: ProjectUpdate) => {
    setComposer({
      mode: "edit",
      updateId: update.id,
      title: update.title,
      body: update.body,
      imagePath: update.imagePath,
      imageUrl: update.imageUrl,
      idempotencyKey: crypto.randomUUID(),
    });
    setFormError("");
    setComposerOpen(true);
  };

  const uploadImage = async (file: File) => {
    if (!supabase || !composer) return;
    setUploading(true);
    setFormError("");
    const form = new FormData();
    form.set("scope", "project-update");
    form.set("slug", slug);
    form.set("file", file);
    try {
      const { data, error } = await supabase.functions.invoke("project-media", { body: form });
      if (error || typeof data?.url !== "string" || typeof data?.path !== "string")
        throw new Error("upload_failed");
      setComposer((current) =>
        current ? { ...current, imagePath: data.path, imageUrl: data.url } : current,
      );
    } catch {
      setFormError("That image couldn’t be uploaded. Try a JPG, PNG or WebP under 5 MB.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveUpdate = async () => {
    if (!supabase || !composer || saving) return;
    const title = composer.title.trim();
    const body = composer.body.trim();
    if (!title) {
      setFormError("Add a title for this update.");
      return;
    }
    if (!body) {
      setFormError("Add the update you want to share.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const { data, error } = await supabase.functions.invoke("project-updates", {
        body: {
          action: composer.mode === "create" ? "create" : "update",
          slug,
          updateId: composer.updateId,
          title,
          body,
          imagePath: composer.imagePath,
          idempotencyKey: composer.idempotencyKey,
        },
      });
      if (error || !data?.update) throw new Error("save_failed");
      const saved = data.update as ProjectUpdate;
      setUpdates((current) =>
        [saved, ...current.filter((update) => update.id !== saved.id)].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        ),
      );
      setComposerOpen(false);
      setComposer(null);
      if (composer.mode === "create") setShareUpdate(saved);
    } catch {
      setFormError("Your update couldn’t be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUpdate = async (updateId: string) => {
    if (!supabase || deletingId) return;
    setDeletingId(updateId);
    setActionError("");
    try {
      const { data, error } = await supabase.functions.invoke("project-updates", {
        body: { action: "delete", slug, updateId },
      });
      if (error || data?.deleted !== true) throw new Error("delete_failed");
      setUpdates((current) => current.filter((update) => update.id !== updateId));
    } catch {
      setActionError("That update couldn’t be deleted. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="updates" aria-labelledby="project-updates-heading" className="max-w-[760px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="project-updates-heading" className="text-2xl font-semibold">
          Updates
        </h2>
        {isOwner ? (
          <Button onClick={openCreate}>
            {updates.length ? "Post an update" : "Post your first update"}
          </Button>
        ) : null}
      </div>
      {actionError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-8 space-y-4" aria-label="Loading updates">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : loadError ? (
        <div className="mt-8 rounded-md border border-border p-6">
          <p className="font-semibold">Updates couldn’t be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try again in a moment.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : updates.length === 0 ? (
        <div className="py-16">
          <p className="text-muted-foreground">
            {isOwner
              ? "Keep your backers in the loop with progress, milestones and news."
              : "No updates yet. Check back here for news from the creator."}
          </p>
          {isOwner ? (
            <Button className="mt-5" onClick={openCreate}>
              Post your first update
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 divide-y divide-border border-y border-border">
          {updates.map((update) => (
            <article key={update.id} className="py-8 first:pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {displayDate(update.publishedAt)}
                    {wasMateriallyUpdated(update) ? " · Updated" : ""}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">
                    <a
                      href={`/projects/${slug}/updates/${update.id}`}
                      className="hover:text-primary"
                    >
                      {update.title}
                    </a>
                  </h3>
                </div>
                {isOwner ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShareUpdate(update)}
                      aria-label={`Share ${update.title}`}
                    >
                      <Share2 className="mr-1.5 size-4" />
                      Share
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(update)}
                      aria-label={`Edit ${update.title}`}
                    >
                      <Pencil className="mr-1.5 size-4" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Delete ${update.title}`}
                        >
                          <Trash2 className="mr-1.5 size-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this update?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove it from your project.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deletingId === update.id}
                            onClick={() => void deleteUpdate(update.id)}
                          >
                            {deletingId === update.id ? "Deleting…" : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : null}
              </div>
              <div className="mt-5 space-y-4 leading-7 text-foreground">
                {update.body.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={`${update.id}-${index}`} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
              {update.imageUrl ? (
                <img
                  src={update.imageUrl}
                  alt={`${update.title} update`}
                  className="mt-6 aspect-video w-full rounded-md border border-border object-cover"
                  loading="lazy"
                />
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={composerOpen}
        onOpenChange={(open) => {
          if (saving) return;
          setComposerOpen(open);
          if (!open) {
            setComposer(null);
            setFormError("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {composer?.mode === "edit" ? "Edit update" : "Post an update"}
            </DialogTitle>
            <DialogDescription>
              Share progress, milestones or news with everyone following {projectName}.
            </DialogDescription>
          </DialogHeader>
          {composer ? (
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="update-title">Title</Label>
                <Input
                  id="update-title"
                  value={composer.title}
                  maxLength={160}
                  onChange={(event) =>
                    setComposer((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                  placeholder="What’s new?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="update-body">Update</Label>
                <Textarea
                  id="update-body"
                  value={composer.body}
                  maxLength={20000}
                  rows={10}
                  onChange={(event) =>
                    setComposer((current) =>
                      current ? { ...current, body: event.target.value } : current,
                    )
                  }
                  placeholder="Share the latest progress with your backers."
                />
                <p className="text-xs text-muted-foreground">
                  Paragraphs and line breaks will be preserved.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="update-image">Image (optional)</Label>
                {composer.imageUrl ? (
                  <div className="space-y-3">
                    <img
                      src={composer.imageUrl}
                      alt="Update preview"
                      className="aspect-video w-full rounded-md border border-border object-cover"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setComposer((current) =>
                          current ? { ...current, imagePath: null, imageUrl: null } : current,
                        )
                      }
                    >
                      Remove image
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="update-image"
                    className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border px-4 text-center hover:bg-muted/40"
                  >
                    <ImagePlus className="size-5" />
                    <span className="mt-2 text-sm font-medium">
                      {uploading ? "Uploading…" : "Upload image"}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG or WebP · 5 MB max
                    </span>
                  </label>
                )}
                <input
                  ref={fileInputRef}
                  id="update-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading || saving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                />
              </div>
              {formError ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {formError}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || uploading} onClick={() => void saveUpdate()}>
              {saving
                ? composer?.mode === "edit"
                  ? "Saving…"
                  : "Publishing…"
                : composer?.mode === "edit"
                  ? "Save changes"
                  : "Publish update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpdateShareDialog
        slug={slug}
        projectName={projectName}
        update={shareUpdate}
        open={Boolean(shareUpdate)}
        onOpenChange={(open) => {
          if (!open) setShareUpdate(null);
        }}
      />
    </section>
  );
}
