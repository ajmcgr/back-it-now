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
    const { projectSlug } = await req.json();
    if (typeof projectSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug))
      return json({ error: "project_unavailable" }, 400);

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
      .limit(2);
    if (rewardError || !rewards || rewards.length !== 1)
      return json({ error: "reward_unavailable" }, 409);
    const reward = rewards[0];

    // Stripe requires Checkout sessions to expire at least 30 minutes after it receives the request.
    // A one-minute buffer keeps the reservation and Checkout window aligned without clock-skew failures.
    const checkoutExpiry = Date.now() + 31 * 60 * 1000;
    const expiresAt = new Date(checkoutExpiry).toISOString();
    const { data: reservationId, error: reservationError } = await admin.rpc("reserve_reward", {
      p_reward_id: reward.id,
      p_user_id: user?.id ?? null,
      p_expires_at: expiresAt,
    });
    if (reservationError || !reservationId) return json({ error: "reward_unavailable" }, 409);
    let checkoutSessionId: string | null = null;
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user?.email ?? undefined,
        customer_creation: "always",
        line_items: [
          {
            price_data: {
              currency: project.currency,
              product_data: { name: reward.title, description: reward.description || undefined },
              unit_amount: reward.amount,
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/projects/${project.slug}?checkout=success`,
        cancel_url: `${origin}/projects/${project.slug}?checkout=cancelled`,
        expires_at: Math.floor(checkoutExpiry / 1000),
        metadata: {
          reservation_id: reservationId,
          reward_id: reward.id,
          project_id: project.id,
        },
        payment_intent_data: {
          metadata: {
            reservation_id: reservationId,
            reward_id: reward.id,
            project_id: project.id,
          },
        },
      });
      checkoutSessionId = session.id;
      const { error: reservationUpdateError } = await admin
        .from("reward_reservations")
        .update({ checkout_session_id: session.id })
        .eq("id", reservationId)
        .is("converted_at", null)
        .is("released_at", null);
      if (reservationUpdateError) throw reservationUpdateError;
      return json({ checkoutUrl: session.url });
    } catch (error) {
      if (checkoutSessionId) {
        try {
          await getStripe().checkout.sessions.expire(checkoutSessionId);
        } catch {
          // The reservation is still released below; Stripe will also expire this session naturally.
        }
      }
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
