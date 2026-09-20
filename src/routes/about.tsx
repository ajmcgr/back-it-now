import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    publicSeo({
      title: "About | Backed",
      description:
        "Backed is a reward and preorder crowdfunding marketplace for things people want to exist.",
      path: "/about",
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
            Each project has a funding goal and deadline. The goal shows progress; every successful
            backing helps the builder make the project happen.
          </p>
          <p>
            Backed is built around a simple idea: the product is the pitch. Clear projects, honest
            progress and a direct way for early supporters to help good ideas become real.
          </p>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <img
            src="/alex-macgregor.png"
            alt="Alex MacGregor"
            width={1000}
            height={1000}
            className="size-20 object-cover"
          />
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
