import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  CheckoutReconciliationError,
  finalizeBackingFromStripe,
} from "../_shared/stripe-finalization.ts";

const origin = "https://backedit.co";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const stripe = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key?.startsWith("sk_live_") && !key?.startsWith("rk_live_"))
    throw new Error("stripe_live_key_required");
  return new Stripe(key);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    const projectSlug = typeof body?.projectSlug === "string" ? body.projectSlug : "";
    if (
      !/^cs_live_[A-Za-z0-9]+$/.test(sessionId) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug)
    )
      return json({ error: "invalid_checkout_reference" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const result = await finalizeBackingFromStripe(stripe(), admin, {
      sessionId,
      expectedProjectSlug: projectSlug,
      requesterId: auth.user?.id ?? null,
    });
    return json({
      confirmed: true,
      backingId: result.backingId,
      projectSlug: result.projectSlug,
      amount: result.amount,
      currency: result.currency,
    });
  } catch (error) {
    if (error instanceof CheckoutReconciliationError)
      return json({ error: error.code }, error.status);
    console.error(
      "checkout_confirmation_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({ error: "confirmation_unavailable" }, 500);
  }
});
