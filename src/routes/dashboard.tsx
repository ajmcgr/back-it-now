import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { amountBacked, daysRemaining, money, percent, projects } from "@/lib/projects";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your projects — Backed" },
      { name: "description", content: "Manage your projects on Backed." },
      { property: "og:title", content: "Your projects — Backed" },
      { property: "og:description", content: "Manage your projects on Backed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});
function Dashboard() {
  const project = projects[0];
  if (!project) return null;
  return (
    <main className="container-backed py-14 sm:py-20">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-semibold sm:text-5xl">Your projects</h1>
        <Button asChild>
          <Link to="/start">Start a project</Link>
        </Button>
      </div>
      <div className="mt-10 overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-border bg-muted/60 px-5 py-3 text-xs font-semibold text-muted-foreground md:grid">
          <span>Project</span>
          <span>Status</span>
          <span>Amount backed</span>
          <span>Backers</span>
          <span>Days remaining</span>
        </div>
        <div className="grid items-center gap-4 p-5 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="flex items-center gap-4">
            <img
              src={project.coverImage}
              alt=""
              width={160}
              height={100}
              className="aspect-[16/10] w-24 rounded-sm object-cover"
            />
            <div>
              <strong className="block">{project.title}</strong>
              <span className="text-xs text-muted-foreground">{percent(project)}% funded</span>
            </div>
          </div>
          <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
            Live
          </span>
          <span className="font-semibold">{money(amountBacked(project))}</span>
          <span>{project.successfulBackingCount}</span>
          <span>{daysRemaining(project)}</span>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        This is a preview. Sign in and saved project management require Lovable Cloud.
      </p>
    </main>
  );
}
