import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { rewardAvailability, type Project } from "@/lib/projects";
import { supabase } from "@/lib/supabase";

export function BackingDialog({
  project,
  children,
}: {
  project: Project;
  children?: React.ReactNode;
}) {
  const availability = rewardAvailability(project.reward);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const startCheckout = async () => {
    if (!supabase) return;
    setCheckoutError("");
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setIsStartingCheckout(true);
    try {
      const { data: campaign, error: campaignError } = await supabase
        .from("projects")
        .select("id")
        .eq("slug", project.slug)
        .eq("status", "live")
        .single();
      if (campaignError || !campaign) throw new Error("This project is not ready for backing.");
      const { data: reward, error: rewardError } = await supabase
        .from("rewards")
        .select("id")
        .eq("project_id", campaign.id)
        .eq("title", project.reward.name)
        .single();
      if (rewardError || !reward) throw new Error("This reward is no longer available.");
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { rewardId: reward.id },
      });
      if (error || !data?.checkoutUrl)
        throw new Error(error?.message || "Unable to start checkout.");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout.");
      setIsStartingCheckout(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="lg" className="w-full">
            Back this project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0">
        <div className="grid sm:grid-cols-[180px_1fr]">
          <img
            src={project.coverImage}
            alt=""
            width={720}
            height={480}
            className="h-full min-h-44 w-full object-cover"
          />
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl">{project.reward.name}</DialogTitle>
              <DialogDescription>{project.reward.description}</DialogDescription>
            </DialogHeader>
            {availability && (
              <p className="mt-4 text-sm font-semibold text-foreground">{availability}</p>
            )}
            <div className="mt-6">
              <p className="text-sm font-semibold">Includes</p>
              <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                {project.reward.includes.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Button className="mt-7 w-full" onClick={startCheckout} disabled={isStartingCheckout}>
              {isStartingCheckout ? "Opening checkout…" : "Back this project"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              If this project does not reach its goal by the deadline, your eligible backing will be
              refunded.
            </p>
            {checkoutError && (
              <p className="mt-3 text-center text-xs text-destructive">{checkoutError}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
