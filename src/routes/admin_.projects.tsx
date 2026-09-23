import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminDeleteDialog } from "@/components/backed/admin-delete-dialog";
import { AdminLoading, AdminShell, AdminUnavailable } from "@/components/backed/admin-shell";
import { Button } from "@/components/ui/button";
import { invokeAdmin, type AdminProject } from "@/lib/admin";
import { privateSeo } from "@/lib/seo";

export const Route = createFileRoute("/admin_/projects")({
  head: () => privateSeo("Projects — Backed Admin"),
  component: AdminProjects,
});

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

function AdminProjects() {
  const [projects, setProjects] = useState<AdminProject[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<AdminProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await invokeAdmin<{ projects: AdminProject[] }>("list_projects");
    setProjects(response.projects);
  }, []);

  useEffect(() => {
    void load().catch(() => setDenied(true));
  }, [load]);

  async function remove() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      await invokeAdmin("delete_project", { projectId: selected.id });
      setSelected(null);
      setMessage("Project removed from public Backed. Financial history was preserved.");
      await load();
    } catch {
      setMessage("The project could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <AdminUnavailable message="You don’t have access to Backed Admin." />;
  if (!projects) return <AdminLoading />;

  return (
    <AdminShell
      active="projects"
      title="Projects"
      description="View every project and safely remove it from public Backed without destroying payment history."
    >
      {message ? <p className="mb-4 text-sm text-muted-foreground">{message}</p> : null}
      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No projects yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-4">Project</th>
                <th>Creator</th>
                <th>Status</th>
                <th>Amount backed</th>
                <th>Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const creator = project.profiles;
                const archived = Boolean(project.admin_archived_at);
                return (
                  <tr key={project.id} className="border-b border-border last:border-0">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-16 overflow-hidden rounded-md bg-muted">
                          {project.image_url ? (
                            <img
                              src={project.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <span className="font-semibold">{project.name}</span>
                      </div>
                    </td>
                    <td>{creator.display_name || creator.username || "Backed creator"}</td>
                    <td className="capitalize">{archived ? "archived" : project.status}</td>
                    <td className="tabular-nums">
                      {formatMoney(
                        project.initial_backed_amount + project.successful_backed_amount,
                      )}
                    </td>
                    <td>{new Date(project.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            to="/projects/$slug"
                            params={{ slug: project.slug }}
                            aria-label={`View ${project.name}`}
                          >
                            <ExternalLink />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelected(project)}
                          disabled={archived}
                          aria-label={`Delete ${project.name}`}
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
      )}
      <AdminDeleteDialog
        open={Boolean(selected)}
        title={`Delete “${selected?.name ?? "project"}”?`}
        description="This project will be removed from public Backed. Payment and accounting records will be preserved."
        busy={busy}
        onCancel={() => setSelected(null)}
        onConfirm={() => void remove()}
      />
    </AdminShell>
  );
}
