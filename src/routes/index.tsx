import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ProjectResults } from "@/components/backed/project-card";
import { ProjectDiscoveryControls } from "@/components/backed/project-discovery-controls";
import { PublicAnalyticsCounter } from "@/components/backed/public-analytics-counter";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PROJECT_SORT,
  DEFAULT_PROJECT_VIEW,
  mergeDiscoveryProjects,
  parseProjectSort,
  parseProjectView,
  projectSorts,
  projectViews,
  sortDiscoveryProjects,
  type ProjectSort,
  type ProjectView,
} from "@/lib/project-discovery";
import { projects, type Project } from "@/lib/projects";
import { loadRankedCanonicalProjects, presentationAsProject } from "@/lib/project-presentation";
import { absoluteUrl, publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(projectSorts.includes(search["sort"] as ProjectSort)
      ? { sort: search["sort"] as ProjectSort }
      : {}),
    ...(projectViews.includes(search["view"] as ProjectView)
      ? { view: search["view"] as ProjectView }
      : {}),
  }),
  loaderDeps: ({ search }) => ({ sort: parseProjectSort(search.sort) }),
  loader: async ({ deps }) =>
    (await loadRankedCanonicalProjects(deps.sort, 6)).map(({ slug, presentation }) =>
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
  const { sort: sortSearch, view: viewSearch } = Route.useSearch();
  const navigate = Route.useNavigate();
  const sort = parseProjectSort(sortSearch);
  const view = parseProjectView(viewSearch);
  const canonicalProjects = Route.useLoaderData() as Project[];
  const discoveryProjects = sortDiscoveryProjects(
    mergeDiscoveryProjects(canonicalProjects, projects),
    sort,
  ).slice(0, 6);
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

  function setDiscoveryState(nextSort: ProjectSort, nextView: ProjectView) {
    void navigate({
      search: {
        ...(nextSort === DEFAULT_PROJECT_SORT ? {} : { sort: nextSort }),
        ...(nextView === DEFAULT_PROJECT_VIEW ? {} : { view: nextView }),
      },
    });
  }

  return (
    <main>
      <section className="container-backed pt-5 sm:pt-6">
        <nav
          aria-label="Project categories"
          className="flex gap-5 overflow-x-auto pb-2 text-left sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0"
        >
          {categories.map((category) => (
            <Link
              key={category}
              to="/discover"
              search={category === "All" ? {} : { category }}
              className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {category}
            </Link>
          ))}
        </nav>
      </section>

      <section className="container-backed pb-14 pt-10 text-center sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <PublicAnalyticsCounter />
          </div>
          <h1 className="type-display text-4xl font-semibold text-foreground sm:text-6xl lg:text-7xl">
            Back things you want to exist.
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-7 text-muted-foreground">
            Reward and preorder crowdfunding for independent products and creative projects.
            Discover something worth backing—or launch your own.
          </p>
          <div className="mt-9 grid gap-3 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:justify-center">
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

      <section className="container-backed pb-20 sm:pb-24">
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-semibold">Projects worth backing</h2>
          <Link
            to="/discover"
            search={{ sort, view }}
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold hover:text-primary sm:inline-flex"
          >
            View all projects <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mb-7">
          <ProjectDiscoveryControls
            sort={sort}
            view={view}
            onSortChange={(nextSort) => setDiscoveryState(nextSort, view)}
            onViewChange={(nextView) => setDiscoveryState(sort, nextView)}
          />
        </div>
        {discoveryProjects.length ? (
          <ProjectResults items={discoveryProjects} view={view} />
        ) : (
          <div className="border-y border-border py-16 text-center">
            <h3 className="text-xl font-semibold">No projects to show yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">Try another sort.</p>
          </div>
        )}
        <Link
          to="/discover"
          search={{ sort, view }}
          className="mt-7 inline-flex items-center gap-1 text-sm font-semibold hover:text-primary sm:hidden"
        >
          View all projects <ArrowRight className="size-4" />
        </Link>
      </section>

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
