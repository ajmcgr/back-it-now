import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UMAMI_API_BASE = "https://gateway-us.umami.is/api";
const UMAMI_SHARE_SLUG = "5kuMEhyajDtCHMB6";
// The website ID and public share token are intentionally exposed by Umami's
// anonymous, read-only share page. No account or private API credential is used.
const UMAMI_WEBSITE_ID = "1e0eeedd-f47c-45fd-bdd7-966a0f1baada";
const TOTAL_CACHE_MS = 5 * 60 * 1000;
const ONLINE_CACHE_MS = 30 * 1000;
const SHARE_CACHE_MS = 5 * 60 * 1000;

type CachedTotal = { value: number; expiresAt: number };
type CachedShare = { value: VerifiedShare; expiresAt: number };
type VerifiedShare = { token: string; realtimeEnabled: boolean };
type UmamiShare = {
  websiteId?: unknown;
  token?: unknown;
  parameters?: { realtime?: unknown };
};

let totalCache: CachedTotal | null = null;
let onlineCache: CachedTotal | null = null;
let shareCache: CachedShare | null = null;

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
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;
}

async function publicShare(now: number) {
  if (shareCache && shareCache.expiresAt > now) return shareCache.value;

  const request = await fetch(`${UMAMI_API_BASE}/share/${UMAMI_SHARE_SLUG}`, {
    headers: { Accept: "application/json" },
  });
  if (!request.ok) throw new Error(`umami_share_${request.status}`);

  const share = (await request.json()) as UmamiShare;
  if (share.websiteId !== UMAMI_WEBSITE_ID || typeof share.token !== "string" || !share.token) {
    throw new Error("umami_invalid_share");
  }
  const verified = {
    token: share.token,
    realtimeEnabled: share.parameters?.realtime === true,
  };
  shareCache = { value: verified, expiresAt: now + SHARE_CACHE_MS };
  return verified;
}

async function totalVisitors(token: string, now: number) {
  if (totalCache && totalCache.expiresAt > now) return totalCache.value;

  const query = new URLSearchParams({ startAt: "0", endAt: String(now) });
  const request = await fetch(`${UMAMI_API_BASE}/websites/${UMAMI_WEBSITE_ID}/stats?${query}`, {
    headers: {
      Accept: "application/json",
      "x-umami-share-context": "1",
      "x-umami-share-token": token,
    },
  });
  if (!request.ok) throw new Error(`umami_stats_${request.status}`);

  const stats = (await request.json()) as { visitors?: unknown };
  const visitors = nonNegativeInteger(stats.visitors);
  if (visitors === null) throw new Error("umami_invalid_total");

  totalCache = { value: visitors, expiresAt: now + TOTAL_CACHE_MS };
  return visitors;
}

async function onlineVisitors(token: string, now: number) {
  if (onlineCache && onlineCache.expiresAt > now) return onlineCache.value;

  const request = await fetch(`${UMAMI_API_BASE}/websites/${UMAMI_WEBSITE_ID}/active`, {
    headers: {
      Accept: "application/json",
      "x-umami-share-context": "1",
      "x-umami-share-token": token,
    },
  });
  if (!request.ok) throw new Error(`umami_active_${request.status}`);

  const active = (await request.json()) as { visitors?: unknown };
  const visitors = nonNegativeInteger(active.visitors);
  if (visitors === null) throw new Error("umami_invalid_active");

  onlineCache = { value: visitors, expiresAt: now + ONLINE_CACHE_MS };
  return visitors;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { ...corsHeaders, Allow: "GET, HEAD" },
    });
  }

  try {
    const now = Date.now();
    const share = await publicShare(now);
    const totalVisitorsValue = await totalVisitors(share.token, now);
    const onlineVisitorsValue = share.realtimeEnabled
      ? await onlineVisitors(share.token, now).catch(() => null)
      : null;
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
    return response({
      totalVisitors: totalVisitorsValue,
      onlineVisitors: onlineVisitorsValue,
    });
  } catch {
    // Keep serving the last safely cached aggregate during a temporary provider
    // outage. With no cached value, the public UI quietly hides the counter.
    if (totalCache) {
      return response({
        totalVisitors: totalCache.value,
        onlineVisitors: onlineCache?.value ?? null,
      });
    }
    return response({ available: false }, 503);
  }
});
