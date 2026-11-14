import { cookies } from "next/headers";
import { getAnnouncements, getQuotes } from "@/lib/market";
import { titleCase } from "@/lib/fmt";
import { store } from "./store";
import { CSE_BOT_ID } from "./seed";
import type { FeedPost, Post, User } from "./types";
import type { ViewerCtx } from "./ranking";

const COOKIE = "ls_uid";

// Guest-first identity: every visitor gets an account on first write, and
// "onboards" (name, handle, guideline acceptance) before posting. Phase 2
// replaces this cookie with Supabase Auth sessions.
export async function getViewer(create = true): Promise<User | null> {
  const jar = await cookies();
  const s = store();
  const id = jar.get(COOKIE)?.value;
  const existing = id ? s.users.get(id) : undefined;
  if (existing) return existing;
  if (!create) return null;
  const u = s.createUser();
  jar.set(COOKIE, u.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return u;
}

export function isAdmin(req: Request): boolean {
  const key = process.env.ADMIN_KEY || (process.env.NODE_ENV !== "production" ? "dev-admin" : "");
  return !!key && req.headers.get("x-admin-key") === key;
}

export function hydrate(p: Post, viewer: User | null, depth = 0): FeedPost {
  const s = store();
  const a = s.users.get(p.authorId);
  const vid = viewer?.id || "";
  const quotedSrc = p.repostOf && depth === 0 ? s.posts.get(p.repostOf) : undefined;
  return {
    ...p,
    author: { id: p.authorId, handle: a?.handle || "deleted", name: a?.name || "Deleted account", kind: a?.kind || "investor", verified: !!a?.verified, official: a?.official },
    viewer: {
      liked: !!s.likes.get(vid)?.has(p.id), reposted: !!s.reposts.get(vid)?.has(p.id), bookmarked: !!s.bookmarks.get(vid)?.has(p.id),
      following: !!s.follows.get(vid)?.has(p.authorId), own: vid === p.authorId,
    },
    quoted: quotedSrc && quotedSrc.status === "live" ? hydrate(quotedSrc, viewer, 1) : undefined,
  };
}

export function viewerCtx(viewer: User | null, watch: string[]): ViewerCtx {
  const s = store();
  const id = viewer?.id || "";
  const engagedAuthors = new Map<string, number>();
  const engagedTickers = new Map<string, number>();
  for (const set of [s.likes.get(id), s.bookmarks.get(id), s.reposts.get(id)])
    for (const pid of set || []) {
      const p = s.posts.get(pid);
      if (!p) continue;
      engagedAuthors.set(p.authorId, (engagedAuthors.get(p.authorId) || 0) + 1);
      for (const t of p.tickers) engagedTickers.set(t, (engagedTickers.get(t) || 0) + 1);
    }
  return { userId: id, following: s.follows.get(id) || new Set(), watch: new Set(watch), engagedAuthors, engagedTickers, seen: s.seen.get(id) || new Map() };
}

// Pull official CSE announcements into the feed as posts from the disclosures bot.
let lastIngest = 0;
export async function ingestAnnouncements() {
  if (Date.now() - lastIngest < 120_000) return;
  lastIngest = Date.now();
  const s = store();
  try {
    const [anns, { quotes }] = await Promise.all([getAnnouncements(), getQuotes()]);
    const byName = new Map(quotes.filter((q) => !q.ticker.includes(".")).map((q) => [q.name.toUpperCase().replace(/[^A-Z0-9]/g, ""), q.ticker]));
    for (const a of anns) {
      if (s.ingested.has(a.id)) continue;
      s.ingested.add(a.id);
      const ticker = byName.get(a.company.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      s.addPost({
        authorId: CSE_BOT_ID, source: "cse", createdAt: a.ts, link: a.url,
        text: `${titleCase(a.company)}${ticker ? ` ($${ticker})` : ""}: ${a.title}`, tickers: ticker ? [ticker] : [],
        tags: [a.kind === "financial" ? "results" : "disclosure"],
      });
    }
  } catch {
    /* market source unavailable; try again later */
  }
}

// Sliding-window rate limit, per user and action.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  return true;
}
