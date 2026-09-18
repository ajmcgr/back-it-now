import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function completeSignIn() {
      if (!supabase) return setError("Authentication is not configured.");
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) return setError("Your sign-in link has expired. Please try again.");
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) return setError(exchangeError.message);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return setError("Your sign-in link has expired. Please try again.");
      const next = new URLSearchParams(window.location.search).get("next");
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = "";
      cleanUrl.hash = "";
      window.history.replaceState({}, "", cleanUrl);
      navigate({ to: next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard" });
    }
    void completeSignIn();
  }, [navigate]);

  return (
    <main className="container-backed grid min-h-[calc(100vh-8rem)] place-items-center py-16 text-muted-foreground">
      {error ?? "Completing secure sign-in…"}
    </main>
  );
}
