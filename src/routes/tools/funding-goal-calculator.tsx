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
import { estimateFundingGoal, money } from "@/lib/crowdfunding-calculators";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/funding-goal-calculator")({
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Goal Calculator | Backed",
      description:
        "Estimate a practical crowdfunding target using project costs, contingency and campaign fees.",
      path: "/tools/funding-goal-calculator",
    }),
  component: FundingGoalCalculator,
});

function FundingGoalCalculator() {
  const [production, setProduction] = useState(5000);
  const [fulfillment, setFulfillment] = useState(1200);
  const [marketing, setMarketing] = useState(500);
  const [other, setOther] = useState(300);
  const [contingency, setContingency] = useState(10);
  const [fees, setFees] = useState(8);
  const result = useMemo(
    () =>
      estimateFundingGoal({
        production,
        fulfillment,
        marketing,
        other,
        contingencyPercent: contingency,
        feePercent: fees,
      }),
    [production, fulfillment, marketing, other, contingency, fees],
  );

  return (
    <ToolPage
      title="Crowdfunding goal calculator"
      description="Build a funding target from the costs required to deliver your project—not a number chosen for the progress bar."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolPanel title="Project costs">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="production"
              label="Production and development"
              prefix="$"
              value={production}
              onChange={setProduction}
            />
            <NumberField
              id="fulfillment"
              label="Rewards and fulfillment"
              prefix="$"
              value={fulfillment}
              onChange={setFulfillment}
            />
            <NumberField
              id="marketing"
              label="Marketing"
              prefix="$"
              value={marketing}
              onChange={setMarketing}
            />
            <NumberField
              id="other"
              label="Other costs"
              prefix="$"
              value={other}
              onChange={setOther}
            />
            <NumberField
              id="contingency"
              label="Contingency"
              suffix="%"
              value={contingency}
              onChange={setContingency}
              help="A buffer for overruns and replacements."
            />
            <NumberField
              id="fees"
              label="Estimated total fees"
              suffix="%"
              value={fees}
              onChange={setFees}
              help="Include platform and payment processing estimates."
            />
          </div>
        </ToolPanel>
        <ToolPanel title="Estimated goal" className="h-fit">
          <div className="divide-y divide-border">
            <ResultRow label="Project costs" value={money(result.subtotal)} />
            <ResultRow label="Contingency" value={money(result.contingency)} />
            <ResultRow label="Estimated fees" value={money(result.estimatedFees)} />
            <ResultRow
              label="Suggested funding goal"
              value={money(Math.ceil(result.goal))}
              strong
            />
          </div>
          <EstimateNote>
            This is a planning estimate, not financial advice. Validate taxes, shipping and
            processor pricing for your location before publishing.
          </EstimateNote>
        </ToolPanel>
      </div>
      <ToolCta />
    </ToolPage>
  );
}
