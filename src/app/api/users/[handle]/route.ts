import { NextResponse } from "next/server";
import { getViewer } from "@/lib/social/server";
import { store } from "@/lib/social/store";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  const s = store();
  const u = s.userByHandle(handle);
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const viewer = await getViewer(false);
  return NextResponse.json({
    user: { id: u.id, handle: u.handle, name: u.name, bio: u.bio, kind: u.kind, verified: u.verified, official: u.official, createdAt: u.createdAt,
      followers: s.followers(u.id), following: s.follows.get(u.id)?.size || 0 },
    viewer: { following: !!s.follows.get(viewer?.id || "")?.has(u.id), own: viewer?.id === u.id },
  });
}
