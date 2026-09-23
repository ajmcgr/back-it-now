import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { type Project } from "@/lib/projects";
import { supabase } from "@/lib/supabase";

export function BackingCheckoutButton({
  project,
  className,
}: {
  project: Project;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(25);
  const [claimReward, setClaimReward] = useState(false);
  const [backPrivately, setBackPrivately] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const rewardMinimum = project.reward.minimumAmount ?? project.goal;

  const startCheckout = async () => {
    if (!supabase || isStartingCheckout) return;
    setCheckoutError("");
    setIsStartingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          projectSlug: project.slug,
          amount: Math.round(amount * 100),
          claimReward,
          isPrivate: backPrivately,
        },
        timeout: 30_000,
      });
      if (error || !data?.checkoutUrl)
        throw new Error("We couldn't open secure checkout. Please try again.");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "We couldn't open secure checkout. Please try again.",
      );
      setIsStartingCheckout(false);
    }
  };

  return (
    <div>
      <Button size="lg" className={className ?? "w-full"} onClick={() => setOpen(true)}>
        Back this project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Back {project.title}</DialogTitle>
            <DialogDescription>Choose your backing. Rewards are optional.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
            {[25, 50, 100, 250].map((value) => (
              <Button
                key={value}
                variant={amount === value ? "default" : "outline"}
                onClick={() => {
                  setAmount(value);
                  if (value < rewardMinimum) setClaimReward(false);
                }}
              >
                ${value}
              </Button>
            ))}
          </div>
          <label className="block text-sm font-semibold">
            Other amount
            <Input
              type="number"
              min="5"
              step="1"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                const value = Number(event.target.value);
                setAmount(value);
                if (value < rewardMinimum) setClaimReward(false);
              }}
              className="mt-2"
            />
          </label>
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <label className="flex items-start gap-2 leading-5">
              <input type="radio" checked={!claimReward} onChange={() => setClaimReward(false)} />{" "}
              No reward — just back this project.
            </label>
            <label
              className={`flex items-start gap-2 leading-5 ${amount < rewardMinimum ? "text-muted-foreground" : ""}`}
            >
              <input
                type="radio"
                checked={claimReward}
                disabled={amount < rewardMinimum}
                onChange={() => setClaimReward(true)}
              />{" "}
              {project.reward.name} — ${rewardMinimum.toLocaleString()}+ ·{" "}
              {project.reward.totalQuantity} left
            </label>
            {amount < rewardMinimum && (
              <p className="text-xs text-muted-foreground">
                Requires ${rewardMinimum.toLocaleString()}+ to claim.
              </p>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1 text-sm">
            <Checkbox
              checked={backPrivately}
              onCheckedChange={(checked) => setBackPrivately(checked === true)}
              aria-describedby="back-privately-description"
              className="mt-0.5"
            />
            <span>
              <span className="block font-semibold">Back privately</span>
              <span
                id="back-privately-description"
                className="mt-0.5 block text-xs leading-5 text-muted-foreground"
              >
                Your name won’t appear publicly on the project.
              </span>
            </span>
          </label>
          {checkoutError && <p className="text-sm text-destructive">{checkoutError}</p>}
          <Button
            size="lg"
            onClick={startCheckout}
            disabled={isStartingCheckout || amount < 5}
            className="w-full"
          >
            {isStartingCheckout ? "Opening checkout…" : "Continue to payment"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
