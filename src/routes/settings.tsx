import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  email: string | null;
  receive_project_updates: boolean;
  receive_product_news: boolean;
};

const emptyProfile: Profile = {
  display_name: "",
  username: "",
  avatar_url: "",
  bio: "",
  email: "",
  receive_project_updates: true,
  receive_product_news: false,
};

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [providers, setProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!supabase) return setIsLoading(false);
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return window.location.assign("/auth?next=/settings");
      const { data: savedProfile } = await supabase
        .from("profiles")
        .select(
          "display_name, username, avatar_url, bio, email, receive_project_updates, receive_product_news",
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
    const { data } = await supabase.auth.getSession();
    if (!data.session) return window.location.assign("/auth?next=/settings");
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name || null,
        username: profile.username || null,
        avatar_url: profile.avatar_url || null,
        bio: profile.bio || null,
        receive_project_updates: profile.receive_project_updates,
        receive_product_news: profile.receive_product_news,
      })
      .eq("id", data.session.user.id);
    setMessage(error ? "We couldn't save your settings." : "Settings saved.");
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
              <Field label="Avatar URL">
                <Input
                  type="url"
                  value={profile.avatar_url ?? ""}
                  onChange={(e) => update("avatar_url", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Bio">
                <Textarea
                  value={profile.bio ?? ""}
                  onChange={(e) => update("bio", e.target.value)}
                  maxLength={500}
                />
              </Field>
            </div>
          </div>
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

        <Button type="submit">Save settings</Button>
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
