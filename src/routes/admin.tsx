import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLoading, AdminShell, AdminUnavailable } from "@/components/backed/admin-shell";
import { AdminStatsCard } from "@/components/backed/admin-stats-card";
import { invokeAdmin, type AdminOverview } from "@/lib/admin";
import { privateSeo } from "@/lib/seo";

export const Route = createFileRoute("/admin")({
  head: () => privateSeo("Admin — Backed"),
  component: AdminOverview,
});

function AdminOverview() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void invokeAdmin<AdminOverview>("overview")
      .then((response) => {
        if (!cancelled) setOverview(response);
      })
      .catch(() => {
        if (!cancelled) setDenied(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (denied) return <AdminUnavailable message="You don’t have access to Backed Admin." />;
  if (!overview) return <AdminLoading />;

  return (
    <AdminShell
      active="overview"
      title="Overview"
      description="A simple view of Backed’s real production activity. Seed funding is excluded from backing totals."
    >
      <AdminStatsCard totals={overview.totals} pastSevenDays={overview.pastSevenDays} />
    </AdminShell>
  );
}
