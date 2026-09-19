import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, ExternalLink, Pencil, Share2, ShieldBan, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProjectPosterDialog, type PosterProject } from "@/components/backed/project-poster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

type AdminProject = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  image_url: string | null;
  status: string;
  funding_goal_amount: number;
  initial_backed_amount: number;
  successful_backed_amount: number;
  successful_backer_count: number;
  deadline_at: string | null;
  created_at: string;
  admin_archived_at: string | null;
  admin_suspended_at: string | null;
  profiles: { username: string; display_name: string | null; avatar_url: string | null };
};
type Totals = { live: number; draft: number; ended: number; volume: number; backings: number };
const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount / 100);

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [poster, setPoster] = useState<PosterProject | null>(null);
  const [editing, setEditing] = useState<AdminProject | null>(null);
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.functions.invoke("admin-projects", {
      body: { action: "list" },
    });
    if (error || !data?.projects) return setAllowed(false);
    setAllowed(true);
    setProjects(data.projects);
    setTotals(data.totals);
  };
  useEffect(() => void load(), []);
  const visible = useMemo(
    () =>
      projects.filter((project) => {
        const searchable =
          `${project.name} ${project.profiles.display_name ?? ""} ${project.profiles.username}`.toLowerCase();
        const state = project.admin_archived_at
          ? "archived"
          : project.admin_suspended_at
            ? "suspended"
            : project.status;
        return (
          searchable.includes(query.toLowerCase()) &&
          (filter === "all" ||
            state === filter ||
            (filter === "ended" && project.status !== "live"))
        );
      }),
    [filter, projects, query],
  );
  const act = async (action: string, project: AdminProject) => {
    if (!supabase) return;
    if (
      action === "delete" &&
      !window.confirm(
        `Archive "${project.name}"? This hides it from public discovery and preserves records.`,
      )
    )
      return;
    const { error } = await supabase.functions.invoke("admin-projects", {
      body: { action, projectId: project.id },
    });
    if (error) return setMessage("That admin action could not be completed.");
    setMessage(action === "delete" ? "Project archived safely." : "Project updated.");
    void load();
  };
  const saveEdit = async (form: HTMLFormElement) => {
    if (!supabase || !editing) return;
    const values = new FormData(form);
    const { error } = await supabase.functions.invoke("admin-projects", {
      body: {
        action: "update",
        projectId: editing.id,
        patch: {
          name: values.get("name"),
          summary: values.get("summary"),
          description: values.get("description"),
          image_url: values.get("image_url"),
          deadline_at: values.get("deadline_at"),
        },
      },
    });
    if (error) return setMessage("That project update could not be completed.");
    setEditing(null);
    setMessage("Project details updated. Funding and financial history were not changed.");
    void load();
  };
  if (allowed === false)
    return (
      <main className="container-backed py-20 text-center">
        <h1 className="text-3xl font-semibold">Page not found</h1>
      </main>
    );
  if (allowed === null)
    return (
      <main className="container-backed py-20 text-center text-muted-foreground">
        Loading admin…
      </main>
    );
  return (
    <main className="container-backed py-12 sm:py-16">
      <h1 className="text-4xl font-semibold">Backed Admin</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Live projects", totals?.live ?? 0],
          ["Draft projects", totals?.draft ?? 0],
          ["Ended projects", totals?.ended ?? 0],
          ["Backing volume", money(totals?.volume ?? 0)],
          ["Successful backings", totals?.backings ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-md border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects or creators"
          className="max-w-sm"
        />
        {["all", "live", "draft", "ended", "suspended"].map((value) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
      <div className="mt-6 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-4">Project</th>
              <th>Creator</th>
              <th>Status</th>
              <th>Backed</th>
              <th>Backers</th>
              <th>Created</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((project) => {
              const backed = project.initial_backed_amount + project.successful_backed_amount;
              const posterProject: PosterProject = {
                slug: project.slug,
                name: project.name,
                summary: project.summary,
                coverImage: project.image_url,
                creatorName: project.profiles.display_name || project.profiles.username,
                amountBacked: backed,
                goal: project.funding_goal_amount,
              };
              return (
                <tr key={project.id} className="border-b border-border last:border-0">
                  <td className="p-4 font-semibold">
                    <Link
                      to="/projects/$slug"
                      params={{ slug: project.slug }}
                      className="hover:text-primary"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td>
                    <Link
                      to="/$username"
                      params={{ username: project.profiles.username }}
                      className="hover:text-primary"
                    >
                      {project.profiles.display_name || project.profiles.username}
                    </Link>
                  </td>
                  <td>
                    {project.admin_archived_at
                      ? "archived"
                      : project.admin_suspended_at
                        ? "suspended"
                        : project.status}
                  </td>
                  <td>{money(backed)}</td>
                  <td>{project.successful_backer_count}</td>
                  <td>{new Date(project.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" asChild>
                        <a
                          href={`/projects/${project.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="View project"
                        >
                          <ExternalLink />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setPoster(posterProject)}
                        aria-label="Poster"
                      >
                        <Share2 />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            `https://backedit.co/projects/${project.slug}`,
                          )
                        }
                        aria-label="Copy link"
                      >
                        <Copy />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(project)}
                        aria-label="Edit project"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          act(project.admin_suspended_at ? "restore" : "suspend", project)
                        }
                        aria-label="Suspend or restore"
                      >
                        <ShieldBan />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => act("delete", project)}
                        aria-label="Archive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {poster && (
        <ProjectPosterDialog
          project={poster}
          open
          onOpenChange={(open) => !open && setPoster(null)}
        />
      )}
      <EditProjectDialog
        project={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={saveEdit}
      />
    </main>
  );
}

function EditProjectDialog({
  project,
  onOpenChange,
  onSubmit,
}: {
  project: AdminProject | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  return (
    <Dialog open={Boolean(project)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update public project details. Funding, payment, reward, and accounting records stay
            protected.
          </DialogDescription>
        </DialogHeader>
        {project && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(event.currentTarget);
            }}
          >
            <label className="block space-y-2 text-sm font-medium">
              Project name
              <Input name="name" defaultValue={project.name} required />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Short description
              <Textarea name="summary" defaultValue={project.summary} required />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Story
              <Textarea
                name="description"
                defaultValue={project.description}
                className="min-h-36"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Cover image URL
              <Input name="image_url" defaultValue={project.image_url ?? ""} type="url" />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Deadline
              <Input
                name="deadline_at"
                type="datetime-local"
                defaultValue={project.deadline_at ? project.deadline_at.slice(0, 16) : ""}
              />
            </label>
            <DialogFooter>
              <Button type="submit">Save public details</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
