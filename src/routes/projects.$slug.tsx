import { createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BackingDialog } from "@/components/backed/backing-dialog";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { resolveProjectCover, useCanonicalProjectPresentation } from "@/lib/project-presentation";
import {
  amountBacked,
  daysRemaining,
  money,
  percent,
  projects,
  rewardAvailability,
} from "@/lib/projects";

export const Route = createFileRoute("/projects/$slug")({
  loader: ({ params }) => {
    const project = projects.find((item) => item.slug === params.slug && item.status === "live");
    if (!project) throw notFound();
    return project;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — Backed` : "Project unavailable — Backed" },
      {
        name: "description",
        content: loaderData?.description ?? "This Backed project is unavailable.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.title} — Backed` : "Project unavailable — Backed",
      },
      {
        property: "og:description",
        content: loaderData?.description ?? "This Backed project is unavailable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const project = Route.useLoaderData();
  const [tab, setTab] = useState("Story");
  const presentation = useCanonicalProjectPresentation(project.slug);
  const creator = presentation?.creator;
  const coverImage = resolveProjectCover({
    slug: project.slug,
    imageUrl: presentation?.imageUrl,
    coverImage: project.coverImage,
    gallery: project.gallery,
  });
  const funded = percent(project);
  const remaining = daysRemaining(project);
  const availability = rewardAvailability(project.reward);

  return (
    <main className="pb-24">
      <div className="container-backed pt-10 sm:pt-16">
        <div className="mb-8 max-w-3xl">
          <span className="text-sm font-semibold text-primary">{project.category}</span>
          <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">{project.title}</h1>
          <p className="mt-4 text-xl font-semibold text-foreground sm:text-2xl">
            {project.tagline}
          </p>
          <p className="mt-3 text-lg text-muted-foreground">{project.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                avatarUrl={creator?.avatarUrl}
                displayName={creator?.displayName}
                username={creator?.username}
                className="size-10"
              />
              <div>
                {creator ? (
                  <Link
                    to="/$username"
                    params={{ username: creator.username }}
                    className="block font-bold hover:text-primary"
                  >
                    {creator.displayName || creator.username}
                  </Link>
                ) : (
                  <strong className="block">Creator</strong>
                )}
                {creator ? <p className="text-muted-foreground">@{creator.username}</p> : null}
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-4" />
              {project.location} · {project.projectDates}
            </span>
          </div>
        </div>

        <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            {coverImage ? (
              <img
                src={coverImage}
                alt={project.title}
                width={720}
                height={480}
                className="aspect-[16/10] w-full rounded-md object-cover"
              />
            ) : (
              <div className="aspect-[16/10] rounded-md bg-secondary" />
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              {project.gallery.slice(1).map((image, index) => (
                <img
                  key={image}
                  src={image}
                  alt={`${project.title} gallery image ${index + 2}`}
                  loading="lazy"
                  width={720}
                  height={480}
                  className="aspect-[4/3] w-full rounded-md object-cover"
                />
              ))}
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-4xl font-semibold">{money(amountBacked(project))}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              backed of {money(project.goal)} goal
            </p>
            <Progress value={Math.min(funded, 100)} className="my-6 h-2" />
            <p className="mb-5 text-sm font-semibold">{funded}% funded</p>
            <div className="grid grid-cols-2 gap-5 border-y border-border py-5">
              <div>
                <strong className="block text-xl">{project.successfulBackingCount}</strong>
                <span className="text-xs text-muted-foreground">backers</span>
              </div>
              <div>
                <strong className="block text-xl">{remaining}</strong>
                <span className="text-xs text-muted-foreground">days to go</span>
              </div>
            </div>
            <div className="my-6 rounded-md border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reward
              </p>
              <h2 className="mt-2 text-xl font-semibold">{project.reward.name}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {project.reward.description}
              </p>
              {availability && <p className="mt-3 text-sm font-semibold">{availability}</p>}
            </div>
            <BackingDialog project={project} />
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              This is a reward-based project. Backing does not provide equity, ownership, or
              financial returns.
            </p>
          </aside>
        </div>
      </div>

      <div className="mt-14 border-y border-border">
        <div className="container-backed flex gap-8">
          {["Story", "Updates", "Backers"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`border-b-2 py-5 text-sm font-semibold ${tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="container-backed grid gap-10 py-12 lg:grid-cols-[minmax(0,760px)_1fr]">
        {tab === "Story" ? (
          <article className="space-y-7 text-base leading-8 text-foreground">
            <h2 className="text-3xl font-semibold">One week to build</h2>
            {project.story.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <a
              href={project.externalWebsite}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
            >
              Visit Launch Island
              <ExternalLink className="size-4" />
            </a>
          </article>
        ) : (
          <div className="py-16">
            <h2 className="text-2xl font-semibold">{tab}</h2>
            <p className="mt-2 text-muted-foreground">Nothing has been posted here yet.</p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background p-3 lg:hidden">
        <BackingDialog project={project}>
          <Button size="lg" className="w-full">
            Back this project
          </Button>
        </BackingDialog>
      </div>
    </main>
  );
}
