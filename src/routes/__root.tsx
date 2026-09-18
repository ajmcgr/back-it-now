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
      <SiteFooter />
    </QueryClientProvider>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-sm">
      <div className="container-backed flex h-16 items-center gap-7">
        <Link to="/" aria-label="Backed home" className="shrink-0">
          <img src="/logo.png" alt="Backed" width={3654} height={1291} className="h-14 w-auto" />
        </Link>
        <Link
          to="/discover"
          search={{ q: "" }}
          className="hidden text-sm font-semibold text-foreground hover:text-primary sm:block"
        >
          Discover
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            to="/discover"
            search={{ q: "" }}
            aria-label="Search projects"
            className="inline-flex size-10 items-center justify-center rounded-md text-foreground hover:bg-accent"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </Link>
          <Link
            to="/start"
            className="hidden text-sm font-semibold text-foreground hover:text-primary md:block"
          >
            Start a project
          </Link>
          <Link
            to="/auth"
            className="hidden rounded-md border border-input px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent md:block"
          >
            Sign in
          </Link>
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
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile navigation">
                <SheetClose asChild>
                  <Link
                    to="/discover"
                    search={{ q: "" }}
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
                <SheetClose asChild>
                  <Link
                    to="/auth"
                    className="rounded-md px-3 py-3 text-lg font-semibold text-foreground hover:bg-accent hover:text-primary"
                  >
                    Sign in
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
