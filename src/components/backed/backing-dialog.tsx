import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type Project } from "@/lib/projects";
import { supabase } from "@/lib/supabase";

export function BackingCheckoutButton({
  project,
  className,
}: {
  project: Project;
  className?: string;
}) {
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const startCheckout = async () => {
    if (!supabase || isStartingCheckout) return;
    setCheckoutError("");
    setIsStartingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { projectSlug: project.slug },
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
      <Button
        size="lg"
        className={className ?? "w-full"}
        onClick={startCheckout}
        disabled={isStartingCheckout}
      >
        {isStartingCheckout ? "Opening checkout…" : "Back this project"}
      </Button>
      {checkoutError && (
        <p className="mt-3 text-center text-xs text-destructive">{checkoutError}</p>
      )}
    </div>
  );
}
