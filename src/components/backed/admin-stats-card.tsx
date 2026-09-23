import type { AdminTotals } from "@/lib/admin";

type MetricKey = keyof AdminTotals;

const metrics: Array<{ key: MetricKey; label: string }> = [
  { key: "users", label: "Users" },
  { key: "projects", label: "Projects" },
  { key: "amountBacked", label: "Backed" },
  { key: "backers", label: "Backers" },
  { key: "comments", label: "Comments" },
];

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

export function AdminStatsCard({
  totals,
  pastSevenDays,
}: {
  totals: AdminTotals;
  pastSevenDays: AdminTotals;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map(({ key, label }) => {
        const isMoney = key === "amountBacked";
        const total = totals[key];
        const recent = pastSevenDays[key];
        return (
          <article
            key={key}
            className="flex min-h-[250px] flex-col rounded-xl border border-border bg-card p-7 sm:min-h-[270px] sm:p-8"
          >
            <div className="flex items-start justify-between gap-6">
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-muted-foreground">
                {label}
              </h2>
              <img
                src="/logo.png"
                alt="Backed"
                width={3654}
                height={1291}
                className="h-auto w-[112px] shrink-0"
              />
            </div>
            <div className="mt-auto pt-12">
              <p className="text-5xl font-semibold tracking-[-0.04em] text-foreground tabular-nums sm:text-6xl">
                {isMoney ? formatMoney(total) : total.toLocaleString("en-US")}
              </p>
              <p className="mt-5 text-sm font-medium text-[#5171ff] tabular-nums">
                +{isMoney ? formatMoney(recent) : recent.toLocaleString("en-US")} past 7 days
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
