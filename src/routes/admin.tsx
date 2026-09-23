import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLoading, AdminShell, AdminUnavailable } from "@/components/backed/admin-shell";
import { AdminStatsCard } from "@/components/backed/admin-stats-card";
import { invokeAdmin, type AdminTotals } from "@/lib/admin";
import { privateSeo } from "@/lib/seo";

export const Route = createFileRoute("/admin")({
  head: () => privateSeo("Admin — Backed"),
  component: AdminOverview,
});

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

function AdminOverview() {
  const [totals, setTotals] = useState<AdminTotals | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void invokeAdmin<{ totals: AdminTotals }>("overview")
      .then((response) => {
        if (!cancelled) setTotals(response.totals);
      })
      .catch(() => {
        if (!cancelled) setDenied(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (denied) return <AdminUnavailable message="You don’t have access to Backed Admin." />;
  if (!totals) return <AdminLoading />;

  const summary = [
    ["Total users", totals.users.toLocaleString("en-US")],
    ["Total projects", totals.projects.toLocaleString("en-US")],
    ["Total amount backed", formatMoney(totals.amountBacked)],
    ["Total backers", totals.backers.toLocaleString("en-US")],
    ["Total comments", totals.comments.toLocaleString("en-US")],
  ];

  return (
    <AdminShell
      active="overview"
      title="Overview"
      description="A simple view of Backed’s real production activity. Seed funding is excluded from backing totals."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summary.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-12 border-t border-border pt-10">
        <div className="mb-6 max-w-2xl">
          <h2 className="text-2xl font-semibold">Share stats</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create a branded social card from the current verified number or a truthful lower
            milestone.
          </p>
        </div>
        <AdminStatsCard totals={totals} />
      </section>
    </AdminShell>
  );
}
