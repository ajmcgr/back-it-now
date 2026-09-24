import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CompactRowsSkeleton } from "@/components/backed/loading-skeletons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: string;
  title: string;
  body: string;
  target_url: string;
  created_at: string;
  read_at: string | null;
};

function notificationAge(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, target_url, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data ?? []) as Notification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);

  const unread = notifications.filter((notification) => !notification.read_at).length;
  const markAllRead = async () => {
    if (!supabase || unread === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .is("read_at", null);
    if (!error)
      setNotifications((current) =>
        current.map((item) => ({ ...item, read_at: item.read_at ?? now })),
      );
  };
  const openNotification = async (notification: Notification) => {
    if (supabase && !notification.read_at) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification.id);
    }
    window.location.assign(notification.target_url);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative inline-flex size-10 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Bell className="size-5" aria-hidden="true" />
          {unread ? (
            <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <strong>Notifications</strong>
          {unread ? (
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => void markAllRead()}
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1">
          {loading && !notifications.length ? (
            <CompactRowsSkeleton />
          ) : notifications.length ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="items-start px-3 py-3"
                onSelect={() => void openNotification(notification)}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-transparent" : "bg-primary"}`}
                />
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{notification.title}</strong>
                  {notification.body ? (
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {notification.body}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {notificationAge(notification.created_at)}
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="font-semibold">You’re all caught up.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Project launches and updates will appear here.
              </p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
