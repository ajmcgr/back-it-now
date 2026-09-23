import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BackingCheckoutButton } from "@/components/backed/backing-dialog";
import { ProjectComments } from "@/components/backed/project-comments";
import { ProjectFavoriteButton } from "@/components/backed/project-favorite-button";
import { ProjectMediaGallery } from "@/components/backed/project-media-gallery";
import { ProjectBackers } from "@/components/backed/project-backers";
import { ProjectGrid } from "@/components/backed/project-card";
import { ProjectPosterDialog } from "@/components/backed/project-poster";
import { ProjectUpdates } from "@/components/backed/project-updates";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  presentationAsProject,
  loadCanonicalProjectPresentation,
  loadSimilarCanonicalProjects,
  resolveProjectCover,
} from "@/lib/project-presentation";
import { type ShareContext } from "@/lib/project-share";
import { loadProjectComments } from "@/lib/project-comments";
import {
  absoluteUrl,
  privateSeo,
  projectSocialImageUrl,
  publicSeo,
  trimDescription,
} from "@/lib/seo";
import { supabase } from "@/lib/supabase";
import {
  amountBacked,
  daysRemaining,
  money,
  percent,
  projects,
  rewardAvailability,
} from "@/lib/projects";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params }) => {
    const [presentation, similarPresentations] = await Promise.all([
      loadCanonicalProjectPresentation(params.slug),
      loadSimilarCanonicalProjects(params.slug),
    ]);
    const fallback = projects.find((item) => item.slug === params.slug && item.status === "live");
    if (!presentation && !fallback) throw notFound();
    return {
      slug: params.slug,
      presentation,
      similarProjects: similarPresentations.map(
        ({
          slug,
          presentation: similar,
        }: Awaited<ReturnType<typeof loadSimilarCanonicalProjects>>[number]) =>
          presentationAsProject(slug, similar),
      ),
    };
  },
  head: ({ loaderData }) => {
    const slug = loaderData?.slug ?? "project";
    const presentation = loaderData?.presentation ?? null;
    const fallback = projects.find((item) => item.slug === slug && item.status === "live");
    const project = presentation ? presentationAsProject(slug, presentation) : fallback;
    if (!project) return privateSeo("Project not found — Backed");
    const title = `${project.title} | Backed`;
    const description = trimDescription(
      project.tagline,
      project.status === "prelaunch"
        ? `Follow ${project.title} on Backed and get notified when it launches.`
        : `Back ${project.title} on Backed.`,
    );
    const path = `/projects/${project.slug}`;
    const coverImage = absoluteUrl(
      resolveProjectCover({
        slug: project.slug,
        imageUrl: presentation?.imageUrl ?? null,
        coverImage: project.coverImage,
        gallery: project.gallery,
      }) ?? "/logo.png",
    );
    const image = projectSocialImageUrl({
      slug: project.slug,
      name: project.title,
      summary: project.tagline,
      creator: project.creator,
      amountBacked: project.initialBackedAmount + project.successfulBackingAmount,
      goal: project.goal,
      backers: project.successfulBackingCount,
    });
    const creatorName = presentation?.creator.displayName || presentation?.creator.username;
    return publicSeo({
      title,
      description,
      path,
      image,
      type: "website",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CreativeWork",
            "@id": `${absoluteUrl(path)}#project`,
            url: absoluteUrl(path),
            name: project.title,
            headline: project.tagline,
            description: project.description || project.tagline,
            image: coverImage,
            genre: project.category,
            ...(creatorName && presentation
              ? {
                  creator: {
                    "@type": "Person",
                    name: creatorName,
                    url: absoluteUrl(`/${presentation.creator.username}`),
                  },
                }
              : {}),
            isPartOf: { "@type": "WebSite", name: "Backed", url: absoluteUrl("/") },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Discover",
                item: absoluteUrl("/discover"),
              },
              { "@type": "ListItem", position: 2, name: project.title, item: absoluteUrl(path) },
            ],
          },
        ],
      },
    });
  },
  component: ProjectPage,
});

function ProjectPage() {
  const { slug, presentation, similarProjects } = Route.useLoaderData();
  const fallback = projects.find((item) => item.slug === slug && item.status === "live");
  const [tab, setTab] = useState("Story");
  const [isOwner, setIsOwner] = useState(false);
  const [ownershipResolved, setOwnershipResolved] = useState(false);
  const [isPosterOpen, setIsPosterOpen] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState(false);
  const [checkoutSucceeded, setCheckoutSucceeded] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [commentCount, setCommentCount] = useState<number | null>(
    presentation?.commentCount ?? fallback?.commentCount ?? null,
  );
  const [checkoutConfirmation, setCheckoutConfirmation] = useState<{
    state: "idle" | "confirming" | "confirmed" | "delayed";
    amount?: number;
  }>({ state: "idle" });
  const project = presentation ? presentationAsProject(slug, presentation) : fallback;
  const isPrelaunch = project?.status === "prelaunch";
  const creator = presentation?.creator;
  useEffect(() => {
    const selectLinkedTab = () => {
      if (isPrelaunch) {
        setTab("Story");
        return;
      }
      const linkedTab = {
        "#updates": "Updates",
        "#backers": "Backers",
        "#comments": "Comments",
      }[window.location.hash];
      setTab(linkedTab ?? "Story");
    };
    selectLinkedTab();
    window.addEventListener("hashchange", selectLinkedTab);
    return () => window.removeEventListener("hashchange", selectLinkedTab);
  }, [isPrelaunch]);
  useEffect(() => {
    if (isPrelaunch) return;
    let cancelled = false;
    void loadProjectComments(slug)
      .then((comments) => {
        if (!cancelled) setCommentCount(comments.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isPrelaunch, slug]);
  useEffect(() => {
    if (!supabase || !creator?.username) {
      setOwnershipResolved(true);
      return;
    }
    const client = supabase;
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setOwnershipResolved(true);
        return;
      }
      const { data: profile } = await client
        .from("profiles")
        .select("username")
        .eq("id", data.session.user.id)
        .maybeSingle();
      const ownsProject = profile?.username?.toLowerCase() === creator.username.toLowerCase();
      setIsOwner(ownsProject);
      const params = new URLSearchParams(window.location.search);
      if (ownsProject && params.get("share") === "1") {
        setIsPosterOpen(true);
      }
      setPublishedNotice(ownsProject && params.get("published") === "1");
      setOwnershipResolved(true);
    });
  }, [creator?.username]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success" || !supabase) return;
    const client = supabase;
    let cancelled = false;
    const returnedSessionId = params.get("session_id");
    setCheckoutConfirmation({ state: "confirming" });
    const confirmBacking = async () => {
      const { data: auth } = await client.auth.getSession();
      if (!auth.session) {
        if (!cancelled) setCheckoutConfirmation({ state: "delayed" });
        return;
      }
      const { data: canonicalProject } = await client
        .from("projects")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!canonicalProject) {
        if (!cancelled) setCheckoutConfirmation({ state: "delayed" });
        return;
      }
      for (let attempt = 0; attempt < 10 && !cancelled; attempt += 1) {
        let query = client
          .from("backings")
          .select("gross_amount, stripe_checkout_session_id, paid_at")
          .eq("project_id", canonicalProject.id)
          .eq("backer_id", auth.session.user.id)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
          .limit(1);
        if (returnedSessionId) query = query.eq("stripe_checkout_session_id", returnedSessionId);
        const { data: matchingBackings } = await query;
        const backing = matchingBackings?.[0];
        if (backing) {
          setCheckoutSucceeded(true);
          setCheckoutConfirmation({ state: "confirmed", amount: backing.gross_amount });
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      if (!cancelled) setCheckoutConfirmation({ state: "delayed" });
    };
    void confirmBacking();
    return () => {
      cancelled = true;
    };
  }, [slug]);
  const launchProject = async () => {
    if (!supabase || isLaunching) return;
    setIsLaunching(true);
    setLaunchError("");
    const { data, error } = await supabase.functions.invoke("project-lifecycle", {
      body: { slug },
    });
    setIsLaunching(false);
    if (error || !data?.slug) {
      setLaunchError("We couldn’t launch this project. Please try again.");
      return;
    }
    window.location.assign(`/projects/${data.slug}?published=1&share=1`);
  };
  if (!project)
    return (
      <main className="container-backed py-24 text-center text-muted-foreground">
        Loading project…
      </main>
    );
  const coverImage = resolveProjectCover({
    slug: project.slug,
    imageUrl: presentation?.imageUrl ?? null,
    coverImage: project.coverImage,
    gallery: project.gallery,
  });
  const funded = percent(project);
  const remaining = daysRemaining(project);
  const availability =
    presentation?.rewardAvailableQuantity === null ||
    presentation?.rewardAvailableQuantity === undefined
      ? rewardAvailability(project.reward)
      : `${presentation.rewardAvailableQuantity} available`;
  const locationDetails = [project.location, project.projectDates].filter(Boolean).join(" · ");
  return (
    <main className="pb-28 lg:pb-24">
      <div className="container-backed pt-8 sm:pt-16">
        {publishedNotice && (
          <div className="mb-8 rounded-md border border-primary/30 bg-primary/5 p-5">
            <p className="text-xl font-semibold">
              {isPrelaunch ? "Your pre-launch page is public" : "Your project is live 🎉"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPrelaunch
                ? "Share it to build interest before you launch."
                : "Now get your first backers."}
            </p>
            <Button className="mt-4" onClick={() => setIsPosterOpen(true)}>
              Share project
            </Button>
          </div>
        )}
        {checkoutConfirmation.state !== "idle" && (
          <div className="mb-8 rounded-md border border-primary/30 bg-primary/5 p-5">
            {checkoutConfirmation.state === "confirmed" ? (
              <>
                <p className="text-xl font-semibold">You’re backing {project.title} 🎉</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {money((checkoutConfirmation.amount ?? 0) / 100)} backed
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button asChild>
                    <a href="/dashboard?tab=backed">View your backed projects</a>
                  </Button>
                  <Button variant="outline" onClick={() => setIsPosterOpen(true)}>
                    Share project
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold">Confirming your backing…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {checkoutConfirmation.state === "delayed"
                    ? "This is taking longer than expected. Your dashboard will update as soon as confirmation completes."
                    : "This usually takes only a few seconds."}
                </p>
                {checkoutConfirmation.state === "delayed" ? (
                  <Button asChild variant="outline" className="mt-4">
                    <a href="/dashboard?tab=backed">Check your backed projects</a>
                  </Button>
                ) : null}
              </>
            )}
          </div>
        )}
        <div className="mb-8 max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-4 truncate text-sm text-muted-foreground">
            <Link
              to="/discover"
              search={{ category: project.category }}
              className="hover:text-primary"
            >
              Discover
            </Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page">{project.title}</span>
          </nav>
          <span className="text-sm font-semibold text-primary">{project.category}</span>
          <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">{project.title}</h1>
          <p className="mt-4 text-xl font-semibold leading-7 text-foreground sm:text-2xl">
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
            {locationDetails ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4" />
                {locationDetails}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ProjectMediaGallery
            coverUrl={coverImage}
            media={project.media ?? project.gallery.slice(1).map((url) => ({ type: "image", url }))}
            projectTitle={project.title}
          />

          <aside className="lg:sticky lg:top-24 lg:self-start">
            {isPrelaunch ? (
              <div className="border-y border-border py-5">
                <p className="text-sm font-semibold text-primary">Pre-launch</p>
                <p className="mt-2 text-3xl font-semibold">
                  {project.plannedLaunchAt
                    ? `Launching ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(project.plannedLaunchAt))}`
                    : "Coming soon"}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {project.favoriteCount} {project.favoriteCount === 1 ? "person is" : "people are"}{" "}
                  interested
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}
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
            {isPrelaunch ? (
              !ownershipResolved ? (
                <Button size="lg" className="w-full" disabled>
                  Checking availability…
                </Button>
              ) : isOwner ? (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={isLaunching}
                  onClick={() => void launchProject()}
                >
                  {isLaunching ? "Launching…" : "Launch project"}
                </Button>
              ) : (
                <ProjectFavoriteButton
                  slug={project.slug}
                  initialCount={project.favoriteCount}
                  notificationMode
                />
              )
            ) : ownershipResolved ? (
              isOwner ? (
                <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                  You can’t back your own project.
                </div>
              ) : (
                <BackingCheckoutButton project={project} />
              )
            ) : (
              <Button size="lg" className="w-full" disabled>
                Checking availability…
              </Button>
            )}
            <Button variant="outline" className="mt-3 w-full" onClick={() => setIsPosterOpen(true)}>
              {isOwner ? "Share project" : "Share"}
            </Button>
            {!isPrelaunch ? (
              <div className="mt-3">
                <ProjectFavoriteButton slug={project.slug} initialCount={project.favoriteCount} />
              </div>
            ) : null}
            {isOwner && (
              <Button asChild variant="ghost" className="mt-1 w-full">
                <Link to="/projects/$slug/edit" params={{ slug: project.slug }}>
                  Edit project
                </Link>
              </Button>
            )}
            {launchError ? <p className="mt-3 text-xs text-destructive">{launchError}</p> : null}
            {!isPrelaunch ? (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                This is a reward-based project. Backing does not provide equity, ownership, or
                financial returns.
              </p>
            ) : null}
          </aside>
        </div>
      </div>

      <div className="mt-14 border-y border-border">
        <div
          className="container-backed flex gap-7 overflow-x-auto [scrollbar-width:none]"
          role="tablist"
          aria-label="Project details"
        >
          {(isPrelaunch
            ? (["Story"] as const)
            : (["Story", "Updates", "Backers", "Comments"] as const)
          ).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => {
                setTab(item);
                const hash = item === "Story" ? "" : `#${item.toLowerCase()}`;
                window.history.replaceState(
                  null,
                  "",
                  `${window.location.pathname}${window.location.search}${hash}`,
                );
              }}
              className={`shrink-0 border-b-2 py-5 text-sm font-semibold ${tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              {item === "Comments" && commentCount !== null ? `Comments (${commentCount})` : item}
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
            {project.externalWebsite ? (
              <a
                href={project.externalWebsite}
                target="_blank"
                rel="ugc noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                Visit {project.title}
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </article>
        ) : tab === "Updates" ? (
          <ProjectUpdates slug={project.slug} projectName={project.title} isOwner={isOwner} />
        ) : tab === "Backers" ? (
          <ProjectBackers
            slug={project.slug}
            backingCount={project.successfulBackingCount}
            isOwner={isOwner}
          />
        ) : (
          <ProjectComments slug={project.slug} onCountChange={setCommentCount} />
        )}
      </div>

      {similarProjects.length > 0 ? (
        <section className="border-t border-border py-16 sm:py-20">
          <div className="container-backed">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="text-3xl font-semibold">Similar projects</h2>
              <Link
                to="/discover"
                search={{}}
                className="hidden items-center gap-1 text-sm font-semibold transition-colors hover:text-primary sm:inline-flex"
              >
                Explore more projects <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <ProjectGrid items={similarProjects} />
            <Link
              to="/discover"
              search={{}}
              className="mt-8 inline-flex items-center gap-1 text-sm font-semibold transition-colors hover:text-primary sm:hidden"
            >
              Explore more projects <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-3 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] lg:hidden">
        {isPrelaunch ? (
          !ownershipResolved ? (
            <Button className="w-full" disabled>
              Checking availability…
            </Button>
          ) : isOwner ? (
            <Button className="w-full" disabled={isLaunching} onClick={() => void launchProject()}>
              {isLaunching ? "Launching…" : "Launch project"}
            </Button>
          ) : (
            <ProjectFavoriteButton
              slug={project.slug}
              initialCount={project.favoriteCount}
              notificationMode
            />
          )
        ) : ownershipResolved ? (
          isOwner ? (
            <Button className="w-full" onClick={() => setIsPosterOpen(true)}>
              Share project
            </Button>
          ) : (
            <BackingCheckoutButton project={project} className="w-full" />
          )
        ) : (
          <Button className="w-full" disabled>
            Checking availability…
          </Button>
        )}
      </div>
      {creator && (
        <ProjectPosterDialog
          open={isPosterOpen}
          onOpenChange={setIsPosterOpen}
          project={{
            slug: project.slug,
            name: project.title,
            summary: project.tagline,
            coverImage,
            creatorName: creator.displayName || creator.username,
            amountBacked: amountBacked(project) * 100,
            goal: project.goal * 100,
          }}
          context={
            isOwner
              ? publishedNotice
                ? "owner_launch"
                : "owner_general"
              : checkoutSucceeded
                ? "backer"
                : "visitor"
          }
        />
      )}
    </main>
  );
}
