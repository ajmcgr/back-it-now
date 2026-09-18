import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const origin = "https://backedit.co";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const getStripe = () => {
  if (Deno.env.get("STRIPE_MODE") !== "test") throw new Error("stripe_test_mode_required");
  const key = Deno.env.get("STRIPE_TEST_SECRET_KEY");
  if (!key?.startsWith("sk_test_")) throw new Error("stripe_test_key_required");
  return new Stripe(key);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "authentication_required" }, 401);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "authentication_required" }, 401);
    const { rewardId } = await req.json();
    if (typeof rewardId !== "string") return json({ error: "reward_required" }, 400);
    const { data: reward, error: rewardError } = await admin
      .from("rewards")
      .select(
        "id, project_id, title, description, amount, projects!inner(slug, status, deadline_at, currency)",
      )
      .eq("id", rewardId)
      .single();
    if (
      rewardError ||
      !reward ||
      reward.projects.status !== "live" ||
      new Date(reward.projects.deadline_at).getTime() <= Date.now()
    ) {
      return json({ error: "reward_unavailable" }, 409);
    }
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { data: reservationId, error: reservationError } = await admin.rpc("reserve_reward", {
      p_reward_id: reward.id,
      p_user_id: auth.user.id,
      p_expires_at: expiresAt,
    });
    if (reservationError || !reservationId) return json({ error: "reward_unavailable" }, 409);
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: auth.user.email ?? undefined,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: reward.title, description: reward.description || undefined },
              unit_amount: reward.amount,
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/projects/${reward.projects.slug}?checkout=success`,
        cancel_url: `${origin}/projects/${reward.projects.slug}?checkout=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: {
          reservation_id: reservationId,
          reward_id: reward.id,
          project_id: reward.project_id,
          backer_id: auth.user.id,
        },
        payment_intent_data: {
          metadata: {
            reservation_id: reservationId,
            reward_id: reward.id,
            project_id: reward.project_id,
            backer_id: auth.user.id,
          },
        },
      });
      await admin
        .from("reward_reservations")
        .update({ checkout_session_id: session.id })
        .eq("id", reservationId)
        .eq("user_id", auth.user.id);
      return json({ checkoutUrl: session.url });
    } catch (error) {
      await admin.rpc("release_reward_reservation", { p_reservation_id: reservationId });
      throw error;
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "checkout_unavailable" }, 500);
  }
});
