import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProjectGrid } from "@/components/backed/project-card";
import { resolveProjectCover } from "@/lib/project-presentation";
import { presentationAsProject, presentationFromPublicRow } from "@/lib/project-presentation";
import { money, type Project } from "@/lib/projects";
import { privateSeo } from "@/lib/seo";
import { supabase } from "@/lib/supabase";

type DashboardTab = "created" | "backed" | "favorites";
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
type BackingRecord = {
  id: string;
  project_id: string;
  reward_id: string | null;
  gross_amount: number;
  currency: string;
  status: string;
  refund_status: string;
  refund_amount: number;
  paid_at: string | null;
  created_at: string;
  is_private: boolean;
};
type BackedProject = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  creatorName: string;
  totalAmount: number;
  backings: Array<BackingRecord & { rewardTitle: string | null }>;
};

export const Route = createFileRoute("/dashboard")({
  head: () => privateSeo("Dashboard — Backed"),
  component: Dashboard,
});

function backingStatus(backing: BackingRecord) {
  if (backing.refund_amount >= backing.gross_amount) return "Refunded";
  if (backing.refund_amount > 0) return "Partially refunded";
  return backing.status === "paid" ? "Backed" : "Payment issue";
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("created");
  const [projects, setProjects] = useState<CreatorProject[]>([]);
  const [backings, setBackings] = useState<BackingRecord[]>([]);
  const [backedProjectRows, setBackedProjectRows] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [rewardTitles, setRewardTitles] = useState<Record<string, string>>({});
  const [favoriteProjects, setFavoriteProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [privacyUpdateId, setPrivacyUpdateId] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState("");

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "backed" || requestedTab === "favorites") setActiveTab(requestedTab);
    const load = async () => {
      if (!supabase) return setIsLoading(false);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return setIsLoading(false);
      try {
        const [createdResult, backingResult, favoriteResult] = await Promise.all([
          supabase
            .from("projects")
            .select(
              "id, slug, name, status, funding_goal_amount, initial_backed_amount, successful_backed_amount, successful_backer_count, deadline_at",
            )
            .eq("creator_id", session.session.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("backings")
            .select(
              "id, project_id, reward_id, gross_amount, currency, status, refund_status, refund_amount, paid_at, created_at, is_private",
            )
            .eq("backer_id", session.session.user.id)
            .order("paid_at", { ascending: false }),
          supabase.rpc("list_my_favorite_projects"),
        ]);
        if (createdResult.error || backingResult.error || favoriteResult.error)
          throw new Error("Your dashboard is temporarily unavailable.");
        const ownBackings = (backingResult.data ?? []) as BackingRecord[];
        setProjects((createdResult.data ?? []) as CreatorProject[]);
        setBackings(ownBackings);
        setFavoriteProjects(
          (favoriteResult.data ?? []).flatMap((row: Record<string, unknown>) => {
            const presentation = presentationFromPublicRow(row);
            return presentation && typeof row["slug"] === "string"
              ? [presentationAsProject(row["slug"], presentation)]
              : [];
          }),
        );
        if (!ownBackings.length) return;

        const projectIds = [...new Set(ownBackings.map((backing) => backing.project_id))];
        const rewardIds = [
          ...new Set(
            ownBackings
              .map((backing) => backing.reward_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const [projectResult, rewardResult] = await Promise.all([
          supabase
            .from("projects")
            .select("id, slug, name, image_url, status")
            .in("id", projectIds),
          rewardIds.length
            ? supabase.from("rewards").select("id, title").in("id", rewardIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (projectResult.error || rewardResult.error)
          throw new Error("Your backing history is temporarily unavailable.");
        const projectRows = (projectResult.data ?? []) as Array<Record<string, unknown>>;
        const slugs = projectRows
          .map((project) => project["slug"])
          .filter((slug): slug is string => typeof slug === "string");
        const { data: presentationRows, error: presentationError } = slugs.length
          ? await supabase
              .from("public_profile_projects")
              .select("slug, creator_username, creator_display_name, image_url")
              .in("slug", slugs)
          : { data: [], error: null };
        if (presentationError) throw new Error("Project details are temporarily unavailable.");
        const presentations = new Map(
          (presentationRows ?? []).map((row) => [row.slug, row as Record<string, unknown>]),
        );
        setBackedProjectRows(
          Object.fromEntries(
            projectRows.map((project) => {
              const slug = String(project["slug"] ?? "");
              return [String(project["id"]), { ...project, ...presentations.get(slug) }];
            }),
          ),
        );
        setRewardTitles(
          Object.fromEntries((rewardResult.data ?? []).map((reward) => [reward.id, reward.title])),
        );
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Your dashboard is unavailable.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const backedProjects = useMemo<BackedProject[]>(() => {
    const grouped = new Map<string, BackedProject>();
    for (const backing of backings) {
      const project = backedProjectRows[backing.project_id];
      if (!project) continue;
      const slug = String(project["slug"] ?? "");
      const item = {
        ...backing,
        rewardTitle: backing.reward_id ? (rewardTitles[backing.reward_id] ?? null) : null,
      };
      const existing = grouped.get(backing.project_id);
      if (existing) {
        existing.totalAmount += backing.gross_amount;
        existing.backings.push(item);
      } else {
        grouped.set(backing.project_id, {
          id: backing.project_id,
          slug,
          name: String(project["name"] ?? "Project"),
          imageUrl: resolveProjectCover({
            slug,
            imageUrl: typeof project["image_url"] === "string" ? project["image_url"] : null,
          }),
          creatorName: String(
            project["creator_display_name"] ?? project["creator_username"] ?? "Creator",
          ),
          totalAmount: backing.gross_amount,
          backings: [item],
        });
      }
    }
    return [...grouped.values()];
  }, [backedProjectRows, backings, rewardTitles]);

  const setBackingPrivacy = async (backingId: string, isPrivate: boolean) => {
    if (!supabase || privacyUpdateId) return;
    setPrivacyError("");
    setPrivacyUpdateId(backingId);
    const { data, error } = await supabase.rpc("set_backing_privacy", {
      p_backing_id: backingId,
      p_is_private: isPrivate,
    });
    if (error || data !== true) {
      setPrivacyError("We couldn’t update that backing’s privacy. Please try again.");
    } else {
      setBackings((current) =>
        current.map((backing) =>
          backing.id === backingId ? { ...backing, is_private: isPrivate } : backing,
        ),
      );
    }
    setPrivacyUpdateId(null);
  };

  return (
    <main className="container-backed py-14 sm:py-20">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between sm:gap-4">
        <h1 className="min-w-0 text-3xl font-semibold sm:text-5xl">Dashboard</h1>
        <Button asChild>
          <Link to="/start">Start a project</Link>
        </Button>
      </div>
      <div className="mt-8 flex gap-6 border-b border-border" role="tablist" aria-label="Dashboard">
        {(["created", "backed", "favorites"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 pb-3 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab}
          </button>
        ))}
      </div>
      {loadError ? (
        <div className="mt-8 rounded-md border border-destructive/30 p-5 text-sm">{loadError}</div>
      ) : isLoading ? (
        <div className="mt-8 grid gap-3" aria-label="Loading dashboard">
          {[0, 1].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : activeTab === "created" ? (
        <CreatedProjects projects={projects} />
      ) : activeTab === "backed" ? (
        <BackedProjects
          projects={backedProjects}
          privacyUpdateId={privacyUpdateId}
          privacyError={privacyError}
          onPrivacyChange={setBackingPrivacy}
        />
      ) : (
        <FavoriteProjects projects={favoriteProjects} />
      )}
    </main>
  );
}

function FavoriteProjects({ projects }: { projects: Project[] }) {
  if (!projects.length)
    return (
      <div className="mt-8 rounded-md border border-border p-8 text-center">
        <h2 className="text-xl font-semibold">You haven’t favorited a project yet.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Save projects to find them here and receive the updates you choose.
        </p>
        <Button asChild className="mt-5">
          <Link to="/discover" search={{}}>
            Discover projects
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="mt-8">
      <ProjectGrid items={projects} />
    </div>
  );
}

function CreatedProjects({ projects }: { projects: CreatorProject[] }) {
  if (!projects.length)
    return (
      <div className="mt-8 rounded-md border border-border p-8 text-center">
        <h2 className="text-xl font-semibold">You haven’t created a project yet.</h2>
        <Button asChild className="mt-5">
          <Link to="/start">Start a project</Link>
        </Button>
      </div>
    );
  return (
    <div className="mt-8 overflow-hidden rounded-md border border-border">
      <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-border bg-muted/60 px-5 py-3 text-xs font-semibold text-muted-foreground md:grid">
        <span>Project</span>
        <span>Status</span>
        <span>Amount backed</span>
        <span>Backers</span>
        <span>Days remaining</span>
      </div>
      {projects.map((project) => {
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
            className="grid grid-cols-2 items-start gap-4 border-b border-border p-5 last:border-b-0 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center"
          >
            <div className="col-span-2 md:col-span-1">
              <strong className="block">{project.name}</strong>
              <span className="text-xs text-muted-foreground">{funded}% funded</span>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-primary">
                <Link
                  to="/projects/$slug"
                  params={{ slug: project.slug }}
                  className="hover:underline"
                >
                  View
                </Link>
                <Link
                  to="/projects/$slug/edit"
                  params={{ slug: project.slug }}
                  className="hover:underline"
                >
                  Edit
                </Link>
                {project.status === "live" && (
                  <a href={`/projects/${project.slug}?share=1`} className="hover:underline">
                    Share
                  </a>
                )}
                <a href={`/projects/${project.slug}#backers`} className="hover:underline">
                  Backers
                </a>
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted-foreground md:hidden">Status</span>
              <span className="inline-flex w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize">
                {project.status}
              </span>
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                Amount backed
              </span>
              <span className="font-semibold">{money(backed / 100)}</span>
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted-foreground md:hidden">Backers</span>
              <span>{project.successful_backer_count}</span>
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                Days remaining
              </span>
              <span>{days}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BackedProjects({
  projects,
  privacyUpdateId,
  privacyError,
  onPrivacyChange,
}: {
  projects: BackedProject[];
  privacyUpdateId: string | null;
  privacyError: string;
  onPrivacyChange: (backingId: string, isPrivate: boolean) => Promise<void>;
}) {
  if (!projects.length)
    return (
      <div className="mt-8 rounded-md border border-border p-8 text-center">
        <h2 className="text-xl font-semibold">You haven’t backed a project yet.</h2>
        <Button asChild className="mt-5">
          <Link to="/discover" search={{}}>
            Discover projects
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="mt-8 grid gap-4">
      {privacyError ? (
        <p className="rounded-md border border-destructive/30 p-4 text-sm" role="alert">
          {privacyError}
        </p>
      ) : null}
      {projects.map((project) => (
        <article
          key={project.id}
          className="grid gap-5 rounded-md border border-border p-4 sm:grid-cols-[140px_1fr_auto] sm:p-5"
        >
          <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
            {project.imageUrl ? (
              <img
                src={project.imageUrl}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">By {project.creatorName}</p>
            <h2 className="mt-1 text-xl font-semibold">{project.name}</h2>
            <p className="mt-3 font-semibold">{money(project.totalAmount / 100)} backed</p>
            {project.backings.length > 1 ? (
              <p className="text-sm text-muted-foreground">{project.backings.length} backings</p>
            ) : null}
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold">Backing details</summary>
              <div className="mt-3 grid gap-3">
                {project.backings.map((backing) => (
                  <div
                    key={backing.id}
                    className="grid gap-1 border-l-2 border-border pl-3 sm:grid-cols-[0.8fr_1fr_1fr_0.8fr_auto] sm:items-center sm:gap-3"
                  >
                    <span>{money(backing.gross_amount / 100)}</span>
                    <span>
                      {new Date(backing.paid_at ?? backing.created_at).toLocaleDateString()}
                    </span>
                    <span>{backing.rewardTitle ?? "No reward"}</span>
                    <span>{backingStatus(backing)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 w-fit px-2 sm:mt-0"
                      disabled={privacyUpdateId === backing.id}
                      onClick={() => void onPrivacyChange(backing.id, !backing.is_private)}
                    >
                      {privacyUpdateId === backing.id
                        ? "Saving…"
                        : backing.is_private
                          ? "Backed privately · Make public"
                          : "Public · Make private"}
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          </div>
          <div className="flex items-start sm:justify-end">
            <Button asChild variant="outline">
              <Link to="/projects/$slug" params={{ slug: project.slug }}>
                View project
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
