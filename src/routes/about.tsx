import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Backed" },
      {
        name: "description",
        content: "Backed is a crowdfunding marketplace for things people want to exist.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="container-backed py-16 sm:py-24">
      <article className="max-w-3xl">
        <h1 className="text-5xl font-semibold sm:text-6xl">About Backed</h1>
        <p className="mt-7 text-xl leading-8 text-muted-foreground">
          Backed is a crowdfunding marketplace for things people want to exist.
        </p>

        <div className="mt-12 space-y-6 text-base leading-8 sm:text-lg">
          <p>Hello there!</p>
          <p>
            Creators, founders and builders use Backed to launch a specific project or product.
            People who want it to exist can back it with money.
          </p>
          <p>
            Each project has a funding goal and deadline. If enough people back it, the project gets
            funded and the builder can make it happen.
          </p>
          <p>
            Backed is built around a simple idea: the product is the pitch. Clear projects, honest
            progress and a direct way for early supporters to help good ideas become real.
          </p>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <span className="grid size-14 place-items-center rounded-full bg-secondary font-bold">
            AM
          </span>
          <p className="mt-4 font-semibold">Alex MacGregor</p>
          <p className="text-sm text-muted-foreground">Founder, Backed</p>
          <a
            href="https://x.com/alexmacgregor__"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Follow me on X <ExternalLink className="size-3.5" />
          </a>
        </div>
      </article>
    </main>
  );
}
