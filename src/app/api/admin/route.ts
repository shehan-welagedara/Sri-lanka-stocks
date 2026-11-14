import { NextResponse } from "next/server";
import { hydrate, isAdmin } from "@/lib/social/server";
import { store } from "@/lib/social/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const s = store();
  const posts = [...s.posts.values()];
  return NextResponse.json({
    queue: posts.filter((p) => p.status === "review").sort((a, b) => b.createdAt - a.createdAt).map((p) => ({ ...hydrate(p, null), reportReasons: s.reports.filter((r) => r.postId === p.id).map((r) => r.reason) })),
    reported: posts.filter((p) => p.status === "live" && p.reports > 0).sort((a, b) => b.reports - a.reports).map((p) => ({ ...hydrate(p, null), reportReasons: s.reports.filter((r) => r.postId === p.id).map((r) => r.reason) })),
    requests: s.requests.filter((r) => r.status === "open").map((r) => ({ ...r, user: s.users.get(r.userId)?.handle })),
    stats: { users: s.users.size, posts: posts.length, live: posts.filter((p) => p.status === "live").length, leads: s.requests.filter((r) => r.type === "lead").length },
  });
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string };
  const s = store();
  const post = b.id ? s.posts.get(b.id) : undefined;
  const request = s.requests.find((r) => r.id === b.id);
  switch (b.action) {
    case "approve-post": if (post) { post.status = "live"; post.reports = 0; } break;
    case "remove-post":
      if (post) { post.status = "removed"; const a = s.users.get(post.authorId); if (a) a.strikes += 1; }
      break;
    case "approve-request":
      if (request) {
        request.status = "approved";
        if (request.type === "verify") { const u = s.users.get(request.userId); if (u) u.verified = true; }
        if (request.type === "promote") { const p = s.posts.get(request.data.postId); if (p) p.promoted = true; }
      }
      break;
    case "reject-request": if (request) request.status = "rejected"; break;
    default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  s.save();
  return NextResponse.json({ ok: true });
}
