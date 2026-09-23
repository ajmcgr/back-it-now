import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminDeleteDialog } from "@/components/backed/admin-delete-dialog";
import { AdminLoading, AdminShell, AdminUnavailable } from "@/components/backed/admin-shell";
import { Button } from "@/components/ui/button";
import { invokeAdmin, type AdminComment } from "@/lib/admin";
import { privateSeo } from "@/lib/seo";

export const Route = createFileRoute("/admin_/comments")({
  head: () => privateSeo("Comments — Backed Admin"),
  component: AdminComments,
});

function AdminComments() {
  const [comments, setComments] = useState<AdminComment[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<AdminComment | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await invokeAdmin<{ comments: AdminComment[] }>("list_comments");
    setComments(response.comments);
  }, []);

  useEffect(() => {
    void load().catch(() => setDenied(true));
  }, [load]);

  async function remove() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      await invokeAdmin("delete_comment", { commentId: selected.id });
      setSelected(null);
      setMessage("Comment removed from the public project.");
      await load();
    } catch {
      setMessage("The comment could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <AdminUnavailable message="You don’t have access to Backed Admin." />;
  if (!comments) return <AdminLoading />;

  return (
    <AdminShell
      active="comments"
      title="Comments"
      description="View current public comments and remove one from its project when necessary."
    >
      {message ? <p className="mb-4 text-sm text-muted-foreground">{message}</p> : null}
      {comments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No public comments yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-4">Commenter</th>
                <th>Comment</th>
                <th>Project</th>
                <th>Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((comment) => {
                const author = comment.profiles;
                return (
                  <tr key={comment.id} className="border-b border-border align-top last:border-0">
                    <td className="p-4 font-medium">
                      {author.display_name || author.username || "Backed member"}
                    </td>
                    <td className="max-w-md whitespace-normal py-4 pr-6 leading-6">
                      {comment.body}
                    </td>
                    <td className="py-4 pr-6">{comment.projects.name}</td>
                    <td className="py-4 pr-6">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            to="/projects/$slug"
                            params={{ slug: comment.projects.slug }}
                            hash="comments"
                            aria-label={`View comment on ${comment.projects.name}`}
                          >
                            <ExternalLink />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelected(comment)}
                          aria-label="Delete comment"
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
        title="Delete this comment?"
        description="The comment will be removed immediately from the public Comments tab."
        busy={busy}
        onCancel={() => setSelected(null)}
        onConfirm={() => void remove()}
      />
    </AdminShell>
  );
}
