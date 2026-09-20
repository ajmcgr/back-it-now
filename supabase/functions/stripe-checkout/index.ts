import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

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
const getStripe = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key?.startsWith("sk_live_") && !key?.startsWith("rk_live_"))
    throw new Error("stripe_live_key_required");
  return new Stripe(key);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { projectSlug, amount, claimReward } = await req.json();
    if (typeof projectSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug))
      return json({ error: "project_unavailable" }, 400);
    if (!Number.isSafeInteger(amount) || amount < 500)
      return json({ error: "minimum_backing_is_5_usd" }, 400);
    if (typeof claimReward !== "boolean") return json({ error: "invalid_reward_selection" }, 400);

    let user: { id: string; email?: string | null } | null = null;
    if (token) {
      const { data: auth, error: authError } = await admin.auth.getUser(token);
      if (authError || !auth.user) return json({ error: "authentication_required" }, 401);
      user = auth.user;
    }

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, creator_id, slug, status, deadline_at, currency")
      .eq("slug", projectSlug)
      .single();
    if (
      projectError ||
      !project ||
      project.status !== "live" ||
      !project.deadline_at ||
      new Date(project.deadline_at).getTime() <= Date.now()
    )
      return json({ error: "project_unavailable" }, 409);
    if (user?.id === project.creator_id) return json({ error: "creator_cannot_back_project" }, 403);

    const { data: rewards, error: rewardError } = await admin
      .from("rewards")
      .select("id, title, description, amount")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true })
      .limit(1);
    if (rewardError || !rewards) return json({ error: "reward_unavailable" }, 409);
    const reward = rewards[0] ?? null;
    if (claimReward && (!reward || amount < reward.amount))
      return json({ error: "reward_minimum_not_met" }, 409);

    // Stripe requires Checkout sessions to expire at least 30 minutes after it receives the request.
    // A one-minute buffer keeps the reservation and Checkout window aligned without clock-skew failures.
    const checkoutExpiry = Date.now() + 31 * 60 * 1000;
    const expiresAt = new Date(checkoutExpiry).toISOString();
    let reservationId: string | null = null;
    if (claimReward && reward) {
      const { data, error: reservationError } = await admin.rpc("reserve_reward", {
        p_reward_id: reward.id,
        p_user_id: user?.id ?? null,
        p_expires_at: expiresAt,
      });
      if (reservationError || !data) return json({ error: "reward_unavailable" }, 409);
      reservationId = data;
    }
    let checkoutSessionId: string | null = null;
    try {
      const stripe = getStripe();
      const checkoutMetadata = {
        reservation_id: reservationId ?? "",
        reward_id: claimReward && reward ? reward.id : "",
        project_id: project.id,
      };
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user?.email ?? undefined,
        customer_creation: "always",
        line_items: [
          {
            price_data: {
              currency: project.currency,
              product_data: {
                name:
                  claimReward && reward
                    ? `${project.slug} — ${reward.title}`
                    : `Back ${project.slug}`,
                description: claimReward
                  ? reward?.description || undefined
                  : "Support this project on Backed",
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/projects/${project.slug}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/projects/${project.slug}?checkout=cancelled`,
        expires_at: Math.floor(checkoutExpiry / 1000),
        metadata: checkoutMetadata,
        payment_intent_data: {
          metadata: checkoutMetadata,
        },
      });
      checkoutSessionId = session.id;
      if (reservationId) {
        const { error: reservationUpdateError } = await admin
          .from("reward_reservations")
          .update({ checkout_session_id: session.id })
          .eq("id", reservationId)
          .is("converted_at", null)
          .is("released_at", null);
        if (reservationUpdateError) throw reservationUpdateError;
      }
      const { error: intentError } = await admin.from("checkout_backing_intents").insert({
        checkout_session_id: session.id,
        project_id: project.id,
        reward_id: claimReward && reward ? reward.id : null,
        reservation_id: reservationId,
        backer_id: user?.id ?? null,
        amount,
        currency: project.currency,
        expires_at: expiresAt,
      });
      if (intentError) throw intentError;
      return json({ checkoutUrl: session.url });
    } catch (error) {
      if (checkoutSessionId) {
        try {
          await getStripe().checkout.sessions.expire(checkoutSessionId);
        } catch {
          // The reservation is still released below; Stripe will also expire this session naturally.
        }
      }
      if (reservationId)
        await admin.rpc("release_reward_reservation", { p_reservation_id: reservationId });
      console.error(
        "stripe_checkout_failed",
        error instanceof Error ? error.message : "unknown_error",
      );
      throw error;
    }
  } catch (error) {
    return json({ error: "checkout_unavailable" }, 500);
  }
});
