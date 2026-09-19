import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ProjectGrid } from "@/components/backed/project-card";
import { Button } from "@/components/ui/button";
import { projects, type Project } from "@/lib/projects";
import { presentationAsProject, presentationFromPublicRow } from "@/lib/project-presentation";
import { publicSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Backed — Back things you want to exist" },
      {
        name: "description",
        content: "Discover products and projects from people building what's next.",
      },
      { property: "og:title", content: "Backed — Back things you want to exist" },
      {
        property: "og:description",
        content: "Discover products and projects from people building what's next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [canonicalProjects, setCanonicalProjects] = useState<Project[]>([]);
  useEffect(() => {
    if (!publicSupabase) return;
    void publicSupabase
      .from("public_profile_projects")
      .select("*")
      .then(({ data }) => {
        if (!data) return;
        setCanonicalProjects(
          data.flatMap((row) => {
            const presentation = presentationFromPublicRow(row as Record<string, unknown>);
            return presentation && typeof row.slug === "string"
              ? [presentationAsProject(row.slug, presentation)]
              : [];
          }),
        );
      });
  }, []);
  const liveProjects = [
    ...projects.filter((project) => !canonicalProjects.some((item) => item.slug === project.slug)),
    ...canonicalProjects,
  ].filter((project) => project.status === "live");
  const newAndNoteworthy = liveProjects.slice(3);
  const categories = [
    "All",
    "Technology",
    "Design",
    "Fashion",
    "Games",
    "Publishing",
    "Food",
    "Other",
  ];

  return (
    <main>
      <section className="container-backed pb-16 pt-20 text-center sm:pb-24 sm:pt-28">
        <div className="mx-auto max-w-4xl">
          <nav
            aria-label="Project categories"
            className="mb-7 flex flex-wrap justify-center gap-x-4 gap-y-2"
          >
            {categories.map((category) => (
              <Link
                key={category}
                to="/discover"
                search={{ q: "", category }}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {category}
              </Link>
            ))}
          </nav>
          <h1 className="text-5xl font-semibold leading-[1.02] text-foreground sm:text-7xl lg:text-8xl">
            Back things you want to exist.
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-7 text-muted-foreground">
            Discover products and projects from people building what's next.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/discover" search={{ q: "", category: "" }}>
                Explore projects
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/start">Start a project</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Free to launch. 5% on what you raise.
          </p>
        </div>
      </section>

      <section className="container-backed pb-24">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold">Projects worth backing</h2>
          <Link
            to="/discover"
            search={{ q: "", category: "" }}
            className="hidden items-center gap-1 text-sm font-semibold hover:text-primary sm:inline-flex"
          >
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        <ProjectGrid items={liveProjects.slice(0, 3)} />
      </section>

      {newAndNoteworthy.length > 0 && (
        <section className="border-t border-border bg-muted/40 py-20">
          <div className="container-backed text-center">
            <h2 className="mb-8 text-3xl font-semibold">New &amp; noteworthy</h2>
            <ProjectGrid items={newAndNoteworthy} />
          </div>
        </section>
      )}

      <section className="container-backed py-20 text-center sm:py-28">
        <h2 className="mx-auto max-w-2xl text-4xl font-semibold sm:text-5xl">
          Have something you want to make?
        </h2>
        <Link
          to="/start"
          className="mt-6 inline-flex items-center gap-2 text-lg font-semibold text-primary"
        >
          Start a project <ArrowRight className="size-5" />
        </Link>
      </section>
    </main>
  );
}
