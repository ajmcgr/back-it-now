import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage, type ComparisonRow } from "@/components/backed/comparison-page";
import { publicSeo } from "@/lib/seo";

const rows: ComparisonRow[] = [
  {
    label: "Primary use",
    backed: "Funding an individual product or creative project.",
    competitor: "Ongoing creator memberships, community and one-time digital purchases.",
  },
  {
    label: "Funding model",
    backed: "Flexible project crowdfunding with a visible goal and deadline.",
    competitor:
      "Recurring paid memberships and one-time commerce rather than campaign crowdfunding.",
  },
  {
    label: "Payment timing",
    backed: "Backers are charged immediately for a one-time backing.",
    competitor:
      "Subscription members are charged when they join and then on their billing schedule; one-time purchases are charged once.",
  },
  {
    label: "Platform fee",
    backed: "5% of successful backing amounts, plus payment processing.",
    competitor:
      "The standard plan for new creator pages is 10% of successfully processed payments, plus applicable processing and other fees.",
  },
  {
    label: "Supporter offering",
    backed: "Optional project rewards, custom backing amounts, or backing without a reward.",
    competitor: "Membership tiers and benefits, community access, and eligible one-time products.",
  },
  {
    label: "Recurring memberships",
    backed: "Not the core model; backings are project-specific and one-time.",
    competitor: "A core model, with monthly or eligible annual memberships.",
  },
];

export const Route = createFileRoute("/compare/patreon")({
  head: () =>
    publicSeo({
      title: "Backed vs Patreon: Creator Funding Compared | Backed",
      description:
        "Compare Backed's project crowdfunding with Patreon's ongoing memberships, including fees, supporter payments, rewards and ideal use cases.",
      path: "/compare/patreon",
    }),
  component: PatreonComparison,
});

function PatreonComparison() {
  return (
    <ComparisonPage
      competitor="Patreon"
      eyebrow="Creator funding compared"
      intro="Backed is designed to fund a specific product or creative project. Patreon is primarily designed for an ongoing relationship between creators and paying members, with one-time sales also available."
      rows={rows}
      howTheyWork="Backed organizes support around one project, its goal, deadline and optional rewards. Patreon organizes monetization around a creator page, memberships, community benefits and eligible one-time purchases."
      backedFit="Consider Backed when the thing being funded has a clear project scope and you want one-time backings, optional rewards and a public progress goal."
      competitorFit="Consider Patreon when you publish on an ongoing basis and want recurring memberships, gated benefits and a continuing creator community."
      sourceLinks={[
        {
          label: "pricing",
          href: "https://support.patreon.com/hc/en-us/articles/16733504643597-Pricing-FAQ",
        },
        {
          label: "membership billing",
          href: "https://support.patreon.com/hc/en-us/articles/360002355991-How-membership-billing-works",
        },
      ]}
    />
  );
}
