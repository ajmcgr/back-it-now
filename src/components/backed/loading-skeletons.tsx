import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingRegion({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ProjectResultsSkeleton({
  view = "cards",
  count = 6,
  numbered = false,
}: {
  view?: "cards" | "list";
  count?: number;
  numbered?: boolean;
}) {
  return (
    <LoadingRegion label="Loading projects">
      {view === "list" ? (
        <div className="divide-y divide-border border-y border-border">
          {Array.from({ length: count }, (_, index) => (
            <div
              key={index}
              className={`grid min-w-0 gap-4 py-4 sm:items-center sm:gap-5 ${
                numbered
                  ? "grid-cols-[24px_80px_minmax(0,1fr)] sm:grid-cols-[28px_128px_minmax(0,1fr)_auto]"
                  : "grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[128px_minmax(0,1fr)_auto]"
              }`}
            >
              {numbered ? <Skeleton className="h-4 w-4" /> : null}
              <Skeleton className="aspect-[16/10] w-full" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="hidden h-4 w-20 sm:block" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="min-w-0">
              <Skeleton className="aspect-[16/10] w-full" />
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-1.5 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </LoadingRegion>
  );
}

export function PageLoadingSkeleton() {
  return (
    <main className="container-backed py-14 sm:py-20">
      <LoadingRegion label="Loading page">
        <Skeleton className="h-12 w-56 max-w-full" />
        <Skeleton className="mt-4 h-5 w-80 max-w-full" />
        <div className="mt-10">
          <ProjectResultsSkeleton count={3} />
        </div>
      </LoadingRegion>
    </main>
  );
}

export function HomePageSkeleton({ view = "cards" }: { view?: "cards" | "list" }) {
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
              className="shrink-0 text-sm font-medium text-muted-foreground"
            >
              {category}
            </Link>
          ))}
        </nav>
      </section>
      <section className="container-backed pb-14 pt-10 text-center sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="mx-auto mb-6 h-7 w-44" />
          <h1 className="type-display text-4xl font-semibold sm:text-6xl lg:text-7xl">
            Back things you want to exist.
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-7 text-muted-foreground">
            Reward and preorder crowdfunding for independent products and creative projects.
            Discover something worth backing—or launch your own.
          </p>
          <div className="mt-9 grid gap-3 min-[380px]:grid-cols-2 sm:flex sm:justify-center">
            <Button size="lg" asChild>
              <Link to="/discover" search={{}}>
                Explore projects
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
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
        </div>
        <ProjectResultsSkeleton view={view} count={6} numbered />
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

export function DiscoverPageSkeleton({ view = "cards" }: { view?: "cards" | "list" }) {
  return (
    <main className="container-backed py-10 sm:py-20">
      <h1 className="text-4xl font-semibold sm:text-6xl">Discover</h1>
      <div className="mt-9 max-w-xl">
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="my-7 flex gap-2 overflow-hidden sm:my-8">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-20 shrink-0" />
        ))}
      </div>
      <div className="mb-7 flex justify-between gap-4 sm:mb-8">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-24" />
      </div>
      <ProjectResultsSkeleton view={view} count={6} />
    </main>
  );
}

export function SettingsSkeleton() {
  return (
    <main className="container-backed max-w-3xl py-14 sm:py-20">
      <LoadingRegion label="Loading settings">
        <Skeleton className="h-12 w-72 max-w-full" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        <div className="mt-10 space-y-8">
          <section className="rounded-md border border-border p-6">
            <Skeleton className="h-6 w-24" />
            <div className="mt-5 flex items-center gap-4">
              <Skeleton className="size-20 shrink-0 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-5 h-24 w-full" />
          </section>
          {Array.from({ length: 2 }, (_, index) => (
            <section key={index} className="rounded-md border border-border p-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-3 h-4 w-full max-w-md" />
              <div className="mt-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-36" />
              </div>
            </section>
          ))}
        </div>
      </LoadingRegion>
    </main>
  );
}

export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading dashboard">
      <div className="mt-8 overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-border bg-muted/40 px-5 py-3 md:grid">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="grid gap-3 border-b border-border p-5 last:border-0 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center"
          >
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            {Array.from({ length: 4 }, (_, item) => (
              <Skeleton key={item} className="h-4 w-20" />
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function ProjectPageSkeleton() {
  return (
    <main className="container-backed py-8 sm:py-16">
      <LoadingRegion label="Loading project">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] lg:gap-12">
          <div>
            <Skeleton className="aspect-[16/10] w-full" />
            <div className="mt-6 flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="mt-6 h-12 w-4/5" />
            <Skeleton className="mt-4 h-5 w-full" />
            <Skeleton className="mt-2 h-5 w-3/4" />
          </div>
          <div className="rounded-md border border-border p-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="mt-3 h-4 w-28" />
            <Skeleton className="mt-6 h-2 w-full" />
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
            <Skeleton className="mt-8 h-12 w-full" />
          </div>
        </div>
        <div className="mt-12 border-t border-border pt-8">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-11/12" />
          <Skeleton className="mt-3 h-4 w-4/5" />
        </div>
      </LoadingRegion>
    </main>
  );
}

export function ProfilePageSkeleton() {
  return (
    <main className="container-backed py-14 sm:py-20">
      <LoadingRegion label="Loading profile">
        <section className="mx-auto max-w-3xl text-center">
          <Skeleton className="mx-auto size-28 rounded-full sm:size-32" />
          <Skeleton className="mx-auto mt-5 h-12 w-64 max-w-full" />
          <Skeleton className="mx-auto mt-3 h-5 w-28" />
          <Skeleton className="mx-auto mt-6 h-5 w-full max-w-xl" />
          <Skeleton className="mx-auto mt-2 h-5 w-4/5 max-w-lg" />
        </section>
        <section className="mx-auto mt-16 max-w-5xl">
          <Skeleton className="h-9 w-32" />
          <div className="mt-7">
            <ProjectResultsSkeleton count={3} />
          </div>
        </section>
      </LoadingRegion>
    </main>
  );
}

export function ProjectFormSkeleton() {
  return (
    <main className="container-backed max-w-3xl py-12 sm:py-16">
      <LoadingRegion label="Loading project editor">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-11 w-56" />
        <div className="mt-8 space-y-6">
          {["h-12", "h-24", "h-64", "h-12", "h-12"].map((height, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className={`${height} w-full`} />
            </div>
          ))}
        </div>
      </LoadingRegion>
    </main>
  );
}

export function CompactRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading results">
      <div className="space-y-1 p-1">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex min-h-14 items-center gap-3 px-2 py-2">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
