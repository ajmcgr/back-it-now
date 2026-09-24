import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminSection = "overview" | "projects" | "users" | "comments" | "newsletter";

const navigation = [
  { id: "overview", label: "Overview", to: "/admin" },
  { id: "projects", label: "Projects", to: "/admin/projects" },
  { id: "users", label: "Users", to: "/admin/users" },
  { id: "comments", label: "Comments", to: "/admin/comments" },
  { id: "newsletter", label: "Newsletter", to: "/admin/newsletter" },
] as const;

export function AdminShell({
  active,
  title,
  description,
  children,
}: {
  active: AdminSection;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="container-backed py-10 sm:py-14">
      <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-12">
        <aside>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Backed Admin
          </p>
          <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto lg:flex-col">
            {navigation.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active === item.id ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function AdminUnavailable({ message }: { message?: string }) {
  return (
    <main className="container-backed py-20 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </main>
  );
}

export function AdminLoading() {
  return (
    <main className="container-backed py-20" aria-label="Loading admin" aria-busy="true">
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="grid gap-3 pt-6 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    </main>
  );
}
