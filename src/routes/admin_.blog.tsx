import { createFileRoute } from "@tanstack/react-router";
import { Check, ImageIcon, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminLoading, AdminShell, AdminUnavailable } from "@/components/backed/admin-shell";
import { Button } from "@/components/ui/button";
import { publishedBlogArticles } from "@/content/blog";
import { privateSeo } from "@/lib/seo";
import { supabase } from "@/lib/supabase";

type ImageState = {
  slug: string;
  status: "pending" | "ready";
  generation_status: "idle" | "generating" | "failed";
  public_url: string | null;
  updated_at: string;
  generation_count: number;
};

type StatusResponse = {
  images: ImageState[];
  openAiConfigured: boolean;
  model: string;
};

export const Route = createFileRoute("/admin_/blog")({
  head: () => privateSeo("Blog — Backed Admin"),
  component: AdminBlog,
});

async function invokeBlogImage(body: Record<string, string>) {
  if (!supabase) throw new Error("Blog image service is unavailable.");
  const { data, error } = await supabase.functions.invoke("blog-image", { body });
  if (error) throw new Error(error.message || "The image service could not be reached.");
  if (data?.error) throw new Error(data.error);
  return data;
}

function AdminBlog() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [denied, setDenied] = useState(false);
  const [activeSlug, setActiveSlug] = useState("");
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const response = (await invokeBlogImage({ action: "status" })) as StatusResponse;
      setStatus(response);
    } catch {
      setDenied(true);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function generate(slug: string) {
    setActiveSlug(slug);
    setMessage("");
    try {
      await invokeBlogImage({ action: "generate", slug });
      setMessage("Editorial image generated and stored.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The image could not be generated.");
    } finally {
      setActiveSlug("");
    }
  }

  if (denied) return <AdminUnavailable message="You don’t have access to Backed Admin." />;
  if (!status) return <AdminLoading />;

  const stateBySlug = new Map(status.images.map((image) => [image.slug, image]));

  return (
    <AdminShell
      active="blog"
      title="Blog"
      description="Backed publishes a new article and cover automatically every seven days. These controls remain available for optional launch-article image regeneration."
    >
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="rounded-md border border-border px-2.5 py-1.5">{status.model}</span>
        <span className="inline-flex items-center gap-1.5">
          {status.openAiConfigured ? <Check className="size-4 text-primary" /> : null}
          {status.openAiConfigured ? "OpenAI configured" : "OPENAI_API_KEY is not configured"}
        </span>
      </div>

      {message ? (
        <p
          role="status"
          className="mb-5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
        >
          {message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {publishedBlogArticles.map((article) => {
          const image = stateBySlug.get(article.slug);
          const isGenerating = activeSlug === article.slug;
          return (
            <article
              key={article.slug}
              className="flex flex-col gap-4 border-b border-border p-4 last:border-0 sm:flex-row sm:items-center sm:p-5"
            >
              <div className="aspect-[16/9] w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-36">
                {image?.public_url ? (
                  <img src={image.public_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{article.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {image?.status === "ready"
                    ? `Ready · generated ${image.generation_count} time${image.generation_count === 1 ? "" : "s"}`
                    : image?.generation_status === "failed"
                      ? "Last generation failed; the previous image remains available if one exists."
                      : "Using the Backed fallback image."}
                </p>
              </div>
              <Button
                type="button"
                variant={image?.status === "ready" ? "outline" : "default"}
                size="sm"
                disabled={!status.openAiConfigured || Boolean(activeSlug)}
                onClick={() => void generate(article.slug)}
              >
                {isGenerating ? (
                  <LoaderCircle className="animate-spin" />
                ) : image?.status === "ready" ? (
                  <RefreshCw />
                ) : (
                  <ImageIcon />
                )}
                {isGenerating
                  ? "Generating…"
                  : image?.status === "ready"
                    ? "Regenerate"
                    : "Generate"}
              </Button>
            </article>
          );
        })}
      </div>
    </AdminShell>
  );
}
