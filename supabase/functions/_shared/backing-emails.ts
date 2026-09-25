import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import { deliverBackedEmail } from "./email-delivery.ts";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);

export async function sendBackingTransactionalEmails(
  admin: SupabaseClient,
  backingId: string,
  options: { includeCreator?: boolean } = {},
) {
  const { data: backing, error: backingError } = await admin
    .from("backings")
    .select("id, project_id, reward_id, backer_email, gross_amount, currency, status")
    .eq("id", backingId)
    .maybeSingle();
  if (backingError) throw backingError;
  if (!backing || backing.status !== "paid") return { confirmation: null, creator: null };

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, slug, name, creator_id")
    .eq("id", backing.project_id)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return { confirmation: null, creator: null };

  const { data: reward } = backing.reward_id
    ? await admin.from("rewards").select("title").eq("id", backing.reward_id).maybeSingle()
    : { data: null };
  const amount = money(backing.gross_amount, backing.currency);
  const rewardCopy = reward?.title ? ` You selected the reward: ${reward.title}.` : "";

  const confirmation = await deliverBackedEmail(admin, {
    key: `backing-confirmation:${backing.id}`,
    event: "backing_confirmation",
    backingId: backing.id,
    to: backing.backer_email,
    subject: "Your Backed confirmation",
    title: `You're backing ${project.name}`,
    body: `Your ${amount} backing has been confirmed.${rewardCopy}`,
    ctaLabel: "View project",
    ctaUrl: `https://backedit.co/projects/${project.slug}`,
    footer: "This receipt confirms your backing. Stripe processes the payment securely.",
  });

  if (options.includeCreator === false) return { confirmation, creator: null };

  const { data: creator } = await admin
    .from("profiles")
    .select("email")
    .eq("id", project.creator_id)
    .maybeSingle();
  const creatorDelivery = creator?.email
    ? await deliverBackedEmail(admin, {
        key: `creator-new-backing:${backing.id}`,
        event: "creator_new_backing",
        backingId: backing.id,
        to: creator.email,
        subject: `Someone backed ${project.name}`,
        title: `Someone backed ${project.name} 🎉`,
        body: `${project.name} received a new ${amount} backing. Keep the momentum going by sharing your project.`,
        ctaLabel: "Share your project",
        ctaUrl: `https://backedit.co/projects/${project.slug}?share=1`,
        footer: "You’re receiving this because you created this project on Backed.",
      })
    : null;

  return { confirmation, creator: creatorDelivery };
}
