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
import { estimateProceeds, money } from "@/lib/crowdfunding-calculators";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/crowdfunding-fee-calculator")({
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Fee Calculator | Backed",
      description:
        "Estimate crowdfunding platform fees, payment processing costs and creator proceeds.",
      path: "/tools/crowdfunding-fee-calculator",
    }),
  component: CrowdfundingFeeCalculator,
});

function CrowdfundingFeeCalculator() {
  const [raised, setRaised] = useState(10000);
  const [averageBacking, setAverageBacking] = useState(75);
  const [platform, setPlatform] = useState(5);
  const [processing, setProcessing] = useState(2.9);
  const [fixed, setFixed] = useState(0.3);
  const result = useMemo(
    () =>
      estimateProceeds({
        raised,
        averageBacking,
        platformPercent: platform,
        processingPercent: processing,
        processingFixed: fixed,
      }),
    [raised, averageBacking, platform, processing, fixed],
  );

  return (
    <ToolPage
      title="Crowdfunding fee calculator"
      description="Estimate what platform and payment processing fees could mean for the amount available to deliver your project."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolPanel title="Campaign assumptions">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="raised"
              label="Amount raised"
              prefix="$"
              value={raised}
              onChange={setRaised}
            />
            <NumberField
              id="average-backing"
              label="Average backing"
              prefix="$"
              value={averageBacking}
              onChange={setAverageBacking}
              help="Used to estimate the number of payments."
            />
            <NumberField
              id="platform-fee"
              label="Platform fee"
              suffix="%"
              value={platform}
              onChange={setPlatform}
              help="Backed charges creators 5%."
            />
            <NumberField
              id="processing-fee"
              label="Processing percentage"
              suffix="%"
              value={processing}
              onChange={setProcessing}
            />
            <NumberField
              id="fixed-fee"
              label="Fixed fee per payment"
              prefix="$"
              value={fixed}
              onChange={setFixed}
            />
          </div>
        </ToolPanel>
        <ToolPanel title="Estimated proceeds" className="h-fit">
          <div className="divide-y divide-border">
            <ResultRow label="Estimated payments" value={String(result.payments)} />
            <ResultRow label="Platform fee" value={`−${money(result.platformFee)}`} />
            <ResultRow label="Payment processing" value={`−${money(result.processingFee)}`} />
            <ResultRow label="Estimated creator proceeds" value={money(result.proceeds)} strong />
          </div>
          <EstimateNote>
            Processor pricing varies by country, payment method and connected account. Enter the
            rates that apply to your campaign.
          </EstimateNote>
        </ToolPanel>
      </div>
      <ToolCta />
    </ToolPage>
  );
}
