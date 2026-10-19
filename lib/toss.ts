import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { admin } from "./admin";
import { demoQuotes, symbols } from "./seed";
import type { Quote } from "./types";
const origin = "https://openapi.tossinvest.com";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function request(path: string, init: RequestInit) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(origin + path, {
      ...init,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status === 429 && attempt < 2) {
      await wait(250 * 2 ** attempt);
      continue;
    }
    if (!res.ok)
      throw Error(`시세 공급자 연결 오류 (${res.status}). 거래를 중지했어요.`);
    return res.json();
  }
  throw Error("시세 요청 한도를 초과했어요.");
}
async function token() {
  const { db } = admin();
  const ref = db.doc("serverSecrets/toss");
  const owner = randomUUID();
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data();
      if (d?.accessToken && d.expiresAt > Date.now() + 120000)
        return { token: String(d.accessToken) };
      if (d?.leaseUntil > Date.now()) return { pending: true };
      tx.set(ref, { owner, leaseUntil: Date.now() + 30000 }, { merge: true });
      return { acquired: true };
    });
    if (result.token) return result.token;
    if (result.acquired) {
      try {
        const raw = await request("/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: process.env.TOSS_CLIENT_ID ?? "",
            client_secret: process.env.TOSS_CLIENT_SECRET ?? "",
          }),
        });
        const data = z
          .object({
            access_token: z.string().min(1),
            expires_in: z.number().positive(),
          })
          .parse(raw);
        await ref.set({
          accessToken: data.access_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          leaseUntil: 0,
          owner,
        });
        return data.access_token;
      } catch (error) {
        await ref.set({ leaseUntil: 0 }, { merge: true });
        throw error;
      }
    }
    await wait(500);
  }
  throw Error("시세 인증을 준비하고 있어요. 잠시 후 다시 시도해 주세요.");
}
const pricesSchema = z.object({
  result: z.array(
    z.object({
      symbol: z.string(),
      lastPrice: z.string(),
      currency: z.enum(["KRW", "USD"]),
      timestamp: z.string().nullable().optional(),
    }),
  ),
});
export async function quotes(): Promise<Quote[]> {
  if (process.env.MARKET_DATA_ENABLED !== "true") return demoQuotes();
  if (!process.env.TOSS_CLIENT_ID || !process.env.TOSS_CLIENT_SECRET)
    throw Error("실제 시세 인증 정보가 없어요.");
  const { db } = admin();
  const cache = db.doc("serverCache/quotes");
  const prev = await cache.get();
  if (prev.exists && prev.data()!.expiresAt > Date.now())
    return prev.data()!.quotes as Quote[];
  const bearer = await token();
  const raw = pricesSchema.parse(
    await request(
      "/api/v1/prices?symbols=" + symbols.map((s) => s.symbol).join(","),
      { headers: { Authorization: `Bearer ${bearer}` } },
    ),
  );
  const result: Quote[] = raw.result.map((p) => ({
    symbol: p.symbol,
    name: symbols.find((s) => s.symbol === p.symbol)?.name ?? p.symbol,
    currency: p.currency,
    price: Number(p.lastPrice),
    time: p.timestamp ?? "1970-01-01T00:00:00Z",
    source: "toss",
  }));
  if (result.some((q) => !Number.isFinite(q.price) || q.price <= 0))
    throw Error("시세 응답이 올바르지 않아요.");
  await cache.set({ quotes: result, expiresAt: Date.now() + 15000 });
  return result;
}
export async function assertMarketOpen(symbol: string) {
  const bearer = await token();
  const stockRaw = await request(
    "/api/v1/stocks?symbols=" + encodeURIComponent(symbol),
    { headers: { Authorization: `Bearer ${bearer}` } },
  );
  const stocks = z
    .object({
      result: z.array(
        z.object({
          symbol: z.string(),
          status: z.string(),
          currency: z.string(),
          koreanMarketDetail: z
            .object({ krxTradingSuspended: z.boolean() })
            .nullable(),
        }),
      ),
    })
    .parse(stockRaw).result;
  const stock = stocks.find((s) => s.symbol === symbol);
  if (
    !stock ||
    stock.status !== "ACTIVE" ||
    stock.currency !== "KRW" ||
    stock.koreanMarketDetail?.krxTradingSuspended !== false
  )
    throw Error("거래정지 여부와 국내 종목 상태를 확인할 수 없어요.");
  const raw = await request("/api/v1/market-calendar/KR", {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const session = z
    .object({
      result: z.object({
        today: z.object({
          date: z.string(),
          integrated: z
            .object({
              regularMarket: z
                .object({ startTime: z.string(), endTime: z.string() })
                .nullable(),
            })
            .nullable(),
        }),
      }),
    })
    .parse(raw).result.today;
  const period = session.integrated?.regularMarket;
  const now = Date.now();
  if (
    !period ||
    now < Date.parse(period.startTime) ||
    now >= Date.parse(period.endTime)
  )
    throw Error("국내 정규장 운영 시간에만 모의거래할 수 있어요.");
}
