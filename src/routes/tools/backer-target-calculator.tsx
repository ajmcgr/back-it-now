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
import { estimateBackerTarget, money } from "@/lib/crowdfunding-calculators";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/backer-target-calculator")({
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Backer Target Calculator | Backed",
      description:
        "Calculate how many backers a crowdfunding campaign may need to reach its funding goal.",
      path: "/tools/backer-target-calculator",
    }),
  component: BackerTargetCalculator,
});

function BackerTargetCalculator() {
  const [goal, setGoal] = useState(10000);
  const [averageBacking, setAverageBacking] = useState(75);
  const [days, setDays] = useState(30);
  const result = useMemo(
    () => estimateBackerTarget({ goal, averageBacking, campaignDays: days }),
    [goal, averageBacking, days],
  );

  return (
    <ToolPage
      title="Backer target calculator"
      description="Turn your funding goal into a concrete backer target, then break it into useful weekly and daily milestones."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolPanel title="Campaign assumptions">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="backer-goal"
              label="Funding goal"
              prefix="$"
              value={goal}
              onChange={setGoal}
            />
            <NumberField
              id="backer-average"
              label="Average backing"
              prefix="$"
              value={averageBacking}
              onChange={setAverageBacking}
            />
            <NumberField
              id="backer-days"
              label="Campaign length"
              suffix="days"
              value={days}
              onChange={setDays}
              min={1}
              step="1"
            />
          </div>
        </ToolPanel>
        <ToolPanel title="Estimated targets" className="h-fit">
          <div className="divide-y divide-border">
            <ResultRow label="Backers needed" value={result.backers.toLocaleString()} strong />
            <ResultRow label="Backers per week" value={result.backersPerWeek.toLocaleString()} />
            <ResultRow label="Backers per day" value={result.backersPerDay.toLocaleString()} />
            <ResultRow label="Backing needed per day" value={money(result.amountPerDay)} />
          </div>
          <EstimateNote>
            Average backing often changes as reward availability and campaign momentum change. Use
            this as a planning target, not a prediction.
          </EstimateNote>
        </ToolPanel>
      </div>
      <ToolCta />
    </ToolPage>
  );
}
