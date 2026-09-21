import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { socialImageResponse, type SocialProject } from "./handler.tsx";

const cacheControl = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(value: unknown, fallback = "", maxLength = 180) {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, maxLength) || fallback;
}

function cents(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(parsed)))
    : 0;
}

function responseHeaders(etag: string) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": cacheControl,
    "Content-Type": "image/png",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
}

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (slug && !slugPattern.test(slug)) return new Response("Invalid project", { status: 400 });

  const version = text(url.searchParams.get("v"), "default", 64).replace(/[^a-zA-Z0-9_-]/g, "");
  const etag = `W/"backed-social-${slug ?? "default"}-${version || "default"}"`;
  const headers = responseHeaders(etag);
  if (request.headers.get("If-None-Match") === etag)
    return new Response(null, { status: 304, headers });
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });

  let project: SocialProject | null = null;
  if (slug) {
    project = {
      name: text(url.searchParams.get("name"), "Backed project", 90),
      summary: text(url.searchParams.get("summary"), "A project worth backing.", 180),
      creatorName: text(url.searchParams.get("creator"), "Backed creator", 70),
      // Do not make crawler rendering depend on a separate remote media host.
      imageUrl: null,
      amountBacked: cents(url.searchParams.get("raised")),
      goal: cents(url.searchParams.get("goal")),
      backers: Math.floor(cents(url.searchParams.get("backers"))),
    };
  }

  try {
    return socialImageResponse(project, headers);
  } catch {
    return socialImageResponse(project ? { ...project, imageUrl: null } : null, headers);
  }
});
