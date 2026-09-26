import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { publicSeo } from "@/lib/seo";

const platforms = [
  {
    name: "Kickstarter",
    path: "/compare/kickstarter",
    summary: "All-or-nothing campaigns for creative projects.",
    funding: "All-or-nothing",
    payment: "Charged if the goal is reached",
    fee: "5% plus payment processing",
    bestFor: "Traditional, time-bound creative campaigns",
  },
  {
    name: "Indiegogo",
    path: "/compare/indiegogo",
    summary: "Fixed-goal campaigns with post-campaign pledge tools.",
    funding: "Fixed funding",
    payment: "Collected during the campaign",
    fee: "5% plus payment processing",
    bestFor: "Product launches needing broader campaign tools",
  },
  {
    name: "Patreon",
    path: "/compare/patreon",
    summary: "Ongoing memberships, creator communities and digital sales.",
    funding: "Recurring memberships",
    payment: "Charged on a billing schedule",
    fee: "10% standard plan plus applicable fees",
    bestFor: "Ongoing creator memberships and benefits",
  },
  {
    name: "GoFundMe",
    path: "/compare/gofundme",
    summary: "Donation fundraising for people, causes and communities.",
    funding: "Donation funding",
    payment: "Charged when a donation is made",
    fee: "No platform fee; transaction fees apply",
    bestFor: "Personal, charitable and community fundraising",
  },
] as const;

const backed = {
  funding: "Flexible project funding",
  payment: "Charged immediately",
  fee: "5% plus payment processing",
  bestFor: "Products and creative projects with optional rewards",
};

export const Route = createFileRoute("/compare/")({
  head: () =>
    publicSeo({
      title: "Compare Crowdfunding Platforms | Backed",
      description:
        "Compare Backed with Kickstarter, Indiegogo, Patreon and GoFundMe across funding models, payment timing, fees and ideal use cases.",
      path: "/compare",
    }),
  component: CompareOverview,
});

function CompareOverview() {
  return (
    <main className="container-backed py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Crowdfunding platforms compared
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">
            Find the right way to fund your idea
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Backed is built for one-time project funding with optional rewards. See how that model
            compares with four established funding platforms.
          </p>
        </header>

        <section className="mt-14" aria-labelledby="overview-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="overview-heading" className="text-2xl font-semibold sm:text-3xl">
                At a glance
              </h2>
              <p className="mt-2 text-muted-foreground">
                The main differences in how each platform works.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Information reviewed September 2026.</p>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-5 py-4 font-semibold" scope="col">
                    Platform
                  </th>
                  <th className="px-5 py-4 font-semibold" scope="col">
                    Funding model
                  </th>
                  <th className="px-5 py-4 font-semibold" scope="col">
                    Payment timing
                  </th>
                  <th className="px-5 py-4 font-semibold" scope="col">
                    Platform fee
                  </th>
                  <th className="px-5 py-4 font-semibold" scope="col">
                    Best suited to
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-primary/[0.04] align-top">
                  <th className="px-5 py-4 font-semibold text-primary" scope="row">
                    Backed
                  </th>
                  <OverviewCells platform={backed} />
                </tr>
                {platforms.map((platform) => (
                  <tr key={platform.name} className="align-top">
                    <th className="px-5 py-4 font-semibold" scope="row">
                      {platform.name}
                    </th>
                    <OverviewCells platform={platform} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Swipe or scroll horizontally to view the complete table on smaller screens.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="guides-heading">
          <div className="max-w-2xl">
            <h2 id="guides-heading" className="text-2xl font-semibold sm:text-3xl">
              Read each comparison
            </h2>
            <p className="mt-2 leading-7 text-muted-foreground">
              Explore funding, fees, rewards and use cases in more detail.
            </p>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {platforms.map((platform) => (
              <Link
                key={platform.name}
                to={platform.path}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-sm font-medium text-primary">Platform comparison</p>
                    <h3 className="mt-2 text-2xl font-semibold">Backed vs {platform.name}</h3>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </div>
                <p className="mt-4 leading-7 text-muted-foreground">{platform.summary}</p>
                <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
                  <Check aria-hidden="true" className="size-4 text-primary" />
                  View the full comparison
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-xl border border-border bg-card px-6 py-10 text-center sm:px-10">
          <h2 className="text-3xl font-semibold">Ready to bring your project to life?</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">
            Launch for free, offer optional rewards and keep the funds from successful backings.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/start">Start a project</Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Backed takes 5% of successful backing amounts, plus payment processing.
          </p>
        </section>

        <p className="mt-8 text-center text-sm leading-6 text-muted-foreground">
          Backed is not affiliated with or endorsed by the platforms listed above. Features and
          pricing can change; review each provider&apos;s current terms before choosing a platform.
        </p>
      </div>
    </main>
  );
}

function OverviewCells({
  platform,
}: {
  platform: Pick<(typeof platforms)[number], "funding" | "payment" | "fee" | "bestFor">;
}) {
  return (
    <>
      <td className="px-5 py-4 leading-6 text-muted-foreground">{platform.funding}</td>
      <td className="px-5 py-4 leading-6 text-muted-foreground">{platform.payment}</td>
      <td className="px-5 py-4 leading-6 text-muted-foreground">{platform.fee}</td>
      <td className="px-5 py-4 leading-6 text-muted-foreground">{platform.bestFor}</td>
    </>
  );
}
