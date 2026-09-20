import { Link, createFileRoute } from "@tanstack/react-router";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/pricing")({
  head: () =>
    publicSeo({
      title: "Pricing | Backed",
      description:
        "Launch free on Backed. Creators pay a 5% platform fee on successful backing amounts, plus payment processing.",
      path: "/pricing",
    }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <main className="container-backed py-16 sm:py-24">
      <section className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Pricing</p>
        <h1 className="mt-4 text-5xl font-semibold sm:text-6xl">
          Free to launch. 5% on what you raise.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-muted-foreground">
          Backed takes a 5% platform fee from each successful backing. Payment processing fees are
          additional.
        </p>
      </section>

      <section
        className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2"
        aria-label="Pricing details"
      >
        <article className="rounded-xl border border-border bg-card p-7 text-left sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Creators</p>
          <h2 className="mt-3 text-3xl font-semibold">$0 to get started</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Create your project, add rewards, and share it with your community for free.
          </p>
          <ul className="mt-6 space-y-3 leading-7 text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">5% platform fee</span> on every
              successful backing
            </li>
            <li>Payment processing fees are additional</li>
            <li>
              Funding goals track progress—they do not decide whether you receive successful
              proceeds
            </li>
          </ul>
        </article>

        <article className="rounded-xl border border-border bg-card p-7 text-left sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Backers</p>
          <h2 className="mt-3 text-3xl font-semibold">Back any amount</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Choose the amount that feels right. You can optionally claim an eligible reward at
            checkout.
          </p>
          <ul className="mt-6 space-y-3 leading-7 text-muted-foreground">
            <li>No separate Backed platform fee for backers</li>
            <li>Rewards are optional</li>
            <li>Limited rewards remain available only while capacity lasts</li>
            <li>Successful backings count toward the project’s visible progress</li>
          </ul>
        </article>
      </section>

      <section className="mx-auto mt-8 max-w-4xl rounded-xl border border-border bg-muted/40 p-7 text-center sm:p-8">
        <h2 className="text-2xl font-semibold">A clear example</h2>
        <p className="mx-auto mt-3 max-w-2xl leading-7 text-muted-foreground">
          On a $100 successful backing, Backed’s platform fee is $5. Payment processing is separate
          and varies by payment method and processor.
        </p>
        <Link
          to="/start"
          className="mt-6 inline-flex rounded-md bg-black px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black/85"
        >
          Start a project
        </Link>
      </section>
    </main>
  );
}
