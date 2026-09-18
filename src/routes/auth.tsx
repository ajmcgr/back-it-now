import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authRedirectUrl, isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Backed" },
      { name: "description", content: "Sign in to back projects and launch your own." },
      { property: "og:title", content: "Sign in — Backed" },
      { property: "og:description", content: "Sign in to back projects and launch your own." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});
function AuthPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<"x" | "google" | "email" | null>(null);

  async function signInWithProvider(provider: "x" | "google") {
    if (!supabase) return setMessage("Authentication is being configured. Please try again soon.");
    setPending(provider);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: authRedirectUrl("/dashboard") } });
    if (error) setMessage(error.message);
    setPending(null);
  }

  async function signInWithEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return setMessage("Authentication is being configured. Please try again soon.");
    setPending("email");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectUrl("/dashboard"), shouldCreateUser: true } });
    setMessage(error ? error.message : "Check your inbox for a secure Backed sign-in link.");
    setPending(null);
  }

  return (
    <main className="container-backed grid min-h-[calc(100vh-8rem)] place-items-center py-16">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="font-display text-2xl font-bold">
          BACKED<span className="text-primary">.</span>
        </Link>
        <h1 className="mt-10 text-4xl font-semibold">Welcome to Backed</h1>
        <p className="mt-3 text-muted-foreground">
          Use your internet identity to back and launch projects.
        </p>
        <Button className="mt-8 w-full" size="lg" onClick={() => signInWithProvider("x")} disabled={pending !== null}>
          <svg viewBox="0 0 24 24" className="size-4 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
          </svg>
          Continue with X
        </Button>
        <Button className="mt-3 w-full" size="lg" variant="outline" onClick={() => signInWithProvider("google")} disabled={pending !== null}>
          Continue with Google
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={signInWithEmail} className="space-y-3 text-left">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required aria-label="Email address" />
          <Button className="w-full" type="submit" variant="outline" disabled={pending !== null}>Continue with email</Button>
        </form>
        {message && <p className="mt-4 text-sm leading-6 text-muted-foreground">{message}</p>}
        {!isSupabaseConfigured && <p className="mt-4 text-xs text-muted-foreground">Authentication is temporarily unavailable.</p>}
      </div>
    </main>
  );
}
