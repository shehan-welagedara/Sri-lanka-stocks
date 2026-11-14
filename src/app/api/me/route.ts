import { NextResponse } from "next/server";
import { getViewer } from "@/lib/social/server";
import { store } from "@/lib/social/store";
import { moderateText } from "@/lib/social/moderation";
import type { UserKind } from "@/lib/social/types";

export const dynamic = "force-dynamic";

const pub = (u: NonNullable<Awaited<ReturnType<typeof getViewer>>>) => {
  const s = store();
  return { ...u, followers: s.followers(u.id), following: s.follows.get(u.id)?.size || 0 };
};

export async function GET() {
  const u = await getViewer();
  return NextResponse.json({ user: pub(u!) });
}

const KINDS: UserKind[] = ["investor", "business", "broker", "analyst", "media"];

export async function PATCH(req: Request) {
  const u = (await getViewer())!;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = store();
  if (typeof b.name === "string") {
    const name = b.name.trim().slice(0, 40);
    if (name.length < 2) return NextResponse.json({ error: "Name is too short." }, { status: 400 });
    if (moderateText(name).action !== "allow") return NextResponse.json({ error: "That name is not allowed." }, { status: 400 });
    u.name = name;
  }
  if (typeof b.handle === "string") {
    const handle = b.handle.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)) return NextResponse.json({ error: "Handle must be 3-20 letters, numbers or underscores." }, { status: 400 });
    if (moderateText(handle.replace(/_/g, " ")).action !== "allow") return NextResponse.json({ error: "That handle is not allowed." }, { status: 400 });
    const other = s.userByHandle(handle);
    if (other && other.id !== u.id) return NextResponse.json({ error: "That handle is taken." }, { status: 409 });
    u.handle = handle;
  }
  if (typeof b.bio === "string") {
    const bio = b.bio.trim().slice(0, 160);
    if (moderateText(bio).action !== "allow") return NextResponse.json({ error: "That bio breaks the community guidelines." }, { status: 400 });
    u.bio = bio;
  }
  if (typeof b.kind === "string" && KINDS.includes(b.kind as UserKind)) u.kind = b.kind as UserKind;
  if (b.acceptGuidelines === true) u.onboarded = true;
  // Demo checkout: flips the premium flag locally until PayHere is connected.
  if (typeof b.premium === "boolean" && process.env.NODE_ENV !== "production") u.premium = b.premium;
  s.save();
  return NextResponse.json({ user: pub(u) });
}
