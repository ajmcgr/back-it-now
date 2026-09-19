import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

type Profile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  email: string | null;
  receive_project_updates: boolean;
  receive_product_news: boolean;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_payouts_enabled: boolean;
  stripe_requirements_due: string[];
};

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
  stripe_payouts_enabled: false,
  stripe_requirements_due: [],
};

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [providers, setProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      if (!supabase) return setIsLoading(false);
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return window.location.assign("/auth?next=/settings");
      const { data: savedProfile } = await supabase
        .from("profiles")
        .select(
          "display_name, username, avatar_url, bio, website, email, receive_project_updates, receive_product_news, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled, stripe_requirements_due",
        )
        .eq("id", user.id)
        .maybeSingle();
      setProfile({
        ...emptyProfile,
        ...savedProfile,
        email: savedProfile?.email ?? user.email ?? "",
      });
      setProviders([...new Set((user.identities ?? []).map((identity) => identity.provider))]);
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
        "display_name, username, avatar_url, bio, website, email, receive_project_updates, receive_product_news, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled, stripe_requirements_due",
      )
      .single();
    setIsSaving(false);
    if (error || !savedProfile) {
      if (error?.code === "23505") return setMessage("That username is already taken.");
      if (error?.code === "23514") return setMessage("That username or website is not allowed.");
      return setMessage("We couldn't save your changes. Please try again.");
    }
    setProfile({
      ...emptyProfile,
      ...savedProfile,
      email: savedProfile.email ?? data.session.user.email ?? "",
    });
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
    const form = new FormData();
    form.append("file", file);
    const { data, error } = await supabase.functions.invoke("avatar-upload", { body: form });
    setIsUploadingAvatar(false);
    const avatarUrl =
      data && typeof data === "object" && "avatarUrl" in data && typeof data.avatarUrl === "string"
        ? data.avatarUrl
        : null;
    if (error || !avatarUrl) {
      setMessage("We couldn't upload your photo. Please try again.");
      return;
    }
    update("avatar_url", avatarUrl);
    window.dispatchEvent(new Event("backed-profile-updated"));
    setMessage("Profile photo updated.");
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

  async function connectStripe() {
    if (!supabase) return;
    setIsConnectingStripe(true);
    setMessage(null);
    const { data } = await supabase.auth.getSession();
    if (!data.session) return window.location.assign("/auth?next=/settings");
    const { data: result, error } = await supabase.functions.invoke("stripe-connect", {
      body: { action: profile.stripe_payouts_enabled ? "dashboard" : "onboarding" },
    });
    if (error || !result?.onboardingUrl) {
      setMessage("We couldn't open Stripe setup. Please try again.");
      setIsConnectingStripe(false);
      return;
    }
    window.location.assign(result.onboardingUrl);
  }

  if (isLoading)
    return (
      <main className="container-backed py-16 text-center text-muted-foreground">
        Loading settings…
      </main>
    );

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
          <h2 className="text-xl font-semibold">Creator payouts</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Backed uses Stripe Connect to send creator proceeds to your connected Stripe account.
            Stripe then pays out to your bank on its payout schedule.
          </p>
          <p className="mt-4 text-sm font-semibold">
            {profile.stripe_payouts_enabled
              ? "Stripe payouts are ready."
              : profile.stripe_account_id
                ? "Stripe setup needs more information."
                : "Connect Stripe before receiving creator proceeds."}
          </p>
          {profile.stripe_requirements_due.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Stripe still needs: {profile.stripe_requirements_due.join(", ")}.
            </p>
          )}
          <Button
            type="button"
            className="mt-5"
            onClick={connectStripe}
            disabled={isConnectingStripe}
          >
            {isConnectingStripe
              ? "Opening Stripe…"
              : profile.stripe_payouts_enabled
                ? "Manage Stripe account"
                : profile.stripe_account_id
                  ? "Resume Stripe setup"
                  : "Connect with Stripe"}
          </Button>
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
