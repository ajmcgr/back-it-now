import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { privateSeo } from "@/lib/seo";
import {
  applyStripeStatus,
  getPayoutState,
  payoutContent,
  type CreatorPayoutProfile,
} from "@/lib/creator-payouts";

type Profile = CreatorPayoutProfile & {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  email: string | null;
  receive_project_updates: boolean;
  receive_product_news: boolean;
};

type StripeResetStatus = {
  eligible: boolean;
  reason: string | null;
  contactSupport: boolean;
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string) => regionNames.of(code) ?? code;

const emptyProfile: Profile = {
  display_name: "",
  username: "",
  avatar_url: "",
  bio: "",
  website: "",
  email: "",
  receive_project_updates: true,
  receive_product_news: false,
  stripe_account_id: null,
  stripe_onboarding_complete: false,
  stripe_charges_enabled: false,
  stripe_payouts_enabled: false,
  stripe_requirements_due: [],
  stripe_requirements_past_due: [],
  stripe_requirements_pending_verification: [],
  stripe_disabled_reason: null,
};

export const Route = createFileRoute("/settings")({
  head: () => privateSeo("Settings — Backed"),
  component: Settings,
});

function Settings() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [providers, setProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [isResettingStripe, setIsResettingStripe] = useState(false);
  const [stripeReset, setStripeReset] = useState<StripeResetStatus | null>(null);
  const [stripeCountries, setStripeCountries] = useState<string[]>([]);
  const [selectedStripeCountry, setSelectedStripeCountry] = useState("");
  const [stripeAccountCountry, setStripeAccountCountry] = useState<string | null>(null);
  const [isLoadingStripeCountries, setIsLoadingStripeCountries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  async function loadStripeCountries() {
    if (!supabase) return;
    setIsLoadingStripeCountries(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("stripe-connect", {
        body: { action: "countries" },
        timeout: 30_000,
      });
      const countries = Array.isArray(result?.countries)
        ? result.countries.filter(
            (country: unknown): country is string =>
              typeof country === "string" && /^[A-Z]{2}$/.test(country),
          )
        : [];
      if (error || countries.length === 0) {
        setMessage("We couldn't load Stripe's supported countries. Please try again.");
        return;
      }
      setStripeCountries(countries);
    } catch {
      setMessage("We couldn't load Stripe's supported countries. Please try again.");
    } finally {
      setIsLoadingStripeCountries(false);
    }
  }

  useEffect(() => {
    async function load() {
      if (!supabase) return setIsLoading(false);
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return window.location.assign("/auth?next=/settings");
      const { data: savedProfile } = await supabase
        .from("profiles")
        .select(
          "display_name, username, avatar_url, bio, website, email, receive_project_updates, receive_product_news, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, stripe_requirements_due",
        )
        .eq("id", user.id)
        .maybeSingle();
      let nextProfile: Profile = {
        ...emptyProfile,
        ...savedProfile,
        email: savedProfile?.email ?? user.email ?? "",
      };
      setProviders([...new Set((user.identities ?? []).map((identity) => identity.provider))]);
      const stripeAction = new URLSearchParams(window.location.search).get("stripe");
      if (stripeAction === "refresh") {
        try {
          const { data: result, error } = await supabase.functions.invoke("stripe-connect", {
            body: { action: "onboarding" },
            timeout: 30_000,
          });
          if (!error && result?.onboardingUrl) {
            window.location.assign(result.onboardingUrl);
            return;
          }
          setMessage("We couldn't reopen Stripe setup. Please try again.");
        } finally {
          window.history.replaceState({}, "", "/settings");
        }
      }
      if (nextProfile.stripe_account_id) {
        try {
          const { data: result, error } = await supabase.functions.invoke("stripe-connect", {
            body: { action: "status" },
            timeout: 30_000,
          });
          if (!error && result?.account) {
            nextProfile = applyStripeStatus(nextProfile, result.account);
            setStripeAccountCountry(
              typeof result.account.country === "string" ? result.account.country : null,
            );
            setStripeReset(result.reset ?? null);
            if (stripeAction === "return") setMessage("Payout status updated.");
          } else if (stripeAction === "return") {
            setMessage("We couldn't refresh your payout status. Please try again.");
          }
        } catch {
          if (stripeAction === "return")
            setMessage("We couldn't refresh your payout status. Please try again.");
        } finally {
          if (stripeAction === "return") window.history.replaceState({}, "", "/settings");
        }
      } else {
        await loadStripeCountries();
      }
      setProfile(nextProfile);
      setIsLoading(false);
    }
    void load();
  }, []);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setMessage(null);
    const displayName = profile.display_name.trim();
    const username = profile.username.trim().toLowerCase();
    let website = profile.website.trim();
    if (username && !/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/.test(username)) {
      return setMessage(
        "Username must be 3–30 characters: lowercase letters, numbers, hyphens, or underscores.",
      );
    }
    if (website) {
      try {
        const url = new URL(website);
        if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported protocol");
        website = url.toString();
      } catch {
        return setMessage("Website must be a valid http:// or https:// URL.");
      }
    }
    setIsSaving(true);
    const { data } = await supabase.auth.getSession();
    if (!data.session) return window.location.assign("/auth?next=/settings");
    const { data: savedProfile, error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        username: username || null,
        bio: profile.bio || null,
        website: website || null,
        receive_project_updates: profile.receive_project_updates,
        receive_product_news: profile.receive_product_news,
      })
      .eq("id", data.session.user.id)
      .select(
        "display_name, username, avatar_url, bio, website, email, receive_project_updates, receive_product_news, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, stripe_requirements_due",
      )
      .single();
    setIsSaving(false);
    if (error || !savedProfile) {
      if (error?.code === "23505") return setMessage("That username is already taken.");
      if (error?.code === "23514") return setMessage("That username or website is not allowed.");
      return setMessage("We couldn't save your changes. Please try again.");
    }
    setProfile((current) => ({
      ...current,
      ...savedProfile,
      email: savedProfile.email ?? data.session.user.email ?? "",
    }));
    window.dispatchEvent(new Event("backed-profile-updated"));
    setMessage("Changes saved.");
  }

  async function uploadAvatar(file?: File) {
    if (!file || !supabase) return;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setMessage("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }
    setMessage(null);
    setIsUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data, error } = await supabase.functions.invoke("avatar-upload", {
        body: form,
        timeout: 30_000,
      });
      const avatarUrl =
        data &&
        typeof data === "object" &&
        "avatarUrl" in data &&
        typeof data.avatarUrl === "string"
          ? data.avatarUrl
          : null;
      if (error || !avatarUrl) {
        setMessage("We couldn't upload your photo. Please try again.");
        return;
      }
      update("avatar_url", avatarUrl);
      window.dispatchEvent(new Event("backed-profile-updated"));
      setMessage("Profile photo updated.");
    } catch {
      setMessage("The upload took too long. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function changeEmail() {
    if (!supabase || !profile.email) return;
    const { error } = await supabase.auth.updateUser({ email: profile.email });
    setMessage(
      error
        ? "We couldn't start that email change."
        : "Check your inbox to verify your new email address.",
    );
  }

  async function deleteAccount() {
    if (!supabase || deleteConfirmation !== "DELETE") return;
    setIsDeleting(true);
    setMessage(null);
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: "DELETE" },
    });
    if (error) {
      setMessage("Your account could not be deleted while financial activity is still active.");
      setIsDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  async function connectStripe(action: "onboarding" | "dashboard") {
    if (!supabase) return;
    setIsConnectingStripe(true);
    setMessage(null);
    const { data } = await supabase.auth.getSession();
    if (!data.session) return window.location.assign("/auth?next=/settings");
    if (action === "onboarding" && !profile.stripe_account_id && !selectedStripeCountry) {
      setIsConnectingStripe(false);
      setMessage("Choose your Stripe account country before continuing.");
      return;
    }
    try {
      const { data: result, error } = await supabase.functions.invoke("stripe-connect", {
        body: {
          action,
          ...(!profile.stripe_account_id ? { country: selectedStripeCountry } : {}),
        },
        timeout: 30_000,
      });
      if (error || !result?.onboardingUrl) {
        setMessage("We couldn't open Stripe setup. Please try again.");
        return;
      }
      window.location.assign(result.onboardingUrl);
    } catch {
      setMessage("We couldn't open Stripe setup. Please try again.");
    } finally {
      setIsConnectingStripe(false);
    }
  }

  async function resetStripe() {
    if (!supabase || !stripeReset?.eligible) return;
    setIsResettingStripe(true);
    setMessage(null);
    try {
      const { data: result, error } = await supabase.functions.invoke("stripe-connect", {
        body: { action: "reset", confirmation: "START_OVER" },
        timeout: 30_000,
      });
      if (error || !result?.reset) {
        setMessage(
          "We couldn't restart your Stripe setup. Your existing payout setup hasn't been changed. Please try again or contact support.",
        );
        return;
      }
      setProfile((current) => ({
        ...current,
        stripe_account_id: null,
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_requirements_due: [],
        stripe_requirements_past_due: [],
        stripe_requirements_pending_verification: [],
        stripe_disabled_reason: null,
      }));
      setStripeReset(null);
      setStripeAccountCountry(null);
      setSelectedStripeCountry("");
      await loadStripeCountries();
      setMessage("Your previous Stripe setup was removed. You can now set up payouts again.");
    } catch {
      setMessage(
        "We couldn't restart your Stripe setup. Your existing payout setup hasn't been changed. Please try again or contact support.",
      );
    } finally {
      setIsResettingStripe(false);
    }
  }

  if (isLoading)
    return (
      <main className="container-backed py-16 text-center text-muted-foreground">
        Loading settings…
      </main>
    );

  const payoutState = getPayoutState(profile);
  const payout = payoutContent[payoutState];

  return (
    <main className="container-backed max-w-3xl py-14 sm:py-20">
      <div>
        <div>
          <h1 className="text-4xl font-semibold sm:text-5xl">Account settings</h1>
          <p className="mt-3 text-muted-foreground">
            Manage your Backed profile and account preferences.
          </p>
        </div>
      </div>

      <form onSubmit={saveProfile} className="mt-10 space-y-8">
        <section className="rounded-md border border-border p-6">
          <h2 className="text-xl font-semibold">Profile</h2>
          <div className="mt-5 flex items-center gap-4">
            <ProfileAvatar
              avatarUrl={profile.avatar_url}
              displayName={profile.display_name}
              username={profile.username}
              className="size-20 border border-border"
            />
            <div>
              <input
                ref={avatarInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  void uploadAvatar(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => avatarInput.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? "Uploading…" : "Change photo"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, or WebP. Up to 5 MB.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Display name">
              <Input
                value={profile.display_name ?? ""}
                onChange={(e) => update("display_name", e.target.value)}
              />
            </Field>
            <Field label="Username">
              <Input
                value={profile.username ?? ""}
                onChange={(e) => update("username", e.target.value)}
                placeholder="your-handle"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Bio">
                <Textarea
                  value={profile.bio ?? ""}
                  onChange={(e) => update("bio", e.target.value)}
                  maxLength={500}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Website">
                <Input
                  type="url"
                  value={profile.website ?? ""}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://your-site.com"
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border p-6">
          <h2 className="text-xl font-semibold">{payout.heading}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{payout.copy}</p>
          {payoutState === "not_connected" ? (
            <div className="mt-5 max-w-md space-y-2">
              <Label htmlFor="stripe-country">Where are you based?</Label>
              <Select
                value={selectedStripeCountry}
                onValueChange={setSelectedStripeCountry}
                disabled={isLoadingStripeCountries || stripeCountries.length === 0}
              >
                <SelectTrigger id="stripe-country">
                  <SelectValue
                    placeholder={
                      isLoadingStripeCountries ? "Loading countries…" : "Choose a country"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {stripeCountries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {countryName(country)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Stripe uses this to set up your payout account.
              </p>
            </div>
          ) : payoutState === "ready" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Backed sends creator proceeds to your connected Stripe account. Stripe then pays out
              to your bank according to your Stripe payout schedule.
            </p>
          ) : null}
          {payoutState !== "not_connected" && stripeAccountCountry ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Stripe account country: {countryName(stripeAccountCountry)}.
            </p>
          ) : null}
          {payout.cta ? (
            <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={() => void connectStripe(payout.action)}
                disabled={
                  isConnectingStripe ||
                  isResettingStripe ||
                  (payoutState === "not_connected" && !selectedStripeCountry)
                }
              >
                {isConnectingStripe ? "Opening Stripe…" : payout.cta}
              </Button>
              {payoutState === "incomplete" && stripeReset?.eligible ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={isResettingStripe}>
                      Start over with Stripe
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Start over with Stripe?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove your current Stripe payout setup and let you create a new
                        one. Use this if you selected the wrong country or need to restart setup.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isResettingStripe}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={isResettingStripe}
                        onClick={(event) => {
                          event.preventDefault();
                          void resetStripe();
                        }}
                      >
                        {isResettingStripe ? "Starting over…" : "Start over"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          ) : null}
          {payoutState === "incomplete" && stripeReset?.contactSupport ? (
            <div className="mt-5 rounded-md border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Can't restart payout setup</p>
              <p className="mt-1 text-muted-foreground">
                This Stripe account has already been used for creator payments. Contact Backed
                support if you need to change your payout setup.
              </p>
              <a
                className="mt-3 inline-block font-medium underline underline-offset-4"
                href="/contact"
              >
                Contact support
              </a>
            </div>
          ) : null}
        </section>

        <section className="rounded-md border border-border p-6">
          <h2 className="text-xl font-semibold">Account</h2>
          <div className="mt-5 space-y-4">
            <Field label="Email">
              <div className="flex gap-3">
                <Input
                  type="email"
                  value={profile.email ?? ""}
                  onChange={(e) => update("email", e.target.value)}
                />
                <Button type="button" variant="outline" onClick={changeEmail}>
                  Change email
                </Button>
              </div>
            </Field>
            <p className="text-sm text-muted-foreground">
              Sign-in methods: {providers.length ? providers.join(", ") : "email"}.
            </p>
            <p className="text-sm text-muted-foreground">
              Backed uses OAuth and passwordless email links; there is no password to reset.
            </p>
          </div>
        </section>

        <section className="rounded-md border border-border p-6">
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Payment, refund, payout, security, and other essential account emails remain enabled.
          </p>
          <div className="mt-5 space-y-4">
            <Preference
              label="Project and backing updates"
              checked={profile.receive_project_updates}
              onCheckedChange={(checked) => update("receive_project_updates", checked)}
              disabled={!profile.email}
            />
            <Preference
              label="Backed product and news emails"
              checked={profile.receive_product_news}
              onCheckedChange={(checked) => update("receive_product_news", checked)}
              disabled={!profile.email}
            />
          </div>
        </section>

        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </form>

      <section className="mt-10 rounded-md border border-destructive/40 p-6">
        <h2 className="text-xl font-semibold text-destructive">Danger zone</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deletion revokes access and anonymizes your profile. It is unavailable while projects,
          refunds, or payouts are active.
        </p>
        <div className="mt-5 flex max-w-md gap-3">
          <Input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Type DELETE to confirm"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={deleteConfirmation !== "DELETE" || isDeleting}
            onClick={deleteAccount}
          >
            {isDeleting ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Preference({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
