import type { ProjectMediaItem } from "@/lib/project-media";

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
  creatorAvatarUrl?: string | null;
  handle: string;
  initials: string;
  description: string;
  story: string[];
  coverImage: string;
  gallery: string[];
  media?: ProjectMediaItem[];
  category: string;
  location: string;
  projectDates: string;
  externalWebsite: string;
  status: "draft" | "prelaunch" | "live" | "cancelling" | "cancelled" | "funded" | "closed";
  cancellationComplete?: boolean;
  plannedLaunchAt?: string | null;
  createdAt?: string | null;
  latestBackedAt?: string | null;
  deadline: string;
  initialBackedAmount: number;
  successfulBackingAmount: number;
  successfulBackingCount: number;
  commentCount: number;
  favoriteCount: number;
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
    commentCount: 0,
    favoriteCount: 0,
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

export function plainTextExcerpt(value: string | null | undefined) {
  if (!value) return "";

  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/(^|\n)\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)/g, "$1")
    .replace(/(\*\*|__|~~|`)(.*?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function projectExcerpt(project: Pick<Project, "tagline" | "description">) {
  return plainTextExcerpt(project.tagline) || plainTextExcerpt(project.description);
}

export function plannedLaunchLabel(project: Project, now = new Date()) {
  if (!project.plannedLaunchAt) return "Coming soon";
  const plannedLaunch = new Date(project.plannedLaunchAt);
  if (!Number.isFinite(plannedLaunch.getTime()) || plannedLaunch.getTime() <= now.getTime()) {
    return "Coming soon";
  }
  const includeYear = plannedLaunch.getFullYear() !== now.getFullYear();
  return `Launching ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(plannedLaunch)}`;
}

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
