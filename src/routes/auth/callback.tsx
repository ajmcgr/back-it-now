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
      const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        return setError("We couldn't complete that sign-in. Please try again.");
      }
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) return setError("We couldn't complete that sign-in. Please try again.");
      if (!session.session) return setError("Your sign-in link has expired. Please try again.");
      // The code is no longer needed once Supabase has persisted the session. Remove it
      // before profile work so a profile error cannot leave an authorization code visible.
      window.history.replaceState({}, "", "/auth/callback");
      // Best effort only: a valid Supabase Auth session must never be discarded because
      // profile bookkeeping failed. X accounts may have no email — never fabricate one.
      try {
        const user = session.session.user;
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile) {
          const candidate: Record<string, unknown> = {
            id: user.id,
            email: user.email ?? null,
            username: text(meta["user_name"]) ?? text(meta["preferred_username"]) ?? null,
            display_name: text(meta["full_name"]) ?? text(meta["name"]) ?? null,
            avatar_url: text(meta["avatar_url"]) ?? text(meta["picture"]) ?? null,
          };
          const { error: insertError } = await supabase.from("profiles").insert(candidate);
          if (insertError) await supabase.from("profiles").insert({ id: user.id });
        }
      } catch {
        // Authentication remains valid if non-critical profile bookkeeping is unavailable.
      }
      navigate({ to: destination, replace: true });
    }
    void completeSignIn();
  }, [navigate]);

  return (
    <main className="container-backed grid min-h-[calc(100vh-8rem)] place-items-center py-16 text-muted-foreground">
      <div className="max-w-md text-center">
        <p>{error ? "Authentication failed" : "Signing you in…"}</p>
        {error && <p className="mt-2 text-sm text-destructive">Error: {error}</p>}
      </div>
    </main>
  );
}
