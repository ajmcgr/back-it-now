import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import { resolveProjectCover, type CanonicalProjectCreator } from "@/lib/project-presentation";
import { amountBacked, daysRemaining, money, percent, type Project } from "@/lib/projects";

export function CreatorIdentity({ creator }: { creator: CanonicalProjectCreator | null }) {
  const identity = (
    <>
      <ProfileAvatar
        avatarUrl={creator?.avatarUrl}
        displayName={creator?.displayName}
        username={creator?.username}
        className="size-7"
      />
      <span className="text-xs font-semibold text-muted-foreground">
        {creator?.username ? `@${creator.username}` : "Creator"}
      </span>
    </>
  );
  return creator ? (
    <Link
      to="/$username"
      params={{ username: creator.username }}
      className="flex w-fit items-center gap-2 hover:text-primary"
    >
      {identity}
    </Link>
  ) : (
    <div className="flex items-center gap-2">{identity}</div>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const funded = percent(project);
  const isPrelaunch = project.status === "prelaunch";
  const creator = project.creatorUsername
    ? {
        username: project.creatorUsername,
        displayName: project.creator,
        avatarUrl: project.creatorAvatarUrl ?? null,
      }
    : null;
  const coverImage = resolveProjectCover({
    slug: project.slug,
    coverImage: project.coverImage,
    gallery: project.gallery,
  });
  return (
    <article className="group min-w-0">
      <Link
        to="/projects/$slug"
        params={{ slug: project.slug }}
        className="block overflow-hidden rounded-md bg-muted"
      >
        {coverImage ? (
          <img
            src={coverImage}
            alt={project.title}
            loading="lazy"
            width={720}
            height={480}
            className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-[16/10] bg-secondary" />
        )}
      </Link>
      <div className="pt-4">
        <CreatorIdentity creator={creator} />
        <Link to="/projects/$slug" params={{ slug: project.slug }}>
          <h3 className="mt-3 text-xl font-semibold text-foreground group-hover:text-primary">
            {project.title}
          </h3>
        </Link>
        <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {project.description}
        </p>
        {isPrelaunch ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
            <strong>Coming soon</strong>
            <span className="text-muted-foreground">
              {project.favoriteCount} {project.favoriteCount === 1 ? "person" : "people"} interested
            </span>
          </div>
        ) : (
          <>
            <Progress value={Math.min(funded, 100)} className="mt-4 h-1.5" />
            <div className="mt-2 flex items-start justify-between gap-3 text-xs">
              <div>
                <strong className="block text-sm text-foreground">
                  {money(amountBacked(project))}
                </strong>
                <span className="text-muted-foreground">{funded}% funded</span>
              </div>
              <span className="pt-1 text-muted-foreground">{daysRemaining(project)} days left</span>
            </div>
          </>
        )}
        <div
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"
          aria-label={
            isPrelaunch
              ? `${project.favoriteCount} interested, ${project.commentCount} comments`
              : `${project.successfulBackingCount} backers, ${project.commentCount} comments, ${project.favoriteCount} favorites`
          }
        >
          <span className={`inline-flex items-center gap-1.5 ${isPrelaunch ? "hidden" : ""}`}>
            <Users className="size-3.5" aria-hidden="true" />
            {project.successfulBackingCount}
            <span className="sr-only"> backers</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-3.5" aria-hidden="true" />
            {project.commentCount}
            <span className="sr-only"> comments</span>
          </span>
          <span className={`inline-flex items-center gap-1.5 ${isPrelaunch ? "hidden" : ""}`}>
            <Heart className="size-3.5" aria-hidden="true" />
            {project.favoriteCount}
            <span className="sr-only"> favorites</span>
          </span>
        </div>
      </div>
    </article>
  );
}

export function ProjectGrid({ items }: { items: Project[] }) {
  return (
    <div className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((project) => (
        <ProjectCard key={project.slug} project={project} />
      ))}
    </div>
  );
}

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

export function ProjectList({ items, numbered = false }: { items: Project[]; numbered?: boolean }) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((project, index) => {
        const isPrelaunch = project.status === "prelaunch";
        const coverImage = resolveProjectCover({
          slug: project.slug,
          coverImage: project.coverImage,
          gallery: project.gallery,
        });

        return (
          <article key={project.slug}>
            <Link
              to="/projects/$slug"
              params={{ slug: project.slug }}
              className={`group grid min-w-0 gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 sm:items-center sm:gap-5 ${
                numbered
                  ? "grid-cols-[24px_80px_minmax(0,1fr)] sm:grid-cols-[28px_128px_minmax(0,1fr)_auto]"
                  : "grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[128px_minmax(0,1fr)_auto]"
              }`}
            >
              {numbered ? (
                <span
                  className="self-start pt-1 text-sm font-semibold tabular-nums text-muted-foreground sm:self-center sm:pt-0"
                  aria-label={`Rank ${index + 1}`}
                >
                  {index + 1}
                </span>
              ) : null}
              <div className="overflow-hidden rounded-md bg-muted">
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt=""
                    loading="lazy"
                    width={256}
                    height={160}
                    className="aspect-[16/10] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="aspect-[16/10] bg-secondary" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-2">
                  <h3 className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary sm:text-lg">
                    {project.title}
                  </h3>
                  <span className="hidden truncate text-xs text-muted-foreground md:inline">
                    by {project.creatorUsername ? `@${project.creatorUsername}` : project.creator}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {project.tagline || project.description}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground tabular-nums">
                  {isPrelaunch ? (
                    <>
                      <span>{plural(project.favoriteCount, "person", "people")} interested</span>
                      <span aria-hidden="true">·</span>
                      <span>{plural(project.commentCount, "comment")}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">
                        {money(amountBacked(project))} backed
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{plural(project.successfulBackingCount, "backer")}</span>
                      <span aria-hidden="true">·</span>
                      <span>{plural(project.favoriteCount, "favorite")}</span>
                      <span aria-hidden="true">·</span>
                      <span>{plural(project.commentCount, "comment")}</span>
                    </>
                  )}
                </p>
                <p className="mt-2 text-xs font-semibold sm:hidden">
                  {isPrelaunch ? "Coming soon" : `${daysRemaining(project)} days left`}
                </p>
              </div>

              <p className="hidden whitespace-nowrap text-right text-sm font-semibold sm:block">
                {isPrelaunch ? "Coming soon" : `${daysRemaining(project)} days left`}
              </p>
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function ProjectResults({
  items,
  view,
  numbered = false,
}: {
  items: Project[];
  view: "list" | "cards";
  numbered?: boolean;
}) {
  return view === "list" ? (
    <ProjectList items={items} numbered={numbered} />
  ) : (
    <ProjectGrid items={items} />
  );
}
