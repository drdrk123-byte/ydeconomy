export type Role = "teacher" | "student";
export type Actor = { uid: string; role: Role; classId: string };
export type Account = {
  id: string;
  name: string;
  jobId: string;
  balance: number;
  savings: number;
  holdings: Record<string, { quantity: number; cost: number }>;
  goal: number;
  goalName: string;
};
export type Settings = {
  className: string;
  currency: string;
  taxRate: number;
  interestRate: number;
  marketOpen: boolean;
  transfersEnabled: boolean;
  transferLimit: number;
  coinKrw: number;
  allowedSymbols: string[];
  holdingLimit: number;
  shopOpen: boolean;
};
export type Job = {
  id: string;
  name: string;
  description: string;
  salary: number;
  seats: number;
};
export type Item = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  emoji: string;
  limit: number;
};
export type Ledger = {
  id: string;
  actorId: string;
  studentId: string;
  kind: string;
  amount: number;
  savingsDelta: number;
  note: string;
  time: string;
  reversalOf?: string;
};
export type Proposal = {
  id: string;
  title: string;
  description: string;
  cost: number;
  votes: string[];
  status: "open" | "executed";
};
export type Journal = {
  id: string;
  studentId: string;
  activity: string;
  reason: string;
  opportunity: string;
  next: string;
  feedback: string;
  time: string;
};
export type Lesson = {
  id: string;
  title: string;
  concept: string;
  question: string;
  goal: string;
};
export type News = {
  id: string;
  title: string;
  url: string;
  source: string;
  question: string;
  time: string;
};
export type State = {
  version: 1;
  settings: Settings;
  accounts: Account[];
  jobs: Job[];
  items: Item[];
  budget: number;
  ledger: Ledger[];
  proposals: Proposal[];
  journals: Journal[];
  news: News[];
  lessons: Lesson[];
  purchases: Record<string, number>;
  applications: Record<string, string>;
  transferUsage?: Record<string, { day: string; count: number }>;
  lastPayroll: string;
  lastInterest: string;
};
export type Quote = {
  symbol: string;
  name: string;
  currency: "KRW" | "USD";
  price: number;
  time: string;
  source: "demo" | "toss";
  change?: number;
};
