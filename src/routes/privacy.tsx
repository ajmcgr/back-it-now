import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Backed" },
      { name: "description", content: "How Backed collects and uses information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="container-backed py-16 sm:py-24">
      <article className="max-w-3xl">
        <h1 className="text-5xl font-semibold sm:text-6xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">Effective September 18, 2026</p>

        <div className="mt-10 space-y-8 text-base leading-8">
          <PrivacySection title="Information you provide">
            We collect information you choose to provide when you create an account, launch a
            project, contact us or back a campaign. This may include your name, email address,
            project details and the information needed to deliver a reward.
          </PrivacySection>
          <PrivacySection title="Payments">
            Payments, when enabled, are handled by a third-party payment provider under its own
            privacy policy. Backed does not store full card details.
          </PrivacySection>
          <PrivacySection title="Analytics and device information">
            We use Google Analytics to understand how people use Backed. Analytics may collect
            device, browser, approximate location, referral and interaction information using
            cookies or similar technologies.
          </PrivacySection>
          <PrivacySection title="How information is used">
            We use information to operate Backed, provide project and backing features, communicate
            about campaigns, prevent abuse, improve the service and comply with legal obligations.
          </PrivacySection>
          <PrivacySection title="Sharing">
            We share information only with service providers needed to operate Backed, with project
            creators when necessary to fulfill a reward, when required by law or when you direct us
            to do so. We do not sell personal information.
          </PrivacySection>
          <PrivacySection title="Retention and your choices">
            We retain information only as long as reasonably needed for the purposes described
            above. You may ask to access, correct or delete your information, subject to legal and
            operational requirements.
          </PrivacySection>
          <PrivacySection title="Contact">
            Privacy requests can be sent to hello@backedit.co.
          </PrivacySection>
        </div>
      </article>
    </main>
  );
}

function PrivacySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </section>
  );
}
