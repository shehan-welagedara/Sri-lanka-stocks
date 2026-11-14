"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Bookmark, FileText, Flag, Heart, MessageCircle, MoreHorizontal, Megaphone, Repeat2, Share, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { ago } from "@/lib/fmt";
import { holdingsStore, useLocal, watchlistStore } from "@/lib/local";
import type { FeedPost } from "@/lib/social/types";
import { useMe } from "@/lib/api";
import { Avatar, Button, cx, Empty, Sheet, Skeleton, Verified } from "./ui";
import { useApp } from "./app";

// ---- impression + dwell tracking, batched -------------------------------
const pending: { id: string; dwell: number }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  flushTimer = null;
  if (!pending.length) return;
  const body = JSON.stringify({ events: pending.splice(0) });
  if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" })))
    fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}
function track(id: string, dwell: number) {
  pending.push({ id, dwell });
  flushTimer ??= setTimeout(flush, 4000);
}
if (typeof window !== "undefined") window.addEventListener("pagehide", flush);

function useDwell(id: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let since = 0;
    const stop = () => { if (since) { const d = Date.now() - since; since = 0; if (d > 800) track(id, d); } };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) since ||= Date.now(); else stop(); }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); stop(); };
  }, [id]);
  return ref;
}

// ---- rich text -----------------------------------------------------------
const TOKEN = /(\$[A-Za-z]{2,6}(?:\.[A-Za-z])?|#[\p{L}\p{N}_]{2,30}|https?:\/\/[^\s]+)/gu;
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (i % 2 === 0) return part;
        const stop = (e: React.MouseEvent) => e.stopPropagation();
        if (part[0] === "$") return <Link key={i} href={`/stock/${part.slice(1).toUpperCase()}`} onClick={stop} className="font-semibold text-accent hover:underline">{part.toUpperCase()}</Link>;
        if (part[0] === "#") return <Link key={i} href={`/feed?q=${encodeURIComponent(part)}`} onClick={stop} className="font-medium text-accent hover:underline">{part}</Link>;
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={stop} className="break-all text-accent hover:underline">{part.replace(/^https?:\/\//, "").slice(0, 40)}</a>;
      })}
    </>
  );
}

const KIND_LABEL: Record<string, string> = { business: "Company", broker: "Broker", analyst: "Analyst", media: "Media" };
const REPORT_REASONS = ["Nudity or sexual content", "Scam or fraud", "Market manipulation / pump and dump", "Harassment or hate", "Spam", "Off-topic"];

function Action({ icon: Icon, count, on, label, onClick, tone }: { icon: typeof Heart; count?: number; on?: boolean; label: string; onClick: () => void; tone?: string }) {
  return (
    <button aria-label={label} aria-pressed={on} title={label} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cx("press num group -ml-2 flex h-10 min-w-[44px] items-center gap-1.5 rounded-full px-2 text-[13px] font-medium", on ? tone : "text-muted hover:text-ink")}>
      <Icon size={19} className={on ? "fill-current" : ""} strokeWidth={1.9} />
      {count ? count : ""}
    </button>
  );
}

export function PostCard({ post: initial, detail, onRemoved }: { post: FeedPost; detail?: boolean; onRemoved?: (id: string) => void }) {
  const [post, setPost] = useState(initial);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const router = useRouter();
  const { toast, compose } = useApp();
  const ref = useDwell(post.id);
  useEffect(() => setPost(initial), [initial]);

  const act = async (action: "like" | "bookmark" | "repost") => {
    const key = action === "like" ? "liked" : action === "bookmark" ? "bookmarked" : "reposted";
    const cnt = action === "like" ? "likes" : action === "bookmark" ? "bookmarks" : "reposts";
    const was = post.viewer[key];
    setPost((p) => ({ ...p, [cnt]: Math.max(0, p[cnt] + (was ? -1 : 1)), viewer: { ...p.viewer, [key]: !was } })); // optimistic
    try {
      const r = await api<{ post: FeedPost }>(`/api/posts/${post.id}`, { method: "POST", json: { action } });
      setPost(r.post);
    } catch (e) {
      setPost(post);
      toast((e as Error).message, "error");
    }
  };
  const follow = async () => {
    setPost((p) => ({ ...p, viewer: { ...p.viewer, following: true } }));
    await api("/api/follow", { method: "POST", json: { userId: post.author.id } }).catch(() => {});
  };
  const report = async (reason: string) => {
    setReporting(false);
    try { await api(`/api/posts/${post.id}`, { method: "POST", json: { action: "report", reason } }); toast("Thanks. Our team will review this post."); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const remove = async () => {
    setMenu(false);
    try { await api(`/api/posts/${post.id}`, { method: "POST", json: { action: "delete" } }); onRemoved?.(post.id); toast("Post deleted"); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const promote = async () => {
    setMenu(false);
    try { await api("/api/requests", { method: "POST", json: { type: "promote", data: { postId: post.id } } }); toast("Promotion request sent. We'll contact you with pricing."); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const share = async () => {
    const url = `${location.origin}/post/${post.id}`;
    try { if (navigator.share) await navigator.share({ url, text: post.text.slice(0, 120) }); else { await navigator.clipboard.writeText(url); toast("Link copied"); } } catch { /* cancelled */ }
  };

  return (
    <article ref={ref} onClick={() => !detail && router.push(`/post/${post.id}`)}
      className={cx("relative flex gap-3 px-4 py-3.5", !detail && "cursor-pointer transition-colors hover:bg-chip/40")}>
      <Link href={`/u/${post.author.handle}`} onClick={(e) => e.stopPropagation()} className="shrink-0 self-start" aria-label={post.author.name}><Avatar label={post.author.name} size={44} /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1">
              <Link href={`/u/${post.author.handle}`} onClick={(e) => e.stopPropagation()} className="truncate text-[15px] font-bold hover:underline">{post.author.name}</Link>
              {post.author.verified && <Verified />}
            </div>
            <p className="truncate text-[13px] text-muted">@{post.author.handle}{KIND_LABEL[post.author.kind] ? ` · ${KIND_LABEL[post.author.kind]}` : ""} · {post.promoted ? "Promoted" : ago(post.createdAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!post.viewer.own && !post.viewer.following && !post.promoted && (
              <button onClick={(e) => { e.stopPropagation(); follow(); }} className="press h-8 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-bg">Follow</button>
            )}
            <button aria-label="More" onClick={(e) => { e.stopPropagation(); setMenu(true); }} className="press -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-chip"><MoreHorizontal size={19} /></button>
          </div>
        </div>
        {post.status === "review" && <p className="mt-1.5 inline-block rounded-full bg-[#fef3c7] px-2.5 py-1 text-[12px] font-semibold text-[#92400e]">Under review — only you can see this</p>}
        {post.text && <p className={cx("mt-1.5 break-words whitespace-pre-wrap", detail ? "text-[17px] leading-relaxed" : "text-[15px]")}><RichText text={post.text} /></p>}
        {post.link && (
          <a href={post.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-2 inline-flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-[13.5px] font-semibold hover:bg-chip">
            <FileText size={16} /> View filing (PDF)
          </a>
        )}
        {post.media.length > 0 && (
          <div className={cx("mt-2.5 grid gap-1 overflow-hidden rounded-[18px] border border-line", post.media.length > 1 ? "grid-cols-2" : "grid-cols-1")} onClick={(e) => e.stopPropagation()}>
            {post.media.map((m) => m.type === "image"
              ? <img key={m.id} src={m.url} alt="Post attachment" loading="lazy" className={cx("w-full bg-chip object-cover", post.media.length > 1 ? "aspect-square" : "max-h-[520px]")} />
              : <video key={m.id} src={m.url} controls playsInline preload="metadata" className="max-h-[520px] w-full bg-black" />)}
          </div>
        )}
        {post.quoted && (
          <Link href={`/post/${post.quoted.id}`} onClick={(e) => e.stopPropagation()} className="mt-2.5 block rounded-[18px] border border-line p-3 hover:bg-chip/50">
            <span className="flex items-center gap-1 text-[14px]"><span className="font-bold">{post.quoted.author.name}</span>{post.quoted.author.verified && <Verified size={14} />}<span className="text-muted">· {ago(post.quoted.createdAt)}</span></span>
            <span className="mt-0.5 line-clamp-4 block text-[14px]">{post.quoted.text}</span>
          </Link>
        )}
        <div className="mt-1 flex max-w-[420px] items-center justify-between">
          <Action icon={MessageCircle} count={post.replies} label="Reply" onClick={() => compose({ replyTo: post })} />
          <Action icon={Repeat2} count={post.reposts} on={post.viewer.reposted} tone="text-up" label="Repost" onClick={() => compose({ quote: post })} />
          <Action icon={Heart} count={post.likes} on={post.viewer.liked} tone="text-down" label="Like" onClick={() => act("like")} />
          <Action icon={Bookmark} on={post.viewer.bookmarked} tone="text-ink" label="Bookmark" onClick={() => act("bookmark")} />
          <Action icon={Share} label="Share" onClick={share} />
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Sheet open={menu} onClose={() => setMenu(false)} title="Post options">
          <div className="flex flex-col gap-2">
            {post.viewer.own ? (
              <>
                <Button variant="ghost" className="justify-start" onClick={promote}><Megaphone size={18} /> Promote this post</Button>
                <Button variant="ghost" className="justify-start text-down" onClick={remove}><Trash2 size={18} /> Delete post</Button>
              </>
            ) : (
              <Button variant="ghost" className="justify-start" onClick={() => { setMenu(false); setReporting(true); }}><Flag size={18} /> Report post</Button>
            )}
          </div>
        </Sheet>
        <Sheet open={reporting} onClose={() => setReporting(false)} title="Why are you reporting this?">
          <div className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => <Button key={r} variant="ghost" className="justify-start" onClick={() => report(r)}>{r}</Button>)}
          </div>
        </Sheet>
      </div>
    </article>
  );
}

export function AdSlot() {
  const me = useMe();
  if (me?.premium) return null;
  return (
    <div className="px-4 py-3.5">
      <Link href="/profile#premium" className="rings flex min-h-[84px] items-center justify-between gap-4 rounded-[20px] bg-hero px-5 py-4 text-hero-ink">
        <span><span className="block text-[11px] font-semibold tracking-wide text-hero-muted uppercase">Sponsored</span><span className="mt-0.5 block text-[15px] font-bold">Go Premium: no ads, unlimited alerts, full technicals</span></span>
        <span className="relative z-10 shrink-0 rounded-full bg-lime px-4 py-2 text-[13px] font-bold text-lime-ink">Upgrade</span>
      </Link>
    </div>
  );
}

type Page = { posts: FeedPost[]; next: string | null; newest: number };

export function FeedList({ query, empty, ads = false, accepts }: { query: string; empty?: { title: string; body?: string }; ads?: boolean; accepts?: (p: FeedPost) => boolean }) {
  const watch = useLocal(watchlistStore);
  const holdings = useLocal(holdingsStore);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState("");
  const loading = useRef(false);
  const newest = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const interests = [...new Set([...watch, ...holdings.map((h) => h.ticker)])].join(",");
  const base = `/api/feed?${query}${query.includes("tab=foryou") ? `&watch=${encodeURIComponent(interests)}` : ""}`;

  const load = useCallback(async (cursor?: string) => {
    if (loading.current) return;
    loading.current = true;
    try {
      const r = await api<Page>(cursor ? `${base}&cursor=${cursor}` : base);
      setPosts((prev) => (cursor && prev ? [...prev, ...r.posts.filter((p) => !prev.some((x) => x.id === p.id))] : r.posts));
      setNext(r.next);
      if (!cursor) { newest.current = r.newest; setFresh(false); }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      loading.current = false;
    }
  }, [base]);

  useEffect(() => { setPosts(null); setNext(null); load(); }, [load]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && load(next), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, load]);

  // Near-real-time: poll for newer posts and offer them without yanking the scroll position.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await api<Page>(`/api/feed?tab=news`).catch(() => null);
      if (r && newest.current && r.newest > newest.current) setFresh(true);
    }, 20_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const p = (e as CustomEvent<FeedPost>).detail;
      if (accepts ? accepts(p) : !p.replyTo) setPosts((prev) => [p, ...(prev || [])]);
      newest.current = Math.max(newest.current, p.createdAt);
    };
    window.addEventListener("feed:new", on);
    return () => window.removeEventListener("feed:new", on);
  }, [accepts]);

  if (error && !posts) return <Empty title="Couldn't load the feed" body={error} action={<Button onClick={() => load()}>Try again</Button>} />;
  if (!posts)
    return <div aria-busy="true">{[0, 1, 2].map((i) => (
      <div key={i} className="flex gap-3 px-4 py-4"><Skeleton className="h-11 w-11 !rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div></div>
    ))}</div>;
  if (!posts.length) return <Empty title={empty?.title || "Nothing here yet"} body={empty?.body} />;
  return (
    <div className="relative">
      {fresh && (
        <div className="pointer-events-none sticky top-[calc(env(safe-area-inset-top)+64px)] z-20 flex h-0 justify-center lg:top-4">
          <button onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); load(); }} className="press pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 text-[13px] font-bold text-lime-ink shadow-lg"><ArrowUp size={15} strokeWidth={2.6} /> New posts</button>
        </div>
      )}
      <div className="divide-y divide-line">
        {posts.map((p, i) => (
          <div key={p.id}>
            <PostCard post={p} onRemoved={(id) => setPosts((x) => x && x.filter((y) => y.id !== id))} />
            {ads && i % 9 === 5 && <div className="border-t border-line"><AdSlot /></div>}
          </div>
        ))}
      </div>
      <div ref={sentinel} className="h-px" />
      {next ? <div className="flex justify-center py-6"><Skeleton className="h-4 w-24" /></div> : posts.length > 6 && <p className="py-8 text-center text-[13px] text-muted">You&apos;re all caught up</p>}
    </div>
  );
}
