import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import { renderBackedEmail, sendResendEmail } from "./backed-email.ts";

export async function deliverProjectLaunchEmails(
  admin: SupabaseClient,
  project: { id: string; slug: string; name: string },
  eventId: string,
) {
  const { data: deliveries } = await admin
    .from("email_deliveries")
    .select("id, dedupe_key, recipient_email, status")
    .eq("event_type", "project_launch")
    .like("dedupe_key", `project-launch:${eventId}:%`)
    .in("status", ["pending", "failed"]);

  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries ?? []) {
    try {
      const response = await sendResendEmail({
        to: delivery.recipient_email,
        subject: `${project.name} is now live on Backed`,
        email: renderBackedEmail({
          title: `${project.name} is now live`,
          preheader: `Back ${project.name} on Backed.`,
          body: `${project.name} has launched and is now accepting backings.`,
          ctaLabel: "Back this project",
          ctaUrl: `https://backedit.co/projects/${project.slug}`,
          footer: "You’re receiving this because you favorited this project or follow its creator.",
        }),
        idempotencyKey: delivery.dedupe_key,
      });
      const result = response.ok
        ? ((await response.json().catch(() => null)) as { id?: string } | null)
        : null;
      await admin
        .from("email_deliveries")
        .update(
          response.ok
            ? {
                status: "sent",
                sent_at: new Date().toISOString(),
                resend_email_id: result?.id ?? null,
                last_error: null,
              }
            : { status: "failed", last_error: "resend_delivery_failed" },
        )
        .eq("id", delivery.id);
      if (response.ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
      await admin
        .from("email_deliveries")
        .update({ status: "failed", last_error: "resend_delivery_failed" })
        .eq("id", delivery.id);
    }
  }
  return { sent, failed };
}
