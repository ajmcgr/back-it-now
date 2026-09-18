import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    async function completeSignIn() {
      if (started.current) return;
      started.current = true;
      if (!supabase) return setError("Authentication is not configured.");
      const callbackUrl = new URL(window.location.href);
      const code = callbackUrl.searchParams.get("code");
      if (!code) return setError("Your sign-in link has expired. Please try again.");
      const next = callbackUrl.searchParams.get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        return setError(
          "We couldn't complete your sign-in. Please return to Backed and try again.",
        );
      }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return setError("Your sign-in link has expired. Please try again.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (!profile)
        return setError("Your Backed profile is still being created. Please refresh in a moment.");
      window.history.replaceState({}, "", "/auth/callback");
      navigate({ to: destination });
    }
    void completeSignIn();
  }, [navigate]);

  return (
    <main className="container-backed grid min-h-[calc(100vh-8rem)] place-items-center py-16 text-muted-foreground">
      {error ?? "Completing secure sign-in…"}
    </main>
  );
}
