import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? "https://zlzaxgsyczfeepwidjii.supabase.co";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_xS6SYY2eNA8LIWhjFBUDyg__JTDgnhh";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function authRedirectUrl(next?: string) {
  const url = new URL("/auth/callback", window.location.origin);
  if (next?.startsWith("/")) url.searchParams.set("next", next);
  return url.toString();
}
