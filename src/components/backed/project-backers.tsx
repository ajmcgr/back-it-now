import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { publicSupabase, supabase } from "@/lib/supabase";

type BackerPresentation = {
  entry_key: string;
  is_private: boolean;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  amount: number;
  currency: string;
  backed_at: string;
  reward_title: string | null;
};

const backingAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100);

const backingDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

export function ProjectBackers({
  slug,
  backingCount,
  isOwner,
}: {
  slug: string;
  backingCount: number;
  isOwner: boolean;
}) {
  const [backers, setBackers] = useState<BackerPresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setLoadError("");
      const client = isOwner ? supabase : publicSupabase;
      if (!client) {
        setLoadError("Backers are temporarily unavailable.");
        setIsLoading(false);
        return;
      }
      const { data, error } = isOwner
        ? await client.rpc("get_creator_project_backers", { p_slug: slug })
        : await client.rpc("get_public_project_backers", { p_slug: slug });
      if (cancelled) return;
      if (error) {
        setLoadError("Backers are temporarily unavailable.");
        setBackers([]);
      } else {
        setBackers((data ?? []) as BackerPresentation[]);
      }
      setIsLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOwner, retry, slug]);

  return (
    <section id="backers" className="w-full max-w-3xl py-4 sm:py-8">
      <h2 className="text-2xl font-semibold">Backers</h2>
      <p className="mt-2 text-muted-foreground">
        {backingCount > 0
          ? `${backingCount} ${backingCount === 1 ? "backer has" : "backers have"} helped make this project happen.`
          : "No backers yet. Be the first to help make this project happen."}
      </p>

      {isLoading ? (
        <div className="mt-8 grid gap-3" aria-label="Loading backers" aria-busy="true">
          {[0, 1].map((item) => (
            <Skeleton key={item} className="h-20" />
          ))}
        </div>
      ) : loadError ? (
        <div className="mt-8 rounded-md border border-border p-5 text-sm">
          <p>{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      ) : backers.length ? (
        <div className="mt-8 divide-y divide-border border-y border-border">
          {backers.map((backer) => {
            const hideIdentity = backer.is_private && !isOwner;
            const name = hideIdentity
              ? "Anonymous backer"
              : backer.display_name || backer.username || "Backed supporter";
            const identity = (
              <div className="flex min-w-0 items-center gap-3">
                {hideIdentity ? (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                ) : (
                  <ProfileAvatar
                    avatarUrl={backer.avatar_url}
                    displayName={backer.display_name}
                    username={backer.username}
                    className="size-11 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{name}</p>
                  {!hideIdentity && backer.username ? (
                    <p className="truncate text-sm text-muted-foreground">@{backer.username}</p>
                  ) : null}
                </div>
              </div>
            );
            return (
              <article
                key={backer.entry_key}
                className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                {!hideIdentity && backer.username ? (
                  <Link
                    to="/$username"
                    params={{ username: backer.username }}
                    className="rounded-md transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {identity}
                  </Link>
                ) : (
                  identity
                )}
                <div className="pl-14 sm:pl-0 sm:text-right">
                  <p className="font-medium">
                    Backed {backingAmount(backer.amount, backer.currency)} ·{" "}
                    {backingDate(backer.backed_at)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 sm:justify-end">
                    {backer.reward_title ? (
                      <span className="text-sm text-muted-foreground">{backer.reward_title}</span>
                    ) : null}
                    {isOwner && backer.is_private ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        Private publicly
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
