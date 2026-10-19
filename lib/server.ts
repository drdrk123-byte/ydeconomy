import "server-only";
import { createHash } from "node:crypto";
import { admin } from "./admin";
import { applyAction, projectState, actionSchema } from "./engine";
import { demoQuotes } from "./seed";
import { quotes as marketQuotes, assertMarketOpen } from "./toss";
import type { Actor, State, Ledger } from "./types";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function actorFor(req: Request): Promise<Actor> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "로그인해 주세요.");
  let user;
  try {
    user = await admin().auth.verifyIdToken(token, true);
  } catch {
    throw new HttpError(401, "로그인을 다시 해 주세요.");
  }
  if (
    !["teacher", "student"].includes(user.role) ||
    typeof user.classId !== "string" ||
    !user.classId.match(/^[\w-]{1,100}$/)
  )
    throw new HttpError(403, "등록된 학급 계정이 필요해요.");
  if (user.mustChangePassword)
    throw new HttpError(403, "처음 받은 비밀번호를 변경해 주세요.");
  return { uid: user.uid, role: user.role, classId: user.classId };
}
export async function readState(actor: Actor) {
  const { db } = admin();
  const ref = db.doc(`classes/${actor.classId}/private/economy`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "학급을 먼저 생성해 주세요.");
  const data = snap.data() as State;
  const collection = db.collection(`classes/${actor.classId}/ledger`);
  const query =
    actor.role === "teacher"
      ? collection.orderBy("time", "desc").limit(200)
      : collection
          .where("studentId", "==", actor.uid)
          .orderBy("time", "desc")
          .limit(200);
  const logs = await query.get();
  const state = projectState(
    { ...data, ledger: logs.docs.map((d) => d.data() as Ledger).reverse() },
    actor,
  );
  return {
    state,
    actor,
    directory: data.accounts.map((a) => ({ id: a.id, name: a.name })),
    mode: "firebase" as const,
  };
}
export async function transact(actor: Actor, raw: unknown, key: string) {
  const action = actionSchema.parse(raw);
  const { db } = admin();
  const root = `classes/${actor.classId}`;
  const opId = createHash("sha256").update(`${actor.uid}:${key}`).digest("hex");
  const opRef = db.doc(`${root}/operations/${opId}`);
  const stateRef = db.doc(`${root}/private/economy`);
  const hash = createHash("sha256")
    .update(JSON.stringify(action))
    .digest("hex");
  let market = demoQuotes();
  if (action.type === "trade") {
    market = await marketQuotes();
    if (market.some((q) => q.source === "toss"))
      await assertMarketOpen(action.symbol);
  }
  await db.runTransaction(
    async (tx) => {
      const [snap, op] = await Promise.all([tx.get(stateRef), tx.get(opRef)]);
      if (op.exists) {
        if (op.data()?.hash !== hash)
          throw new HttpError(409, "같은 거래 번호에 다른 요청이 들어왔어요.");
        return;
      }
      if (!snap.exists) throw new HttpError(404, "학급을 찾을 수 없어요.");
      const stored = snap.data() as State;
      let ledger: Ledger[] = [];
      // Query history inside the transaction for transfer limits and reversal protection.

      if (action.type === "reverse") {
        const l = await tx.get(
          db.doc(`${root}/ledger/${action.transactionId}`),
        );
        if (l.exists) ledger = [l.data() as Ledger];
        const rev = await tx.get(
          db.doc(`${root}/reversals/${action.transactionId}`),
        );
        if (rev.exists) throw new HttpError(409, "이미 보정된 거래예요.");
      }
      const before = ledger.length;
      const updated = applyAction(
        { ...stored, ledger },
        actor,
        action,
        opId,
        market,
      );
      const additions = updated.ledger.slice(before);
      tx.set(stateRef, { ...updated, ledger: [] });
      for (const entry of additions)
        tx.create(db.doc(`${root}/ledger/${entry.id}`), entry);
      tx.create(opRef, {
        uid: actor.uid,
        hash,
        action: action.type,
        time: new Date().toISOString(),
      });
      if (action.type === "reverse")
        tx.create(db.doc(`${root}/reversals/${action.transactionId}`), {
          operationId: opId,
        });
    },
    { maxAttempts: 10 },
  );
  return readState(actor);
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json(
      { error: "입력한 값의 범위와 형식을 확인해 주세요." },
      { status: 400 },
    );
  const message =
    error instanceof Error ? error.message : "요청을 완료하지 못했어요.";
  if (message.includes("Firebase 서버"))
    return Response.json({ error: message }, { status: 503 });
  return Response.json(
    { error: message.replace(/\b(?:tsck_|s_)[\w-]+/g, "[비공개]") },
    { status: 400 },
  );
}
