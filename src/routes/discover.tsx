import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProjectResults } from "@/components/backed/project-card";
import { ProjectDiscoveryControls } from "@/components/backed/project-discovery-controls";
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
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/discover")({
  loaderDeps: ({ search }) => ({ sort: parseProjectSort(search.sort) }),
  loader: async ({ deps }) =>
    (await loadRankedCanonicalProjects(deps.sort, 100)).map(({ slug, presentation }) =>
      presentationAsProject(slug, presentation),
    ),
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {}),
    ...(typeof search["category"] === "string" && search["category"] !== "All"
      ? { category: search["category"] }
      : {}),
    ...(projectSorts.includes(search["sort"] as ProjectSort)
      ? { sort: search["sort"] as ProjectSort }
      : {}),
    ...(projectViews.includes(search["view"] as ProjectView)
      ? { view: search["view"] as ProjectView }
      : {}),
  }),
  head: () =>
    publicSeo({
      title: "Discover Projects | Backed",
      description: "Explore independent products and projects worth backing on Backed.",
      path: "/discover",
    }),
  component: Discover,
});
function Discover() {
  const {
    q = "",
    category: categorySearch = "All",
    sort: sortSearch,
    view: viewSearch,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState(q);
  const [category, setCategory] = useState(categorySearch);
  const sort = parseProjectSort(sortSearch);
  const view = parseProjectView(viewSearch);
  const canonicalProjects = Route.useLoaderData() as Project[];
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
  const filtered = useMemo(
    () =>
      sortDiscoveryProjects(mergeDiscoveryProjects(canonicalProjects, projects), sort).filter(
        (project) =>
          (category === "All" || project.category === category) &&
          (project.title + project.description).toLowerCase().includes(query.toLowerCase()),
      ),
    [canonicalProjects, category, query, sort],
  );

  function setDiscoveryState(nextSort: ProjectSort, nextView: ProjectView) {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...(nextSort === DEFAULT_PROJECT_SORT ? {} : { sort: nextSort }),
        ...(nextView === DEFAULT_PROJECT_VIEW ? {} : { view: nextView }),
      }),
    });
  }

  return (
    <main className="container-backed py-10 sm:py-20">
      <h1 className="text-4xl font-semibold sm:text-6xl">Discover</h1>
      <div className="mt-9 flex max-w-xl items-center gap-2 rounded-md border border-input bg-background px-3">
        <Search className="size-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects"
          className="h-12 border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="-mx-4 my-7 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:my-8 sm:px-0">
        {categories.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? "default" : "outline"}
            onClick={() => setCategory(c)}
            className="shrink-0"
          >
            {c}
          </Button>
        ))}
      </div>
      <div className="mb-7 sm:mb-8">
        <ProjectDiscoveryControls
          sort={sort}
          view={view}
          onSortChange={(nextSort) => setDiscoveryState(nextSort, view)}
          onViewChange={(nextView) => setDiscoveryState(sort, nextView)}
        />
      </div>
      {filtered.length ? (
        <ProjectResults items={filtered} view={view} />
      ) : (
        <div className="py-24 text-center">
          <h2 className="text-2xl font-semibold">No projects found</h2>
          <p className="mt-2 text-muted-foreground">Try another search or category.</p>
        </div>
      )}
    </main>
  );
}
