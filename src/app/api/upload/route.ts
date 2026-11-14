import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getViewer, rateLimit } from "@/lib/social/server";
import { store } from "@/lib/social/store";

export const dynamic = "force-dynamic";
const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

// File type is decided by magic bytes, never by the name or the browser's claim.
function sniff(b: Buffer): { ext: string; type: "image" | "video" } | null {
  if (b[0] === 0xff && b[1] === 0xd8) return { ext: "jpg", type: "image" };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image" };
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return { ext: "webp", type: "image" };
  if (b.subarray(0, 3).toString() === "GIF") return { ext: "gif", type: "image" };
  if (b.subarray(4, 8).toString() === "ftyp") return { ext: "mp4", type: "video" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: "webm", type: "video" };
  return null;
}

export async function POST(req: Request) {
  const viewer = (await getViewer())!;
  if (!viewer.onboarded) return NextResponse.json({ error: "Set up your profile first.", code: "onboard" }, { status: 403 });
  if (!rateLimit(`upload:${viewer.id}`, 12, 10 * 60_000)) return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) return NextResponse.json({ error: "Only JPG, PNG, WebP, GIF, MP4 and WebM files are supported." }, { status: 415 });
  const limit = kind.type === "image" ? 6e6 : 40e6;
  if (buf.length > limit) return NextResponse.json({ error: `File is too large (max ${limit / 1e6} MB).` }, { status: 413 });
  const id = store().id();
  const name = `${id}.${kind.ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  // `checked` records that the on-device nudity screen passed. It is a client
  // claim, so unchecked media forces review and reports can still pull a post.
  return NextResponse.json({ media: { id, type: kind.type, url: `/api/media/${name}`, checked: form?.get("checked") === "1" } });
}
