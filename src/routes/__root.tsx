import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileAvatar } from "@/components/backed/profile-avatar";
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
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85"
          >
            Go home
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
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
      { property: "og:type", content: "website" },
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
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
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
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-3MGN9JG9RQ');
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

  return (
    <QueryClientProvider client={queryClient}>
      <SiteHeader />
      <Outlet />
      <FloatingStartButton />
      <SiteFooter />
    </QueryClientProvider>
  );
}

function FloatingStartButton() {
  return (
    <Link
      to="/start"
      className="fixed inset-x-4 bottom-4 z-30 inline-flex h-12 items-center justify-center rounded-md bg-black px-5 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inset-x-auto md:right-6 md:w-auto"
    >
      Start a project
    </Link>
  );
}

function SiteHeader() {
  const [account, setAccount] = useState<{
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const loadAccount = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return setAccount(null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      const metadata = user.user_metadata ?? {};
      setAccount({
        username: profile?.username ?? null,
        displayName: profile?.display_name ?? metadata.full_name ?? metadata.name ?? null,
        avatarUrl: profile?.avatar_url ?? metadata.avatar_url ?? metadata.picture ?? null,
      });
    };
    void loadAccount();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
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

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-sm">
      <div className="container-backed flex h-16 items-center gap-7">
        <Link to="/" aria-label="Backed home" className="shrink-0">
          <img src="/logo.png" alt="Backed" width={3654} height={1291} className="h-14 w-auto" />
        </Link>
        <Link
          to="/discover"
          search={{ q: "", category: "" }}
          className="hidden items-center gap-2 text-sm font-semibold text-foreground hover:text-primary sm:inline-flex"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          Discover
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            to="/start"
            className="hidden text-sm font-semibold text-foreground hover:text-primary md:block"
          >
            Start a project
          </Link>
          <Link
            to="/faq"
            className="hidden text-sm font-semibold text-foreground hover:text-primary md:block"
          >
            FAQ
          </Link>
          {account ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open account menu"
                    className="hidden rounded-full p-0.5 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring md:block"
                  >
                    <ProfileAvatar
                      avatarUrl={account.avatarUrl}
                      displayName={account.displayName}
                      username={account.username}
                      className="size-9 border border-border"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link
                      to={account.username ? "/$username" : "/settings"}
                      params={account.username ? { username: account.username } : undefined}
                    >
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={signOut}>Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link
              to="/auth"
              className="hidden rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-black/85 md:block"
            >
              Sign in
            </Link>
          )}
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex size-10 items-center justify-center rounded-md text-foreground hover:bg-accent"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile navigation">
                <SheetClose asChild>
                  <Link
                    to="/discover"
                    search={{ q: "", category: "" }}
                    className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                  >
                    Discover
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/start"
                    className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                  >
                    Start a project
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/faq"
                    className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                  >
                    FAQ
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/about"
                    className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                  >
                    About
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/contact"
                    className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                  >
                    Contact
                  </Link>
                </SheetClose>
                {account ? (
                  <>
                    <SheetClose asChild>
                      <Link
                        to={account.username ? "/$username" : "/settings"}
                        params={account.username ? { username: account.username } : undefined}
                        className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                      >
                        Profile
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/dashboard"
                        className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                      >
                        Dashboard
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/settings"
                        className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                      >
                        Settings
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <button
                        type="button"
                        onClick={signOut}
                        className="rounded-md px-3 py-3 text-left text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                      >
                        Log out
                      </button>
                    </SheetClose>
                  </>
                ) : (
                  <SheetClose asChild>
                    <Link
                      to="/auth"
                      className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                    >
                      Sign in
                    </Link>
                  </SheetClose>
                )}
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
      className="inline-flex size-10 items-center justify-center rounded-md text-foreground hover:bg-accent"
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border py-8">
      <div className="container-backed text-center text-sm text-muted-foreground">
        <nav
          className="mb-4 flex flex-wrap justify-center gap-x-5 gap-y-2"
          aria-label="Footer navigation"
        >
          <Link to="/faq" className="hover:text-primary">
            FAQ
          </Link>
          <Link to="/contact" className="hover:text-primary">
            Contact
          </Link>
          <Link to="/privacy" className="hover:text-primary">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-primary">
            Terms
          </Link>
          <a
            href="https://x.com/backeditco"
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary"
          >
            Follow us on X
          </a>
        </nav>
        <p className="mb-2">© 2026 Backed</p>
        <p>
          Built with 🫶🏻 by{" "}
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
          . Backed is not affiliated with or endorsed by X.
        </p>
      </div>
    </footer>
  );
}
