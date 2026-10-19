import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { admin } from "@/lib/admin";
import { actorFor, errorResponse, HttpError } from "@/lib/server";
import type { State } from "@/lib/types";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const created: string[] = [];
  try {
    const actor = await actorFor(req);
    if (actor.role !== "teacher")
      throw new HttpError(403, "교사만 학생 계정을 만들 수 있어요.");
    const { names } = z
      .object({
        names: z.array(z.string().trim().min(1).max(30)).min(1).max(35),
      })
      .parse(await req.json());
    const { db, auth } = admin();
    const ref = db.doc(`classes/${actor.classId}/private/economy`);
    const credentials: {
      id: string;
      name: string;
      email: string;
      password: string;
    }[] = [];
    for (const name of names) {
      const id = "s" + randomUUID().replaceAll("-", "").slice(0, 14);
      const email = `${actor.classId}.${id}@students.invalid`;
      const password = randomBytes(12).toString("base64url");
      await auth.createUser({ uid: id, email, password, displayName: name });
      created.push(id);
      await auth.setCustomUserClaims(id, {
        role: "student",
        classId: actor.classId,
        mustChangePassword: true,
      });
      credentials.push({ id, name, email, password });
    }
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Error("학급을 먼저 생성해 주세요.");
      const state = snap.data() as State;
      if (state.accounts.length + names.length > 35)
        throw Error("한 학급은 학생 35명까지 등록할 수 있어요.");
      tx.update(ref, {
        accounts: [
          ...state.accounts,
          ...credentials.map((c) => ({
            id: c.id,
            name: c.name,
            jobId: "",
            balance: 1000,
            savings: 0,
            holdings: {},
            goal: 2000,
            goalName: "나의 저축 목표",
          })),
        ],
      });
      for (const c of credentials)
        tx.create(db.doc(`classes/${actor.classId}/ledger/initial_${c.id}`), {
          id: `initial_${c.id}`,
          actorId: actor.uid,
          studentId: c.id,
          kind: "초기 자산",
          amount: 1000,
          savingsDelta: 0,
          note: "학급 참여 초기 자산",
          time: new Date().toISOString(),
        });
    });
    return Response.json(
      { credentials },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (created.length) {
      await admin()
        .auth.deleteUsers(created)
        .catch(() => {});
    }
    return errorResponse(e);
  }
}
