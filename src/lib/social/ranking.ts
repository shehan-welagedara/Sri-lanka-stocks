// "For you" ranking. Four stages, the same shape large feeds use:
//   1. candidates  - recent live posts, minus the viewer's own and ones already seen a lot
//   2. scoring     - smoothed engagement rate x time decay x personal affinity x credibility
//   3. re-ranking  - greedy diversity pass (author / ticker fatigue) + exploration slots
//   4. blending    - promoted posts inserted at fixed slots
import type { Post, User } from "./types";

export type ViewerCtx = {
  userId: string;
  following: Set<string>;
  watch: Set<string>; // tickers on the viewer's watchlist / portfolio
  engagedAuthors: Map<string, number>; // author -> past interactions by the viewer
  engagedTickers: Map<string, number>;
  seen: Map<string, number>; // post -> times shown to the viewer
};

const W = { like: 1, repost: 2.5, reply: 3.5, bookmark: 2, dwell: 0.25 };
const HALF_LIFE_H = 8;
const PRIOR = { a: 2, b: 40 }; // Bayesian prior: ~5% engagement rate until proven otherwise

export function engagement(p: Post): number {
  const dwellSec = p.impressions ? Math.min(p.dwellMs / p.impressions / 1000, 30) : 0;
  return W.like * p.likes + W.repost * p.reposts + W.reply * p.replies + W.bookmark * p.bookmarks + W.dwell * dwellSec * Math.log1p(p.impressions);
}

export function score(p: Post, author: User | undefined, v: ViewerCtx, now = Date.now()): number {
  const eng = engagement(p);
  const rate = (eng + PRIOR.a) / (p.impressions + PRIOR.b);
  const quality = Math.log1p(eng) + 12 * rate;
  const ageH = Math.max(0, now - p.createdAt) / 36e5;
  const decay = Math.pow(0.5, ageH / HALF_LIFE_H);

  let affinity = 1;
  if (v.following.has(p.authorId)) affinity *= 2.2;
  affinity *= 1 + Math.min(v.engagedAuthors.get(p.authorId) || 0, 5) * 0.15;
  let tickerBoost = 0;
  for (const t of p.tickers) {
    if (v.watch.has(t)) tickerBoost = Math.max(tickerBoost, 0.7);
    tickerBoost = Math.max(tickerBoost, Math.min(v.engagedTickers.get(t) || 0, 5) * 0.1);
  }
  affinity *= 1 + tickerBoost;

  let cred = 1;
  if (author?.verified) cred *= 1.25;
  if (author?.official) cred *= 1.15;
  if (author) cred *= 1 / (1 + author.strikes * 0.5);
  cred *= 1 / (1 + p.reports * 0.75);
  if (p.flags.includes("shouting") || p.flags.includes("link-heavy")) cred *= 0.6;

  const richness = (p.media.length ? 1.12 : 1) * (p.tickers.length ? 1.08 : 1) * (p.text.length > 80 ? 1.05 : 1);
  const fatigue = Math.pow(0.55, v.seen.get(p.id) || 0); // each repeat view roughly halves the score
  return (0.6 + quality) * decay * affinity * cred * richness * fatigue;
}

export function rankForYou(posts: Post[], users: Map<string, User>, v: ViewerCtx, now = Date.now()): Post[] {
  const organic = posts.filter((p) => !p.promoted);
  const promoted = posts.filter((p) => p.promoted && (v.seen.get(p.id) || 0) < 4);
  const scored = organic.map((p) => ({ p, s: score(p, users.get(p.authorId), v, now) })).sort((a, b) => b.s - a.s);

  // Exploration pool: fresh posts with few impressions get a guaranteed trial audience.
  const explore = scored.filter(({ p }) => now - p.createdAt < 6 * 36e5 && p.impressions < 30 && !v.seen.has(p.id));
  const exploreIds = new Set(explore.map((e) => e.p.id));

  const out: Post[] = [];
  const pool = scored.slice();
  const used = new Set<string>();
  let ex = 0;
  while (pool.length) {
    // Every 6th slot is an exploration slot when one is available.
    if (out.length % 6 === 4) {
      while (ex < explore.length && used.has(explore[ex].p.id)) ex++;
      if (ex < explore.length) {
        const e = explore[ex++];
        used.add(e.p.id);
        out.push(e.p);
        continue;
      }
    }
    const recentAuthors = out.slice(-3).map((p) => p.authorId);
    const recentTickers = new Set(out.slice(-2).flatMap((p) => p.tickers));
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < Math.min(pool.length, 40); i++) {
      const { p, s } = pool[i];
      if (used.has(p.id)) continue;
      let adj = s;
      if (recentAuthors.includes(p.authorId)) adj *= 0.35;
      if (p.tickers.some((t) => recentTickers.has(t))) adj *= 0.7;
      if (exploreIds.has(p.id)) adj *= 0.9; // will get its own slot
      if (adj > bestScore) { bestScore = adj; best = i; }
    }
    if (best < 0) { pool.shift(); continue; }
    const [{ p }] = pool.splice(best, 1);
    used.add(p.id);
    out.push(p);
  }

  // Promoted posts: slot 3, then every 10 organic posts.
  let slot = 2;
  for (const ad of promoted) {
    if (slot > out.length) break;
    out.splice(slot, 0, ad);
    slot += 11;
  }
  return out;
}

// Trending tickers: recency-weighted mention velocity, weighted by engagement.
export function trendingTickers(posts: Post[], now = Date.now(), limit = 8): { ticker: string; score: number; posts: number }[] {
  const m = new Map<string, { score: number; posts: number }>();
  for (const p of posts) {
    const ageH = (now - p.createdAt) / 36e5;
    if (ageH > 48) continue;
    const w = Math.pow(0.5, ageH / 6) * (1 + Math.log1p(engagement(p)));
    for (const t of p.tickers) {
      const e = m.get(t) || { score: 0, posts: 0 };
      e.score += w; e.posts += 1;
      m.set(t, e);
    }
  }
  return [...m.entries()].map(([ticker, e]) => ({ ticker, ...e })).sort((a, b) => b.score - a.score).slice(0, limit);
}
