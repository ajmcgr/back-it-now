import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage, type ComparisonRow } from "@/components/backed/comparison-page";
import { publicSeo } from "@/lib/seo";

const rows: ComparisonRow[] = [
  {
    label: "Primary use",
    backed: "Reward and preorder crowdfunding for independent products and creative projects.",
    competitor: "Campaign crowdfunding and product launches, with pledge-management tools.",
  },
  {
    label: "Funding model",
    backed:
      "Flexible funding. The creator can receive successful backing proceeds without reaching the goal.",
    competitor:
      "Current campaigns use fixed funding and must reach their goal to keep collected funds.",
  },
  {
    label: "Payment timing",
    backed: "Backers are charged immediately.",
    competitor:
      "Contributions are collected during the campaign and returned automatically if the goal is missed.",
  },
  {
    label: "Platform fee",
    backed: "5% of successful backing amounts, plus payment processing.",
    competitor: "5% platform fee, plus payment processing fees.",
  },
  {
    label: "Rewards",
    backed: "Optional rewards, custom backing amounts, and backing without a reward.",
    competitor: "Campaigns can offer perks and add-ons to backers.",
  },
  {
    label: "After the campaign",
    backed: "Projects remain centered on their public page, progress, updates and community.",
    competitor:
      "Successfully funded campaigns can continue with Late Pledge and pledge-management tools.",
  },
];

export const Route = createFileRoute("/compare/indiegogo")({
  head: () =>
    publicSeo({
      title: "Backed vs Indiegogo: Crowdfunding Platforms Compared | Backed",
      description:
        "Compare Backed and Indiegogo for product and creative crowdfunding, including current funding models, fees, rewards and payment timing.",
      path: "/compare/indiegogo",
    }),
  component: IndiegogoComparison,
});

function IndiegogoComparison() {
  return (
    <ComparisonPage
      competitor="Indiegogo"
      eyebrow="Crowdfunding platforms compared"
      intro="Backed and Indiegogo both support project and product crowdfunding. Backed uses flexible funding; Indiegogo's current platform uses fixed funding and adds campaign tools for later pledges and fulfillment."
      rows={rows}
      howTheyWork="Backed keeps the flow focused on a project, optional reward and immediate backing. Indiegogo runs fixed-goal campaigns and provides additional post-campaign pledge-management tools."
      backedFit="Consider Backed when you want a straightforward reward or preorder project where each successful backing can fund the work without an all-or-nothing threshold."
      competitorFit="Consider Indiegogo when fixed-goal crowdfunding and a broader campaign, late-pledge and pledge-management workflow fit your product launch."
      sourceLinks={[
        {
          label: "current funding and fees",
          href: "https://support.indiegogo.com/hc/en-us/articles/39600950083988-Indiegogo-s-Acquisition-by-Gamefound-Platform-Upgrade-FAQs",
        },
      ]}
    />
  );
}
