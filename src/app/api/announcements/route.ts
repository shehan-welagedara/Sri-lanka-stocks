import { NextResponse } from "next/server";
import { getAnnouncements } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: (await getAnnouncements()).slice(0, 30) });
}
