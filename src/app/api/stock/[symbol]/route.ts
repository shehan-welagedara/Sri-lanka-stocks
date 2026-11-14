import { NextResponse } from "next/server";
import { findQuote, getCompanyInfo, getHistory, getSummary } from "@/lib/market";
import { RANGES, type Range } from "@/lib/market/types";
import { technicalSummary } from "@/lib/market/indicators";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  const url = new URL(req.url);
  const range = (RANGES.includes(url.searchParams.get("range") as Range) ? url.searchParams.get("range") : "1M") as Range;
  const key = decodeURIComponent(symbol).toUpperCase();
  const isIndex = key === "ASPI" || key === "SNP";

  if (isIndex) {
    const [summary, hist] = await Promise.all([getSummary(), getHistory(key, range)]);
    return NextResponse.json({ index: summary.indices.find((i) => i.code === key), ...hist });
  }
  const { quote, source } = await findQuote(key);
  if (!quote) return NextResponse.json({ error: "Unknown symbol" }, { status: 404 });
  const full = url.searchParams.get("full") === "1";
  const [hist, info, year] = await Promise.all([
    getHistory(quote.symbol, range),
    full ? getCompanyInfo(quote.symbol) : undefined,
    full ? getHistory(quote.symbol, "1Y") : undefined,
  ]);
  const technicals = year && year.points.length > 20 && year.source === "cse" ? technicalSummary(year.points.map((p) => p.p)) : undefined;
  return NextResponse.json({ quote, source, points: hist.points, historySource: hist.source, prevClose: hist.prevClose, info, technicals });
}
