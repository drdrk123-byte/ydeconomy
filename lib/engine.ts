import { z } from "zod";
import type { Actor, State, Quote, Ledger } from "./types";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const money = z.number().int().min(1).max(1000000);
const text = z.string().trim().min(1).max(1000);
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("payroll"),
    period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    type: z.literal("interest"),
    period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    type: z.literal("bonus"),
    studentId: id,
    amount: money,
    note: text,
  }),
  z.object({
    type: z.literal("save"),
    amount: money,
    direction: z.enum(["deposit", "withdraw"]),
  }),
  z.object({ type: z.literal("goal"), name: text, amount: money }),
  z.object({ type: z.literal("transfer"), to: id, amount: money, note: text }),
  z.object({ type: z.literal("buy"), itemId: id }),
  z.object({
    type: z.literal("trade"),
    symbol: z.string().regex(/^[A-Z0-9.-]{1,12}$/),
    quantity: z.number().int().min(1).max(20),
    side: z.enum(["buy", "sell"]),
    reason: z.string().max(1000),
  }),
  z.object({ type: z.literal("assign"), studentId: id, jobId: id }),
  z.object({ type: z.literal("apply"), jobId: id }),
  z.object({ type: z.literal("vote"), proposalId: id }),
  z.object({
    type: z.literal("propose"),
    title: z.string().trim().min(1).max(100),
    description: text,
    cost: money,
  }),
  z.object({ type: z.literal("execute"), proposalId: id }),
  z.object({
    type: z.literal("journal"),
    activity: text,
    reason: text,
    opportunity: text,
    next: text,
  }),
  z.object({ type: z.literal("feedback"), journalId: id, feedback: text }),
  z.object({
    type: z.literal("news"),
    title: z.string().trim().min(1).max(150),
    source: text,
    url: z
      .string()
      .url()
      .max(1000)
      .refine((s) => s.startsWith("https://")),
    question: text,
  }),
  z.object({
    type: z.literal("settings"),
    className: z.string().trim().min(1).max(60),
    currency: z.string().trim().min(1).max(10),
    taxRate: z.number().min(0).max(30),
    interestRate: z.number().min(0).max(10),
    marketOpen: z.boolean(),
    shopOpen: z.boolean(),
    transfersEnabled: z.boolean(),
    transferLimit: money,
    coinKrw: money,
    holdingLimit: z.number().int().min(1).max(100),
    allowedSymbols: z.array(z.string().regex(/^[A-Z0-9.-]{1,12}$/)).max(50),
  }),
  z.object({
    type: z.literal("item"),
    name: z.string().trim().min(1).max(80),
    description: text,
    price: money,
    stock: z.number().int().min(1).max(1000),
    limit: z.number().int().min(1).max(100),
  }),
  z.object({ type: z.literal("reverse"), transactionId: id }),
]);
export type Action = z.infer<typeof actionSchema>;
const teacherOnly = new Set([
  "payroll",
  "interest",
  "bonus",
  "assign",
  "execute",
  "feedback",
  "news",
  "settings",
  "item",
  "reverse",
]);
export function weekKey(time = new Date()) {
  const d = new Date(time.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function applyAction(
  input: State,
  actor: Actor,
  raw: unknown,
  requestId: string,
  quotes: Quote[] = [],
  now = new Date().toISOString(),
): State {
  const action = actionSchema.parse(raw);
  if (teacherOnly.has(action.type) && actor.role !== "teacher")
    throw Error("교사만 실행할 수 있어요.");
  const s = structuredClone(input);
  const me = s.accounts.find((a) => a.id === actor.uid);
  const student = () => {
    if (!me || actor.role !== "student")
      throw Error("학생 계정으로 이용해 주세요.");
    return me;
  };
  const record = (
    studentId: string,
    kind: string,
    amount: number,
    note: string,
    savingsDelta = 0,
    reversalOf?: string,
  ) => {
    const l: Ledger = {
      id: `${requestId}_${s.ledger.length}`,
      actorId: actor.uid,
      studentId,
      kind,
      amount,
      savingsDelta,
      note,
      time: now,
    };
    if (reversalOf) l.reversalOf = reversalOf;
    s.ledger.push(l);
  };
  const get = (uid: string) => {
    const a = s.accounts.find((a) => a.id === uid);
    if (!a) throw Error("학생을 찾을 수 없어요.");
    return a;
  };
  const enough = (balance: number, cost: number) => {
    if (balance < cost) throw Error("잔액이 부족해요.");
  };
  switch (action.type) {
    case "payroll": {
      if (action.period !== weekKey(new Date(now)))
        throw Error("이번 주 지급 기간을 확인해 주세요.");
      if (s.lastPayroll === action.period)
        throw Error("이번 주 월급은 이미 지급했어요.");
      for (const a of s.accounts) {
        const salary = s.jobs.find((j) => j.id === a.jobId)?.salary ?? 200;
        const tax = Math.floor((salary * s.settings.taxRate) / 100);
        a.balance += salary - tax;
        s.budget += tax;
        record(
          a.id,
          "월급",
          salary - tax,
          `총급여 ${salary} · 소득세 ${tax} · ${action.period}`,
        );
      }
      s.lastPayroll = action.period;
      break;
    }
    case "interest": {
      if (action.period !== weekKey(new Date(now)))
        throw Error("이번 주 지급 기간을 확인해 주세요.");
      if (s.lastInterest === action.period)
        throw Error("이번 주 이자는 이미 지급했어요.");
      for (const a of s.accounts) {
        const interest = Math.floor(
          (a.savings * s.settings.interestRate) / 100,
        );
        if (interest) {
          a.savings += interest;
          record(
            a.id,
            "저축 이자",
            0,
            `${s.settings.interestRate}% 주간 이자`,
            interest,
          );
        }
      }
      s.lastInterest = action.period;
      break;
    }
    case "bonus": {
      const a = get(action.studentId);
      a.balance += action.amount;
      record(a.id, "보너스", action.amount, action.note);
      break;
    }
    case "save": {
      const a = student();
      const deposit = action.direction === "deposit";
      enough(deposit ? a.balance : a.savings, action.amount);
      a.balance += deposit ? -action.amount : action.amount;
      a.savings += deposit ? action.amount : -action.amount;
      record(
        a.id,
        deposit ? "저축" : "저축 인출",
        deposit ? -action.amount : action.amount,
        "보통예금 ↔ 저축",
        deposit ? action.amount : -action.amount,
      );
      break;
    }
    case "goal": {
      const a = student();
      a.goal = action.amount;
      a.goalName = action.name;
      break;
    }
    case "transfer": {
      const a = student();
      if (!s.settings.transfersEnabled) throw Error("지금은 송금할 수 없어요.");
      if (action.to === a.id) throw Error("자신에게 보낼 수 없어요.");
      if (action.amount > s.settings.transferLimit)
        throw Error("한 번에 보낼 수 있는 한도를 넘었어요.");
      const day = new Date(now).toLocaleDateString("en-CA", {
        timeZone: "Asia/Seoul",
      });
      s.transferUsage ??= {};
      const usage = s.transferUsage[a.id];
      if (usage?.day === day && usage.count >= 3)
        throw Error("송금은 하루 세 번까지 가능해요.");
      const b = get(action.to);
      enough(a.balance, action.amount);
      a.balance -= action.amount;
      b.balance += action.amount;
      s.transferUsage[a.id] = {
        day,
        count: usage?.day === day ? usage.count + 1 : 1,
      };
      record(a.id, "송금", -action.amount, `${b.name}에게 · ${action.note}`);
      record(
        b.id,
        "송금 받음",
        action.amount,
        `${a.name}에게서 · ${action.note}`,
      );
      break;
    }
    case "buy": {
      const a = student();
      if (!s.settings.shopOpen) throw Error("지금은 상점이 쉬고 있어요.");
      const item = s.items.find((i) => i.id === action.itemId);
      if (!item || item.stock < 1) throw Error("상품이 품절되었어요.");
      const key = `${a.id}_${item.id}`;
      if ((s.purchases[key] ?? 0) >= item.limit)
        throw Error("개인 구매 한도에 도달했어요.");
      enough(a.balance, item.price);
      a.balance -= item.price;
      s.budget += item.price;
      item.stock--;
      s.purchases[key] = (s.purchases[key] ?? 0) + 1;
      record(a.id, "상점 구매", -item.price, item.name);
      break;
    }
    case "trade": {
      const a = student();
      if (!s.settings.marketOpen)
        throw Error("교사가 모의투자를 잠시 멈췄어요.");
      if (!s.settings.allowedSymbols.includes(action.symbol))
        throw Error("허용되지 않은 종목이에요.");
      const q = quotes.find((q) => q.symbol === action.symbol);
      if (!q || q.currency !== "KRW")
        throw Error("이 버전의 실제 체결은 원화 종목만 지원해요.");
      if (
        !Number.isFinite(Date.parse(q.time)) ||
        Date.parse(now) - Date.parse(q.time) > 60000 ||
        Date.parse(q.time) > Date.parse(now) + 5000 ||
        !Number.isFinite(q.price) ||
        q.price <= 0
      )
        throw Error("시세가 만료되었어요. 새로 조회해 주세요.");
      const h = a.holdings[q.symbol] ?? { quantity: 0, cost: 0 };
      const cost = Math.ceil(q.price / s.settings.coinKrw) * action.quantity;
      if (action.side === "buy") {
        if (h.quantity + action.quantity > s.settings.holdingLimit)
          throw Error("한 종목 보유 한도를 넘었어요.");
        enough(a.balance, cost);
        a.balance -= cost;
        h.quantity += action.quantity;
        h.cost += cost;
      } else {
        if (h.quantity < action.quantity) throw Error("보유 주식이 부족해요.");
        const removed = (h.cost * action.quantity) / h.quantity;
        h.quantity -= action.quantity;
        h.cost -= removed;
        a.balance += cost;
      }
      a.holdings[q.symbol] = h;
      record(
        a.id,
        action.side === "buy" ? "주식 매수" : "주식 매도",
        action.side === "buy" ? -cost : cost,
        `${q.name} ${action.quantity}주 · ${action.reason || "이유 미작성"} · ${q.source === "demo" ? "데모 시세" : "실제 시세"}`,
      );
      break;
    }
    case "assign": {
      const a = get(action.studentId);
      const j = s.jobs.find((j) => j.id === action.jobId);
      if (!j) throw Error("직업을 찾을 수 없어요.");
      if (
        a.jobId !== j.id &&
        s.accounts.filter((a) => a.jobId === j.id).length >= j.seats
      )
        throw Error("모집 인원이 찼어요.");
      a.jobId = j.id;
      delete s.applications[a.id];
      break;
    }
    case "apply": {
      const a = student();
      if (!s.jobs.some((j) => j.id === action.jobId))
        throw Error("직업을 확인해 주세요.");
      s.applications[a.id] = action.jobId;
      break;
    }
    case "propose": {
      if (s.proposals.length >= 100)
        throw Error("정책 제안은 학급당 100개까지 보관해요.");
      s.proposals.push({
        id: requestId,
        title: action.title,
        description: action.description,
        cost: action.cost,
        votes: [],
        status: "open",
      });
      break;
    }
    case "vote": {
      const a = student();
      const p = s.proposals.find((p) => p.id === action.proposalId);
      if (!p || p.status !== "open") throw Error("진행 중인 제안이 아니에요.");
      p.votes = p.votes.includes(a.id)
        ? p.votes.filter((v) => v !== a.id)
        : [...p.votes, a.id];
      break;
    }
    case "execute": {
      const p = s.proposals.find((p) => p.id === action.proposalId);
      if (!p || p.status !== "open")
        throw Error("이미 집행되었거나 없는 제안이에요.");
      if (p.votes.length <= s.accounts.length / 2)
        throw Error("학생 과반수의 찬성이 필요해요.");
      enough(s.budget, p.cost);
      s.budget -= p.cost;
      p.status = "executed";
      record("government", "공공예산 집행", -p.cost, p.title);
      break;
    }
    case "journal": {
      const a = student();
      if (s.journals.length >= 200)
        throw Error("보관 한도에 도달했어요. 교사에게 알려 주세요.");
      s.journals.push({
        id: requestId,
        studentId: a.id,
        ...action,
        feedback: "",
        time: now,
      });
      break;
    }
    case "feedback": {
      const j = s.journals.find((j) => j.id === action.journalId);
      if (!j) throw Error("일기를 찾을 수 없어요.");
      j.feedback = action.feedback;
      break;
    }
    case "news": {
      if (s.news.length >= 100) throw Error("뉴스는 100개까지 보관해요.");
      s.news.unshift({ id: requestId, ...action, time: now });
      break;
    }
    case "settings": {
      const { type: _, ...settings } = action;
      s.settings = settings;
      break;
    }
    case "item": {
      const { type: _, ...item } = action;
      s.items.push({ ...item, id: requestId, emoji: "🎁" });
      break;
    }
    case "reverse": {
      const l = s.ledger.find((l) => l.id === action.transactionId);
      if (!l || !["보너스", "저축", "저축 인출", "저축 이자"].includes(l.kind))
        throw Error("이 거래는 자동 보정 대상이 아니에요.");
      if (s.ledger.some((x) => x.reversalOf === l.id))
        throw Error("이미 보정된 거래예요.");
      const a = get(l.studentId);
      enough(a.balance, l.amount);
      enough(a.savings, l.savingsDelta);
      a.balance -= l.amount;
      a.savings -= l.savingsDelta;
      record(a.id, "거래 보정", -l.amount, l.note, -l.savingsDelta, l.id);
      break;
    }
  }
  for (const a of s.accounts) {
    if (
      !Number.isSafeInteger(a.balance) ||
      !Number.isSafeInteger(a.savings) ||
      a.balance < 0 ||
      a.savings < 0
    )
      throw Error("안전한 거래 범위를 벗어났어요.");
  }
  if (!Number.isSafeInteger(s.budget) || s.budget < 0)
    throw Error("예산을 확인해 주세요.");
  return s;
}
export function projectState(s: State, actor: Actor): State {
  if (actor.role === "teacher") return s;
  return {
    ...s,
    accounts: s.accounts.filter((a) => a.id === actor.uid),
    ledger: s.ledger.filter(
      (l) => l.studentId === actor.uid || l.studentId === "government",
    ),
    journals: s.journals.filter((j) => j.studentId === actor.uid),
    applications: Object.fromEntries(
      Object.entries(s.applications).filter(([id]) => id === actor.uid),
    ),
    transferUsage: Object.fromEntries(
      Object.entries(s.transferUsage ?? {}).filter(([id]) => id === actor.uid),
    ),
    purchases: Object.fromEntries(
      Object.entries(s.purchases).filter(([key]) =>
        key.startsWith(`${actor.uid}_`),
      ),
    ),
  };
}
