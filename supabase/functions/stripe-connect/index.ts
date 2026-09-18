import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const origin = "https://backedit.co";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const stripe = () => {
  if (Deno.env.get("STRIPE_MODE") !== "test") throw new Error("stripe_test_mode_required");
  const key = Deno.env.get("STRIPE_TEST_SECRET_KEY");
  if (!key?.startsWith("sk_test_")) throw new Error("stripe_test_key_required");
  return new Stripe(key);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!auth.user) return response({ error: "authentication_required" }, 401);
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", auth.user.id)
      .single();
    const api = stripe();
    const account = profile?.stripe_account_id
      ? await api.accounts.retrieve(profile.stripe_account_id)
      : await api.accounts.create({
          type: "express",
          email: auth.user.email ?? undefined,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { backed_profile_id: auth.user.id },
        });
    await admin
      .from("profiles")
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_complete: account.details_submitted,
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
      })
      .eq("id", auth.user.id);
    const link = await api.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      refresh_url: `${origin}/dashboard?stripe=refresh`,
      return_url: `${origin}/dashboard?stripe=return`,
    });
    return response({ onboardingUrl: link.url });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "connect_unavailable" }, 500);
  }
});
