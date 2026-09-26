import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectSort, ProjectView } from "@/lib/project-discovery";

const sortOptions: Array<{ value: ProjectSort; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "popular", label: "Popular" },
  { value: "most-backed", label: "Most Backed" },
  { value: "ending-soon", label: "Ending Soon" },
  { value: "coming-soon", label: "Coming Soon" },
];

const viewOptions = [
  { value: "list", label: "List view", icon: List },
  { value: "cards", label: "Card view", icon: LayoutGrid },
] as const;

type ProjectDiscoveryControlsProps = {
  sort: ProjectSort;
  view: ProjectView;
  onSortChange: (sort: ProjectSort) => void;
  onViewChange: (view: ProjectView) => void;
};

export function ProjectDiscoveryControls({
  sort,
  view,
  onSortChange,
  onViewChange,
}: ProjectDiscoveryControlsProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div
          className="inline-flex min-w-max rounded-lg border border-border bg-muted/40 p-1"
          role="group"
          aria-label="Sort projects"
        >
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sort === option.value}
              onClick={() => onSortChange(option.value)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:text-sm",
                sort === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex w-fit shrink-0 rounded-lg border border-border bg-muted/40 p-1"
        role="group"
        aria-label="Project view"
      >
        {viewOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              title={option.label}
              aria-pressed={view === option.value}
              onClick={() => onViewChange(option.value)}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                view === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
