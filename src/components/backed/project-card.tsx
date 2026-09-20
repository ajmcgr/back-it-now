import { Link } from "@tanstack/react-router";
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
        {creator?.displayName || creator?.username || "Creator"}
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
          <h3 className="mt-3 text-xl font-semibold leading-tight text-foreground group-hover:text-primary">
            {project.title}
          </h3>
        </Link>
        <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {project.description}
        </p>
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
