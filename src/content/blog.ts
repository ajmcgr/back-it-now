export type BlogCategory = "Crowdfunding" | "Guides" | "Comparisons" | "Ideas";

export type BlogSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogLink = {
  label: string;
  href: string;
};

export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  category: BlogCategory;
  author: string;
  publishedAt: string;
  updatedAt: string;
  readMinutes: number;
  draft: boolean;
  imageConcept: string;
  sections: BlogSection[];
  relatedLinks: BlogLink[];
  sources?: BlogLink[];
};

const articles: BlogArticle[] = [
  {
    slug: "how-to-crowdfund-a-project-in-2026",
    title: "How to Crowdfund a Project in 2026",
    description:
      "A practical guide to planning, launching and growing a reward-based crowdfunding project in 2026.",
    excerpt:
      "Turn a clear idea into a credible campaign, find your first backers and keep momentum after launch.",
    category: "Guides",
    author: "Backed",
    publishedAt: "2026-09-26",
    updatedAt: "2026-09-26",
    readMinutes: 8,
    draft: false,
    imageConcept:
      "An editorial still life of an independent creator planning a launch with sketches, a prototype and a simple campaign checklist, optimistic natural light",
    sections: [
      {
        heading: "Start with a project people can understand",
        paragraphs: [
          "A crowdfunding page is not the place to make people decode your idea. Explain what you are making, who it is for, why it matters and what a successful first version looks like. A useful test is whether someone outside your field can repeat the idea after reading two sentences.",
          "Keep the first promise narrow. Backers are more likely to trust a specific, achievable outcome than a grand roadmap with no obvious first milestone.",
        ],
      },
      {
        heading: "Build the budget before the page",
        paragraphs: [
          "List production, tooling, packaging, shipping, taxes, contingency and payment costs before choosing a goal. If you offer rewards, cost each reward at the quantity you realistically expect—not only at the best bulk price.",
        ],
        bullets: [
          "Separate essential launch costs from nice-to-have improvements.",
          "Allow room for failed payments, replacements and unexpected delivery costs.",
          "Choose a goal you can explain in plain language.",
        ],
      },
      {
        heading: "Prepare the audience before launch day",
        paragraphs: [
          "Crowdfunding works best when the first supporters already know the project is coming. Share prototypes, decisions and progress with a small group before launch. Ask for feedback, not vague promises to support later.",
          "Create a short list of people who genuinely care about the problem. Personal outreach to that group is usually more valuable than broadcasting the same message to a large, indifferent audience.",
        ],
      },
      {
        heading: "Make the project page do the trust-building",
        paragraphs: [
          "Use strong original images, a concise opening, clear reward terms and honest risks. Show the creator behind the work. Backers should know what happens next, what may change and how updates will be communicated.",
          "On Backed, supporters can choose a custom amount and may claim an eligible reward. That makes the core project story more important than an oversized reward menu.",
        ],
      },
      {
        heading: "Launch, learn and communicate",
        paragraphs: [
          "Treat launch day as the start of a conversation. Thank early backers, answer questions quickly and share meaningful updates. If something changes, explain it early. Consistent communication is one of the clearest ways to show that a real person is responsibly moving the work forward.",
          "After launch, review which messages bring qualified visitors and which questions keep appearing. Improve the page, clarify the offer and keep sharing evidence of progress.",
        ],
      },
    ],
    relatedLinks: [
      { label: "Set a crowdfunding goal", href: "/blog/how-to-set-a-crowdfunding-goal" },
      { label: "Get your first backers", href: "/blog/how-to-get-your-first-backers" },
      { label: "Start a project", href: "/start" },
    ],
  },
  {
    slug: "kickstarter-vs-patreon",
    title: "Kickstarter vs Patreon: What’s the Difference?",
    description:
      "Compare Kickstarter campaigns and Patreon memberships to decide which funding model fits your work.",
    excerpt:
      "One funds a defined campaign; the other supports an ongoing creator relationship. Here is how to choose.",
    category: "Comparisons",
    author: "Backed",
    publishedAt: "2026-09-26",
    updatedAt: "2026-09-26",
    readMinutes: 6,
    draft: false,
    imageConcept:
      "A clean editorial split scene contrasting a finite product launch plan with an ongoing creator membership calendar, no logos or text",
    sections: [
      {
        heading: "The shortest answer",
        paragraphs: [
          "Kickstarter is built around time-bound creative projects with a funding goal. Patreon is built around an ongoing creator page, recurring memberships and eligible one-time purchases. The best fit depends on whether supporters are funding a defined outcome or an ongoing body of work.",
        ],
      },
      {
        heading: "Choose a campaign for a defined outcome",
        paragraphs: [
          "A campaign model makes sense when the work has a clear beginning, budget and deliverable: a first production run, book, game, film or physical product. The deadline creates a shared moment and the goal communicates the scale of the plan.",
          "Kickstarter uses all-or-nothing funding, so a project must reach its goal for pledges to be collected. Backed takes a different approach: successful backings are charged immediately and the visible goal tracks progress without deciding whether the creator receives those proceeds.",
        ],
      },
      {
        heading: "Choose membership for ongoing output",
        paragraphs: [
          "Patreon is usually the more natural choice when supporters are paying for continuing access, posts, community benefits or a recurring creative practice. It rewards a regular publishing cadence rather than a single launch moment.",
          "For new creator pages, Patreon’s official documentation describes a standard platform fee of 10% on successfully processed payments, with payment processing and other applicable fees in addition.",
        ],
      },
      {
        heading: "Questions to ask before choosing",
        paragraphs: [
          "Ask what supporters are actually funding, how often you can deliver value and whether you need a public deadline. A musician funding one album has a different need from a musician releasing a new studio session every month.",
        ],
        bullets: [
          "Is there one concrete outcome or a continuing stream of work?",
          "Do supporters expect a reward, access or simply progress?",
          "Can you sustain recurring obligations after the first burst of attention?",
        ],
      },
    ],
    relatedLinks: [
      { label: "Compare Backed and Kickstarter", href: "/compare/kickstarter" },
      { label: "Compare Backed and Patreon", href: "/compare/patreon" },
      { label: "Explore projects", href: "/discover" },
    ],
    sources: [
      {
        label: "Kickstarter’s all-or-nothing model",
        href: "https://updates.kickstarter.com/why-is-funding-all-or-nothing/",
      },
      {
        label: "Patreon creator fees overview",
        href: "https://support.patreon.com/hc/en-us/articles/11111747095181-Creator-fees-overview",
      },
    ],
  },
  {
    slug: "kickstarter-vs-gofundme",
    title: "Kickstarter vs GoFundMe: Which Type of Crowdfunding Is Right for Your Project?",
    description:
      "Understand the difference between reward-based project crowdfunding and donation-led fundraising.",
    excerpt:
      "Kickstarter and GoFundMe both gather support online, but they are designed for very different kinds of asks.",
    category: "Comparisons",
    author: "Backed",
    publishedAt: "2026-09-26",
    updatedAt: "2026-09-26",
    readMinutes: 6,
    draft: false,
    imageConcept:
      "Editorial tabletop scene contrasting a designed product prototype and reward package with a community support noticeboard, humane and modern, no logos or text",
    sections: [
      {
        heading: "Project backing and donation fundraising are different",
        paragraphs: [
          "Kickstarter is for creative projects: supporters pledge toward a defined idea and creators may offer project-related rewards. GoFundMe is centered on donations for people, communities, organizations and causes. The practical question is whether supporters are helping make a project or responding to a need.",
        ],
      },
      {
        heading: "How the funding mechanics differ",
        paragraphs: [
          "Kickstarter uses an all-or-nothing model. If the campaign does not reach its target by the deadline, backers are not charged. GoFundMe fundraisers do not need to reach the displayed goal before available donations can be transferred.",
          "GoFundMe says it is free to start and manage a fundraiser, while a transaction fee is deducted from each donation. Donors can also choose an optional contribution to GoFundMe.",
        ],
      },
      {
        heading: "Which one fits your ask?",
        paragraphs: [
          "Choose a project platform when you can describe what will be made, what the money enables and what supporters may receive. Choose a donation platform when the central purpose is personal, charitable or community support rather than delivering a creative reward.",
          "If your project benefits from optional rewards but you do not want an all-or-nothing threshold, Backed offers flexible project funding with immediate successful charges.",
        ],
      },
      {
        heading: "Be clear with supporters",
        paragraphs: [
          "Whichever model you use, avoid borrowing the language of another model. A donation should not imply a product purchase. A reward should explain delivery expectations and risk. Clear wording makes the relationship easier to understand before anyone pays.",
        ],
      },
    ],
    relatedLinks: [
      { label: "Compare Backed and GoFundMe", href: "/compare/gofundme" },
      {
        label: "Reward-based crowdfunding explained",
        href: "/blog/reward-based-crowdfunding-explained",
      },
      { label: "Start a project", href: "/start" },
    ],
    sources: [
      {
        label: "GoFundMe fee guidance",
        href: "https://support.gofundme.com/hc/en-us/articles/203604424-Learn-about-GoFundMe-fees",
      },
      {
        label: "Kickstarter’s all-or-nothing model",
        href: "https://updates.kickstarter.com/why-is-funding-all-or-nothing/",
      },
    ],
  },
  {
    slug: "best-kickstarter-alternatives-2026",
    title: "The Best Kickstarter Alternatives in 2026",
    description:
      "A practical guide to crowdfunding alternatives for products, memberships, donations and independent projects.",
    excerpt:
      "Compare funding models—not just feature lists—to find the platform that matches what you are making.",
    category: "Comparisons",
    author: "Backed",
    publishedAt: "2026-09-26",
    updatedAt: "2026-09-26",
    readMinutes: 8,
    draft: false,
    imageConcept:
      "A refined editorial arrangement of branching paths leading from one creative prototype toward project funding, membership and community support, no logos or text",
    sections: [
      {
        heading: "There is no universal best platform",
        paragraphs: [
          "The right alternative depends on the relationship between creator, supporter and outcome. A product preorder, recurring membership and personal fundraiser may all be called crowdfunding, but they need different payment mechanics and expectations.",
        ],
      },
      {
        heading: "Backed: flexible funding for projects",
        paragraphs: [
          "Backed is designed for independent products and creative projects. Supporters choose an amount and can optionally claim an eligible reward. Successful backings are charged immediately, and creators do not need to reach the displayed goal to receive those proceeds. Backed charges creators 5% of successful backing amounts, plus payment processing.",
        ],
      },
      {
        heading: "Indiegogo: fixed campaigns and pledge management",
        paragraphs: [
          "Indiegogo’s current platform uses fixed funding for new campaigns and offers post-campaign tools such as late pledges and pledge management. Its official documentation lists a 5% platform fee plus payment processing, and says funds are returned when a fixed campaign misses its goal.",
        ],
      },
      {
        heading: "Patreon: memberships and ongoing creator work",
        paragraphs: [
          "Patreon is a better conceptual fit for creators who publish continuously and want recurring memberships, community benefits or eligible one-time products. It is not primarily a deadline-driven project campaign tool.",
        ],
      },
      {
        heading: "GoFundMe: donation-led fundraising",
        paragraphs: [
          "GoFundMe is designed around donations for personal, community and organizational needs. It does not require the fundraiser goal to be reached before available donations can be transferred, and it does not center the experience on creative rewards.",
        ],
      },
      {
        heading: "A useful selection checklist",
        paragraphs: [
          "Compare the funding model, payment timing, fee structure, reward expectations, audience and payout requirements. Then choose the platform whose default behavior already matches the promise you want to make.",
        ],
      },
    ],
    relatedLinks: [
      { label: "Backed vs Kickstarter", href: "/compare/kickstarter" },
      { label: "Backed vs Indiegogo", href: "/compare/indiegogo" },
      { label: "Backed vs Patreon", href: "/compare/patreon" },
      { label: "Backed vs GoFundMe", href: "/compare/gofundme" },
    ],
    sources: [
      { label: "Indiegogo fees", href: "https://help.indiegogo.com/article/596-fees" },
      {
        label: "Patreon creator fees",
        href: "https://support.patreon.com/hc/en-us/articles/11111747095181-Creator-fees-overview",
      },
      {
        label: "GoFundMe fees",
        href: "https://support.gofundme.com/hc/en-us/articles/203604424-Learn-about-GoFundMe-fees",
      },
    ],
  },
  {
    slug: "how-to-set-a-crowdfunding-goal",
    title: "How to Set a Crowdfunding Goal",
    description:
      "Build a crowdfunding goal from real costs, fees, reward margins and a practical contingency.",
    excerpt:
      "A credible goal is a budget you can explain—not an impressive number chosen for the progress bar.",
    category: "Guides",
    author: "Backed",
    publishedAt: "2026-09-26",
    updatedAt: "2026-09-26",
    readMinutes: 7,
    draft: false,
    imageConcept:
      "An editorial overhead view of a creator calculating a project budget with material samples, calculator and simple handwritten cost categories, no readable text",
    sections: [
      {
        heading: "Define the minimum useful outcome",
        paragraphs: [
          "Start with the smallest version of the project that is still worth delivering. A goal should fund a coherent outcome, not every future idea. Write down what exists when the budget is fully spent and what is deliberately outside scope.",
        ],
      },
      {
        heading: "Build the cost model",
        paragraphs: [
          "Estimate production, packaging, labor, software, contractors, taxes, shipping support and a contingency. Reward costs need to include fulfillment, not only manufacturing. Include platform and payment processing fees so the amount left after fees can still fund the plan.",
        ],
        bullets: [
          "Fixed costs: prototypes, tooling, setup and one-time professional work.",
          "Variable costs: each reward, package, label and delivery allowance.",
          "Risk allowance: replacements, price movement and ordinary mistakes.",
        ],
      },
      {
        heading: "Understand what the goal means on your platform",
        paragraphs: [
          "On an all-or-nothing platform, the goal is the threshold that determines whether funds are collected. On a flexible platform such as Backed, the goal communicates ambition and progress but successful backing proceeds are not conditional on reaching it.",
          "That difference changes planning, but not the need for honesty. If a partial amount only funds research rather than delivery, say so clearly.",
        ],
      },
      {
        heading: "Pressure-test the number",
        paragraphs: [
          "Calculate how many likely backers are needed at a realistic average amount. If that number is far larger than the audience you can reach, reduce scope, build the audience first or find another source for part of the budget.",
          "Finally, ask someone familiar with production to challenge your assumptions. The best goal is defensible both to supporters and to the person responsible for delivery.",
        ],
      },
    ],
    relatedLinks: [
      { label: "Start a project", href: "/start" },
      { label: "How to crowdfund a project", href: "/blog/how-to-crowdfund-a-project-in-2026" },
      {
        label: "Flexible vs all-or-nothing funding",
        href: "/blog/flexible-vs-all-or-nothing-crowdfunding",
      },
    ],
  },
  {
    slug: "reward-based-crowdfunding-explained",
    title: "Reward-Based Crowdfunding Explained",
    description:
      "Learn how reward-based crowdfunding works, what backers receive and how creators should plan fulfillment.",
    excerpt:
      "Supporters help make a project happen and may receive a reward—but they are not buying equity.",
    category: "Crowdfunding",
    author: "Backed",
    publishedAt: "2026-09-26",
    updatedAt: "2026-09-26",
    readMinutes: 6,
    draft: false,
    imageConcept:
      "A warm editorial scene of a maker packaging a small early-edition reward beside a prototype and thank-you card, premium but human, no logos or text",
    sections: [
      {
        heading: "What reward-based crowdfunding is",
        paragraphs: [
          "Reward-based crowdfunding lets people financially support a project, often in exchange for an optional non-financial reward such as an early product, limited edition or experience. Backers are helping a creator attempt the work; they are not purchasing shares or an investment return.",
        ],
      },
      {
        heading: "What a reward should do",
        paragraphs: [
          "A good reward makes the project more tangible without overwhelming the creator. It should be clearly described, realistically priced and feasible to deliver. The strongest reward is often closely connected to the work itself.",
          "Backed also allows people to back without claiming a reward. That lets a supporter choose the amount that feels right even when no reward fits.",
        ],
      },
      {
        heading: "Rewards are commitments",
        paragraphs: [
          "Creators should treat reward descriptions as public commitments. Explain quantities, expected timing, shipping limitations and what may change. If a reward has limited capacity, keep the available quantity accurate.",
        ],
      },
      {
        heading: "Backers should evaluate risk",
        paragraphs: [
          "Crowdfunding supports work that may still be in development. Backers should read the plan, creator history, risks and updates rather than treating every reward as ordinary retail inventory. Creators build trust by showing evidence, acknowledging uncertainty and communicating throughout delivery.",
        ],
      },
    ],
    relatedLinks: [
      { label: "Explore reward-based projects", href: "/discover" },
      { label: "How to get your first backers", href: "/blog/how-to-get-your-first-backers" },
      { label: "Start a project", href: "/start" },
    ],
  },
  {
    slug: "how-to-get-your-first-backers",
    title: "How to Get Your First Backers",
    description:
      "A practical, trust-first plan for finding the first supporters of a new crowdfunding project.",
    excerpt:
      "Your first backers usually come from relevance and trust, not a viral post. Start with a focused launch circle.",
    category: "Guides",
    author: "Backed",
    publishedAt: "2026-09-26",
    updatedAt: "2026-09-26",
    readMinutes: 7,
    draft: false,
    imageConcept:
      "An editorial image of a small diverse group gathered around an early prototype while a creator demonstrates it, candid and trustworthy, no logos or text",
    sections: [
      {
        heading: "Begin with people who understand the problem",
        paragraphs: [
          "The first backers are rarely random strangers. Make a short list of people who experience the problem, follow your work or have helped shape the idea. A relevant group of twenty is more useful than a generic audience of thousands.",
        ],
      },
      {
        heading: "Ask for feedback before asking for money",
        paragraphs: [
          "Show the draft page to a few people and ask what is unclear, unbelievable or missing. Use their language to improve the opening. When you later launch, those contributors already understand the project and may be comfortable sharing it.",
        ],
      },
      {
        heading: "Make personal outreach specific",
        paragraphs: [
          "Explain why you thought of the person, what you are making and the single action you are asking them to take. Do not manufacture urgency or pressure friends into backing. A respectful request earns more durable support.",
        ],
        bullets: [
          "Send the direct project link, not a vague announcement.",
          "Ask relevant people to back, share or give one piece of feedback.",
          "Thank people without turning every conversation into promotion.",
        ],
      },
      {
        heading: "Turn early activity into proof",
        paragraphs: [
          "Share real milestones: the first prototype, first five backers, a production decision or an improved design. Project updates give later visitors evidence that the work is active and the creator is responsive.",
          "Keep looking for communities where the problem is already discussed. Join the conversation with useful context; dropping a link without participating rarely creates trust.",
        ],
      },
    ],
    relatedLinks: [
      { label: "Explore live projects", href: "/discover" },
      { label: "How to crowdfund a project", href: "/blog/how-to-crowdfund-a-project-in-2026" },
      { label: "Start a project", href: "/start" },
    ],
  },
  {
    slug: "flexible-vs-all-or-nothing-crowdfunding",
    title: "Flexible Funding vs All-or-Nothing Crowdfunding",
    description:
      "Compare flexible and all-or-nothing crowdfunding models, including payment timing, risk and creator planning.",
    excerpt:
      "The funding model changes when money moves, what the goal means and what creators must communicate.",
    category: "Crowdfunding",
    author: "Backed",
    publishedAt: "2026-09-26",
    updatedAt: "2026-09-26",
    readMinutes: 7,
    draft: false,
    imageConcept:
      "A sophisticated editorial balance composition with two paths: one continuous stream of project support and one threshold gate, abstract but tactile, no text",
    sections: [
      {
        heading: "The core difference",
        paragraphs: [
          "All-or-nothing crowdfunding collects funds only when a campaign reaches its goal by the deadline. Flexible funding lets successful contributions fund the creator even if the displayed goal is not reached. The choice affects both financial planning and supporter expectations.",
        ],
      },
      {
        heading: "When all-or-nothing is useful",
        paragraphs: [
          "A threshold can protect a project that is impossible below a minimum budget. It creates a clear shared target and avoids asking a creator to deliver an underfunded plan. Kickstarter uses this model, and Indiegogo’s current crowdfunding platform uses fixed funding for new campaigns.",
        ],
      },
      {
        heading: "When flexible funding is useful",
        paragraphs: [
          "Flexible funding works when each backing can meaningfully advance the project or when the creator can scale the plan to the amount raised. Backed uses this model: successful backings are charged immediately and the creator can receive proceeds after applicable fees without the goal acting as a payout threshold.",
          "The creator still needs to explain what different funding levels make possible. A flexible model should not become an excuse for an undefined plan.",
        ],
      },
      {
        heading: "Compare more than the headline model",
        paragraphs: [
          "Review payment timing, refund rules, platform and processing fees, reward capacity and payout requirements. A model that sounds safer in theory can still be a poor fit if the project’s real costs or delivery obligations are misunderstood.",
        ],
      },
      {
        heading: "Choose the promise you can keep",
        paragraphs: [
          "Use all-or-nothing when the project genuinely cannot proceed below a minimum. Use flexible funding when partial support can produce honest, useful progress. Then write the project page so backers can see exactly how the chosen model affects them.",
        ],
      },
    ],
    relatedLinks: [
      { label: "Compare Backed and Kickstarter", href: "/compare/kickstarter" },
      { label: "Compare Backed and Indiegogo", href: "/compare/indiegogo" },
      { label: "Set a crowdfunding goal", href: "/blog/how-to-set-a-crowdfunding-goal" },
    ],
    sources: [
      {
        label: "Kickstarter’s all-or-nothing model",
        href: "https://updates.kickstarter.com/why-is-funding-all-or-nothing/",
      },
      {
        label: "Indiegogo platform changes",
        href: "https://help.indiegogo.com/article/645-what-changed-with-the-platform-upgrade",
      },
    ],
  },
];

export const publishedBlogArticles = articles
  .filter((article) => !article.draft)
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export function getBlogArticle(slug: string) {
  return publishedBlogArticles.find((article) => article.slug === slug) ?? null;
}

export function formatBlogDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
