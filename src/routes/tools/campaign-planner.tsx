import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  EstimateNote,
  NumberField,
  ToolCta,
  ToolPage,
  ToolPanel,
} from "@/components/backed/tool-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/campaign-planner")({
  loader: () => ({ today: new Date().toISOString().slice(0, 10) }),
  head: () =>
    publicSeo({
      title: "Free Crowdfunding Campaign Planner | Backed",
      description:
        "Calculate preparation, launch, midpoint, final-week and deadline dates for a crowdfunding campaign.",
      path: "/tools/campaign-planner",
    }),
  component: CampaignPlanner,
});

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function CampaignPlanner() {
  const { today } = Route.useLoaderData();
  const [launchDate, setLaunchDate] = useState(today);
  const [duration, setDuration] = useState(30);
  const dates = useMemo(() => {
    const launch = new Date(`${launchDate}T12:00:00`);
    const safeLaunch = Number.isNaN(launch.getTime()) ? new Date() : launch;
    const days = Math.max(1, Math.round(duration));
    const end = addDays(safeLaunch, days - 1);
    return [
      {
        label: "Begin pre-launch preparation",
        detail: "Build your page, assets and outreach list.",
        date: addDays(safeLaunch, -28),
      },
      {
        label: "Campaign launches",
        detail: "Tell your closest supporters first.",
        date: safeLaunch,
      },
      {
        label: "Midpoint review",
        detail: "Review questions, traffic and campaign clarity.",
        date: addDays(safeLaunch, Math.floor((days - 1) / 2)),
      },
      {
        label: "Final week begins",
        detail: "Share progress and the approaching deadline.",
        date: addDays(end, -6),
      },
      {
        label: "Campaign deadline",
        detail: "Thank backers and communicate what happens next.",
        date: end,
      },
    ];
  }, [launchDate, duration]);

  return (
    <ToolPage
      title="Crowdfunding campaign planner"
      description="Choose a launch date and campaign length to map the moments that deserve preparation and communication."
    >
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <ToolPanel title="Campaign timing" className="h-fit">
          <div className="space-y-5">
            <div>
              <Label htmlFor="launch-date">Launch date</Label>
              <Input
                id="launch-date"
                type="date"
                value={launchDate}
                onChange={(event) => setLaunchDate(event.target.value)}
                className="mt-2"
              />
            </div>
            <NumberField
              id="duration"
              label="Campaign length"
              suffix="days"
              value={duration}
              onChange={setDuration}
              min={1}
              step="1"
            />
          </div>
          <EstimateNote>
            Four weeks of preparation is a useful starting point, not a rule. Adjust it to the
            complexity of your project and audience.
          </EstimateNote>
        </ToolPanel>
        <ToolPanel title="Your campaign timeline">
          <ol className="space-y-6">
            {dates.map((item) => (
              <li key={item.label} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm font-medium text-primary">{displayDate(item.date)}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </ToolPanel>
      </div>
      <ToolCta />
    </ToolPage>
  );
}
