import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import { renderBackedEmail, sendResendEmail } from "./backed-email.ts";

export type BackedDeliveryInput = {
  key: string;
  event: string;
  backingId: string;
  to: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
};

export async function deliverBackedEmail(admin: SupabaseClient, input: BackedDeliveryInput) {
  if (!input.to) return { status: "skipped" as const, providerId: null };

  const { error: insertError } = await admin.from("email_deliveries").upsert(
    {
      dedupe_key: input.key,
      event_type: input.event,
      backing_id: input.backingId,
      recipient_email: input.to,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  if (insertError) throw insertError;

  const { data: claimedRows, error: claimError } = await admin.rpc("claim_email_delivery", {
    p_dedupe_key: input.key,
  });
  if (claimError) throw claimError;
  const claimed = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;

  if (!claimed) {
    const { data: existing } = await admin
      .from("email_deliveries")
      .select("status, resend_email_id")
      .eq("dedupe_key", input.key)
      .maybeSingle();
    return {
      status: existing?.status === "sent" ? ("sent" as const) : ("skipped" as const),
      providerId: existing?.resend_email_id ?? null,
    };
  }

  try {
    const response = await sendResendEmail({
      to: claimed.recipient_email,
      subject: input.subject,
      email: renderBackedEmail({
        title: input.title,
        preheader: input.title,
        body: input.body,
        ctaLabel: input.ctaLabel,
        ctaUrl: input.ctaUrl,
        footer: input.footer,
      }),
      idempotencyKey: input.key,
    });
    const result = response.ok
      ? ((await response.json().catch(() => null)) as { id?: string } | null)
      : null;
    const providerId = result?.id ?? null;
    if (!response.ok || !providerId) {
      const reason = response.ok ? "resend_missing_message_id" : `resend_http_${response.status}`;
      await admin
        .from("email_deliveries")
        .update({ status: "failed", attempted_at: null, last_error: reason })
        .eq("id", claimed.id);
      return { status: "failed" as const, providerId: null };
    }

    const { error: updateError } = await admin
      .from("email_deliveries")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_email_id: providerId,
        last_error: null,
      })
      .eq("id", claimed.id);
    if (updateError) throw updateError;
    return { status: "sent" as const, providerId };
  } catch (error) {
    await admin
      .from("email_deliveries")
      .update({
        status: "failed",
        attempted_at: null,
        last_error: error instanceof Error ? error.message.slice(0, 240) : "resend_delivery_failed",
      })
      .eq("id", claimed.id);
    throw error;
  }
}
