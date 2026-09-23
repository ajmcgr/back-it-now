import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
import { NotificationBell } from "@/components/backed/notification-bell";
import { NewsletterSignup } from "@/components/backed/newsletter-signup";
import { supabase } from "@/lib/supabase";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Go home
          </Link>
          <Link
            to="/discover"
            search={{}}
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85"
          >
            Explore projects
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Backed" },
      { name: "description", content: "Back things you want to exist." },
      { name: "author", content: "Backed" },
      { name: "theme-color", content: "#5171ff" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Backed" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-3MGN9JG9RQ" />
        <script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="dHZPWMqfLzGFZVNIgIyAZw"
          async
        />
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="1e0eeedd-f47c-45fd-bdd7-966a0f1baada"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-3MGN9JG9RQ');
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.$crisp = [];
              window.CRISP_WEBSITE_ID = "dbdca1e6-de24-4e77-bff9-b425dba0126d";
              (function () {
                var d = document;
                var s = d.createElement("script");
                s.src = "https://client.crisp.chat/l.js";
                s.async = true;
                d.getElementsByTagName("head")[0].appendChild(s);
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <QueryClientProvider client={queryClient}>
      <SiteHeader />
      <Outlet />
      {showNewsletterSignup(pathname) ? <NewsletterSignup /> : null}
      <SiteFooter />
    </QueryClientProvider>
  );
}

const publicNewsletterPages = new Set([
  "/",
  "/about",
  "/contact",
  "/discover",
  "/faq",
  "/pricing",
  "/privacy",
  "/terms",
]);

const privateRootSegments = new Set([
  "admin",
  "api",
  "auth",
  "dashboard",
  "settings",
  "sitemap.xml",
  "start",
]);

function showNewsletterSignup(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (publicNewsletterPages.has(normalized)) return true;
  if (/^\/projects\/[^/]+(?:\/updates\/[^/]+)?$/.test(normalized)) return true;

  const segments = normalized.split("/").filter(Boolean);
  const rootSegment = segments[0];
  return rootSegment !== undefined && segments.length === 1 && !privateRootSegments.has(rootSegment);
}

function SiteHeader() {
  const [account, setAccount] = useState<{
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const loadAccount = async () => {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setAccount(null);
        setIsAdmin(false);
        return;
      }
      const { data: profile } = await client
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      const metadata = user.user_metadata ?? {};
      setAccount({
        username: profile?.username ?? null,
        displayName: profile?.display_name ?? metadata["full_name"] ?? metadata["name"] ?? null,
        avatarUrl: profile?.avatar_url ?? metadata["avatar_url"] ?? metadata["picture"] ?? null,
      });
      const { data: adminStatus } = await client.functions.invoke("admin-projects", {
        body: { action: "status" },
      });
      setIsAdmin(Boolean(adminStatus?.isAdmin));
    };
    void loadAccount();
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAccount(null);
        return;
      }
      void loadAccount();
    });
    window.addEventListener("backed-profile-updated", loadAccount);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("backed-profile-updated", loadAccount);
    };
  }, []);

  async function signOut() {
    await supabase?.auth.signOut();
    window.location.assign("/");
  }

  const navClass =
    "rounded-md px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const mobileNavClass =
    "rounded-md px-3 py-3 text-lg font-semibold text-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-sm">
      <div className="container-backed grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:h-[4.5rem] sm:gap-3 md:grid-cols-[1fr_auto_1fr]">
        <Link
          to="/"
          aria-label="Backed home"
          className="w-fit shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <img
            src="/logo.png"
            alt="Backed"
            width={3654}
            height={1291}
            className="h-10 max-w-full object-contain object-left sm:h-14"
          />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          <Link
            to="/discover"
            search={{}}
            className={navClass}
            activeProps={{ className: `${navClass} text-foreground` }}
          >
            Discover
          </Link>
          <Link
            to="/start"
            className={navClass}
            activeProps={{ className: `${navClass} text-foreground` }}
          >
            Start a project
          </Link>
        </nav>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <nav className="hidden items-center gap-1 md:flex" aria-label="Supporting navigation">
            <Link
              to="/pricing"
              className={navClass}
              activeProps={{ className: `${navClass} text-foreground` }}
            >
              Pricing
            </Link>
            <Link
              to="/faq"
              className={navClass}
              activeProps={{ className: `${navClass} text-foreground` }}
            >
              FAQ
            </Link>
          </nav>
          <div className="max-[359px]:hidden">
            <ThemeToggle />
          </div>
          {account ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open account menu"
                    className="rounded-full p-0.5 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ProfileAvatar
                      avatarUrl={account.avatarUrl}
                      displayName={account.displayName}
                      username={account.username}
                      className="size-9 border border-border"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-40">
                  <DropdownMenuItem asChild>
                    {account.username ? (
                      <Link to="/$username" params={{ username: account.username }}>
                        Profile
                      </Link>
                    ) : (
                      <Link to="/settings">Profile</Link>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings">Settings</Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">Admin</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={signOut}>Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link
              to="/auth"
              className="whitespace-nowrap rounded-md bg-black px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Sign in
            </Link>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent className="flex w-[min(88vw,22rem)] flex-col overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile navigation">
                <SheetClose asChild>
                  <Link to="/discover" search={{}} className={mobileNavClass}>
                    Discover
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/start" className={mobileNavClass}>
                    Start a project
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/pricing" className={mobileNavClass}>
                    Pricing
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/faq" className={mobileNavClass}>
                    FAQ
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/about" className={mobileNavClass}>
                    About
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link to="/contact" className={mobileNavClass}>
                    Contact
                  </Link>
                </SheetClose>
              </nav>
              <div className="mt-auto border-t border-border pt-5 text-sm text-muted-foreground">
                <div className="flex gap-4">
                  <SheetClose asChild>
                    <Link to="/terms" className="hover:text-primary">
                      Terms
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/privacy" className="hover:text-primary">
                      Privacy
                    </Link>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("backed-theme");
    const shouldUseDarkTheme = savedTheme === "dark";

    document.documentElement.classList.toggle("dark", shouldUseDarkTheme);
    setIsDark(shouldUseDarkTheme);
  }, []);

  function toggleTheme() {
    const nextThemeIsDark = !isDark;
    document.documentElement.classList.toggle("dark", nextThemeIsDark);
    window.localStorage.setItem("backed-theme", nextThemeIsDark ? "dark" : "light");
    setIsDark(nextThemeIsDark);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

function XBrandIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function DiscordBrandIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.039.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.039-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.095.252-.194.372-.294a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.1.246.2.373.294a.077.077 0 0 1-.007.128 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.548-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.333-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.333-.946 2.419-2.157 2.419Z" />
    </svg>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border py-10 sm:py-12">
      <div className="container-backed">
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 text-sm text-muted-foreground sm:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="col-span-2 sm:col-span-1">
            <img src="/logo.png" alt="Backed" width={3654} height={1291} className="h-10 w-auto" />
            <p className="mt-3 max-w-xs leading-6">Back things you want to exist.</p>
          </div>
          <FooterGroup
            title="Explore"
            links={[
              ["Discover", "/discover"],
              ["Start a project", "/start"],
              ["Pricing", "/pricing"],
            ]}
          />
          <FooterGroup
            title="Support"
            links={[
              ["About", "/about"],
              ["FAQ", "/faq"],
              ["Contact", "/contact"],
              ["Terms", "/terms"],
              ["Privacy", "/privacy"],
            ]}
          />
          <nav aria-label="Connect">
            <p className="mb-3 font-semibold text-foreground">Connect</p>
            <div className="flex flex-col items-start gap-2.5">
              <a
                href="https://x.com/backeditco"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-primary"
              >
                <XBrandIcon />
                <span>X</span>
              </a>
              <a
                href="https://discord.gg/Zhsc4GFSbx"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-primary"
              >
                <DiscordBrandIcon />
                <span>Discord</span>
              </a>
            </div>
          </nav>
        </div>
        <div className="mt-10 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          <p className="mx-auto max-w-3xl">
            Copyright © 2026 Works App, Inc. Built with 🫶🏻 by{" "}
            <a
              href="https://x.com/alexmacgregor__"
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary"
            >
              Alex
            </a>
            . Inspired by{" "}
            <a
              href="https://x.com/marclou"
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary"
            >
              Marc
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <p className="mb-3 font-semibold text-foreground">{title}</p>
      <div className="flex flex-col gap-2">
        {links.map(([label, href]) => (
          <Link key={href} to={href as "/"} className="w-fit hover:text-primary">
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
