import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { renderBackedEmail, sendResendEmail } from "../_shared/backed-email.ts";

type AuthEmailData = {
  token?: string;
  token_hash?: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to?: string;
  email_action_type: string;
};

type AuthHookEvent = {
  user: { email?: string; new_email?: string };
  email_data: AuthEmailData;
};

const copyFor = (action: string, targetEmail?: string) => {
  const actions: Record<string, { title: string; body: string; ctaLabel?: string }> = {
    magiclink: {
      title: "Sign in to Backed",
      body: "Click the button below to securely sign in to your Backed account.",
      ctaLabel: "Sign in to Backed",
    },
    signup: {
      title: "Confirm your email",
      body: "Confirm your email address to finish setting up your Backed account.",
      ctaLabel: "Confirm email",
    },
    recovery: {
      title: "Secure your account",
      body: "Use the button below to continue your Backed account recovery request.",
      ctaLabel: "Continue securely",
    },
    email_change: {
      title: "Confirm your new email",
      body: targetEmail
        ? `Confirm ${targetEmail} as the email address for your Backed account.`
        : "Confirm the email address change for your Backed account.",
      ctaLabel: "Confirm email",
    },
    invite: {
      title: "You’re invited to Backed",
      body: "You’ve been invited to join Backed. Accept the invitation to get started.",
      ctaLabel: "Accept invitation",
    },
  };
  return actions[action] ?? actions.magiclink;
};

function confirmationUrl(data: AuthEmailData, tokenHash?: string) {
  if (!tokenHash) return undefined;
  const url = new URL(`${Deno.env.get("SUPABASE_URL")}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", data.email_action_type);
  if (data.redirect_to) url.searchParams.set("redirect_to", data.redirect_to);
  return url.toString();
}

async function stableKey(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deliver(
  recipient: string,
  data: AuthEmailData,
  tokenHash: string | undefined,
  token: string | undefined,
) {
  if (data.email_action_type === "reauthentication") {
    const email = renderBackedEmail({
      title: "Confirm it’s you",
      preheader: "Your Backed verification code",
      body: "Enter this verification code to continue.",
      panel: token || "",
    });
    const response = await sendResendEmail({
      to: recipient,
      subject: "Your Backed verification code",
      email,
      idempotencyKey: `auth-reauth-${await stableKey(`${recipient}:${token || ""}`)}`,
    });
    if (!response.ok) throw new Error("auth_email_delivery_failed");
    return;
  }

  const url = confirmationUrl(data, tokenHash);
  if (!url) throw new Error("auth_action_missing_token_hash");
  const copy = copyFor(data.email_action_type, recipient);
  const email = renderBackedEmail({
    title: copy.title,
    preheader: copy.title,
    body: copy.body,
    ctaLabel: copy.ctaLabel,
    ctaUrl: url,
  });
  const response = await sendResendEmail({
    to: recipient,
    subject: copy.title,
    email,
    idempotencyKey: `auth-${data.email_action_type}-${await stableKey(`${recipient}:${tokenHash}`)}`,
  });
  if (!response.ok) throw new Error("auth_email_delivery_failed");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("not allowed", { status: 405 });
  const secret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!secret) return new Response("hook not configured", { status: 500 });

  try {
    const payload = await request.text();
    let event: AuthHookEvent | undefined;
    for (const configuredSecret of secret.split("|")) {
      try {
        event = new Webhook(configuredSecret.replace(/^v1,whsec_/, "")).verify(
          payload,
          Object.fromEntries(request.headers),
        ) as AuthHookEvent;
        break;
      } catch {
        // Support standard-webhook secret rotation without exposing details.
      }
    }
    if (!event) throw new Error("invalid_hook_signature");
    const data = event.email_data;
    if (!event.user.email || !data.email_action_type) throw new Error("invalid_auth_email_event");

    if (data.email_action_type === "email_change" && event.user.new_email) {
      // Supabase secure email change emits two tokens: one for the current email
      // and one for the new address. Use the exact hashes supplied by Auth.
      await Promise.all([
        deliver(event.user.email, data, data.token_hash_new ?? data.token_hash, data.token),
        deliver(event.user.new_email, data, data.token_hash, data.token_new ?? data.token),
      ]);
    } else {
      await deliver(event.user.email, data, data.token_hash, data.token);
    }
    return Response.json({});
  } catch {
    // Never log tokens, token hashes, recipients, or webhook payloads.
    return Response.json({ error: "auth_email_hook_failed" }, { status: 500 });
  }
});
