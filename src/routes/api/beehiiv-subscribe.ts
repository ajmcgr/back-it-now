import { createFileRoute } from "@tanstack/react-router";

const SUPABASE_URL_FALLBACK = "https://zlzaxgsyczfeepwidjii.supabase.co";
const SUPABASE_PUBLISHABLE_FALLBACK = "sb_publishable_xS6SYY2eNA8LIWhjFBUDyg__JTDgnhh";

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

        const key = process.env["BEEHIIV_API_KEY"];
        const publicationId = process.env["BEEHIIV_PUBLICATION_ID"];
        if (!key || !publicationId)
          return reply(200, { subscribed: false, reason: "not_configured" });

        try {
          const beehiiv = await fetch(
            `https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                reactivate_existing: true,
                send_welcome_email: true,
                utm_source: "backedit.co",
                utm_medium: "signup",
              }),
            },
          );
          if (!beehiiv.ok) return reply(200, { subscribed: false, reason: "provider_error" });
          return reply(200, { subscribed: true });
        } catch {
          // Newsletter enrollment must never break sign-in.
          return reply(200, { subscribed: false, reason: "provider_unreachable" });
        }
      },
    },
  },
});
