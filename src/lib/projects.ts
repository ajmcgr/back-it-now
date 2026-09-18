import founderJacket from "@/assets/founder-jacket.jpg";
import clearKeyboard from "@/assets/clear-keyboard.jpg";
import modularClock from "@/assets/modular-clock.jpg";
import fieldNotes from "@/assets/field-notes.jpg";
import coffeeBrewer from "@/assets/coffee-brewer.jpg";
import orbitGame from "@/assets/orbit-game.jpg";

export type Project = {
  slug: string; title: string; creator: string; handle: string; initials: string;
  description: string; image: string; category: string; backed: number; goal: number;
  backers: number; days: number; reward: string; price: number;
};

export const projects: Project[] = [
  { slug: "roach-founder-jacket", title: "Roach Founder Jacket", creator: "Alex MacGregor", handle: "@alexmac", initials: "AM", description: "A limited-run jacket made for people building things on the internet.", image: founderJacket, category: "Fashion", backed: 48723, goal: 75000, backers: 327, days: 12, reward: "Founder Jacket", price: 149 },
  { slug: "clearframe-keyboard", title: "Clearframe Keyboard", creator: "Mina Park", handle: "@minapark", initials: "MP", description: "A transparent low-profile mechanical keyboard built for focused desks.", image: clearKeyboard, category: "Technology", backed: 81940, goal: 60000, backers: 518, days: 8, reward: "Clearframe Keyboard", price: 189 },
  { slug: "interval-clock", title: "Interval Clock", creator: "North Studio", handle: "@northstudio", initials: "NS", description: "A modular analog clock designed to make time feel tangible again.", image: modularClock, category: "Design", backed: 32640, goal: 50000, backers: 204, days: 19, reward: "Interval Clock", price: 175 },
  { slug: "after-hours-volume-one", title: "After Hours, Volume One", creator: "Rosa Bell", handle: "@rosabell", initials: "RB", description: "A tactile journal about the people making culture after dark.", image: fieldNotes, category: "Publishing", backed: 22180, goal: 18000, backers: 412, days: 5, reward: "First edition set", price: 58 },
  { slug: "field-coffee-system", title: "Field Coffee System", creator: "Common Object", handle: "@commonobject", initials: "CO", description: "A compact brewer for making exceptional coffee almost anywhere.", image: coffeeBrewer, category: "Food", backed: 67420, goal: 90000, backers: 289, days: 24, reward: "Field Coffee System", price: 220 },
  { slug: "orbit-board-game", title: "Orbit", creator: "Good Measure Games", handle: "@goodmeasure", initials: "GM", description: "A strategic world-building game about balance, ambition, and consequence.", image: orbitGame, category: "Games", backed: 95100, goal: 80000, backers: 741, days: 15, reward: "Orbit first edition", price: 79 },
];

export const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
export const percent = (project: Project) => Math.round((project.backed / project.goal) * 100);