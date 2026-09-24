import { createFileRoute } from "@tanstack/react-router";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () =>
    publicSeo({
      title: "Terms of Service | Backed",
      description: "Terms that apply when creating, backing and using projects on Backed.",
      path: "/terms",
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="container-backed py-16 sm:py-24">
      <article className="max-w-3xl">
        <h1 className="text-5xl font-semibold sm:text-6xl">Terms of Service</h1>
        <p className="mt-4 text-sm text-muted-foreground">Effective September 18, 2026</p>

        <div className="mt-10 space-y-8 text-base leading-8">
          <TermsSection title="How Backed works">
            Backed lets creators publish reward or preorder crowdfunding projects. Backers support a
            project in exchange for the reward described by its creator. Backing a project is not an
            investment and does not provide equity, ownership or a financial return.
          </TermsSection>
          <TermsSection title="Funding">
            Each project has a funding goal and deadline. The funding goal is a progress target and
            does not determine whether a creator receives proceeds from successful backings. Any
            starting amount shown separately from paid backings is campaign progress supplied by the
            project owner and is not represented as a payment or backer.
          </TermsSection>
          <TermsSection title="Creator responsibilities">
            Creators are responsible for presenting projects honestly, using funds as described,
            communicating material changes and making a good-faith effort to deliver promised
            rewards. Estimated dates are estimates, not guarantees.
          </TermsSection>
          <TermsSection title="Backer responsibilities">
            Backers must provide accurate information and understand that supporting a project
            involves risk. Backed does not guarantee that a creator will complete a project or
            deliver a reward.
          </TermsSection>
          <TermsSection title="Content and conduct">
            Projects and messages must be honest and lawful. Illegal goods or services, malware,
            phishing, scams, hate speech, impersonation and misleading claims are prohibited. Backed
            may suspend or remove content that breaches these terms or applicable law.
          </TermsSection>
          <TermsSection title="Payments and refunds">
            Payments, when enabled, are handled by a third-party payment provider. Backed does not
            store full card details. Backed charges creators a 5% platform fee on each successful
            backing; payment processing fees are additional. Backings are charged immediately, and
            funding goals are targets rather than all-or-nothing thresholds. If a creator cancels a
            project, new backings stop and eligible paid backings are refunded in full. Refund
            timing remains subject to the payment provider and card or bank processing times.
          </TermsSection>
          <TermsSection title="Service availability">
            We may change, suspend or discontinue parts of Backed. To the extent permitted by law,
            the service is provided as available without guarantees of uninterrupted operation.
          </TermsSection>
          <TermsSection title="Contact">
            Questions about these terms can be sent to hello@backedit.co.
          </TermsSection>
        </div>
      </article>
    </main>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </section>
  );
}
