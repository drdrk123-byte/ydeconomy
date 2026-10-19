import { actorFor, readState, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    return Response.json(await readState(await actorFor(req)), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
