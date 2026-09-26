import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  EstimateNote,
  NumberField,
  ResultRow,
  ToolCta,
  ToolPage,
  ToolPanel,
} from "@/components/backed/tool-layout";
import { estimateCampaignProfit, money } from "@/lib/crowdfunding-calculators";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/campaign-profit-calculator")({
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Campaign Profit Calculator | Backed",
      description:
        "Estimate what remains after crowdfunding fees, production, fulfillment, shipping and marketing.",
      path: "/tools/campaign-profit-calculator",
    }),
  component: CampaignProfitCalculator,
});

function CampaignProfitCalculator() {
  const [raised, setRaised] = useState(15000);
  const [production, setProduction] = useState(6000);
  const [fulfillment, setFulfillment] = useState(1800);
  const [shipping, setShipping] = useState(1200);
  const [marketing, setMarketing] = useState(600);
  const [other, setOther] = useState(400);
  const [platform, setPlatform] = useState(5);
  const [processing, setProcessing] = useState(3);
  const result = useMemo(
    () =>
      estimateCampaignProfit({
        raised,
        production,
        fulfillment,
        shipping,
        marketing,
        other,
        platformPercent: platform,
        processingPercent: processing,
      }),
    [raised, production, fulfillment, shipping, marketing, other, platform, processing],
  );

  return (
    <ToolPage
      title="Campaign profit calculator"
      description="See the estimated amount left to fund your work after campaign fees and the costs required to deliver."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolPanel title="Campaign finances">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="profit-raised"
              label="Amount raised"
              prefix="$"
              value={raised}
              onChange={setRaised}
            />
            <NumberField
              id="profit-production"
              label="Production and development"
              prefix="$"
              value={production}
              onChange={setProduction}
            />
            <NumberField
              id="profit-fulfillment"
              label="Reward fulfillment"
              prefix="$"
              value={fulfillment}
              onChange={setFulfillment}
            />
            <NumberField
              id="profit-shipping"
              label="Shipping"
              prefix="$"
              value={shipping}
              onChange={setShipping}
            />
            <NumberField
              id="profit-marketing"
              label="Marketing"
              prefix="$"
              value={marketing}
              onChange={setMarketing}
            />
            <NumberField
              id="profit-other"
              label="Other costs"
              prefix="$"
              value={other}
              onChange={setOther}
            />
            <NumberField
              id="profit-platform"
              label="Platform fee"
              suffix="%"
              value={platform}
              onChange={setPlatform}
            />
            <NumberField
              id="profit-processing"
              label="Processing estimate"
              suffix="%"
              value={processing}
              onChange={setProcessing}
            />
          </div>
        </ToolPanel>
        <ToolPanel title="Estimated result" className="h-fit">
          <div className="divide-y divide-border">
            <ResultRow label="Amount raised" value={money(raised)} />
            <ResultRow label="Campaign fees" value={`−${money(result.campaignFees)}`} />
            <ResultRow label="Project costs" value={`−${money(result.projectCosts)}`} />
            <ResultRow label="Estimated remainder" value={money(result.remainder)} strong />
            <ResultRow label="Estimated margin" value={`${result.marginPercent.toFixed(1)}%`} />
          </div>
          <EstimateNote>
            A negative remainder means the current plan costs more than the campaign brings in. This
            estimate excludes taxes and fixed per-payment processing charges.
          </EstimateNote>
        </ToolPanel>
      </div>
      <ToolCta />
    </ToolPage>
  );
}
