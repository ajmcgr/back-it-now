import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProjectGrid } from "@/components/backed/project-card";
import { projects, type Project } from "@/lib/projects";
import { loadCanonicalProjects, presentationAsProject } from "@/lib/project-presentation";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/discover")({
  loader: async () =>
    (await loadCanonicalProjects()).map(({ slug, presentation }) =>
      presentationAsProject(slug, presentation),
    ),
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {}),
    ...(typeof search["category"] === "string" && search["category"] !== "All"
      ? { category: search["category"] }
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
  const { q = "", category: categorySearch = "All" } = Route.useSearch();
  const [query, setQuery] = useState(q);
  const [category, setCategory] = useState(categorySearch);
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
      [
        ...projects.filter(
          (project) => !canonicalProjects.some((item) => item.slug === project.slug),
        ),
        ...canonicalProjects,
      ].filter(
        (p) =>
          p.status === "live" &&
          (category === "All" || p.category === category) &&
          (p.title + p.description).toLowerCase().includes(query.toLowerCase()),
      ),
    [canonicalProjects, category, query],
  );
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
      {filtered.length ? (
        <ProjectGrid items={filtered} />
      ) : (
        <div className="py-24 text-center">
          <h2 className="text-2xl font-semibold">No projects found</h2>
          <p className="mt-2 text-muted-foreground">Try another search or category.</p>
        </div>
      )}
    </main>
  );
}
