import { createFileRoute } from "@tanstack/react-router";

const questions = [
  [
    "What is Backed?",
    "Backed is a reward and preorder crowdfunding marketplace for things people want to exist. It is not an investment or equity platform.",
  ],
  [
    "What happens when I back a project?",
    "You choose a reward and support the project. If the campaign reaches its goal by the deadline, the creator can move forward with the project and fulfill the stated reward.",
  ],
  [
    "What if a project does not reach its goal?",
    "Eligible backings for unsuccessful campaigns are refunded. Creators do not receive campaign proceeds from unsuccessful projects.",
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
            <details key={question} className="group py-5">
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
