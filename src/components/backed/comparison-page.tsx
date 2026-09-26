import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export type ComparisonRow = {
  label: string;
  backed: string;
  competitor: string;
};

type ComparisonPageProps = {
  competitor: string;
  eyebrow: string;
  intro: string;
  rows: ComparisonRow[];
  howTheyWork: string;
  backedFit: string;
  competitorFit: string;
  sourceLinks: Array<{ label: string; href: string }>;
};

export function ComparisonPage({
  competitor,
  eyebrow,
  intro,
  rows,
  howTheyWork,
  backedFit,
  competitorFit,
  sourceLinks,
}: ComparisonPageProps) {
  return (
    <main className="container-backed py-16 sm:py-24">
      <article className="mx-auto max-w-5xl">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">Backed vs {competitor}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            {intro}
          </p>
        </header>

        <section className="mt-14" aria-labelledby="comparison-heading">
          <h2 id="comparison-heading" className="text-2xl font-semibold sm:text-3xl">
            At a glance
          </h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm sm:text-base">
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-1/4 px-5 py-4 font-semibold" scope="col">
                    Feature
                  </th>
                  <th className="w-[37.5%] px-5 py-4 font-semibold" scope="col">
                    Backed
                  </th>
                  <th className="w-[37.5%] px-5 py-4 font-semibold" scope="col">
                    {competitor}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.label} className="align-top">
                    <th className="px-5 py-4 font-semibold" scope="row">
                      {row.label}
                    </th>
                    <td className="px-5 py-4 leading-6 text-muted-foreground">{row.backed}</td>
                    <td className="px-5 py-4 leading-6 text-muted-foreground">{row.competitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Swipe or scroll horizontally to view the full comparison on smaller screens.
          </p>
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-3" aria-label="Choosing a platform">
          <ComparisonSection title="How they work">{howTheyWork}</ComparisonSection>
          <ComparisonSection title="When Backed may fit">{backedFit}</ComparisonSection>
          <ComparisonSection title={`When ${competitor} may fit`}>
            {competitorFit}
          </ComparisonSection>
        </section>

        <aside className="mt-12 rounded-xl border border-border bg-muted/35 p-6 text-sm leading-6 text-muted-foreground">
          <p>
            Backed is not affiliated with or endorsed by {competitor}. Features and pricing may
            change. Check each platform for current terms.
          </p>
          <p className="mt-3">
            Official {competitor} information reviewed for this comparison:{" "}
            {sourceLinks.map((source, index) => (
              <span key={source.href}>
                {index > 0 ? ", " : ""}
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                >
                  {source.label}
                </a>
              </span>
            ))}
            .
          </p>
        </aside>

        <section className="mt-16 rounded-xl border border-border bg-card px-6 py-10 text-center sm:px-10">
          <h2 className="text-3xl font-semibold">Have something you want to bring to life?</h2>
          <Button asChild size="lg" className="mt-6">
            <Link to="/start">Start a project</Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Free to launch. Backed takes 5% of what you raise.
          </p>
        </section>
      </article>
    </main>
  );
}

function ComparisonSection({ title, children }: { title: string; children: string }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-3 leading-7 text-muted-foreground">{children}</p>
    </section>
  );
}
