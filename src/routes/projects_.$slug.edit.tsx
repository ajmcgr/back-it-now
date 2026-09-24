import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ImagePlus, Trash2, Youtube } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { privateSeo } from "@/lib/seo";
import {
  normalizeYouTubeUrl,
  projectMediaFromUnknown,
  type ProjectMediaItem,
  youtubeThumbnail,
} from "@/lib/project-media";

export const Route = createFileRoute("/projects_/$slug/edit")({
  head: () => privateSeo("Edit project — Backed"),
  component: EditProject,
});
const categories = ["Technology", "Design", "Fashion", "Games", "Publishing", "Food", "Other"];
type Form = {
  [key: string]: string | ProjectMediaItem[] | undefined;
  galleryMedia?: ProjectMediaItem[];
  coverUrl?: string;
  category?: string;
};
const text = (value: unknown) => (typeof value === "string" ? value : "");

function EditProject() {
  const { slug } = Route.useParams();
  const [form, setForm] = useState<Form>({});
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirmation, setCancelConfirmation] = useState("");
  const [cancelPreview, setCancelPreview] = useState<{
    eligibleCount: number;
    eligibleAmount: number;
  } | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const set = (key: string, value: Form[string]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const field = (key: string) => ({
    value: text(form[key]),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, event.target.value),
  });
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    void client.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.assign(`/auth?next=${encodeURIComponent(`/projects/${slug}/edit`)}`);
        return;
      }
      const { data, error } = await client.functions.invoke("project-owner", {
        body: { action: "get", slug },
      });
      if (!active) return;
      if (error || !data?.project) {
        setMessage("You do not have access to edit this project.");
        setLoading(false);
        return;
      }
      const project = data.project;
      const reward = data.reward ?? {};
      setRestricted(project.successful_backed_amount > 0 || project.successful_backer_count > 0);
      setProjectStatus(project.status ?? "");
      setForm({
        name: project.name,
        summary: project.summary,
        description: project.description,
        category: project.category,
        externalWebsite: project.external_website ?? "",
        location: project.location ?? "",
        projectDates: project.project_dates ?? "",
        goal: String((project.funding_goal_amount ?? 0) / 100),
        deadline: project.deadline_at ? project.deadline_at.slice(0, 10) : "",
        coverUrl: project.image_url ?? "",
        galleryMedia: projectMediaFromUnknown(project.gallery_media),
        rewardName: reward.title ?? "",
        rewardDescription: reward.description ?? "",
        rewardPrice: String((reward.amount ?? 0) / 100),
        rewardQuantity: String(reward.total_quantity ?? 1),
      });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [slug]);
  async function upload(files: FileList | null, role: "cover" | "gallery") {
    if (!files?.length || !supabase) return;
    if (
      role === "gallery" &&
      projectMediaFromUnknown(form.galleryMedia).length + files.length > 12
    ) {
      setMessage("A project gallery can include up to 12 images and videos.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const results: { url: string; storagePath: string }[] = [];
      for (const file of Array.from(files)) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error("Use a JPG, PNG, or WebP image up to 5 MB.");
        const data = new FormData();
        data.append("scope", "project");
        data.append("slug", slug);
        data.append("file", file);
        const response = await supabase.functions.invoke("project-media", { body: data });
        if (response.error || !response.data?.url || !response.data?.path)
          throw new Error("Image upload failed.");
        results.push({ url: response.data.url, storagePath: response.data.path });
      }
      setForm((current) =>
        role === "cover"
          ? results[0]
            ? { ...current, coverUrl: results[0].url }
            : current
          : {
              ...current,
              galleryMedia: [
                ...projectMediaFromUnknown(current.galleryMedia),
                ...results.map((item) => ({ type: "image" as const, ...item })),
              ],
            },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setSaving(false);
      if (coverInput.current) coverInput.current.value = "";
      if (galleryInput.current) galleryInput.current.value = "";
    }
  }
  function addYouTube() {
    if (projectMediaFromUnknown(form.galleryMedia).length >= 12) {
      setMessage("A project gallery can include up to 12 images and videos.");
      return;
    }
    const item = normalizeYouTubeUrl(youtubeUrl);
    if (!item) {
      setMessage("Enter a valid YouTube watch, share, or Shorts URL.");
      return;
    }
    setMessage(null);
    setForm((current) => ({
      ...current,
      galleryMedia: [...projectMediaFromUnknown(current.galleryMedia), item],
    }));
    setYoutubeUrl("");
  }
  function updateMedia(index: number, action: "up" | "down" | "remove") {
    setForm((current) => {
      const media = projectMediaFromUnknown(current.galleryMedia);
      if (action === "remove") media.splice(index, 1);
      else {
        const nextIndex = action === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= media.length) return current;
        const currentItem = media[index];
        const nextItem = media[nextIndex];
        if (!currentItem || !nextItem) return current;
        media[index] = nextItem;
        media[nextIndex] = currentItem;
      }
      return { ...current, galleryMedia: media };
    });
  }
  async function save() {
    if (!supabase) return;
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke("project-owner", {
      body: {
        action: "update",
        slug,
        ...form,
        imageUrl: form.coverUrl,
        galleryMedia: projectMediaFromUnknown(form.galleryMedia),
      },
    });
    setSaving(false);
    if (error || !data?.updated)
      return setMessage(
        data?.error === "invalid_project_economics"
          ? "Check the goal, deadline, and reward values."
          : "Could not save your project. Please check the details and try again.",
      );
    setMessage(
      restricted
        ? "Project details saved. Funding, deadline, and reward commitments are locked after backing."
        : "Project saved.",
    );
  }
  async function openCancellation() {
    if (!supabase || cancelBusy) return;
    setCancelOpen(true);
    setCancelBusy(true);
    setCancelError("");
    setCancelConfirmation("");
    const { data, error } = await supabase.functions.invoke("project-cancellation", {
      body: { action: "preview", slug },
    });
    setCancelBusy(false);
    if (error || typeof data?.eligibleCount !== "number") {
      setCancelError("Cancellation details are temporarily unavailable. Please try again.");
      return;
    }
    setCancelPreview({ eligibleCount: data.eligibleCount, eligibleAmount: data.eligibleAmount });
  }
  async function cancelProject() {
    if (!supabase || cancelBusy || cancelConfirmation !== "CANCEL") return;
    setCancelBusy(true);
    setCancelError("");
    const { data, error } = await supabase.functions.invoke("project-cancellation", {
      body: { action: "start", slug, confirmation: cancelConfirmation },
    });
    setCancelBusy(false);
    if (error || !data?.cancellation) {
      setCancelError(
        "The project could not be cancelled. No duplicate refunds were created. Please try again.",
      );
      return;
    }
    setProjectStatus(data.cancellation.status === "completed" ? "cancelled" : "cancelling");
    setCancelOpen(false);
    setMessage(
      data.cancellation.status === "completed"
        ? "Project cancelled. Eligible backings have been refunded."
        : "Project cancelled. New backings are blocked while eligible refunds are processed.",
    );
  }
  if (loading)
    return (
      <main className="container-backed py-20 text-center text-muted-foreground">
        Loading project…
      </main>
    );
  if (!Object.keys(form).length)
    return (
      <main className="container-backed py-20 text-center">
        <p>{message}</p>
        <Button asChild className="mt-4">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </main>
    );
  const gallery = projectMediaFromUnknown(form.galleryMedia);
  return (
    <main className="container-backed max-w-3xl py-12 sm:py-16">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Creator controls</p>
          <h1 className="mt-2 text-4xl font-semibold">Edit project</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/projects/$slug" params={{ slug }}>
            View project
          </Link>
        </Button>
      </div>
      {restricted && (
        <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          This project has successful backings. Funding, deadline, reward price, and capacity are
          protected.
        </p>
      )}
      <div className="mt-8 space-y-6">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Project name</span>
          <Input className="h-12" {...field("name")} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Short description</span>
          <Textarea {...field("summary")} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Story</span>
          <Textarea className="min-h-64" {...field("description")} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Category</span>
          <Select value={text(form.category)} onValueChange={(value) => set("category", value)}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Cover image</span>
          <input
            ref={coverInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void upload(event.target.files, "cover")}
          />
          {text(form.coverUrl) ? (
            <div className="overflow-hidden rounded-md border">
              <img
                src={text(form.coverUrl)}
                alt="Cover"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-3">
                <Button type="button" variant="outline" onClick={() => coverInput.current?.click()}>
                  Replace cover
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => coverInput.current?.click()}>
              <ImagePlus />
              Upload cover
            </Button>
          )}
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Project gallery</span>
          <input
            ref={galleryInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => void upload(event.target.files, "gallery")}
          />
          <Button type="button" variant="outline" onClick={() => galleryInput.current?.click()}>
            <ImagePlus />
            Add images
          </Button>
          <div className="mt-3 flex gap-2">
            <Input
              type="url"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="Paste a YouTube URL"
              className="h-11"
            />
            <Button type="button" variant="outline" onClick={addYouTube}>
              <Youtube />
              Add video
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {gallery.map((item, index) => (
              <div
                key={`${item.type === "image" ? item.url : item.videoId}-${index}`}
                className="overflow-hidden rounded-md border"
              >
                <img
                  src={item.type === "image" ? item.url : youtubeThumbnail(item.videoId)}
                  alt={item.type === "image" ? `Gallery ${index + 1}` : "YouTube thumbnail"}
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="flex items-center justify-end gap-1 p-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={index === 0}
                    aria-label="Move media earlier"
                    onClick={() => updateMedia(index, "up")}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={index === gallery.length - 1}
                    aria-label="Move media later"
                    onClick={() => updateMedia(index, "down")}
                  >
                    <ArrowDown />
                  </Button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-destructive"
                    onClick={() => updateMedia(index, "remove")}
                  >
                    <Trash2 className="mr-1 inline size-3" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">External website</span>
          <Input type="url" className="h-12" {...field("externalWebsite")} />
        </label>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Location</span>
            <Input className="h-12" {...field("location")} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Project dates</span>
            <Input className="h-12" {...field("projectDates")} />
          </label>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Funding goal</span>
            <Input type="number" disabled={restricted} className="h-12" {...field("goal")} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Deadline</span>
            <Input type="date" disabled={restricted} className="h-12" {...field("deadline")} />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Reward name</span>
          <Input disabled={restricted} className="h-12" {...field("rewardName")} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Reward description</span>
          <Textarea disabled={restricted} {...field("rewardDescription")} />
        </label>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Reward minimum</span>
            <Input type="number" disabled={restricted} className="h-12" {...field("rewardPrice")} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Reward capacity</span>
            <Input
              type="number"
              disabled={restricted}
              className="h-12"
              {...field("rewardQuantity")}
            />
          </label>
        </div>
        <div className="flex justify-end border-t pt-6">
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
        {message && <p className="text-right text-sm text-muted-foreground">{message}</p>}
        {projectStatus === "live" ? (
          <section className="mt-10 border-t border-destructive/30 pt-8">
            <h2 className="text-xl font-semibold">Cancel project</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Cancellation immediately stops new backings and refunds every eligible paid backing.
              It cannot be undone.
            </p>
            <Button
              type="button"
              variant="destructive"
              className="mt-4"
              onClick={() => void openCancellation()}
            >
              Cancel project
            </Button>
          </section>
        ) : projectStatus === "cancelling" || projectStatus === "cancelled" ? (
          <section className="mt-10 rounded-md border border-border bg-muted/40 p-5">
            <h2 className="text-xl font-semibold">Project cancelled</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {projectStatus === "cancelled"
                ? "Eligible backers have been refunded."
                : "New backings are blocked while eligible refunds are processed."}
            </p>
          </section>
        ) : null}
      </div>
      <Dialog open={cancelOpen} onOpenChange={(open) => !cancelBusy && setCancelOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this project?</DialogTitle>
            <DialogDescription>
              Cancelling immediately stops new backings. Eligible paid backings will be refunded.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {cancelBusy && !cancelPreview ? (
            <p className="text-sm text-muted-foreground">Checking eligible backings…</p>
          ) : cancelPreview ? (
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Eligible paid backings</p>
                <p className="mt-1 text-xl font-semibold">{cancelPreview.eligibleCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Full refund amount</p>
                <p className="mt-1 text-xl font-semibold">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    cancelPreview.eligibleAmount / 100,
                  )}
                </p>
              </div>
            </div>
          ) : null}
          <label className="block text-sm font-semibold">
            Type CANCEL to continue
            <Input
              className="mt-2"
              value={cancelConfirmation}
              onChange={(event) => setCancelConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          {cancelError ? (
            <p className="text-sm text-destructive" role="alert">
              {cancelError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={cancelBusy}
              onClick={() => setCancelOpen(false)}
            >
              Keep project live
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelBusy || !cancelPreview || cancelConfirmation !== "CANCEL"}
              onClick={() => void cancelProject()}
            >
              {cancelBusy ? "Cancelling…" : "Cancel project and refund backers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
