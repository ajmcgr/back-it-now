import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ProjectGrid } from "@/components/backed/project-card";
import { Button } from "@/components/ui/button";
import { projects, type Project } from "@/lib/projects";
import { loadCanonicalProjects, presentationAsProject } from "@/lib/project-presentation";
import { absoluteUrl, publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: async () =>
    (await loadCanonicalProjects()).map(({ slug, presentation }) =>
      presentationAsProject(slug, presentation),
    ),
  head: () =>
    publicSeo({
      title: "Backed | Back things you want to exist",
      description:
        "Discover and back independent products and projects, or launch your own crowdfunding project on Backed.",
      path: "/",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${absoluteUrl("/")}#organization`,
            name: "Backed",
            url: absoluteUrl("/"),
            logo: absoluteUrl("/logo.png"),
            sameAs: ["https://x.com/backeditco"],
          },
          {
            "@type": "WebSite",
            "@id": `${absoluteUrl("/")}#website`,
            name: "Backed",
            url: absoluteUrl("/"),
            description: "Back things you want to exist.",
            publisher: { "@id": `${absoluteUrl("/")}#organization` },
          },
        ],
      },
    }),
  component: Index,
});

function Index() {
  const canonicalProjects = Route.useLoaderData() as Project[];
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
                search={category === "All" ? {} : { category }}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {category}
              </Link>
            ))}
          </nav>
          <h1 className="type-display text-5xl font-semibold text-foreground sm:text-7xl lg:text-8xl">
            Back things you want to exist.
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-7 text-muted-foreground">
            Reward and preorder crowdfunding for independent products and creative projects.
            Discover something worth backing—or launch your own.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/discover" search={{}}>
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
            search={{}}
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
