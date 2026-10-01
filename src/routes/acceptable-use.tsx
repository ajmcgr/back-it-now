import { createFileRoute } from "@tanstack/react-router";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/acceptable-use")({
  head: () =>
    publicSeo({
      title: "Acceptable Use Policy | Backed",
      description: "Rules for projects, creators and activity permitted on Backed.",
      path: "/acceptable-use",
    }),
  component: AcceptableUsePage,
});

function AcceptableUsePage() {
  return (
    <main className="container-backed py-16 sm:py-24">
      <article className="max-w-3xl">
        <h1 className="text-5xl font-semibold sm:text-6xl">Acceptable Use Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">Effective October 1, 2026</p>

        <div className="mt-10 space-y-8 text-base leading-8">
          <PolicySection title="Using Backed responsibly">
            Backed is a reward and preorder crowdfunding platform. Projects must truthfully describe
            what their creators intend to build or deliver. Creators must have the legal right to
            offer their project and rewards and are responsible for complying with all applicable
            laws.
          </PolicySection>

          <PolicySection title="Prohibited projects and activity">
            You may not use Backed for:
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Illegal products, services or other unlawful activity.</li>
              <li>Fraud, deception, misleading fundraising, or counterfeit or stolen goods.</li>
              <li>
                Weapons or prohibited weapons-related products, illegal drugs or controlled
                substances, gambling or prohibited gaming.
              </li>
              <li>Adult sexual services or content prohibited by Backed.</li>
              <li>
                Securities, equity crowdfunding, loans or lending, or any promise of interest,
                profit participation, ownership interests or other financial returns.
              </li>
              <li>Money transmission or payment processing for third parties.</li>
              <li>
                Sanctions evasion or activity involving prohibited jurisdictions, persons or
                entities.
              </li>
              <li>
                Intellectual property infringement, including unauthorized use of others' work.
              </li>
              <li>Harassment, hate, threats or other illegal harmful activity.</li>
              <li>Any activity prohibited by Backed's payment providers or applicable law.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Backing is not an investment">
            Backing a project does not provide equity, securities, ownership, interest, profit
            sharing or any other investment or financial return. Creators must not present a project
            or reward as providing those rights or returns.
          </PolicySection>

          <PolicySection title="Reviews and enforcement">
            Backed may review projects and accounts, request additional information, suspend or
            remove projects or accounts, and refuse or stop payment activity where necessary to
            enforce this policy, protect users, satisfy payment-provider requirements or comply with
            law. Publication on Backed does not mean that a project has been manually pre-approved.
          </PolicySection>

          <PolicySection title="Policy updates">
            We may update this policy as Backed, legal requirements or payment-provider requirements
            change. Questions or reports can be sent to hello@backedit.co.
          </PolicySection>
        </div>
      </article>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </section>
  );
}
