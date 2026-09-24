import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.116.0";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, number[]>();
const productionOrigins = new Set(["https://backedit.co", "https://www.backedit.co"]);

type AccountAction = "subscribe" | "unsubscribe";
type AccountContext = {
  action: AccountAction;
  admin: SupabaseClient;
  user: User;
};

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowed =
    !origin || productionOrigins.has(origin) || /^http:\/\/localhost(?::\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://backedit.co",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
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

  if (attempts.size > 1_000) {
    for (const [key, times] of attempts) {
      const active = times.filter((time) => now - time < WINDOW_MS);
      if (active.length === 0) attempts.delete(key);
      else attempts.set(key, active);
    }
  }
  return false;
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function accountContext(
  request: Request,
  body: Record<string, unknown>,
): Promise<AccountContext | null | "unauthorized"> {
  if (body.accountAction !== "subscribe" && body.accountAction !== "unsubscribe") return null;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return "unauthorized";

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(authorization.slice("Bearer ".length));
  if (error || !data.user) return "unauthorized";
  return { action: body.accountAction, admin, user: data.user };
}

async function updateAccountState(
  admin: SupabaseClient,
  userId: string,
  values: Record<string, unknown>,
) {
  const { error } = await admin.from("profiles").update(values).eq("id", userId);
  if (error) throw error;
}

async function markAccountFailure(context: AccountContext, code: string) {
  try {
    await updateAccountState(context.admin, context.user.id, {
      newsletter_sync_status: "failed",
      newsletter_last_error: code,
    });
  } catch {
    console.error("account_newsletter_failure_state_unavailable");
  }
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
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") return json(request, { status: "invalid" }, 400);
  const body = parsed as Record<string, unknown>;

  const account = await accountContext(request, body);
  if (account === "unauthorized") return json(request, { status: "unauthorized" }, 401);

  // The public form remains independent of Backed accounts. Its lightweight
  // anti-abuse controls do not throttle authenticated preference changes.
  if (!account) {
    if (rateLimited(request)) return json(request, { status: "rate_limited" }, 429);
    if (typeof body.company === "string" && body.company) {
      return json(request, { status: "subscribed" });
    }
  }

  let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (account) {
    const { data: profile, error } = await account.admin
      .from("profiles")
      .select("receive_product_news, newsletter_sync_status")
      .eq("id", account.user.id)
      .maybeSingle();
    if (error || !profile) {
      console.error("account_newsletter_profile_unavailable");
      return json(request, { status: "unavailable" }, 503);
    }
    email = typeof account.user.email === "string" ? account.user.email.trim().toLowerCase() : "";

    if (
      account.action === "subscribe" &&
      profile.receive_product_news &&
      profile.newsletter_sync_status === "subscribed"
    ) {
      return json(request, { status: "already_subscribed" });
    }
    if (
      account.action === "unsubscribe" &&
      !profile.receive_product_news &&
      profile.newsletter_sync_status === "not_subscribed"
    ) {
      return json(request, { status: "not_subscribed" });
    }

    const now = new Date().toISOString();
    try {
      if (account.action === "subscribe") {
        await updateAccountState(account.admin, account.user.id, {
          receive_product_news: true,
          newsletter_consent_at: now,
          newsletter_opted_out_at: null,
          newsletter_sync_status: validEmail(email) ? "pending" : "no_email",
          newsletter_last_attempt_at: now,
          newsletter_last_error: null,
        });
        if (!validEmail(email)) return json(request, { status: "no_email" });
      } else if (!validEmail(email)) {
        await updateAccountState(account.admin, account.user.id, {
          receive_product_news: false,
          newsletter_opted_out_at: now,
          newsletter_sync_status: "not_subscribed",
          newsletter_last_attempt_at: now,
          newsletter_last_error: null,
        });
        return json(request, { status: "not_subscribed" });
      } else {
        await updateAccountState(account.admin, account.user.id, {
          newsletter_sync_status: "pending",
          newsletter_last_attempt_at: now,
          newsletter_last_error: null,
        });
      }
    } catch {
      console.error("account_newsletter_state_update_failed");
      return json(request, { status: "unavailable" }, 503);
    }
  } else if (!validEmail(email)) {
    return json(request, { status: "invalid" }, 400);
  }

  const apiKey = Deno.env.get("BACKED_BEEHIIV_API_KEY");
  const publicationId = Deno.env.get("BACKED_BEEHIIV_PUBLICATION_ID");
  if (!apiKey || !publicationId || !/^pub_[A-Za-z0-9_-]+$/.test(publicationId)) {
    console.error("backed_beehiiv_configuration_invalid");
    if (account) await markAccountFailure(account, "backed_configuration_invalid");
    return json(request, { status: "unavailable" }, 503);
  }

  const beehiivBase = `https://api.beehiiv.com/v2/publications/${encodeURIComponent(publicationId)}/subscriptions`;
  const headers = { Accept: "application/json", Authorization: `Bearer ${apiKey}` };

  try {
    const byEmail = `${beehiivBase}/by_email/${encodeURIComponent(email)}`;
    const existing = await fetch(byEmail, { headers });

    if (account?.action === "unsubscribe") {
      if (existing.status !== 404 && !existing.ok) {
        console.error("beehiiv_lookup_failed", existing.status);
        await markAccountFailure(account, "beehiiv_lookup_failed");
        return json(request, { status: "unavailable" }, existing.status === 429 ? 429 : 502);
      }
      if (existing.ok) {
        const updated = await fetch(byEmail, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ unsubscribe: true }),
        });
        if (!updated.ok) {
          console.error("beehiiv_unsubscribe_failed", updated.status);
          await markAccountFailure(account, "beehiiv_unsubscribe_failed");
          return json(request, { status: "unavailable" }, updated.status === 429 ? 429 : 502);
        }
      }
      await updateAccountState(account.admin, account.user.id, {
        receive_product_news: false,
        newsletter_opted_out_at: new Date().toISOString(),
        newsletter_sync_status: "not_subscribed",
        newsletter_synced_at: new Date().toISOString(),
        newsletter_last_error: null,
      });
      return json(request, { status: "unsubscribed" });
    }

    if (existing.ok) {
      const payload = (await existing.json().catch(() => null)) as {
        data?: { status?: string };
      } | null;
      const status = payload?.data?.status;
      if (status === "active" || status === "validating") {
        if (account) {
          await updateAccountState(account.admin, account.user.id, {
            newsletter_sync_status: "subscribed",
            newsletter_synced_at: new Date().toISOString(),
            newsletter_last_error: null,
          });
        }
        return json(request, { status: "already_subscribed" });
      }
    } else if (existing.status !== 404) {
      console.error("beehiiv_lookup_failed", existing.status);
      if (account) await markAccountFailure(account, "beehiiv_lookup_failed");
      return json(request, { status: "unavailable" }, existing.status === 429 ? 429 : 502);
    }

    const path = safePath(body.path);
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
      if (account) await markAccountFailure(account, "beehiiv_subscription_failed");
      return json(request, { status: "unavailable" }, created.status === 429 ? 429 : 502);
    }
    if (account) {
      await updateAccountState(account.admin, account.user.id, {
        newsletter_sync_status: "subscribed",
        newsletter_synced_at: new Date().toISOString(),
        newsletter_last_error: null,
      });
    }
    return json(request, { status: "subscribed" });
  } catch {
    console.error("beehiiv_subscription_unreachable");
    if (account) await markAccountFailure(account, "beehiiv_unreachable");
    return json(request, { status: "unavailable" }, 502);
  }
});
