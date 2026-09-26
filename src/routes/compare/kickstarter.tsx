import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage, type ComparisonRow } from "@/components/backed/comparison-page";
import { publicSeo } from "@/lib/seo";

const rows: ComparisonRow[] = [
  {
    label: "Primary use",
    backed: "Reward and preorder crowdfunding for independent products and creative projects.",
    competitor: "Campaign crowdfunding for creative projects.",
  },
  {
    label: "Funding model",
    backed:
      "Flexible funding. The creator can receive successful backing proceeds without reaching the goal.",
    competitor: "All-or-nothing. A project must reach its goal by its deadline to collect funds.",
  },
  {
    label: "Payment timing",
    backed: "Backers are charged immediately.",
    competitor: "Backers are charged only if the project reaches its goal by the deadline.",
  },
  {
    label: "Platform fee",
    backed: "5% of successful backing amounts, plus payment processing.",
    competitor: "5% on successfully funded projects, plus payment processing fees of 3–5%.",
  },
  {
    label: "Rewards",
    backed: "Optional rewards, custom backing amounts, and backing without a reward.",
    competitor: "Creators can offer project-related rewards to backers.",
  },
  {
    label: "Funding goal",
    backed: "Tracks progress but does not determine whether successful proceeds are received.",
    competitor: "Determines whether the project is funded and backers are charged.",
  },
];

export const Route = createFileRoute("/compare/kickstarter")({
  head: () =>
    publicSeo({
      title: "Backed vs Kickstarter: Crowdfunding Platforms Compared | Backed",
      description:
        "Compare Backed's flexible reward crowdfunding with Kickstarter's all-or-nothing campaign model, including fees, payment timing and rewards.",
      path: "/compare/kickstarter",
    }),
  component: KickstarterComparison,
});

function KickstarterComparison() {
  return (
    <ComparisonPage
      competitor="Kickstarter"
      eyebrow="Crowdfunding platforms compared"
      intro="Both platforms help creative projects find early supporters. The central difference is funding: Backed uses flexible funding, while Kickstarter uses an all-or-nothing campaign model."
      rows={rows}
      howTheyWork="Backed records each successful backing immediately and lets creators offer optional rewards. Kickstarter collects pledges only when a campaign reaches its stated goal by the deadline."
      backedFit="Consider Backed when you are launching an independent product or creative project and want each successful backing to contribute funds, even if the visible goal is not reached."
      competitorFit="Consider Kickstarter when an all-or-nothing goal is important to the project's plan and you want a traditional time-bound creative crowdfunding campaign."
      sourceLinks={[
        {
          label: "funding model",
          href: "https://updates.kickstarter.com/why-is-funding-all-or-nothing/",
        },
        { label: "fees", href: "https://www.kickstarter.com/help/fees" },
      ]}
    />
  );
}
