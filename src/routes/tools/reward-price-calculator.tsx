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
import { estimateRewardPrice, money } from "@/lib/crowdfunding-calculators";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/reward-price-calculator")({
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Reward Price Calculator | Backed",
      description: "Estimate a sustainable minimum backing amount for a crowdfunding reward.",
      path: "/tools/reward-price-calculator",
    }),
  component: RewardPriceCalculator,
});

function RewardPriceCalculator() {
  const [unitCost, setUnitCost] = useState(18);
  const [packaging, setPackaging] = useState(3);
  const [shipping, setShipping] = useState(7);
  const [margin, setMargin] = useState(25);
  const [platform, setPlatform] = useState(5);
  const [processing, setProcessing] = useState(2.9);
  const [fixed, setFixed] = useState(0.3);
  const result = useMemo(
    () =>
      estimateRewardPrice({
        unitCost,
        packaging,
        creatorShipping: shipping,
        marginPercent: margin,
        platformPercent: platform,
        processingPercent: processing,
        processingFixed: fixed,
      }),
    [unitCost, packaging, shipping, margin, platform, processing, fixed],
  );

  return (
    <ToolPage
      title="Reward price calculator"
      description="Find a minimum backing amount that accounts for producing, packing and delivering a reward—plus fees and breathing room."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolPanel title="Reward assumptions">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="unit-cost"
              label="Unit production cost"
              prefix="$"
              value={unitCost}
              onChange={setUnitCost}
            />
            <NumberField
              id="packaging"
              label="Packaging"
              prefix="$"
              value={packaging}
              onChange={setPackaging}
            />
            <NumberField
              id="shipping"
              label="Shipping paid by creator"
              prefix="$"
              value={shipping}
              onChange={setShipping}
            />
            <NumberField
              id="margin"
              label="Target margin"
              suffix="%"
              value={margin}
              onChange={setMargin}
            />
            <NumberField
              id="reward-platform"
              label="Platform fee"
              suffix="%"
              value={platform}
              onChange={setPlatform}
            />
            <NumberField
              id="reward-processing"
              label="Processing percentage"
              suffix="%"
              value={processing}
              onChange={setProcessing}
            />
            <NumberField
              id="reward-fixed"
              label="Fixed processing fee"
              prefix="$"
              value={fixed}
              onChange={setFixed}
            />
          </div>
        </ToolPanel>
        <ToolPanel title="Suggested reward minimum" className="h-fit">
          <div className="divide-y divide-border">
            <ResultRow label="Cost to fulfill" value={money(result.cost)} />
            <ResultRow label="Target contribution" value={money(result.targetMargin)} />
            <ResultRow label="Calculated minimum" value={money(result.suggestedPrice)} />
            <ResultRow label="Rounded minimum backing" value={money(result.roundedPrice)} strong />
          </div>
          <EstimateNote>
            Check taxes, failed deliveries, replacements and destination-specific shipping before
            setting the final reward minimum.
          </EstimateNote>
        </ToolPanel>
      </div>
      <ToolCta />
    </ToolPage>
  );
}
