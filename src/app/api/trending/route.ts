import { NextResponse } from "next/server";
import { store } from "@/lib/social/store";
import { trendingTickers } from "@/lib/social/ranking";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = store();
  const live = s.livePosts();
  const suggested = [...s.users.values()]
    .filter((u) => u.onboarded && (u.verified || u.official))
    .map((u) => ({ id: u.id, handle: u.handle, name: u.name, kind: u.kind, verified: u.verified, followers: s.followers(u.id) }))
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 4);
  return NextResponse.json({ tickers: trendingTickers(live), suggested });
}
