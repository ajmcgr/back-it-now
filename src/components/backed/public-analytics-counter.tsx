import { useEffect, useState } from "react";

const analyticsEndpoint = "https://zlzaxgsyczfeepwidjii.supabase.co/functions/v1/public-analytics";

type PublicAnalytics = {
  totalVisitors: number;
  onlineVisitors: number;
};

function isPublicAnalytics(value: unknown): value is PublicAnalytics {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PublicAnalytics>;
  return (
    typeof data.totalVisitors === "number" &&
    Number.isFinite(data.totalVisitors) &&
    data.totalVisitors >= 0 &&
    typeof data.onlineVisitors === "number" &&
    Number.isFinite(data.onlineVisitors) &&
    data.onlineVisitors >= 0
  );
}

export function PublicAnalyticsCounter() {
  const [analytics, setAnalytics] = useState<PublicAnalytics | null>(null);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await fetch(analyticsEndpoint, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!result.ok) return;
        const data: unknown = await result.json();
        if (active && isPublicAnalytics(data)) setAnalytics(data);
      } catch {
        // Keep the homepage intact when analytics is temporarily unavailable.
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, []);

  if (!analytics) return null;

  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground tabular-nums">
      <span>{analytics.totalVisitors.toLocaleString("en-US")} total visitors</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
        {analytics.onlineVisitors.toLocaleString("en-US")} online
      </span>
    </p>
  );
}
