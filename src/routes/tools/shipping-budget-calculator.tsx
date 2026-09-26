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
import { estimateShippingBudget, money } from "@/lib/crowdfunding-calculators";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/shipping-budget-calculator")({
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Shipping Budget Calculator | Backed",
      description:
        "Estimate domestic and international reward shipping, packaging and replacement buffers.",
      path: "/tools/shipping-budget-calculator",
    }),
  component: ShippingBudgetCalculator,
});

function ShippingBudgetCalculator() {
  const [domesticRewards, setDomesticRewards] = useState(80);
  const [domesticShipping, setDomesticShipping] = useState(7);
  const [internationalRewards, setInternationalRewards] = useState(20);
  const [internationalShipping, setInternationalShipping] = useState(22);
  const [packaging, setPackaging] = useState(2.5);
  const [buffer, setBuffer] = useState(10);
  const result = useMemo(
    () =>
      estimateShippingBudget({
        domesticRewards,
        domesticShipping,
        internationalRewards,
        internationalShipping,
        packagingPerReward: packaging,
        bufferPercent: buffer,
      }),
    [
      domesticRewards,
      domesticShipping,
      internationalRewards,
      internationalShipping,
      packaging,
      buffer,
    ],
  );

  return (
    <ToolPage
      title="Shipping budget calculator"
      description="Estimate reward delivery costs across domestic and international backers before shipping surprises consume your budget."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolPanel title="Fulfillment assumptions">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="domestic-rewards"
              label="Domestic rewards"
              value={domesticRewards}
              onChange={setDomesticRewards}
              step="1"
            />
            <NumberField
              id="domestic-shipping"
              label="Shipping per domestic reward"
              prefix="$"
              value={domesticShipping}
              onChange={setDomesticShipping}
            />
            <NumberField
              id="international-rewards"
              label="International rewards"
              value={internationalRewards}
              onChange={setInternationalRewards}
              step="1"
            />
            <NumberField
              id="international-shipping"
              label="Shipping per international reward"
              prefix="$"
              value={internationalShipping}
              onChange={setInternationalShipping}
            />
            <NumberField
              id="shipping-packaging"
              label="Packaging per reward"
              prefix="$"
              value={packaging}
              onChange={setPackaging}
            />
            <NumberField
              id="shipping-buffer"
              label="Replacement buffer"
              suffix="%"
              value={buffer}
              onChange={setBuffer}
            />
          </div>
        </ToolPanel>
        <ToolPanel title="Estimated shipping budget" className="h-fit">
          <div className="divide-y divide-border">
            <ResultRow label="Rewards shipped" value={result.rewards.toLocaleString()} />
            <ResultRow label="Carrier costs" value={money(result.shipping)} />
            <ResultRow label="Packaging" value={money(result.packaging)} />
            <ResultRow label="Replacement buffer" value={money(result.buffer)} />
            <ResultRow label="Total shipping budget" value={money(result.total)} strong />
          </div>
          <EstimateNote>
            Confirm package weight, dimensions, duties, taxes, tracked services and destination
            rates with your carrier or fulfillment partner.
          </EstimateNote>
        </ToolPanel>
      </div>
      <ToolCta />
    </ToolPage>
  );
}
