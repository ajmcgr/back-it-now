import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const endpoint = "https://zlzaxgsyczfeepwidjii.supabase.co/functions/v1/beehiiv-subscribe";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = "idle" | "loading" | "subscribed" | "already_subscribed" | "error";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "loading") return;

    const normalizedEmail = email.trim();
    if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 254) {
      setState("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setState("loading");
    setMessage("");
    try {
      const result = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          company,
          path: window.location.pathname,
        }),
      });
      const payload = (await result.json().catch(() => null)) as { status?: string } | null;
      if (result.ok && payload?.status === "subscribed") {
        setState("subscribed");
        setMessage("You’re in. See you in your inbox.");
      } else if (result.ok && payload?.status === "already_subscribed") {
        setState("already_subscribed");
        setMessage("You’re already subscribed.");
      } else if (payload?.status === "invalid") {
        setState("error");
        setMessage("Please enter a valid email address.");
      } else {
        setState("error");
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  const complete = state === "subscribed" || state === "already_subscribed";

  return (
    <section
      className="border-t border-border bg-muted/30 py-12 sm:py-16"
      aria-labelledby="newsletter-title"
    >
      <div className="container-backed text-center">
        <div className="mx-auto max-w-2xl">
          <h2 id="newsletter-title" className="text-2xl font-semibold sm:text-3xl">
            Stay in the loop
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-muted-foreground">
            The best new projects on Backed, delivered to your inbox.
          </p>

          {complete ? (
            <p className="mt-6 font-medium" role="status">
              {message}
            </p>
          ) : (
            <form
              onSubmit={submit}
              className="mx-auto mt-6 flex max-w-lg flex-col gap-3 sm:flex-row"
              noValidate
            >
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <Input
                id="newsletter-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (state === "error") {
                    setState("idle");
                    setMessage("");
                  }
                }}
                disabled={state === "loading"}
                aria-invalid={state === "error"}
                aria-describedby={message ? "newsletter-message" : undefined}
                className="h-11 bg-background sm:flex-1"
                required
              />
              <div className="hidden" aria-hidden="true">
                <label htmlFor="newsletter-company">Company</label>
                <input
                  id="newsletter-company"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </div>
              <Button type="submit" size="lg" disabled={state === "loading"} className="sm:w-auto">
                {state === "loading" ? "Subscribing…" : "Subscribe"}
              </Button>
            </form>
          )}

          {!complete && message ? (
            <p id="newsletter-message" role="alert" className="mt-3 text-sm text-destructive">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
