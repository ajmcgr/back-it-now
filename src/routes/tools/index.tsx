import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Calculator, Gift, WalletCards } from "lucide-react";
import { publicSeo } from "@/lib/seo";

const tools = [
  {
    title: "Funding goal calculator",
    description:
      "Turn production, fulfillment, contingency and fee estimates into a practical funding target.",
    path: "/tools/funding-goal-calculator",
    icon: Calculator,
  },
  {
    title: "Crowdfunding fee calculator",
    description:
      "Estimate platform and payment processing costs, then see what may remain for your project.",
    path: "/tools/crowdfunding-fee-calculator",
    icon: WalletCards,
  },
  {
    title: "Reward price calculator",
    description: "Price a reward using its real costs, desired margin and estimated campaign fees.",
    path: "/tools/reward-price-calculator",
    icon: Gift,
  },
  {
    title: "Campaign planner",
    description:
      "Map the important preparation, launch, midpoint and final-week dates for your campaign.",
    path: "/tools/campaign-planner",
    icon: CalendarDays,
  },
] as const;

export const Route = createFileRoute("/tools/")({
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Tools for Creators | Backed",
      description:
        "Plan a crowdfunding goal, estimate fees, price rewards and build a campaign timeline with free Backed tools.",
      path: "/tools",
    }),
  component: ToolsIndex,
});

function ToolsIndex() {
  return (
    <main className="container-backed py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Free tools
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-6xl">
            Plan a stronger crowdfunding campaign
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Simple calculators for setting a goal, understanding costs, pricing rewards and planning
            your launch. No signup required.
          </p>
        </header>

        <section className="mt-12 grid gap-5 sm:grid-cols-2" aria-label="Crowdfunding tools">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                to={tool.path}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-7"
              >
                <Icon className="size-6 text-primary" aria-hidden="true" />
                <h2 className="mt-5 text-2xl font-semibold">{tool.title}</h2>
                <p className="mt-3 leading-7 text-muted-foreground">{tool.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                  Use this tool{" "}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
