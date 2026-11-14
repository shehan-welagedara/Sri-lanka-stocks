import { NextResponse } from "next/server";
import { getQuotes, getSectors, getSummary } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET() {
  const [summary, { quotes }, sectors] = await Promise.all([getSummary(), getQuotes(), getSectors()]);
  return NextResponse.json({ summary, quotes, sectors }, { headers: { "Cache-Control": "public, max-age=15, s-maxage=30" } });
}
