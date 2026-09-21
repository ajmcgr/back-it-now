import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import { Button } from "@/components/ui/button";
import { resolveProjectCover } from "@/lib/project-presentation";
import { absoluteUrl, privateSeo, publicSeo, trimDescription } from "@/lib/seo";
import { publicSupabase, supabase } from "@/lib/supabase";

type PublicProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
};

type PublicProject = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  image_url: string | null;
  currency: string;
  funding_goal_amount: number;
  initial_backed_amount: number;
  successful_backed_amount: number;
  successful_backer_count: number;
  deadline_at: string | null;
};

export const Route = createFileRoute("/$username")({
  loader: async ({ params }) => {
    const username = params.username.toLowerCase();
    if (!publicSupabase || !/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/.test(username)) {
      throw notFound();
    }
    const [{ data: profile, error: profileError }, { data: projects, error: projectsError }] =
      await Promise.all([
        publicSupabase
          .from("public_profiles")
          .select("username, display_name, avatar_url, bio, website")
          .eq("username", username)
          .maybeSingle(),
        publicSupabase
          .from("public_profile_projects")
          .select(
            "slug, name, summary, description, image_url, currency, funding_goal_amount, initial_backed_amount, successful_backed_amount, successful_backer_count, deadline_at",
          )
          .eq("creator_username", username)
          .order("deadline_at", { ascending: true }),
      ]);
    if (profileError || projectsError) throw new Error("Public profile data is unavailable.");
    if (!profile) throw notFound();
    return { profile: profile as PublicProfile, projects: (projects ?? []) as PublicProject[] };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return privateSeo("Creator not found — Backed");
    const { profile, projects } = loaderData;
    const displayName = profile.display_name || profile.username;
    const title = `${displayName} (@${profile.username}) | Backed`;
    const description = trimDescription(
      profile.bio || `${displayName} creates projects on Backed.`,
      `${displayName} creates projects on Backed.`,
    );
    const path = `/${profile.username}`;
    const meaningful = Boolean(
      profile.bio || profile.website || profile.avatar_url || projects.length,
    );
    if (!meaningful) {
      return {
        meta: [
          { title },
          { name: "description", content: description },
          { name: "robots", content: "noindex, follow" },
        ],
        links: [{ rel: "canonical", href: absoluteUrl(path) }],
      };
    }
    return publicSeo({
      title,
      description,
      path,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: absoluteUrl(path),
        mainEntity: {
          "@type": "Person",
          name: displayName,
          alternateName: `@${profile.username}`,
          url: absoluteUrl(path),
          ...(profile.avatar_url ? { image: profile.avatar_url } : {}),
          ...(profile.bio ? { description: profile.bio } : {}),
          ...(profile.website ? { sameAs: [profile.website] } : {}),
        },
      },
    });
  },
  component: PublicProfilePage,
});

function safeWebsite(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function PublicProfilePage() {
  const { profile, projects } = Route.useLoaderData();
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: ownProfile } = await client
        .from("profiles")
        .select("username")
        .eq("id", data.session.user.id)
        .maybeSingle();
      setIsOwnProfile(ownProfile?.username?.toLowerCase() === profile.username.toLowerCase());
    });
  }, [profile.username]);

  const website = safeWebsite(profile.website);
  const displayName = profile.display_name || profile.username;

  return (
    <main className="container-backed py-14 sm:py-20">
      <section className="mx-auto max-w-3xl text-center">
        <ProfileAvatar
          avatarUrl={profile.avatar_url}
          displayName={displayName}
          username={profile.username}
          className="mx-auto size-28 border border-border sm:size-32"
        />
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <h1 className="text-4xl font-semibold sm:text-5xl">{displayName}</h1>
          {isOwnProfile ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings">Edit profile</Link>
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-lg text-muted-foreground">@{profile.username}</p>
        {profile.bio ? (
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8">{profile.bio}</p>
        ) : null}
        {website ? (
          <a
            href={website}
            target="_blank"
            rel="ugc noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            {new URL(website).hostname.replace(/^www\./, "")}
            <ExternalLink className="size-4" />
          </a>
        ) : null}
      </section>

      <section className="mx-auto mt-16 max-w-5xl">
        <h2 className="text-3xl font-semibold">Projects</h2>
        {projects.length ? (
          <div className="mt-7 grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const backed = project.initial_backed_amount + project.successful_backed_amount;
              const funded = project.funding_goal_amount
                ? Math.round((backed / project.funding_goal_amount) * 100)
                : 0;
              const coverImage = resolveProjectCover({
                slug: project.slug,
                imageUrl: project.image_url,
              });
              return (
                <article key={project.slug} className="min-w-0">
                  <Link
                    to="/projects/$slug"
                    params={{ slug: project.slug }}
                    className="block overflow-hidden rounded-md bg-muted"
                  >
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={project.name}
                        className="aspect-[16/10] w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-[16/10] bg-secondary" />
                    )}
                  </Link>
                  <Link to="/projects/$slug" params={{ slug: project.slug }}>
                    <h3 className="mt-4 text-xl font-semibold hover:text-primary">
                      {project.name}
                    </h3>
                  </Link>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
                    {project.summary || project.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      {formatMoney(backed, project.currency)} backed
                    </span>
                    <span className="text-muted-foreground">{funded}% funded</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-7 rounded-md border border-border p-8 text-center">
            <p className="text-muted-foreground">No projects yet.</p>
            {isOwnProfile ? (
              <Button className="mt-5" asChild>
                <Link to="/start">Start a project</Link>
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
