import { actorFor, transact, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const actor = await actorFor(req);
    const key = req.headers.get("Idempotency-Key");
    if (!key || !key.match(/^[\w-]{10,100}$/))
      return Response.json({ error: "거래 번호가 필요해요." }, { status: 400 });
    if (Number(req.headers.get("content-length") ?? 0) > 16000)
      return Response.json({ error: "요청이 너무 커요." }, { status: 413 });
    return Response.json(await transact(actor, await req.json(), key));
  } catch (e) {
    return errorResponse(e);
  }
}
