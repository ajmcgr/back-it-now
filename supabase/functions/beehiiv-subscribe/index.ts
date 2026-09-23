import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, number[]>();

const productionOrigins = new Set([
  "https://backedit.co",
  "https://www.backedit.co",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowed =
    !origin || productionOrigins.has(origin) || /^http:\/\/localhost(?::\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://backedit.co",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safePath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value.replace(/[\r\n]/g, "").slice(0, 160);
}

function acquisition(request: Request, path: string) {
  return {
    referringSite: `https://backedit.co${path}`,
    source: "Backed website",
  };
}

function rateLimited(request: Request) {
  const now = Date.now();
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const recent = (attempts.get(client) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) return true;
  recent.push(now);
  attempts.set(client, recent);

  // Keep the isolate-local map bounded without creating a subscriber database.
  if (attempts.size > 1_000) {
    for (const [key, times] of attempts) {
      const active = times.filter((time) => now - time < WINDOW_MS);
      if (active.length === 0) attempts.delete(key);
      else attempts.set(key, active);
    }
  }
  return false;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST")
    return new Response(null, {
      status: 405,
      headers: { ...corsHeaders(request), Allow: "POST" },
    });

  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2_048) return json(request, { status: "invalid" }, 400);
  if (rateLimited(request)) return json(request, { status: "rate_limited" }, 429);

  const apiKey = Deno.env.get("BACKED_BEEHIIV_API_KEY");
  const publicationId = Deno.env.get("BACKED_BEEHIIV_PUBLICATION_ID");
  if (!apiKey || !publicationId || !/^pub_[A-Za-z0-9_-]+$/.test(publicationId)) {
    console.error("backed_beehiiv_configuration_invalid");
    return json(request, { status: "unavailable" }, 503);
  }
  const beehiivBase =
    `https://api.beehiiv.com/v2/publications/${encodeURIComponent(publicationId)}/subscriptions`;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json(request, { status: "invalid" }, 400);

  // A hidden field catches basic form bots without disclosing that they were rejected.
  if (
    typeof (body as { company?: unknown }).company === "string" &&
    (body as { company: string }).company
  ) {
    return json(request, { status: "subscribed" });
  }

  const emailValue = (body as { email?: unknown }).email;
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  if (!validEmail(email)) return json(request, { status: "invalid" }, 400);

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    const existing = await fetch(`${beehiivBase}/by_email/${encodeURIComponent(email)}`, {
      headers,
    });
    if (existing.ok) {
      const payload = (await existing.json().catch(() => null)) as {
        data?: { status?: string };
      } | null;
      const status = payload?.data?.status;
      if (status === "active" || status === "validating") {
        return json(request, { status: "already_subscribed" });
      }
    } else if (![401, 403, 404].includes(existing.status)) {
      console.error("beehiiv_lookup_failed", existing.status);
      return json(request, { status: "unavailable" }, existing.status === 429 ? 429 : 502);
    }

    const path = safePath((body as { path?: unknown }).path);
    const { referringSite, source } = acquisition(request, path);
    const created = await fetch(beehiivBase, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: source,
        utm_medium: "website",
        referring_site: referringSite,
      }),
    });

    if (!created.ok) {
      console.error("beehiiv_subscription_failed", created.status);
      return json(request, { status: "unavailable" }, created.status === 429 ? 429 : 502);
    }
    return json(request, { status: "subscribed" });
  } catch {
    console.error("beehiiv_subscription_unreachable");
    return json(request, { status: "unavailable" }, 502);
  }
});
