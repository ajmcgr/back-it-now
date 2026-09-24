import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FolderKanban, Search, UserRound } from "lucide-react";

import { CompactRowsSkeleton } from "@/components/backed/loading-skeletons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { publicSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type SearchResult = {
  result_type: "project" | "creator";
  slug: string | null;
  username: string;
  title: string;
  subtitle: string;
  image_url: string | null;
};

type SearchStatus = "idle" | "loading" | "ready" | "error";

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<SearchResult>;
  return (
    (result.result_type === "project" || result.result_type === "creator") &&
    typeof result.username === "string" &&
    typeof result.title === "string" &&
    typeof result.subtitle === "string" &&
    (result.slug === null || typeof result.slug === "string") &&
    (result.image_url === null || typeof result.image_url === "string")
  );
}

function resultHref(result: SearchResult) {
  return result.result_type === "project"
    ? `/projects/${encodeURIComponent(result.slug ?? "")}`
    : `/${encodeURIComponent(result.username)}`;
}

function useMarketplaceSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const requestSequence = useRef(0);

  useEffect(() => {
    const normalized = query.trim();
    const sequence = ++requestSequence.current;

    if (normalized.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }

    setResults([]);
    setStatus("idle");
    const timeout = window.setTimeout(async () => {
      if (!publicSupabase) {
        setStatus("error");
        return;
      }

      setStatus("loading");
      const { data, error } = await publicSupabase.rpc("search_public_marketplace", {
        p_query: normalized,
        p_project_limit: 5,
        p_creator_limit: 3,
      });
      if (sequence !== requestSequence.current) return;

      if (error) {
        setResults([]);
        setStatus("error");
        return;
      }

      setResults(Array.isArray(data) ? data.filter(isSearchResult) : []);
      setStatus("ready");
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query]);

  return { results, status };
}

function ResultImage({ result }: { result: SearchResult }) {
  const fallback =
    result.result_type === "project" ? (
      <FolderKanban aria-hidden="true" className="size-4" />
    ) : (
      <UserRound aria-hidden="true" className="size-4" />
    );

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-muted-foreground",
        result.result_type === "creator" ? "rounded-full" : "rounded-md",
      )}
    >
      {result.image_url ? (
        <img
          src={result.image_url}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        fallback
      )}
    </span>
  );
}

function SearchPanel({
  autoFocus = false,
  onDismiss,
  desktop = false,
}: {
  autoFocus?: boolean;
  onDismiss: () => void;
  desktop?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { results, status } = useMarketplaceSearch(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const normalizedQuery = query.trim();
  const showResults = resultsOpen && normalizedQuery.length >= 2;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    setActiveIndex(results.length ? 0 : -1);
  }, [results]);

  useEffect(() => {
    if (!desktop) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setResultsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [desktop]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setResultsOpen(false);
      if (!desktop) onDismiss();
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setResultsOpen(true);
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setResultsOpen(true);
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[activeIndex >= 0 ? activeIndex : 0];
      if (selected) window.location.assign(resultHref(selected));
    }
  }

  const projectResults = results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.result_type === "project");
  const creatorResults = results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.result_type === "creator");

  const resultGroups = [
    { label: "Projects", items: projectResults },
    { label: "Creators", items: creatorResults },
  ].filter((group) => group.items.length);

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          autoComplete="off"
          aria-label="Search Backed"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-activedescendant={
            showResults && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          placeholder="Search Backed..."
          onFocus={() => normalizedQuery.length >= 2 && setResultsOpen(true)}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setResultsOpen(value.trim().length >= 2);
          }}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/35 focus:ring-2 focus:ring-ring/35"
        />
      </div>

      {showResults ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className={cn(
            "z-50 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
            desktop ? "absolute left-0 top-full mt-2 w-[22rem]" : "mt-3 w-full",
          )}
        >
          {status === "idle" || status === "loading" ? (
            <CompactRowsSkeleton />
          ) : status === "error" ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              Search is temporarily unavailable.
            </p>
          ) : !results.length ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              No projects or creators found.
            </p>
          ) : (
            <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
              {resultGroups.map((group) => (
                <section key={group.label} aria-label={group.label} className="not-first:mt-2">
                  <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map(({ result, index }) => (
                    <a
                      key={`${result.result_type}:${result.slug ?? result.username}`}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={activeIndex === index}
                      href={resultHref(result)}
                      onMouseEnter={() => setActiveIndex(index)}
                      onFocus={() => setActiveIndex(index)}
                      onClick={onDismiss}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors",
                        activeIndex === index
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent focus:bg-accent",
                      )}
                    >
                      <ResultImage result={result} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{result.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      </span>
                    </a>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DesktopSiteSearch() {
  return (
    <div className="hidden w-52 lg:block xl:w-60">
      <SearchPanel desktop onDismiss={() => undefined} />
    </div>
  );
}

export function MobileSiteSearch() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Search Backed"
          className="inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
        >
          <Search aria-hidden="true" className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(calc(100vw-2rem),24rem)] p-3">
        <SearchPanel autoFocus onDismiss={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
