import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState("Callback mounted");
  const started = useRef(false);

  useEffect(() => {
    async function completeSignIn() {
      if (started.current) return;
      started.current = true;
      if (!supabase) return setError("Authentication is not configured.");
      const callbackUrl = new URL(window.location.href);
      const code = callbackUrl.searchParams.get("code");
      setStage(`Callback received · code present: ${Boolean(code)}`);
      if (!code) return setError("Your sign-in link has expired. Please try again.");
      const next = callbackUrl.searchParams.get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      setStage(`PKCE code exchange · destination: ${destination}`);
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setStage("Authentication failed · stage: PKCE code exchange");
        return setError(
          exchangeError.message || "The code exchange was rejected by Supabase Auth.",
        );
      }
      const { data: session } = await supabase.auth.getSession();
      setStage(
        `Session check · session exists: ${Boolean(session.session)} · user exists: ${Boolean(session.session?.user)}`,
      );
      if (!session.session) return setError("Your sign-in link has expired. Please try again.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (!profile)
        return setError(
          "Signed in successfully, but Backed could not load your profile. Please refresh in a moment.",
        );
      window.history.replaceState({}, "", "/auth/callback");
      setStage(`Session established · navigating to ${destination}`);
      navigate({ to: destination });
    }
    void completeSignIn();
  }, [navigate]);

  return (
    <main className="container-backed grid min-h-[calc(100vh-8rem)] place-items-center py-16 text-muted-foreground">
      <div className="max-w-md text-center">
        <p>{error ? "Authentication failed" : "Completing secure sign-in…"}</p>
        <p className="mt-3 text-sm">Stage: {stage}</p>
        {error && <p className="mt-2 text-sm text-destructive">Error: {error}</p>}
      </div>
    </main>
  );
}
