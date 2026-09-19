import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase, supabaseAuthStorageKey } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState("Callback mounted");
  const [diagnostics, setDiagnostics] = useState<string[]>(["Callback mounted"]);
  const started = useRef(false);

  useEffect(() => {
    const safeErrorDetails = (value: unknown, fallback: string) => {
      if (!value || typeof value !== "object") return fallback;
      const candidate = value as { message?: unknown; status?: unknown; code?: unknown; name?: unknown };
      const details = [candidate.name, candidate.message, candidate.code, candidate.status]
        .filter((detail): detail is string | number => typeof detail === "string" || typeof detail === "number")
        .join(" · ");
      return details || fallback;
    };
    const record = (message: string) => {
      setStage(message);
      setDiagnostics((entries) => [...entries, message]);
      // Deliberately contains booleans/status only: never OAuth codes or tokens.
      console.info("[Backed auth]", message);
    };

    async function completeSignIn() {
      if (started.current) return;
      started.current = true;
      if (!supabase) return setError("Authentication is not configured.");
      const callbackUrl = new URL(window.location.href);
      const code = callbackUrl.searchParams.get("code");
      record(`Callback received · code present: ${Boolean(code)}`);
      if (!code) return setError("Your sign-in link has expired. Please try again.");
      const next = callbackUrl.searchParams.get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      record(`Destination validated · next: ${destination}`);
      record(
        `PKCE verifier storage · exists: ${Boolean(
          window.localStorage.getItem(`${supabaseAuthStorageKey}-code-verifier`),
        )}`,
      );
      record("PKCE code exchange · started");
      let exchangeError: unknown;
      try {
        ({ error: exchangeError } = await supabase.auth.exchangeCodeForSession(code));
      } catch (unexpectedError) {
        record("Authentication failed · stage: PKCE code exchange");
        return setError(safeErrorDetails(unexpectedError, "The code exchange could not be completed."));
      }
      if (exchangeError) {
        record("Authentication failed · stage: PKCE code exchange");
        return setError(safeErrorDetails(exchangeError, "The code exchange was rejected by Supabase Auth."));
      }
      record("PKCE code exchange · succeeded: true");
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      record(
        `Session check · session exists: ${Boolean(session.session)} · user exists: ${Boolean(session.session?.user)}`,
      );
      if (sessionError) return setError(safeErrorDetails(sessionError, "Backed could not read the new session."));
      if (!session.session) return setError("Your sign-in link has expired. Please try again.");
      // The code is no longer needed once Supabase has persisted the session. Remove it
      // before profile work so a profile error cannot leave an authorization code visible.
      window.history.replaceState({}, "", "/auth/callback");
      record("Profile initialization · started");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (profileError || !profile) {
        record("Signed in successfully · stage: profile initialization failed");
        return setError(
          `Signed in successfully, but Backed could not load your profile. ${safeErrorDetails(profileError, "Profile was not found.")}`,
        );
      }
      record("Profile initialization · succeeded");
      record(`Navigation attempted · destination: ${destination}`);
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
        <ol className="mt-5 space-y-1 text-left text-xs text-muted-foreground" aria-label="Authentication diagnostics">
          {diagnostics.map((entry, index) => (
            <li key={`${index}-${entry}`}>{entry}</li>
          ))}
        </ol>
      </div>
    </main>
  );
}
