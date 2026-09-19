export type Reward = {
  name: string;
  description: string;
  minimumAmount?: number;
  includes: string[];
  totalQuantity: number | null;
  successfulBackingCount: number;
  availabilityLabel: string;
};

export type Project = {
  slug: string;
  title: string;
  tagline: string;
  creator: string;
  creatorUsername?: string;
  handle: string;
  initials: string;
  description: string;
  story: string[];
  coverImage: string;
  gallery: string[];
  category: string;
  location: string;
  projectDates: string;
  externalWebsite: string;
  status: "draft" | "live" | "funded" | "closed";
  deadline: string;
  initialBackedAmount: number;
  successfulBackingAmount: number;
  successfulBackingCount: number;
  goal: number;
  reward: Reward;
};

export const projects: Project[] = [
  {
    slug: "launch-island",
    title: "Launch Island",
    tagline: "6 indie hackers. One tropical island. One week to build.",
    creator: "Launch Island",
    handle: "launchisland.org",
    initials: "LI",
    description:
      "Spend a week in Thailand with five other indie hackers building, shipping and living together.",
    story: [
      "Launch Island brings six indie hackers together in Thailand for one week to build.",
      "No conference. No speakers. No networking badges.",
      "Just six builders, one villa, seven days, and whatever we can ship by the end of it.",
      "The first Launch Island will take place from November 1–8, 2026.",
      "Back the project by reserving one of the six Founding Guest spots. Each successful backing helps make Launch Island happen.",
    ],
    coverImage: "/projects/launch-island/cover.jpeg",
    gallery: [
      "/projects/launch-island/cover.jpeg",
      "/projects/launch-island/gallery-2.jpeg",
      "/projects/launch-island/gallery-3.jpeg",
    ],
    category: "Technology",
    location: "Thailand",
    projectDates: "November 1–8, 2026",
    externalWebsite: "https://launchisland.org",
    status: "live",
    deadline: "2026-11-01T00:00:00+07:00",
    initialBackedAmount: 100,
    successfulBackingAmount: 0,
    successfulBackingCount: 0,
    goal: 1000,
    reward: {
      name: "Founding Guest",
      description: "One of only six spots at the first Launch Island.",
      minimumAmount: 1000,
      includes: [
        "Seven nights at the Launch Island villa",
        "Shared working and living spaces",
        "Participation in the full Launch Island week",
        "November 1–8, 2026",
        "Thailand",
      ],
      totalQuantity: 6,
      successfulBackingCount: 0,
      availabilityLabel: "spots",
    },
  },
];

export const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

export const amountBacked = (project: Project) =>
  project.initialBackedAmount + project.successfulBackingAmount;

export const percent = (project: Project) =>
  Math.round((amountBacked(project) / project.goal) * 100);

export const daysRemaining = (project: Project, now = new Date()) =>
  Math.max(0, Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / 86_400_000));

export const rewardRemaining = (reward: Reward) =>
  reward.totalQuantity === null
    ? null
    : Math.max(0, reward.totalQuantity - reward.successfulBackingCount);

export const rewardAvailability = (reward: Reward) => {
  const remaining = rewardRemaining(reward);

  if (remaining === null) return null;
  if (reward.successfulBackingCount === 0) {
    return `${remaining} ${reward.availabilityLabel} available`;
  }

  return `${remaining} of ${reward.totalQuantity} ${reward.availabilityLabel} remaining`;
};
