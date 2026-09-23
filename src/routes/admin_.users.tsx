import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminDeleteDialog } from "@/components/backed/admin-delete-dialog";
import { AdminLoading, AdminShell, AdminUnavailable } from "@/components/backed/admin-shell";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import { Button } from "@/components/ui/button";
import { invokeAdmin, type AdminUser } from "@/lib/admin";
import { privateSeo } from "@/lib/seo";

export const Route = createFileRoute("/admin_/users")({
  head: () => privateSeo("Users — Backed Admin"),
  component: AdminUsers,
});

function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await invokeAdmin<{ users: AdminUser[] }>("list_users");
    setUsers(response.users);
  }, []);

  useEffect(() => {
    void load().catch(() => setDenied(true));
  }, [load]);

  async function remove() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      await invokeAdmin("delete_user", { userId: selected.id });
      setSelected(null);
      setMessage(
        "User removed from public Backed and access revoked. Financial history was preserved.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "owner_admin_cannot_be_deleted"
          ? "The owner admin account cannot be deleted."
          : "The user could not be deleted. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <AdminUnavailable message="You don’t have access to Backed Admin." />;
  if (!users) return <AdminLoading />;

  return (
    <AdminShell
      active="users"
      title="Users"
      description="View active Backed accounts. Email addresses are visible only inside this owner admin page."
    >
      {message ? <p className="mb-4 text-sm text-muted-foreground">{message}</p> : null}
      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No users yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-4">User</th>
                <th>Username</th>
                <th>Email</th>
                <th>Joined</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <ProfileAvatar
                        avatarUrl={user.avatar_url}
                        displayName={user.display_name}
                        username={user.username}
                        className="size-9"
                      />
                      <div>
                        <p className="font-semibold">{user.display_name || "Backed member"}</p>
                        {user.is_admin ? (
                          <p className="text-xs text-muted-foreground">Owner admin</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>{user.username ? `@${user.username}` : "—"}</td>
                  <td>{user.email || "—"}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      {user.username ? (
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            to="/$username"
                            params={{ username: user.username }}
                            aria-label={`View ${user.display_name || user.username}`}
                          >
                            <ExternalLink />
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={user.is_admin}
                        onClick={() => setSelected(user)}
                        aria-label={user.is_admin ? "Owner admin cannot be deleted" : "Delete user"}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminDeleteDialog
        open={Boolean(selected)}
        title={`Delete ${selected?.display_name || selected?.username || "this user"}?`}
        description="Their public account will disappear and access will be revoked. Required payment and accounting history will be preserved."
        busy={busy}
        onCancel={() => setSelected(null)}
        onConfirm={() => void remove()}
      />
    </AdminShell>
  );
}
