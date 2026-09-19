import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env["VITE_SUPABASE_URL"] || "https://zlzaxgsyczfeepwidjii.supabase.co";
const supabasePublishableKey =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_xS6SYY2eNA8LIWhjFBUDyg__JTDgnhh";
const supabaseProjectRef = new URL(supabaseUrl).hostname.split(".")[0];

// This is Supabase's normal browser storage-key convention. Keeping it explicit
// makes the OAuth initiator and callback's PKCE verifier storage unambiguous.
export const supabaseAuthStorageKey = `sb-${supabaseProjectRef}-auth-token`;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        storageKey: supabaseAuthStorageKey,
      },
    })
  : null;

// Public profile pages deliberately query as the anonymous role. This keeps
// their narrow public RLS policy separate from an authenticated account's
// private profile row and avoids exposing private fields through a shared view.
export const publicSupabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export function authRedirectUrl(next?: string) {
  const url = new URL("/auth/callback", window.location.origin);
  if (next?.startsWith("/") && !next.startsWith("//")) url.searchParams.set("next", next);
  return url.toString();
}
