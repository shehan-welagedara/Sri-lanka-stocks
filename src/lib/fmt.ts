const nf2 = new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 });

export const price = (v: number) => nf2.format(v);
export const int = (v: number) => nf0.format(v);
export const lkr = (v: number) => `Rs ${nf2.format(v)}`;
export const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf2.format(Math.abs(v))}`;
export const pct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;

export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return nf0.format(v);
}

export const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "flat");

export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const TZ = "Asia/Colombo";
export const timeLk = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const dateLk = (ts: number, withYear = false) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: TZ });

export const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s(&-])\S/g, (c) => c.toUpperCase()).replace(/\bPlc\b/g, "PLC").replace(/\b(Jkh|Hnb|Ioc|Dfcc|Ndb|Lb|Lolc|Sl|Cic|Ctc)\b/g, (m) => m.toUpperCase());

