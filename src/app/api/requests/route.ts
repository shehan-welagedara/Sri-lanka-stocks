import { NextResponse } from "next/server";
import { getViewer, rateLimit } from "@/lib/social/server";
import { store } from "@/lib/social/store";
import type { RequestType } from "@/lib/social/types";

// Revenue workflows that need a human decision: verified-badge applications,
// promoted-post requests and broker (CDS account) leads.
const FIELDS: Record<RequestType, string[]> = {
  verify: ["organisation", "role", "website", "contact"],
  promote: ["postId", "budgetLkr", "contact"],
  lead: ["fullName", "phone", "district", "consent"],
};

export async function POST(req: Request) {
  const viewer = (await getViewer())!;
  const b = (await req.json().catch(() => ({}))) as { type?: RequestType; data?: Record<string, unknown> };
  if (!b.type || !FIELDS[b.type]) return NextResponse.json({ error: "Unknown request" }, { status: 400 });
  if (!rateLimit(`req:${viewer.id}`, 5, 60 * 60_000)) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  const data: Record<string, string> = {};
  for (const f of FIELDS[b.type]) data[f] = String(b.data?.[f] ?? "").trim().slice(0, 200);
  if (b.type === "lead" && (data.consent !== "yes" || !/^(?:\+94|0)7\d{8}$/.test(data.phone.replace(/[\s-]/g, "")) || data.fullName.length < 3))
    return NextResponse.json({ error: "Enter your name, a valid Sri Lankan mobile number, and tick the consent box." }, { status: 400 });
  if (b.type === "verify" && (!data.organisation || !data.contact)) return NextResponse.json({ error: "Organisation and contact are required." }, { status: 400 });
  if (b.type === "promote" && store().posts.get(data.postId)?.authorId !== viewer.id) return NextResponse.json({ error: "You can only promote your own posts." }, { status: 403 });
  const s = store();
  s.requests.push({ id: s.id(), type: b.type, userId: viewer.id, data, createdAt: Date.now(), status: "open" });
  s.save();
  return NextResponse.json({ ok: true });
}
