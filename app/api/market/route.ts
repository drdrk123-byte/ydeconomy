import { actorFor, errorResponse } from "@/lib/server";
import { quotes } from "@/lib/toss";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    await actorFor(req);
    return Response.json(
      { quotes: await quotes() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
