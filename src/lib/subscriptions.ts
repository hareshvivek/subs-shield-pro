export type BillingCycle = "Weekly" | "Monthly" | "Annual";

export type Splitter = { id: string; email: string; percent: number };

export type SubSource = "email" | "manual";
export type SubStatus = "active" | "auto-canceled";

export type Subscription = {
  id: string;
  name: string;
  cost: number;
  cycle: BillingCycle;
  renewalDate: string; // ISO
  category: string;
  shared: boolean;
  splitters: Splitter[];
  cancelUrl: string;
  color: string;
  initials: string;
  lastUsedDaysAgo: number;
  source?: SubSource;
  status?: SubStatus;
};

const today = new Date();
const inDays = (d: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString();
};

export const seedSubscriptions: Subscription[] = [
  {
    id: "1",
    name: "Netflix",
    cost: 22.99,
    cycle: "Monthly",
    renewalDate: inDays(2),
    category: "Entertainment",
    shared: true,
    splitters: [
      { id: "a", email: "alex@home.io", percent: 50 },
      { id: "b", email: "you@subshield.app", percent: 50 },
    ],
    cancelUrl: "https://www.netflix.com/cancelplan",
    color: "#E50914",
    initials: "N",
    lastUsedDaysAgo: 1,
  },
  {
    id: "2",
    name: "Spotify Family",
    cost: 16.99,
    cycle: "Monthly",
    renewalDate: inDays(5),
    category: "Music",
    shared: true,
    splitters: [
      { id: "a", email: "alex@home.io", percent: 34 },
      { id: "b", email: "sam@home.io", percent: 33 },
      { id: "c", email: "you@subshield.app", percent: 33 },
    ],
    cancelUrl: "https://www.spotify.com/account/subscription/",
    color: "#1DB954",
    initials: "S",
    lastUsedDaysAgo: 0,
  },
  {
    id: "3",
    name: "Adobe Creative Cloud",
    cost: 59.99,
    cycle: "Monthly",
    renewalDate: inDays(11),
    category: "Productivity",
    shared: false,
    splitters: [],
    cancelUrl: "https://account.adobe.com/plans",
    color: "#FF0000",
    initials: "Ai",
    lastUsedDaysAgo: 14,
  },
  {
    id: "4",
    name: "iCloud+ 2TB",
    cost: 9.99,
    cycle: "Monthly",
    renewalDate: inDays(6),
    category: "Storage",
    shared: false,
    splitters: [],
    cancelUrl: "https://support.apple.com/icloud",
    color: "#0A84FF",
    initials: "iC",
    lastUsedDaysAgo: 0,
  },
  {
    id: "5",
    name: "NYT Digital",
    cost: 4.25,
    cycle: "Weekly",
    renewalDate: inDays(3),
    category: "News",
    shared: false,
    splitters: [],
    cancelUrl: "https://myaccount.nytimes.com/seg/subscription",
    color: "#000000",
    initials: "NY",
    lastUsedDaysAgo: 22,
  },
  {
    id: "6",
    name: "ChatGPT Plus",
    cost: 20,
    cycle: "Monthly",
    renewalDate: inDays(18),
    category: "AI Tools",
    shared: false,
    splitters: [],
    cancelUrl: "https://chat.openai.com/#settings",
    color: "#10A37F",
    initials: "GP",
    lastUsedDaysAgo: 0,
  },
  {
    id: "7",
    name: "Notion Plus",
    cost: 96,
    cycle: "Annual",
    renewalDate: inDays(34),
    category: "Productivity",
    shared: false,
    splitters: [],
    cancelUrl: "https://www.notion.so/my-account",
    color: "#111111",
    initials: "No",
    lastUsedDaysAgo: 3,
  },
  {
    id: "8",
    name: "HBO Max",
    cost: 15.99,
    cycle: "Monthly",
    renewalDate: inDays(1),
    category: "Entertainment",
    shared: true,
    splitters: [
      { id: "a", email: "jordan@home.io", percent: 60 },
      { id: "b", email: "you@subshield.app", percent: 40 },
    ],
    cancelUrl: "https://play.max.com/account",
    color: "#7B61FF",
    initials: "HB",
    lastUsedDaysAgo: 9,
  },
];

export const monthlyCost = (s: Subscription) =>
  s.cycle === "Monthly" ? s.cost : s.cycle === "Annual" ? s.cost / 12 : s.cost * 4.345;

export const daysUntil = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
