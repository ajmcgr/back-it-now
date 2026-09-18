import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProjectGrid } from "@/components/backed/project-card";
import { projects } from "@/lib/projects";

export const Route = createFileRoute("/discover")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
    category: typeof search["category"] === "string" ? search["category"] : "All",
  }),
  head: () => ({
    meta: [
      { title: "Discover projects — Backed" },
      { name: "description", content: "Explore independent products and projects worth backing." },
      { property: "og:title", content: "Discover projects — Backed" },
      {
        property: "og:description",
        content: "Explore independent products and projects worth backing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});
function Discover() {
  const { q, category: categorySearch } = Route.useSearch();
  const [query, setQuery] = useState(q);
  const [category, setCategory] = useState(categorySearch);
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
      projects.filter(
        (p) =>
          p.status === "live" &&
          (category === "All" || p.category === category) &&
          (p.title + p.description + p.creator).toLowerCase().includes(query.toLowerCase()),
      ),
    [category, query],
  );
  return (
    <main className="container-backed py-14 sm:py-20">
      <h1 className="text-5xl font-semibold sm:text-6xl">Discover</h1>
      <div className="mt-9 flex max-w-xl items-center gap-2 rounded-md border border-input bg-background px-3">
        <Search className="size-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects"
          className="h-12 border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="my-8 flex gap-2 overflow-x-auto pb-2">
        {categories.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? "default" : "outline"}
            onClick={() => setCategory(c)}
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
