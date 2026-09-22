import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadCanonicalProjectPresentation,
  presentationAsProject,
} from "@/lib/project-presentation";
import {
  loadProjectUpdates,
  projectUpdateShareUrls,
  type ProjectUpdate,
} from "@/lib/project-updates";
import { trackShare } from "@/lib/project-share";
import { projectSocialImageUrl, publicSeo, trimDescription } from "@/lib/seo";

export const Route = createFileRoute("/projects/$slug/updates/$updateId")({
  loader: async ({ params }) => {
    const [presentation, updates] = await Promise.all([
      loadCanonicalProjectPresentation(params.slug),
      loadProjectUpdates(params.slug, params.updateId),
    ]);
    const update = updates[0];
    if (!presentation || !update) throw notFound();
    return {
      project: presentationAsProject(params.slug, presentation),
      update,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { project, update } = loaderData;
    return publicSeo({
      title: `${update.title} | ${project.title} | Backed`,
      description: trimDescription(update.body, `An update from ${project.title}.`),
      path: `/projects/${project.slug}/updates/${update.id}`,
      image: projectSocialImageUrl({
        slug: project.slug,
        name: project.title,
        summary: update.title,
        creator: project.creator,
        amountBacked: project.initialBackedAmount + project.successfulBackingAmount,
        goal: project.goal,
        backers: project.successfulBackingCount,
      }),
      type: "article",
    });
  },
  component: ProjectUpdatePage,
});

const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const wasMateriallyUpdated = (update: ProjectUpdate) =>
  new Date(update.updatedAt).getTime() - new Date(update.publishedAt).getTime() > 60_000;

function ProjectUpdatePage() {
  const { project, update } = Route.useLoaderData();
  const links = projectUpdateShareUrls(project.slug, project.title, update);
  const record = (event: string) => trackShare(project.slug, event, "project_update");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(links.url);
      record("share_copy_link");
    } catch {
      // Browsers without clipboard access can still use the visible permalink.
    }
  };

  return (
    <main className="container-backed py-12 sm:py-20">
      <article className="mx-auto max-w-[760px]">
        <a
          href={`/projects/${project.slug}#updates`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
          All {project.title} updates
        </a>
        <p className="mt-10 text-sm text-muted-foreground">
          {displayDate(update.publishedAt)}
          {wasMateriallyUpdated(update) ? ` · Updated ${displayDate(update.updatedAt)}` : ""}
        </p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{update.title}</h1>
        <p className="mt-4 text-base font-medium text-muted-foreground">
          An update from {project.title}
        </p>
        {update.imageUrl ? (
          <img
            src={update.imageUrl}
            alt={`${update.title} update`}
            className="mt-8 aspect-video w-full rounded-md border border-border object-cover"
          />
        ) : null}
        <div className="mt-8 space-y-5 text-base leading-8">
          {update.body.split(/\n{2,}/).map((paragraph, index) => (
            <p key={`${update.id}-${index}`} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 inline-flex items-center gap-2 text-sm font-semibold">
              <Share2 className="size-4" /> Share update
            </span>
            {[
              ["X", links.x, "share_x"],
              ["LinkedIn", links.linkedin, "share_linkedin"],
              ["Reddit", links.reddit, "share_reddit"],
              ["WhatsApp", links.whatsapp, "share_whatsapp"],
            ] as Array<[string, string, string]>).map(([label, href, event]) => (
              <Button key={label} asChild variant="outline" size="sm">
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
            <Button variant="outline" size="sm" onClick={() => void copyLink()}>
              Copy link
            </Button>
          </div>
          <p className="mt-4 break-all text-xs text-muted-foreground">{links.url}</p>
        </div>
      </article>
    </main>
  );
}
