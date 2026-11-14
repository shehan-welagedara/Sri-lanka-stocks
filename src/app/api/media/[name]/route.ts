import fs from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), ".data", "uploads");
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" };

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[a-f0-9]{16}\.(jpg|png|webp|gif|mp4|webm)$/.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(DIR, name);
  const stat = await fs.stat(file).catch(() => null);
  if (!stat) return new Response("Not found", { status: 404 });
  const type = TYPES[name.split(".")[1]];
  const base = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    const fh = await fs.open(file);
    const buf = Buffer.alloc(end - start + 1);
    await fh.read(buf, 0, buf.length, start);
    await fh.close();
    return new Response(buf, { status: 206, headers: { ...base, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(buf.length) } });
  }
  return new Response(await fs.readFile(file), { headers: { ...base, "Content-Length": String(stat.size) } });
}
