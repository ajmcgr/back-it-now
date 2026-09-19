export type BackedEmail = {
  title: string;
  preheader: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
  panel?: string;
};

const BACKED_LOGO_URL = "https://backedit.co/logo.png";

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });

export function renderBackedEmail({
  title,
  preheader,
  body,
  ctaLabel,
  ctaUrl,
  footer = "If you didn’t request this email, you can safely ignore it.",
  panel,
}: BackedEmail) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);
  const safeBody = escapeHtml(body);
  const safeFooter = escapeHtml(footer);
  const safePanel = panel ? escapeHtml(panel) : "";
  const button =
    ctaLabel && ctaUrl
      ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#000000;border-radius:8px;color:#ffffff;font-size:16px;font-weight:700;line-height:1;text-decoration:none;padding:15px 22px;">${escapeHtml(ctaLabel)}</a>`
      : "";
  const panelHtml = safePanel
    ? `<div style="margin:24px 0;padding:18px 20px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;color:#1f2937;font-size:16px;font-weight:700;letter-spacing:2px;text-align:center;">${safePanel}</div>`
    : "";

  return {
    html: `<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>@media only screen and (max-width:620px){.backed-card{border-radius:12px!important}.backed-header,.backed-content,.backed-footer{padding-left:24px!important;padding-right:24px!important}.backed-title{font-size:25px!important}}</style></head>
<body style="margin:0;padding:0;background:#f5f5f5;color:#111111;font-family:Inter,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f5f5f5;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="backed-card" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <tr><td class="backed-header" style="padding:30px 40px 24px;border-bottom:1px solid #e5e7eb;"><img src="${BACKED_LOGO_URL}" alt="Backed" width="150" height="53" style="display:block;width:150px;height:auto;border:0;outline:none;text-decoration:none;"></td></tr>
      <tr><td class="backed-content" style="padding:40px;"><h1 class="backed-title" style="margin:0 0 16px;font-size:28px;line-height:1.2;letter-spacing:-.5px;color:#111111;">${safeTitle}</h1><p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#4b5563;">${safeBody}</p>${panelHtml}${button ? `<div style="margin-top:28px;">${button}</div>` : ""}<p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">${safeFooter}</p></td></tr>
      <tr><td class="backed-footer" style="padding:24px 40px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.6;color:#6b7280;">Backed<br><a href="https://backedit.co" style="color:#5171ff;text-decoration:none;">backedit.co</a></td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    text: `${title}\n\n${body}${ctaLabel && ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl}` : ""}${panel ? `\n\n${panel}` : ""}\n\n${footer}\n\nBacked\nbackedit.co`,
  };
}

export async function sendResendEmail({
  to,
  subject,
  email,
  idempotencyKey,
}: {
  to: string | string[];
  subject: string;
  email: ReturnType<typeof renderBackedEmail>;
  idempotencyKey?: string;
}) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("resend_not_configured");
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL") || "Backed <hello@backedit.co>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html: email.html,
      text: email.text,
    }),
  });
}
