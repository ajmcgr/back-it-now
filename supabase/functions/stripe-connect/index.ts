import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const origin = "https://backedit.co";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (body: unknown, status = 200) =>
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
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return response({ error: "authentication_required" }, 401);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return response({ error: "authentication_required" }, 401);
    const { action = "onboarding" } = await req.json().catch(() => ({ action: "onboarding" }));
    if (!["onboarding", "dashboard", "status"].includes(action))
      return response({ error: "invalid_action" }, 400);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", auth.user.id)
      .single();
    if (profileError || !profile) return response({ error: "profile_unavailable" }, 409);
    const api = stripe();
    const account = profile?.stripe_account_id
      ? await api.accounts.retrieve(profile.stripe_account_id)
      : await api.accounts.create({
          type: "express",
          email: auth.user.email ?? undefined,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { backed_profile_id: auth.user.id },
        });
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_complete: account.details_submitted,
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_requirements_due: account.requirements?.currently_due ?? [],
      })
      .eq("id", auth.user.id);
    if (updateError) throw updateError;
    if (action === "status")
      return response({
        account: {
          detailsSubmitted: account.details_submitted,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          requirementsDue: account.requirements?.currently_due ?? [],
        },
      });
    if (action === "dashboard" && account.details_submitted) {
      const login = await api.accounts.createLoginLink(account.id);
      return response({ onboardingUrl: login.url });
    }
    const link = await api.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      refresh_url: `${origin}/settings?stripe=refresh`,
      return_url: `${origin}/settings?stripe=return`,
    });
    return response({ onboardingUrl: link.url });
  } catch (error) {
    console.error(
      "stripe_connect_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return response({ error: "connect_unavailable" }, 500);
  }
});
