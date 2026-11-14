import * as cse from "./cse";
import * as sample from "./sample";
import type { Announcement, CompanyInfo, MarketSummary, Point, Quote, Range, Sector, Source } from "./types";

const forceSample = process.env.MARKET_DATA_SOURCE === "sample";

async function pick<T>(live: () => Promise<T>, fallback: () => T): Promise<{ data: T; source: Source }> {
  if (!forceSample) {
    try {
      return { data: await live(), source: "cse" };
    } catch {
      /* fall through to sample */
    }
  }
  return { data: fallback(), source: "sample" };
}

export async function getQuotes(): Promise<{ quotes: Quote[]; source: Source }> {
  const r = await pick(cse.quotes, sample.sampleQuotes);
  return { quotes: r.data, source: r.source };
}

export async function getSummary(): Promise<MarketSummary> {
  const { quotes, source } = await getQuotes();
  const idx = source === "cse" ? await pick(cse.indices, sample.sampleIndices) : { data: sample.sampleIndices(), source };
  const st = source === "cse" ? await pick(cse.status, () => "Unknown") : { data: "Sample market" };
  const breadth = { up: 0, down: 0, flat: 0 };
  let turnover = 0, volume = 0, asOf = 0;
  for (const q of quotes) {
    if (q.change > 0) breadth.up++; else if (q.change < 0) breadth.down++; else breadth.flat++;
    turnover += q.turnover; volume += q.volume; asOf = Math.max(asOf, q.lastTraded);
  }
  return { source, status: st.data, open: /open/i.test(st.data) && !/closed/i.test(st.data), asOf: asOf || Date.now(), indices: idx.data, breadth, turnover, volume };
}

export async function getSectors(): Promise<Sector[]> {
  return (await pick(cse.sectors, sample.sampleSectors)).data;
}

export async function findQuote(key: string): Promise<{ quote?: Quote; source: Source }> {
  const { quotes, source } = await getQuotes();
  const k = decodeURIComponent(key).toUpperCase();
  return { quote: quotes.find((q) => q.symbol === k) || quotes.find((q) => q.ticker === k), source };
}

export async function getHistory(key: string, range: Range): Promise<{ points: Point[]; source: Source; prevClose?: number }> {
  if (key === "ASPI" || key === "SNP") {
    const idx = (await getSummary()).indices.find((i) => i.code === key)!;
    const r = await pick(() => cse.indexHistory(key, range), () => sample.sampleHistory(key, idx.value, range));
    return { points: r.data, source: r.source, prevClose: idx.value - idx.change };
  }
  const { quote, source } = await findQuote(key);
  if (!quote) return { points: [], source };
  const r = source === "cse"
    ? await pick(() => cse.stockHistory(quote.id, range), () => sample.sampleHistory(quote.symbol, quote.price, range))
    : { data: sample.sampleHistory(quote.symbol, quote.price, range), source };
  return { points: r.data, source: r.source, prevClose: quote.prevClose };
}

export async function getCompanyInfo(symbol: string): Promise<CompanyInfo> {
  return (await pick(() => cse.companyInfo(symbol), () => ({}) as CompanyInfo)).data;
}

export async function getAnnouncements(): Promise<Announcement[]> {
  return (await pick(cse.announcements, sample.sampleAnnouncements)).data;
}
