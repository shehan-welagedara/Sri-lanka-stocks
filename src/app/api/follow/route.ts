import { NextResponse } from "next/server";
import { getViewer } from "@/lib/social/server";
import { store } from "@/lib/social/store";

export async function POST(req: Request) {
  const viewer = (await getViewer())!;
  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing user" }, { status: 400 });
  return NextResponse.json({ following: store().toggleFollow(viewer.id, userId) });
}
