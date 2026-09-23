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
      <article className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-7 sm:p-12">
        <h1 className="text-center text-5xl font-semibold sm:text-6xl">About Backed</h1>
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

        <div className="mt-12">
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

      <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="media-kit-heading">
        <h2 id="media-kit-heading" className="text-2xl font-semibold">
          Media kit
        </h2>
        <p className="mt-2 text-muted-foreground">Download official Backed brand assets.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <BrandAsset
            image="/favicon.png"
            alt="Backed icon preview"
            title="Backed icon"
            download="/favicon.png"
          />
          <BrandAsset
            image="/logo.png"
            alt="Backed logo preview"
            title="Backed logo"
            download="/logo.png"
            contain
          />
        </div>
      </section>
    </main>
  );
}

function BrandAsset({
  image,
  alt,
  title,
  download,
  contain = false,
}: {
  image: string;
  alt: string;
  title: string;
  download: string;
  contain?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-md border border-border">
      <div className="grid h-44 place-items-center bg-muted/50 p-6">
        <img
          src={image}
          alt={alt}
          className={contain ? "max-h-24 max-w-full object-contain" : "size-24 object-contain"}
        />
      </div>
      <div className="flex items-center justify-between gap-4 p-4">
        <h3 className="font-semibold">{title}</h3>
        <a href={download} download className="text-sm font-semibold text-primary hover:underline">
          Download PNG
        </a>
      </div>
    </article>
  );
}
