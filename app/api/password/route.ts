import { z } from "zod";
import { admin } from "@/lib/admin";
import { errorResponse, HttpError } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token) throw new HttpError(401, "다시 로그인해 주세요.");
    const { auth } = admin();
    const user = await auth.verifyIdToken(token, true);
    if (user.role !== "student" || user.mustChangePassword !== true)
      throw new HttpError(403, "초기 비밀번호 변경 대상이 아니에요.");
    const { password } = z
      .object({ password: z.string().min(12).max(100) })
      .parse(await req.json());
    await auth.updateUser(user.uid, { password });
    const record = await auth.getUser(user.uid);
    await auth.setCustomUserClaims(user.uid, {
      ...record.customClaims,
      mustChangePassword: false,
    });
    await auth.revokeRefreshTokens(user.uid);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
