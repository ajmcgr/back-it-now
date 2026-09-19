import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/projects";
import { supabase } from "@/lib/supabase";

type CreatorProject = {
  id: string;
  slug: string;
  name: string;
  status: string;
  funding_goal_amount: number;
  initial_backed_amount: number;
  successful_backed_amount: number;
  successful_backer_count: number;
  deadline_at: string | null;
};

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
  const [projects, setProjects] = useState<CreatorProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      if (!supabase) return setIsLoading(false);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return setIsLoading(false);
      try {
        const { data } = await supabase
          .from("projects")
          .select(
            "id, slug, name, status, funding_goal_amount, initial_backed_amount, successful_backed_amount, successful_backer_count, deadline_at",
          )
          .eq("creator_id", session.session.user.id)
          .order("created_at", { ascending: false });
        setProjects(data ?? []);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);
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
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">
            No projects yet.{" "}
            <Link to="/start" className="font-semibold text-foreground hover:text-primary">
              Start a project
            </Link>
          </div>
        ) : (
          projects.map((project) => {
            const backed = project.initial_backed_amount + project.successful_backed_amount;
            const funded = Math.round((backed / project.funding_goal_amount) * 100);
            const days = project.deadline_at
              ? Math.max(
                  0,
                  Math.ceil((new Date(project.deadline_at).getTime() - Date.now()) / 86400000),
                )
              : 0;
            return (
              <div
                key={project.id}
                className="grid items-center gap-4 p-5 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
              >
                <div>
                  <strong className="block">{project.name}</strong>
                  <span className="text-xs text-muted-foreground">{funded}% funded</span>
                  {project.status === "live" && (
                    <a
                      href={`/projects/${project.slug}?share=1`}
                      className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                    >
                      Share project
                    </a>
                  )}
                </div>
                <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                  {project.status}
                </span>
                <span className="font-semibold">{money(backed / 100)}</span>
                <span>{project.successful_backer_count}</span>
                <span>{days}</span>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
