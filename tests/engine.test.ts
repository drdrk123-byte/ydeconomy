import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAction, projectState, weekKey } from "../lib/engine";
import { initialState, demoQuotes } from "../lib/seed";
import type { Actor, State } from "../lib/types";
const teacher: Actor = { uid: "teacher", role: "teacher", classId: "demo" };
const student: Actor = { uid: "s1", role: "student", classId: "demo" };
const now = "2026-10-19T01:30:00.000Z";
let sequence = 0;
const run = (s: State, a: unknown, actor = student) =>
  applyAction(
    s,
    actor,
    a,
    `operation-${++sequence}`,
    demoQuotes().map((q) => ({ ...q, time: now })),
    now,
  );
test("월급 세금·실수령액이 원자적으로 맞고 중복 지급을 막는다", () => {
  const s = initialState();
  const total = s.accounts.reduce((t, a) => t + a.balance, 0) + s.budget;
  const n = run(s, { type: "payroll", period: "2026-10-19" }, teacher);
  assert.equal(n.accounts[0].balance, s.accounts[0].balance + 270);
  assert.equal(
    n.accounts.reduce((t, a) => t + a.balance, 0) + n.budget - total,
    s.accounts.reduce(
      (t, a) => t + s.jobs.find((j) => j.id === a.jobId)!.salary,
      0,
    ),
  );
  assert.throws(
    () => run(n, { type: "payroll", period: "2026-10-19" }, teacher),
    /이미/,
  );
  assert.equal(s.lastPayroll, "");
});
test("학생은 교사 권한을 얻지 못한다", () => {
  for (const type of ["bonus", "settings", "payroll"]) {
    const action =
      type === "bonus"
        ? { type, studentId: "s1", amount: 100, note: "test" }
        : type === "settings"
          ? { type, ...initialState().settings }
          : { type, period: "2026-10-19" };
    assert.throws(() => run(initialState(), action), /교사/);
  }
});
test("저축은 총자산을 바꾸지 않고 부족한 잔액을 차단한다", () => {
  const s = initialState();
  const n = run(s, { type: "save", direction: "deposit", amount: 500 });
  assert.equal(n.accounts[0].balance, 500);
  assert.equal(n.accounts[0].savings, 700);
  assert.throws(
    () => run(n, { type: "save", direction: "withdraw", amount: 701 }),
    /잔액/,
  );
  assert.throws(() =>
    run(n, { type: "save", direction: "deposit", amount: -100 }),
  );
});
test("재고와 개인 구매 한도·예산 반영", () => {
  const s = initialState();
  s.items[0].stock = 1;
  const n = run(s, { type: "buy", itemId: "plant" });
  assert.equal(n.items[0].stock, 0);
  assert.equal(n.budget, s.budget + 180);
  assert.throws(() => run(n, { type: "buy", itemId: "plant" }), /품절/);
  n.items[0].stock = 1;
  assert.throws(() => run(n, { type: "buy", itemId: "plant" }), /한도/);
});
test("공공예산은 과반 동의와 예산 여유가 필요하고 한 번만 집행된다", () => {
  const s = initialState();
  assert.throws(
    () => run(s, { type: "execute", proposalId: "p1" }, teacher),
    /과반수/,
  );
  s.proposals[0].votes = s.accounts.slice(0, 17).map((a) => a.id);
  const n = run(s, { type: "execute", proposalId: "p1" }, teacher);
  assert.equal(n.budget, 1600);
  assert.throws(
    () => run(n, { type: "execute", proposalId: "p1" }, teacher),
    /이미/,
  );
});
test("학생 응답에는 다른 학생 계좌·일기·거래를 포함하지 않는다", () => {
  let s = run(initialState(), {
    type: "journal",
    activity: "저축",
    reason: "목표",
    opportunity: "소비",
    next: "계획",
  });
  s = run(
    s,
    { type: "save", direction: "deposit", amount: 100 },
    { ...student, uid: "s2" },
  );
  const view = projectState(s, { ...student, uid: "s2" });
  assert.equal(view.accounts.length, 1);
  assert.equal(view.accounts[0].id, "s2");
  assert.equal(view.journals.length, 0);
  assert.ok(view.ledger.every((l) => l.studentId === "s2"));
});
test("송금 허용·횟수·한도 및 양측 합계 보존", () => {
  const s = initialState();
  assert.throws(
    () => run(s, { type: "transfer", to: "s2", amount: 10, note: "공동활동" }),
    /송금할 수/,
  );
  s.settings.transfersEnabled = true;
  let n = s;
  const total = s.accounts[0].balance + s.accounts[1].balance;
  for (let i = 0; i < 3; i++)
    n = run(n, { type: "transfer", to: "s2", amount: 10, note: "공동활동" });
  assert.equal(n.accounts[0].balance + n.accounts[1].balance, total);
  assert.throws(
    () => run(n, { type: "transfer", to: "s2", amount: 10, note: "공동활동" }),
    /세 번/,
  );
  assert.throws(
    () => run(s, { type: "transfer", to: "s2", amount: 101, note: "공동활동" }),
    /한도/,
  );
});
test("보정은 원본을 보존하고 이중 보정을 차단한다", () => {
  let s = run(
    initialState(),
    { type: "bonus", studentId: "s1", amount: 100, note: "기여" },
    teacher,
  );
  const id = s.ledger[0].id;
  s = run(s, { type: "reverse", transactionId: id }, teacher);
  assert.equal(s.accounts[0].balance, 1000);
  assert.equal(s.ledger.length, 2);
  assert.equal(s.ledger[1].reversalOf, id);
  assert.throws(
    () => run(s, { type: "reverse", transactionId: id }, teacher),
    /이미/,
  );
});
test("주식 주문은 부족한 자산·보유 한도·금지 종목·공매도를 차단한다", () => {
  const a = {
    type: "trade",
    symbol: "005930",
    quantity: 2,
    side: "buy",
    reason: "반도체",
  };
  let s = run(initialState(), a);
  assert.equal(s.accounts[0].balance, 856);
  assert.equal(s.accounts[0].holdings["005930"].quantity, 2);
  s = run(s, { ...a, side: "sell" });
  assert.equal(s.accounts[0].balance, 1000);
  assert.equal(s.accounts[0].holdings["005930"].quantity, 0);
  assert.throws(() => run(s, { ...a, side: "sell" }), /부족/);
  assert.throws(() => run(s, { ...a, symbol: "NOPE" }), /허용/);
  assert.throws(() => run(s, { ...a, quantity: 20 }), /잔액/);
});
test("묶음·분할 주문에 반올림 차익이 생기지 않는다", () => {
  const s = initialState();
  const qs = demoQuotes().map((q) => ({ ...q, price: 72123, time: now }));
  const a = {
    type: "trade",
    symbol: "005930",
    quantity: 3,
    side: "buy",
    reason: "",
  };
  let n = applyAction(s, student, a, "rounding1", qs, now);
  for (let i = 0; i < 3; i++)
    n = applyAction(
      n,
      student,
      { ...a, quantity: 1, side: "sell" },
      `rounding${i + 2}`,
      qs,
      now,
    );
  assert.equal(n.accounts[0].balance, s.accounts[0].balance);
});
test("만료·미래·잘못된 시세를 모두 차단한다", () => {
  const s = initialState();
  const a = {
    type: "trade",
    symbol: "005930",
    quantity: 1,
    side: "buy",
    reason: "",
  };
  for (const time of [
    "2026-10-19T01:28:00Z",
    "2026-10-19T01:31:00Z",
    "not-a-date",
  ])
    assert.throws(
      () =>
        applyAction(
          s,
          student,
          a,
          "stale",
          demoQuotes().map((q) => ({ ...q, time })),
          now,
        ),
      /만료/,
    );
});
test("이자 지급은 정수로 계산하고 같은 주 중복을 막는다", () => {
  const s = initialState();
  const n = run(s, { type: "interest", period: "2026-10-19" }, teacher);
  assert.equal(n.accounts[0].savings, 204);
  assert.throws(
    () => run(n, { type: "interest", period: "2026-10-19" }, teacher),
    /이미/,
  );
});
test("주간 지급 기준은 한국 시간 월요일이다", () => {
  assert.equal(weekKey(new Date("2026-10-18T16:00:00Z")), "2026-10-19");
  assert.equal(weekKey(new Date("2026-10-18T14:00:00Z")), "2026-10-12");
});
