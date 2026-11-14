// Data store for the social layer. This implementation keeps everything in
// memory and snapshots to .data/store.json so a single server works with no
// external services. supabase/schema.sql mirrors these shapes for the
// production database.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Post, Report, Request, User } from "./types";
import { seed } from "./seed";

type Sets = Record<string, string[]>;
type Snapshot = {
  users: User[]; posts: Post[]; likes: Sets; reposts: Sets; bookmarks: Sets; follows: Sets;
  seen: Record<string, Record<string, number>>; requests: Request[]; reports: Report[]; ingested: string[];
};

export class Store {
  users = new Map<string, User>();
  posts = new Map<string, Post>();
  likes = new Map<string, Set<string>>(); // userId -> postIds
  reposts = new Map<string, Set<string>>();
  bookmarks = new Map<string, Set<string>>();
  follows = new Map<string, Set<string>>(); // userId -> followed userIds
  seen = new Map<string, Map<string, number>>(); // userId -> postId -> views
  requests: Request[] = [];
  reports: Report[] = [];
  ingested = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private file = path.join(process.cwd(), ".data", "store.json");

  constructor() {
    if (!this.load()) seed(this);
  }

  private load(): boolean {
    try {
      const s = JSON.parse(fs.readFileSync(this.file, "utf8")) as Snapshot;
      s.users.forEach((u) => this.users.set(u.id, u));
      s.posts.forEach((p) => this.posts.set(p.id, p));
      const sets = (src: Sets, dst: Map<string, Set<string>>) => Object.entries(src).forEach(([k, v]) => dst.set(k, new Set(v)));
      sets(s.likes, this.likes); sets(s.reposts, this.reposts); sets(s.bookmarks, this.bookmarks); sets(s.follows, this.follows);
      Object.entries(s.seen || {}).forEach(([k, v]) => this.seen.set(k, new Map(Object.entries(v))));
      this.requests = s.requests || []; this.reports = s.reports || [];
      this.ingested = new Set(s.ingested || []);
      return this.users.size > 0;
    } catch {
      return false;
    }
  }

  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const sets = (m: Map<string, Set<string>>) => Object.fromEntries([...m].map(([k, v]) => [k, [...v]]));
      const snap: Snapshot = {
        users: [...this.users.values()], posts: [...this.posts.values()],
        likes: sets(this.likes), reposts: sets(this.reposts), bookmarks: sets(this.bookmarks), follows: sets(this.follows),
        seen: Object.fromEntries([...this.seen].map(([k, v]) => [k, Object.fromEntries(v)])),
        requests: this.requests, reports: this.reports, ingested: [...this.ingested],
      };
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file + ".tmp", JSON.stringify(snap));
        fs.renameSync(this.file + ".tmp", this.file);
      } catch {
        /* read-only filesystem (serverless): stay in memory */
      }
    }, 1500);
    this.timer.unref?.();
  }

  id = () => randomUUID().replace(/-/g, "").slice(0, 16);

  createUser(partial: Partial<User> = {}): User {
    const id = partial.id || this.id();
    const u: User = {
      id, handle: `investor${Math.floor(1000 + Math.random() * 9000)}`, name: "Guest investor", bio: "", kind: "investor",
      verified: false, premium: false, onboarded: false, createdAt: Date.now(), strikes: 0, ...partial,
    };
    this.users.set(id, u);
    this.save();
    return u;
  }

  userByHandle(handle: string) {
    const h = handle.toLowerCase();
    return [...this.users.values()].find((u) => u.handle.toLowerCase() === h);
  }

  addPost(p: Partial<Post> & Pick<Post, "authorId" | "text">): Post {
    const post: Post = {
      id: this.id(), tickers: [], tags: [], media: [], createdAt: Date.now(), source: "user", status: "live", flags: [],
      likes: 0, reposts: 0, replies: 0, bookmarks: 0, impressions: 0, dwellMs: 0, reports: 0, ...p,
    };
    this.posts.set(post.id, post);
    if (post.replyTo) { const parent = this.posts.get(post.replyTo); if (parent) parent.replies++; }
    if (post.repostOf) { const src = this.posts.get(post.repostOf); if (src) src.reposts++; }
    this.save();
    return post;
  }

  private set(m: Map<string, Set<string>>, k: string) {
    let s = m.get(k);
    if (!s) m.set(k, (s = new Set()));
    return s;
  }

  toggle(kind: "likes" | "bookmarks" | "reposts", userId: string, postId: string): boolean {
    const post = this.posts.get(postId);
    if (!post) return false;
    const s = this.set(this[kind], userId);
    const on = !s.has(postId);
    if (on) s.add(postId); else s.delete(postId);
    post[kind] = Math.max(0, post[kind] + (on ? 1 : -1));
    this.save();
    return on;
  }

  toggleFollow(userId: string, target: string): boolean {
    if (userId === target || !this.users.has(target)) return false;
    const s = this.set(this.follows, userId);
    const on = !s.has(target);
    if (on) s.add(target); else s.delete(target);
    this.save();
    return on;
  }

  followers(userId: string) {
    let n = 0;
    for (const s of this.follows.values()) if (s.has(userId)) n++;
    return n;
  }

  view(userId: string, postId: string, dwellMs: number) {
    const post = this.posts.get(postId);
    if (!post) return;
    let m = this.seen.get(userId);
    if (!m) this.seen.set(userId, (m = new Map()));
    m.set(postId, (m.get(postId) || 0) + 1);
    post.impressions++;
    post.dwellMs += Math.max(0, Math.min(dwellMs, 60_000));
    this.save();
  }

  report(userId: string, postId: string, reason: string): boolean {
    const post = this.posts.get(postId);
    if (!post || this.reports.some((r) => r.userId === userId && r.postId === postId)) return false;
    this.reports.push({ id: this.id(), postId, userId, reason: reason.slice(0, 200), createdAt: Date.now() });
    post.reports++;
    // Three independent reports pull a post for human review.
    if (post.reports >= 3 && post.status === "live") post.status = "review";
    this.save();
    return true;
  }

  livePosts() {
    return [...this.posts.values()].filter((p) => p.status === "live");
  }
}

const g = globalThis as unknown as { __store?: Store };
export const store = () => (g.__store ??= new Store());
