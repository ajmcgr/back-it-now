import { createFileRoute } from "@tanstack/react-router";

const questions = [
  [
    "What is Backed?",
    "Backed is a reward and preorder crowdfunding marketplace for things people want to exist. It is not an investment or equity platform.",
  ],
  [
    "What happens when I back a project?",
    "You choose a reward and complete checkout. Once your payment succeeds, your backing appears in the project's total and the creator can begin making the project happen.",
  ],
  [
    "Does a project have to reach its funding goal?",
    "No. A funding goal is a progress target, not an all-or-nothing threshold. Creators remain entitled to successful backing proceeds, less Backed and payment-processing fees, even if they do not reach the goal.",
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
    "Each project states what supporters receive, how much it costs, and any available quantity. Limited rewards are available only while capacity remains.",
  ],
  [
    "Can I launch a project?",
    "Yes. Backed is for creators, founders, and builders with a clear project, funding goal, and reward for early supporters.",
  ],
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Backed" },
      { name: "description", content: "Frequently asked questions about Backed." },
    ],
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
