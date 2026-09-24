import { createFileRoute } from "@tanstack/react-router";
import { publicSeo } from "@/lib/seo";

const questions = [
  [
    "What is Backed?",
    "Backed is a reward and preorder crowdfunding marketplace for things people want to exist. It is not an investment or equity platform.",
  ],
  [
    "What happens when I back a project?",
    "Choose how much to back and optionally claim an eligible reward. You're charged immediately, and your successful backing is added to the project's progress.",
  ],
  [
    "When am I charged?",
    "You're charged when you back a project. Backed projects don't need to reach their funding goal for creators to receive funds.",
  ],
  [
    "What happens if a project doesn't reach its goal?",
    "The creator still receives the funds raised. Funding goals show what the creator hopes to raise, but Backed isn't all-or-nothing.",
  ],
  [
    "What happens if a creator can't continue with a project?",
    "If a creator decides they can no longer proceed, they can cancel the project. The project stops accepting new backings and eligible paid backings are refunded.",
  ],
  [
    "What does Backed cost?",
    "It is free to launch. Backed charges creators a 5% platform fee on each successful backing, plus payment processing. Backers do not pay a separate Backed platform fee.",
  ],
  [
    "How are payment processing fees handled?",
    "Payment processing fees are separate from Backed's 5% platform fee. The exact processing cost depends on the payment method and is shown where relevant.",
  ],
  [
    "How do rewards work?",
    "Rewards are optional. Each project explains what an eligible backer receives, the minimum backing amount, and any available quantity. Limited rewards are available only while capacity remains.",
  ],
  [
    "When do creators receive proceeds?",
    "Creators receive proceeds from successful backings through their connected Stripe account, less Backed’s 5% platform fee and payment processing fees.",
  ],
  [
    "Can a backing be refunded?",
    "If a creator cancels a project, eligible paid backings are refunded in full through Stripe. Bank or card processing time may vary. Backed is not equity or an investment product.",
  ],
  [
    "Can I launch a project?",
    "Yes. Backed is for creators, founders, and builders with a clear project, funding goal, and reward for early supporters.",
  ],
];

export const Route = createFileRoute("/faq")({
  head: () =>
    publicSeo({
      title: "FAQ | Backed",
      description:
        "Answers about backing projects, optional rewards, funding goals, creator fees, payouts and refunds on Backed.",
      path: "/faq",
    }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <main className="container-backed py-16 sm:py-24">
      <article className="max-w-3xl">
        <h1 className="text-5xl font-semibold sm:text-6xl">FAQ</h1>
        <p className="mt-6 text-xl leading-8 text-muted-foreground">
          A few helpful answers about backing and launching projects on Backed.
        </p>
        <div className="mt-12 divide-y divide-border border-y border-border">
          {questions.map(([question, answer]) => (
            <details key={question} open className="group py-5">
              <summary className="cursor-pointer list-none pr-8 text-lg font-semibold marker:hidden">
                {question}
              </summary>
              <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </article>
    </main>
  );
}
