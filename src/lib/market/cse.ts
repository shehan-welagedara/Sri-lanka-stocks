// Adapter for the public endpoints that power cse.lk. Unofficial: every call is
// cached, time-limited and falls back to stale data, then to the sample market.
// Swap this file for a licensed vendor feed without touching the rest of the app.
import type { Announcement, CompanyInfo, IndexQuote, Point, Quote, Range, Sector } from "./types";

const BASE = "https://www.cse.lk/api/";
type Entry = { at: number; data: unknown };
const g = globalThis as unknown as { __cseCache?: Map<string, Entry>; __cseInflight?: Map<string, Promise<unknown>> };
const cache = (g.__cseCache ??= new Map());
const inflight = (g.__cseInflight ??= new Map());

async function post<T>(endpoint: string, body: Record<string, string | number>, ttlMs: number): Promise<T> {
  const key = endpoint + JSON.stringify(body);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const run = (async () => {
    try {
      const res = await fetch(BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString(),
        signal: AbortSignal.timeout(9000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`CSE ${endpoint} ${res.status}`);
      const data = (await res.json()) as T;
      cache.set(key, { at: Date.now(), data });
      return data;
    } catch (e) {
      if (hit) return hit.data as T; // serve stale rather than fail
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
export const tickerOf = (symbol: string) => {
  const [code, cls = ""] = symbol.split(".");
  return cls.startsWith("N") || !cls ? code : `${code}.${cls[0]}`;
};

type RawTrade = Record<string, unknown> & { id: number; name: string; symbol: string };

export async function quotes(): Promise<Quote[]> {
  const d = await post<{ reqTradeSummery: RawTrade[] }>("tradeSummary", {}, 30_000);
  return (d.reqTradeSummery || [])
    .filter((r) => r.symbol && num(r.price) > 0)
    .map((r) => ({
      id: r.id,
      symbol: r.symbol,
      ticker: tickerOf(r.symbol),
      name: r.name,
      price: num(r.price),
      change: num(r.change),
      changePct: num(r.percentageChange),
      prevClose: num(r.previousClose),
      open: num(r.open),
      high: num(r.high),
      low: num(r.low),
      volume: num(r.sharevolume),
      turnover: num(r.turnover),
      trades: num(r.tradevolume),
      marketCap: num(r.marketCap),
      lastTraded: num(r.lastTradedTime),
    }));
}

type RawIndex = { value: number; change: number; percentage: number; highValue: number; lowValue: number; timestamp: number };
export async function indices(): Promise<IndexQuote[]> {
  const [a, s] = await Promise.all([post<RawIndex>("aspiData", {}, 30_000), post<RawIndex>("snpData", {}, 30_000)]);
  const mk = (code: "ASPI" | "SNP", name: string, r: RawIndex): IndexQuote => ({
    code, name, value: num(r.value), change: num(r.change), changePct: num(r.percentage), high: num(r.highValue), low: num(r.lowValue), ts: num(r.timestamp),
  });
  return [mk("ASPI", "All Share Price Index", a), mk("SNP", "S&P Sri Lanka 20", s)];
}

export async function status(): Promise<string> {
  return (await post<{ status: string }>("marketStatus", {}, 60_000)).status || "Unknown";
}

export async function sectors(): Promise<Sector[]> {
  const d = await post<Record<string, unknown>[]>("allSectors", {}, 60_000);
  return d.map((r) => ({
    symbol: String(r.symbol), name: String(r.name), value: num(r.indexValue), change: num(r.change), changePct: num(r.percentage), turnover: num(r.sectorTurnoverToday),
  }));
}

const PERIOD: Record<Range, number> = { "1D": 1, "1W": 2, "1M": 3, "3M": 4, "1Y": 5 };
const HIST_TTL = (r: Range) => (r === "1D" ? 60_000 : 15 * 60_000);

export async function stockHistory(stockId: number, range: Range): Promise<Point[]> {
  const d = await post<{ chartData: { t: number; p: number; q?: number; h?: number; l?: number }[] }>(
    "companyChartDataByStock", { stockId, period: PERIOD[range] }, HIST_TTL(range));
  return (d.chartData || []).filter((x) => num(x.p) > 0).map((x) => ({ t: x.t, p: x.p, v: num(x.q), h: x.h ?? undefined, l: x.l ?? undefined }));
}

export async function indexHistory(code: "ASPI" | "SNP", range: Range): Promise<Point[]> {
  const d = await post<{ d: number; v: number }[]>(
    "chartData", { symbol: code, chartId: code === "ASPI" ? 1 : 40, period: PERIOD[range] }, HIST_TTL(range));
  return (d || []).filter((x) => num(x.v) > 0).map((x) => ({ t: x.d, p: x.v }));
}

export async function companyInfo(symbol: string): Promise<CompanyInfo> {
  const d = await post<{ reqSymbolInfo?: Record<string, unknown>; reqSymbolBetaInfo?: Record<string, unknown> }>(
    "companyInfoSummery", { symbol }, 10 * 60_000);
  const s = d.reqSymbolInfo || {};
  return {
    isin: s.isin ? String(s.isin) : undefined,
    issued: num(s.quantityIssued) || undefined,
    beta: num(d.reqSymbolBetaInfo?.triASIBetaValue) || undefined,
    hi52: num(s.p12HiPrice) || undefined,
    lo52: num(s.p12LowPrice) || undefined,
    ytdHi: num(s.ytdHiPrice) || undefined,
    ytdLo: num(s.ytdLowPrice) || undefined,
    allHi: num(s.allHiPrice) || undefined,
    allLo: num(s.allLowPrice) || undefined,
    ytdVolume: num(s.ytdShareVolume) || undefined,
    listed: s.issueDate ? String(s.issueDate) : undefined,
  };
}

const title = (s: string) => s.toLowerCase().replace(/(^|\s|\()\S/g, (c) => c.toUpperCase());

export async function announcements(): Promise<Announcement[]> {
  const [a, f] = await Promise.allSettled([
    post<{ approvedAnnouncements: Record<string, unknown>[] }>("approvedAnnouncement", {}, 120_000),
    post<{ reqFinancialAnnouncemnets: Record<string, unknown>[] }>("getFinancialAnnouncement", {}, 120_000),
  ]);
  const out: Announcement[] = [];
  if (a.status === "fulfilled")
    for (const r of a.value.approvedAnnouncements || [])
      out.push({ id: `a${r.id}`, kind: "disclosure", company: String(r.company || ""), title: title(String(r.announcementCategory || "Announcement")), ts: num(r.createdDate) });
  if (f.status === "fulfilled")
    for (const r of (f.value.reqFinancialAnnouncemnets || []).slice(0, 40)) {
      const ts = Date.parse(String(r.uploadedDate || "").replace(/(\d{2}:\d{2}:\d{2}) (AM|PM)/, "$1 $2 GMT+0530"));
      out.push({
        id: `f${r.id}`, kind: "financial", company: String(r.name || ""), title: String(r.fileText || "Financial statements"),
        ts: isFinite(ts) ? ts : 0, url: r.path ? `https://cdn.cse.lk/${encodeURI(String(r.path))}` : undefined,
      });
    }
  if (!out.length) throw new Error("no announcements");
  return out.filter((x) => x.ts > 0).sort((x, y) => y.ts - x.ts).slice(0, 60);
}
