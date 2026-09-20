import { createFileRoute, Link } from "@tanstack/react-router";
import { ImagePlus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/projects/$slug/edit")({
  head: () => privateSeo("Edit project — Backed"),
  component: EditProject,
});
const categories = ["Technology", "Design", "Fashion", "Games", "Publishing", "Food", "Other"];
type Form = Record<string, string | string[]>;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const urls = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function EditProject() {
  const { slug } = Route.useParams();
  const [form, setForm] = useState<Form>({});
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    void supabase.functions
      .invoke("project-owner", { body: { action: "get", slug } })
      .then(({ data, error }) => {
        if (error || !data?.project) {
          setMessage("You do not have access to edit this project.");
          setLoading(false);
          return;
        }
        const project = data.project;
        const reward = data.reward ?? {};
        setRestricted(project.successful_backed_amount > 0 || project.successful_backer_count > 0);
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
          galleryUrls: urls(project.gallery_urls),
          rewardName: reward.title ?? "",
          rewardDescription: reward.description ?? "",
          rewardPrice: String((reward.amount ?? 0) / 100),
          rewardQuantity: String(reward.total_quantity ?? 1),
        });
        setLoading(false);
      });
  }, [slug]);
  async function upload(files: FileList | null, role: "cover" | "gallery") {
    if (!files?.length || !supabase) return;
    setSaving(true);
    setMessage(null);
    try {
      const results: string[] = [];
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
        if (response.error || !response.data?.url) throw new Error("Image upload failed.");
        results.push(response.data.url);
      }
      setForm((current) =>
        role === "cover"
          ? { ...current, coverUrl: results[0] }
          : { ...current, galleryUrls: [...urls(current.galleryUrls), ...results] },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setSaving(false);
      if (coverInput.current) coverInput.current.value = "";
      if (galleryInput.current) galleryInput.current.value = "";
    }
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
        galleryUrls: urls(form.galleryUrls),
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
  const gallery = urls(form.galleryUrls);
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
          <span className="mb-2 block text-sm font-semibold">Gallery</span>
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
          <div className="mt-3 grid grid-cols-2 gap-3">
            {gallery.map((url, index) => (
              <div key={url} className="overflow-hidden rounded-md border">
                <img
                  src={url}
                  alt={`Gallery ${index + 1}`}
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="flex justify-end p-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-destructive"
                    onClick={() =>
                      set(
                        "galleryUrls",
                        gallery.filter((_, item) => item !== index),
                      )
                    }
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
      </div>
    </main>
  );
}
