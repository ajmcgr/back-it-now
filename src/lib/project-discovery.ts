import { amountBacked, type Project } from "@/lib/projects";

export const projectSorts = ["popular", "latest", "most-backed", "ending-soon"] as const;
export const projectViews = ["list", "cards"] as const;

export type ProjectSort = (typeof projectSorts)[number];
export type ProjectView = (typeof projectViews)[number];

export const DEFAULT_PROJECT_SORT: ProjectSort = "latest";
export const DEFAULT_PROJECT_VIEW: ProjectView = "cards";

export function parseProjectSort(value: unknown): ProjectSort {
  return projectSorts.includes(value as ProjectSort)
    ? (value as ProjectSort)
    : DEFAULT_PROJECT_SORT;
}

export function parseProjectView(value: unknown): ProjectView {
  return projectViews.includes(value as ProjectView)
    ? (value as ProjectView)
    : DEFAULT_PROJECT_VIEW;
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestFirst(a: Project, b: Project) {
  return timestamp(b.createdAt) - timestamp(a.createdAt) || a.slug.localeCompare(b.slug);
}

export function sortDiscoveryProjects(items: Project[], sort: ProjectSort, now = new Date()) {
  const nowTime = now.getTime();
  const eligible = items.filter((project) => {
    if (project.status !== "live" && project.status !== "prelaunch") return false;
    if (sort === "most-backed") return project.status === "live";
    if (sort !== "ending-soon") return true;
    const deadline = timestamp(project.deadline);
    return project.status === "live" && deadline > nowTime;
  });

  return [...eligible].sort((a, b) => {
    if (sort === "popular") {
      return (
        b.favoriteCount - a.favoriteCount ||
        timestamp(b.latestBackedAt) - timestamp(a.latestBackedAt) ||
        newestFirst(a, b)
      );
    }
    if (sort === "most-backed") {
      return (
        amountBacked(b) - amountBacked(a) ||
        b.successfulBackingCount - a.successfulBackingCount ||
        newestFirst(a, b)
      );
    }
    if (sort === "ending-soon") {
      return timestamp(a.deadline) - timestamp(b.deadline) || newestFirst(a, b);
    }
    return newestFirst(a, b);
  });
}

export function mergeDiscoveryProjects(canonicalProjects: Project[], fallbackProjects: Project[]) {
  return [
    ...fallbackProjects.filter(
      (project) => !canonicalProjects.some((item) => item.slug === project.slug),
    ),
    ...canonicalProjects,
  ];
}
