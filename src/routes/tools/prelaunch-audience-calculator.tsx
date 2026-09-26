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
import { estimateAudienceSize } from "@/lib/crowdfunding-calculators";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/prelaunch-audience-calculator")({
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Pre-Launch Audience Calculator | Backed",
      description:
        "Estimate the audience and qualified visitors a crowdfunding campaign may need before launch.",
      path: "/tools/prelaunch-audience-calculator",
    }),
  component: PrelaunchAudienceCalculator,
});

function PrelaunchAudienceCalculator() {
  const [goal, setGoal] = useState(10000);
  const [averageBacking, setAverageBacking] = useState(75);
  const [conversion, setConversion] = useState(5);
  const [prelaunchShare, setPrelaunchShare] = useState(30);
  const result = useMemo(
    () =>
      estimateAudienceSize({
        goal,
        averageBacking,
        conversionPercent: conversion,
        prelaunchSharePercent: prelaunchShare,
      }),
    [goal, averageBacking, conversion, prelaunchShare],
  );

  return (
    <ToolPage
      title="Pre-launch audience calculator"
      description="Estimate the qualified audience you may need to produce enough backers for your campaign goal."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolPanel title="Audience assumptions">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="audience-goal"
              label="Funding goal"
              prefix="$"
              value={goal}
              onChange={setGoal}
            />
            <NumberField
              id="audience-average"
              label="Average backing"
              prefix="$"
              value={averageBacking}
              onChange={setAverageBacking}
            />
            <NumberField
              id="audience-conversion"
              label="Visitor-to-backer conversion"
              suffix="%"
              value={conversion}
              onChange={setConversion}
              help="Use a conservative estimate when you do not have prior data."
            />
            <NumberField
              id="prelaunch-share"
              label="Target from pre-launch audience"
              suffix="%"
              value={prelaunchShare}
              onChange={setPrelaunchShare}
              help="The share of total backers you hope to prepare before launch."
            />
          </div>
        </ToolPanel>
        <ToolPanel title="Estimated audience" className="h-fit">
          <div className="divide-y divide-border">
            <ResultRow label="Total backers needed" value={result.backers.toLocaleString()} />
            <ResultRow
              label="Qualified visitors needed"
              value={result.visitors.toLocaleString()}
              strong
            />
            <ResultRow
              label="Pre-launch backer target"
              value={result.prelaunchBackers.toLocaleString()}
            />
            <ResultRow
              label="Pre-launch audience target"
              value={result.prelaunchAudience.toLocaleString()}
            />
          </div>
          <EstimateNote>
            A follower or email subscriber is not automatically a qualified visitor. Conversion
            depends on relevance, trust, traffic source and the project itself.
          </EstimateNote>
        </ToolPanel>
      </div>
      <ToolCta />
    </ToolPage>
  );
}
