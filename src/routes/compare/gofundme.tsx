import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage, type ComparisonRow } from "@/components/backed/comparison-page";
import { publicSeo } from "@/lib/seo";

const rows: ComparisonRow[] = [
  {
    label: "Primary use",
    backed: "Reward and preorder crowdfunding for products and creative projects.",
    competitor: "Donation fundraising for personal needs, communities, organizations and causes.",
  },
  {
    label: "Funding model",
    backed:
      "Flexible project funding. Creators can receive successful backing proceeds without reaching the goal.",
    competitor:
      "Donation funding. Organizers do not need to reach the goal to receive available funds.",
  },
  {
    label: "Payment timing",
    backed: "Backers are charged immediately.",
    competitor:
      "Donors are charged when they make a donation; processed donations become available for transfer.",
  },
  {
    label: "Platform fee",
    backed: "5% of successful backing amounts, plus payment processing.",
    competitor:
      "No fee to start or manage a fundraiser; a transaction fee applies to each donation, and donors may leave an optional tip.",
  },
  {
    label: "Rewards",
    backed: "Optional project rewards and preorders, with the option to back without one.",
    competitor: "Donation-led fundraising rather than a reward or preorder marketplace.",
  },
  {
    label: "Funding goal",
    backed: "Shows project progress but does not block successful proceeds.",
    competitor: "Can be edited and does not need to be reached for funds to be received.",
  },
];

export const Route = createFileRoute("/compare/gofundme")({
  head: () =>
    publicSeo({
      title: "Backed vs GoFundMe: Crowdfunding Compared | Backed",
      description:
        "Compare Backed's reward and preorder crowdfunding with GoFundMe's donation fundraising, including fees, goals, rewards and ideal use cases.",
      path: "/compare/gofundme",
    }),
  component: GofundmeComparison,
});

function GofundmeComparison() {
  return (
    <ComparisonPage
      competitor="GoFundMe"
      eyebrow="Crowdfunding platforms compared"
      intro="Both platforms let people support something they care about, but the format differs. Backed is for reward and preorder projects; GoFundMe is centered on donations for personal, community and organizational needs."
      rows={rows}
      howTheyWork="Backed connects one-time project backings with optional rewards or preorders. GoFundMe collects donations for a fundraiser and transfers processed funds without requiring the stated goal to be reached."
      backedFit="Consider Backed when you are making a product or creative project and want to offer optional rewards, preorders or a way to back without claiming one."
      competitorFit="Consider GoFundMe when the purpose is personal, community, nonprofit or cause-based fundraising and supporters are donating rather than backing a product reward."
      sourceLinks={[
        {
          label: "fees",
          href: "https://support.gofundme.com/hc/en-us/articles/203604424-Learn-about-GoFundMe-fees",
        },
        {
          label: "funding goals",
          href: "https://support.gofundme.com/hc/en-us/articles/360001992627-Creating-a-GoFundMe-from-start-to-finish",
        },
      ]}
    />
  );
}
