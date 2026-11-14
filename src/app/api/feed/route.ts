import { NextResponse } from "next/server";
import { getViewer, hydrate, ingestAnnouncements, rateLimit, viewerCtx } from "@/lib/social/server";
import { store } from "@/lib/social/store";
import { rankForYou } from "@/lib/social/ranking";
import { extractTags, extractTickers, moderateText } from "@/lib/social/moderation";
import type { Media, Post } from "@/lib/social/types";

export const dynamic = "force-dynamic";
const PAGE = 15;

// Ranked lists are frozen per session token so paging stays stable while scores move.
const sessions = new Map<string, { ids: string[]; at: number }>();

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const tab = q.get("tab") || "foryou";
  const viewer = await getViewer(false);
  const s = store();
  await ingestAnnouncements();

  const [token, offStr] = (q.get("cursor") || "").split(":");
  let offset = Number(offStr) || 0;
  let ids = token ? sessions.get(token)?.ids : undefined;
  let tok = token;

  if (!ids) {
    offset = 0;
    const mine = (p: Post) => p.status === "live" || (viewer && p.authorId === viewer.id && p.status === "review");
    let list = [...s.posts.values()].filter(mine);
    const chrono = (a: Post, b: Post) => b.createdAt - a.createdAt;
    const ticker = q.get("ticker"), author = q.get("author"), parent = q.get("parent"), search = q.get("q")?.toLowerCase();

    if (parent) list = list.filter((p) => p.replyTo === parent).sort((a, b) => a.createdAt - b.createdAt);
    else if (ticker) list = list.filter((p) => p.tickers.includes(ticker.toUpperCase()) && !p.replyTo).sort(chrono);
    else if (author) list = list.filter((p) => p.authorId === author && !p.replyTo).sort(chrono);
    else if (search) list = list.filter((p) => p.text.toLowerCase().includes(search)).sort(chrono);
    else if (tab === "bookmarks") { const b = s.bookmarks.get(viewer?.id || ""); list = list.filter((p) => b?.has(p.id)).sort(chrono); }
    else if (tab === "following") { const f = s.follows.get(viewer?.id || ""); list = list.filter((p) => !p.replyTo && (f?.has(p.authorId) || p.authorId === viewer?.id)).sort(chrono); }
    else if (tab === "news") list = list.filter((p) => !p.replyTo && (p.source === "cse" || s.users.get(p.authorId)?.kind === "media")).sort(chrono);
    else {
      const watch = (q.get("watch") || "").split(",").filter(Boolean).map((t) => t.toUpperCase());
      const cutoff = Date.now() - 14 * 864e5;
      list = rankForYou(list.filter((p) => !p.replyTo && p.status === "live" && p.createdAt > cutoff), s.users, viewerCtx(viewer, watch));
    }
    ids = list.map((p) => p.id);
    tok = s.id();
    sessions.set(tok, { ids, at: Date.now() });
    if (sessions.size > 500) for (const [k, v] of sessions) if (Date.now() - v.at > 10 * 60_000) sessions.delete(k);
  }

  const slice = ids.slice(offset, offset + PAGE).map((id) => s.posts.get(id)).filter((p): p is Post => !!p && p.status !== "removed");
  const next = offset + PAGE < ids.length ? `${tok}:${offset + PAGE}` : null;
  const newest = Math.max(0, ...[...s.posts.values()].filter((p) => p.status === "live" && !p.replyTo).map((p) => p.createdAt));
  return NextResponse.json({ posts: slice.map((p) => hydrate(p, viewer)), next, newest });
}

export async function POST(req: Request) {
  const viewer = (await getViewer())!;
  if (!viewer.onboarded) return NextResponse.json({ error: "Set up your profile and accept the community guidelines first.", code: "onboard" }, { status: 403 });
  if (viewer.strikes >= 3) return NextResponse.json({ error: "Your account is restricted from posting after repeated guideline violations." }, { status: 403 });
  if (!rateLimit(`post:${viewer.id}`, 8, 10 * 60_000)) return NextResponse.json({ error: "You're posting too fast. Try again in a few minutes." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as { text?: string; media?: Media[]; replyTo?: string; repostOf?: string };
  const text = (b.text || "").trim();
  const media = (b.media || []).slice(0, 4).filter((m) => m && typeof m.url === "string" && m.url.startsWith("/api/media/"));
  const s = store();
  if (!text && !media.length && !b.repostOf) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (text.length > (viewer.premium || viewer.verified ? 2000 : 500)) return NextResponse.json({ error: "Post is too long." }, { status: 400 });
  if (b.replyTo && !s.posts.get(b.replyTo)) return NextResponse.json({ error: "That post no longer exists." }, { status: 404 });
  if (b.repostOf && !s.posts.get(b.repostOf)) return NextResponse.json({ error: "That post no longer exists." }, { status: 404 });

  const dupe = [...s.posts.values()].some((p) => p.authorId === viewer.id && text && p.text === text && Date.now() - p.createdAt < 30 * 60_000);
  if (dupe) return NextResponse.json({ error: "You already posted that." }, { status: 409 });

  const verdict = moderateText(text);
  if (verdict.action === "reject") {
    viewer.strikes += 1;
    s.save();
    return NextResponse.json({ error: verdict.reason, code: "moderation" }, { status: 422 });
  }
  const uncheckedMedia = media.some((m) => !m.checked);
  const status = verdict.action === "review" || uncheckedMedia ? "review" : "live";
  const flags = [...verdict.flags, ...(uncheckedMedia ? ["media-unchecked"] : [])];
  const post = s.addPost({ authorId: viewer.id, text, media, tickers: extractTickers(text), tags: extractTags(text), replyTo: b.replyTo, repostOf: b.repostOf, status, flags });
  return NextResponse.json({ post: hydrate(post, viewer), notice: status === "review" ? "Your post is under review and will appear once approved." : undefined });
}
