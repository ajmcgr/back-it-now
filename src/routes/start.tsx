import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ImagePlus,
  Trash2,
  Youtube,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { privateSeo } from "@/lib/seo";
import { ProjectMediaGallery } from "@/components/backed/project-media-gallery";
import {
  normalizeYouTubeUrl,
  projectMediaFromUnknown,
  type ProjectMediaItem,
  youtubeThumbnail,
} from "@/lib/project-media";

export const Route = createFileRoute("/start")({
  head: () => privateSeo("Start a project — Backed"),
  component: StartPage,
});
const steps = ["Project", "Funding", "What backers get", "Story", "Preview"];
const categories = ["Technology", "Design", "Fashion", "Games", "Publishing", "Food", "Other"];
type Draft = {
  [key: string]: string | string[] | ProjectMediaItem[] | undefined;
  galleryMedia?: ProjectMediaItem[];
  galleryUrls?: string[];
  galleryPaths?: string[];
  category?: string;
  coverUrl?: string;
  name?: string;
  summary?: string;
  story?: string;
  goal?: string;
  rewardPrice?: string;
  rewardName?: string;
};
type DraftRecord = { id: string; secret: string };
const draftText = (value: Draft[string] | undefined) => (typeof value === "string" ? value : "");
const normalizeDraft = (value: unknown): Draft => {
  if (!value || typeof value !== "object") return {};
  const draft = value as Draft;
  if (projectMediaFromUnknown(draft.galleryMedia).length) return draft;
  const legacyUrls = Array.isArray(draft.galleryUrls)
    ? draft.galleryUrls.filter((item): item is string => typeof item === "string")
    : [];
  const legacyPaths = Array.isArray(draft.galleryPaths)
    ? draft.galleryPaths.filter((item): item is string => typeof item === "string")
    : [];
  if (!legacyUrls.length) return draft;
  return {
    ...draft,
    galleryMedia: legacyUrls.map((url, index) => ({
      type: "image" as const,
      url,
      ...(legacyPaths[index] ? { storagePath: legacyPaths[index] } : {}),
    })),
  };
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function StartPage() {
  const [step, setStep] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [draftRecord, setDraftRecord] = useState<DraftRecord | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("backed-project-draft-record") ?? "null");
    } catch {
      return null;
    }
  });
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return normalizeDraft(JSON.parse(localStorage.getItem("backed-project-draft") ?? "{}"));
    } catch {
      return {};
    }
  });
  const update = (name: string, value: Draft[string]) =>
    setDraft((current) => ({ ...current, [name]: value }));
  const field = (name: string) => ({
    value: typeof draft[name] === "string" ? draft[name] : "",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(name, event.target.value),
  });

  useEffect(() => {
    localStorage.setItem("backed-project-draft", JSON.stringify(draft));
  }, [draft]);
  useEffect(() => {
    if (draftRecord)
      localStorage.setItem("backed-project-draft-record", JSON.stringify(draftRecord));
  }, [draftRecord]);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session));
      if (data.session && new URLSearchParams(location.search).get("publish") === "1")
        void publish();
    });
  }, []);

  async function saveDraft() {
    if (!supabase) throw new Error("Project saving is temporarily unavailable.");
    const secret = draftRecord?.secret ?? `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { data, error } = await supabase.functions.invoke("project-drafts", {
      body: {
        action: draftRecord ? "save" : "create",
        id: draftRecord?.id,
        secret,
        payload: draft,
      },
    });
    if (error || !data?.id) throw new Error("Could not save your draft.");
    const record = { id: data.id as string, secret };
    setDraftRecord(record);
    return record;
  }
  async function upload(files: FileList | null, role: "cover" | "gallery") {
    if (!files?.length || !supabase) return;
    if (role === "gallery" && galleryMedia.length + files.length > 12) {
      setMessage("A project gallery can include up to 12 images and videos.");
      return;
    }
    setMessage(null);
    setIsSaving(true);
    try {
      const record = await saveDraft();
      const uploads: { path: string; url: string }[] = [];
      for (const file of Array.from(files)) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error("Use a JPG, PNG, or WebP image up to 5 MB.");
        const form = new FormData();
        form.append("scope", "draft");
        form.append("draftId", record.id);
        form.append("secret", record.secret);
        form.append("file", file);
        const { data, error } = await supabase.functions.invoke("project-media", { body: form });
        if (error || !data?.url || !data?.path)
          throw new Error("Image upload failed. Please try again.");
        uploads.push({ path: data.path, url: data.url });
      }
      setDraft((current) =>
        role === "cover"
          ? uploads[0]
            ? { ...current, coverPath: uploads[0].path, coverUrl: uploads[0].url }
            : current
          : {
              ...current,
              galleryMedia: [
                ...projectMediaFromUnknown(current.galleryMedia),
                ...uploads.map((item) => ({
                  type: "image" as const,
                  url: item.url,
                  storagePath: item.path,
                })),
              ],
            },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setIsSaving(false);
      if (coverInput.current) coverInput.current.value = "";
      if (galleryInput.current) galleryInput.current.value = "";
    }
  }
  function addYouTube() {
    if (galleryMedia.length >= 12) {
      setMessage("A project gallery can include up to 12 images and videos.");
      return;
    }
    const item = normalizeYouTubeUrl(youtubeUrl);
    if (!item) {
      setMessage("Enter a valid YouTube watch, share, or Shorts URL.");
      return;
    }
    setMessage(null);
    setDraft((current) => ({
      ...current,
      galleryMedia: [...projectMediaFromUnknown(current.galleryMedia), item],
    }));
    setYoutubeUrl("");
  }
  function updateMedia(index: number, action: "up" | "down" | "remove") {
    setDraft((current) => {
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
  async function publish() {
    setMessage(null);
    setIsSaving(true);
    try {
      const record = await saveDraft();
      if (!isAuthenticated) {
        location.assign(`/auth?next=${encodeURIComponent("/start?publish=1")}`);
        return;
      }
      const { data, error } = await supabase!.functions.invoke("project-drafts", {
        body: { action: "publish", id: record.id, secret: record.secret },
      });
      if (error || !data?.slug) throw new Error(data?.error || "Could not launch your project.");
      localStorage.removeItem("backed-project-draft");
      localStorage.removeItem("backed-project-draft-record");
      location.assign(`/projects/${data.slug}?published=1&share=1`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not launch your project.");
    } finally {
      setIsSaving(false);
    }
  }
  const galleryMedia = projectMediaFromUnknown(draft.galleryMedia);
  return (
    <main className="container-backed py-10 sm:py-16">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[220px_minmax(0,680px)]">
        <aside className="min-w-0">
          <h1 className="text-3xl font-semibold">Start a project</h1>
          <ol className="-mx-4 mt-7 flex max-w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:block lg:max-w-full lg:space-y-1 lg:px-0">
            {steps.map((name, index) => (
              <li key={name}>
                <button
                  onClick={() => setStep(index)}
                  className={`flex min-w-max items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${step === index ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="grid size-6 place-items-center rounded-full border border-border text-xs">
                    {index + 1}
                  </span>
                  {name}
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <section className="min-w-0">
          <p className="text-sm font-semibold text-primary">Step {step + 1} of 5</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{steps[step]}</h2>
          <div className="mt-8 space-y-6">
            {step === 0 && (
              <>
                <Field label="Project name">
                  <Input placeholder="e.g. Your project" className="h-12" {...field("name")} />
                </Field>
                <Field label="Short description">
                  <Textarea
                    placeholder="One clear sentence about what you want to make"
                    className="min-h-28"
                    {...field("summary")}
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={typeof draft.category === "string" ? draft.category : ""}
                    onValueChange={(value) => update("category", value)}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Cover image">
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => void upload(event.target.files, "cover")}
                  />
                  {typeof draft.coverUrl === "string" && draft.coverUrl ? (
                    <div className="overflow-hidden rounded-md border">
                      <img
                        src={draft.coverUrl}
                        alt="Project cover preview"
                        className="aspect-[16/10] w-full object-cover"
                      />
                      <div className="flex gap-2 p-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => coverInput.current?.click()}
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setDraft((current) => ({ ...current, coverUrl: "", coverPath: "" }))
                          }
                        >
                          <Trash2 />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => coverInput.current?.click()}
                      className="grid min-h-44 w-full place-items-center rounded-md border border-dashed border-input bg-muted/30 text-sm font-semibold text-muted-foreground hover:bg-muted"
                    >
                      <span className="flex flex-col items-center gap-2">
                        <ImagePlus className="size-6" />
                        Upload a JPG, PNG, or WebP up to 5 MB
                      </span>
                    </button>
                  )}
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <Field label="Funding goal">
                  <Input
                    type="number"
                    min="1"
                    placeholder="$10,000"
                    className="h-12"
                    {...field("goal")}
                  />
                </Field>
                <Field label="Deadline">
                  <Input type="date" className="h-12" {...field("deadline")} />
                </Field>
                <Field label="Location (optional)">
                  <Input
                    className="h-12"
                    placeholder="e.g. Bangkok, Thailand"
                    {...field("location")}
                  />
                </Field>
                <Field label="Project dates (optional)">
                  <Input
                    className="h-12"
                    placeholder="e.g. November 1–8, 2026"
                    {...field("projectDates")}
                  />
                </Field>
                <p className="text-sm leading-6 text-muted-foreground">
                  Backed charges a 5% platform fee on each successful backing, plus payment
                  processing.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Product or reward name">
                  <Input placeholder="Founding edition" className="h-12" {...field("rewardName")} />
                </Field>
                <Field label="Minimum backing">
                  <Input
                    type="number"
                    min="1"
                    placeholder="$100"
                    className="h-12"
                    {...field("rewardPrice")}
                  />
                </Field>
                <Field label="Available quantity">
                  <Input
                    type="number"
                    min="1"
                    placeholder="100"
                    className="h-12"
                    {...field("rewardQuantity")}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    placeholder="What backers receive"
                    className="min-h-28"
                    {...field("rewardDescription")}
                  />
                </Field>
                <Field label="Estimated delivery">
                  <Input type="month" className="h-12" {...field("delivery")} />
                </Field>
              </>
            )}
            {step === 3 && (
              <>
                <Field label="Project story">
                  <Textarea
                    placeholder="Tell backers what you're making, why it matters, and how you'll make it happen."
                    className="min-h-64"
                    {...field("story")}
                  />
                </Field>
                <Field label="External website (optional)">
                  <Input
                    type="url"
                    placeholder="https://yourproject.com"
                    className="h-12"
                    {...field("externalWebsite")}
                  />
                </Field>
                <Field label="Project gallery">
                  <input
                    ref={galleryInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(event) => void upload(event.target.files, "gallery")}
                  />
                  <button
                    type="button"
                    onClick={() => galleryInput.current?.click()}
                    className="grid min-h-28 w-full place-items-center rounded-md border border-dashed border-input bg-muted/30 text-sm font-semibold text-muted-foreground hover:bg-muted"
                  >
                    <span className="flex flex-col items-center gap-2">
                      <ImagePlus className="size-6" />
                      Add images
                    </span>
                  </button>
                   <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
                  <p className="mt-2 text-xs text-muted-foreground">
                    Add images or a YouTube watch, share, or Shorts URL. Drag-free ordering controls
                    keep the sequence accessible.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {galleryMedia.map((item, index) => (
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
                            disabled={index === galleryMedia.length - 1}
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
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Field>
              </>
            )}
            {step === 4 && (
              <div>
                 <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <p className="text-sm text-muted-foreground">
                    Preview only — your project is not public until you publish it.
                  </p>
                  <Button variant="outline" onClick={() => setStep(0)}>
                    Back to edit
                  </Button>
                </div>
                <article className="overflow-hidden rounded-md border bg-card">
                  <ProjectMediaGallery
                    coverUrl={typeof draft.coverUrl === "string" ? draft.coverUrl : null}
                    media={galleryMedia}
                    projectTitle={typeof draft.name === "string" ? draft.name : "Project preview"}
                  />
                  <div className="space-y-3 p-5">
                    <p className="text-sm font-semibold text-primary">
                      {draftText(draft.category) || "Category"}
                    </p>
                    <h3 className="text-3xl font-semibold">
                      {draftText(draft.name) || "Your project title"}
                    </h3>
                    <p className="text-lg font-semibold">
                      {draftText(draft.summary) || "Your project tagline"}
                    </p>
                    <p className="text-muted-foreground">
                      {draftText(draft.story) || "Your story will appear here."}
                    </p>
                    <div className="grid grid-cols-2 gap-4 border-y py-4">
                      <div>
                        <strong className="block text-xl">
                          ${Number(draftText(draft.goal) || 0).toLocaleString()}
                        </strong>
                        <span className="text-xs text-muted-foreground">funding goal</span>
                      </div>
                      <div>
                        <strong className="block text-xl">
                          ${draftText(draft.rewardPrice) || "0"}+
                        </strong>
                        <span className="text-xs text-muted-foreground">
                          {draftText(draft.rewardName) || "Reward"}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            )}
          </div>
          <div className="mt-10 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-t border-border pt-6 [&>button:last-child]:justify-self-end">
            <Button
              variant="ghost"
              disabled={step === 0 || isSaving}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              <ArrowLeft />
              Back
            </Button>
            {step < 4 ? (
              <Button
                disabled={isSaving}
                onClick={() => {
                  void saveDraft().catch(() => undefined);
                  setStep((value) => Math.min(4, value + 1));
                }}
              >
                Continue
                <ArrowRight />
              </Button>
            ) : (
              <Button disabled={isSaving} onClick={() => void publish()}>
                {isSaving ? "Saving…" : isAuthenticated ? "Launch project" : "Sign in to launch"}
              </Button>
            )}
          </div>
          {message && <p className="mt-3 text-right text-xs text-destructive">{message}</p>}
        </section>
      </div>
      <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
        <Link to="/dashboard" className="font-semibold text-foreground hover:text-primary">
          View creator dashboard
        </Link>
      </div>
    </main>
  );
}
