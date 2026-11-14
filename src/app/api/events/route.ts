import { NextResponse } from "next/server";
import { getViewer } from "@/lib/social/server";
import { store } from "@/lib/social/store";

// Impression + dwell-time signals that feed the ranking model.
export async function POST(req: Request) {
  const viewer = await getViewer(false);
  if (!viewer) return NextResponse.json({ ok: true });
  const { events } = (await req.json().catch(() => ({}))) as { events?: { id: string; dwell: number }[] };
  const s = store();
  for (const e of (events || []).slice(0, 50)) if (typeof e?.id === "string") s.view(viewer.id, e.id, Number(e.dwell) || 0);
  return NextResponse.json({ ok: true });
}
