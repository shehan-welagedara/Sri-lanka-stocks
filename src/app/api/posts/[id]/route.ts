import { NextResponse } from "next/server";
import { getViewer, hydrate, rateLimit } from "@/lib/social/server";
import { store } from "@/lib/social/store";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const viewer = await getViewer(false);
  const p = store().posts.get(id);
  if (!p || p.status === "removed" || (p.status === "review" && p.authorId !== viewer?.id)) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ post: hydrate(p, viewer) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const viewer = (await getViewer())!;
  const s = store();
  const p = s.posts.get(id);
  if (!p) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };
  if (!rateLimit(`act:${viewer.id}`, 120, 60_000)) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });

  switch (b.action) {
    case "like": s.toggle("likes", viewer.id, id); break;
    case "bookmark": s.toggle("bookmarks", viewer.id, id); break;
    case "repost": s.toggle("reposts", viewer.id, id); break;
    case "report":
      if (!s.report(viewer.id, id, b.reason || "Other")) return NextResponse.json({ error: "You already reported this post." }, { status: 409 });
      break;
    case "delete":
      if (p.authorId !== viewer.id) return NextResponse.json({ error: "Not your post." }, { status: 403 });
      p.status = "removed";
      if (p.replyTo) { const parent = s.posts.get(p.replyTo); if (parent) parent.replies = Math.max(0, parent.replies - 1); }
      s.save();
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ post: hydrate(p, viewer) });
}
