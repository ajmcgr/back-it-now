import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UMAMI_API_BASE = "https://api.umami.is/v1";
// The website ID is already public in Umami's browser tracking tag. The API
// key remains an Edge Function secret and is never returned to the browser.
const UMAMI_WEBSITE_ID = "1e0eeedd-f47c-45fd-bdd7-966a0f1baada";
const TOTAL_CACHE_MS = 5 * 60 * 1000;
const ONLINE_CACHE_MS = 30 * 1000;

type CachedMetric = { value: number; expiresAt: number };

let totalCache: CachedMetric | null = null;
let onlineCache: CachedMetric | null = null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control":
        status === 200 ? "public, max-age=30, s-maxage=30, stale-while-revalidate=300" : "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function nonNegativeInteger(value: unknown) {
  const candidate =
    typeof value === "number"
      ? value
      : typeof value === "object" && value !== null && "value" in value
        ? (value as { value?: unknown }).value
        : null;
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? Math.max(0, Math.round(candidate))
    : null;
}

async function umamiGet(path: string, apiKey: string) {
  const request = await fetch(`${UMAMI_API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!request.ok) throw new Error(`umami_${request.status}`);
  return (await request.json()) as Record<string, unknown>;
}

async function totalVisitors(apiKey: string, now: number) {
  if (totalCache && totalCache.expiresAt > now) return totalCache.value;
  const query = new URLSearchParams({ startAt: "0", endAt: String(now) });
  const stats = await umamiGet(`/websites/${UMAMI_WEBSITE_ID}/stats?${query}`, apiKey);
  const visitors = nonNegativeInteger(stats.visitors);
  if (visitors === null) throw new Error("umami_invalid_total");
  totalCache = { value: visitors, expiresAt: now + TOTAL_CACHE_MS };
  return visitors;
}

async function onlineVisitors(apiKey: string, now: number) {
  if (onlineCache && onlineCache.expiresAt > now) return onlineCache.value;
  const active = await umamiGet(`/websites/${UMAMI_WEBSITE_ID}/active`, apiKey);
  const visitors = nonNegativeInteger(active.visitors);
  if (visitors === null) throw new Error("umami_invalid_active");
  onlineCache = { value: visitors, expiresAt: now + ONLINE_CACHE_MS };
  return visitors;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...corsHeaders, Allow: "GET, HEAD" } });
  }

  const apiKey = Deno.env.get("UMAMI_API_KEY");
  if (!apiKey) return response({ available: false }, 503);

  try {
    const now = Date.now();
    const [totalVisitorsValue, onlineVisitorsValue] = await Promise.all([
      totalVisitors(apiKey, now),
      onlineVisitors(apiKey, now),
    ]);
    const body = { totalVisitors: totalVisitorsValue, onlineVisitors: onlineVisitorsValue };
    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=300",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return response(body);
  } catch {
    // Analytics must never affect the public page. Keep provider details and
    // credentials out of the response while the UI quietly omits the counter.
    return response({ available: false }, 503);
  }
});
