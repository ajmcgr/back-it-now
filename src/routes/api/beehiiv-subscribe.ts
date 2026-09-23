import { createFileRoute } from "@tanstack/react-router";

const SUPABASE_URL_FALLBACK = "https://zlzaxgsyczfeepwidjii.supabase.co";
const SUPABASE_PUBLISHABLE_FALLBACK = "sb_publishable_xS6SYY2eNA8LIWhjFBUDyg__JTDgnhh";
const NEWSLETTER_ENDPOINT = `${SUPABASE_URL_FALLBACK}/functions/v1/beehiiv-subscribe`;

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/beehiiv-subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return reply(401, { error: "authentication_required" });

        const supabaseUrl = process.env["SUPABASE_URL"] || SUPABASE_URL_FALLBACK;
        const publishableKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] || SUPABASE_PUBLISHABLE_FALLBACK;

        // The address is read from the verified Supabase session only, never from
        // the request body, so nobody can enroll somebody else's email.
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: publishableKey },
        });
        if (!userResponse.ok) return reply(401, { error: "authentication_required" });
        const user = (await userResponse.json()) as { email?: string | null };

        // Accounts without an email (some X sign-ins) are skipped. An email is
        // never fabricated.
        const email = typeof user.email === "string" && user.email ? user.email : null;
        if (!email) return reply(200, { subscribed: false, reason: "no_email" });

        try {
          // Route authenticated auto-enrollment through Backed's single newsletter
          // function so Beehiiv credentials and publication selection stay isolated
          // in Supabase Edge Function secrets.
          const newsletter = await fetch(NEWSLETTER_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, path: "/auth/callback" }),
          });
          const payload = (await newsletter.json().catch(() => null)) as {
            status?: string;
          } | null;
          if (
            !newsletter.ok ||
            (payload?.status !== "subscribed" && payload?.status !== "already_subscribed")
          ) {
            return reply(200, { subscribed: false, reason: "provider_error" });
          }
          return reply(200, { subscribed: true });
        } catch {
          // Newsletter enrollment must never break sign-in.
          return reply(200, { subscribed: false, reason: "provider_unreachable" });
        }
      },
    },
  },
});
