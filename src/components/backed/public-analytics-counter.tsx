import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

const analyticsEndpoint = "https://zlzaxgsyczfeepwidjii.supabase.co/functions/v1/public-analytics";
const publicAnalyticsUrl = "https://cloud.umami.is/share/5kuMEhyajDtCHMB6";

type PublicAnalytics = {
  totalVisitors: number;
  onlineVisitors: number | null;
};

function isPublicAnalytics(value: unknown): value is PublicAnalytics {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PublicAnalytics>;
  return (
    typeof data.totalVisitors === "number" &&
    Number.isFinite(data.totalVisitors) &&
    data.totalVisitors >= 0 &&
    (data.onlineVisitors === null ||
      (typeof data.onlineVisitors === "number" &&
        Number.isFinite(data.onlineVisitors) &&
        data.onlineVisitors >= 0))
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

  const accessibleMetrics = `${analytics.totalVisitors.toLocaleString("en-US")} total visitors${
    analytics.onlineVisitors === null
      ? ""
      : `, ${analytics.onlineVisitors.toLocaleString("en-US")} online`
  }`;

  return (
    <a
      href={publicAnalyticsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-auto flex w-fit flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-sm text-sm text-muted-foreground tabular-nums transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
      aria-label={`${accessibleMetrics}. View Backed's public analytics on Umami (opens in a new tab)`}
    >
      <span>{analytics.totalVisitors.toLocaleString("en-US")} total visitors</span>
      {analytics.onlineVisitors !== null && (
        <>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
            {analytics.onlineVisitors.toLocaleString("en-US")} online
          </span>
        </>
      )}
      <ExternalLink aria-hidden="true" className="size-3.5" />
    </a>
  );
}
