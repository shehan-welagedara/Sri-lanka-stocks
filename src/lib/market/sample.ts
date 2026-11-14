// Deterministic sample market used when the live source is unreachable or
// MARKET_DATA_SOURCE=sample. Clearly labelled "Sample data" in the UI.
import type { Announcement, IndexQuote, Point, Quote, Range, Sector } from "./types";

const BASE: [string, string, number, number][] = [
  ["JKH", "JOHN KEELLS HOLDINGS PLC", 19.4, 344e9],
  ["COMB", "COMMERCIAL BANK OF CEYLON PLC", 178.5, 290e9],
  ["HNB", "HATTON NATIONAL BANK PLC", 372.0, 205e9],
  ["SAMP", "SAMPATH BANK PLC", 142.25, 167e9],
  ["DIAL", "DIALOG AXIATA PLC", 24.6, 226e9],
  ["LOLC", "LOLC HOLDINGS PLC", 612.0, 291e9],
  ["CTC", "CEYLON TOBACCO COMPANY PLC", 1480.0, 277e9],
  ["HAYL", "HAYLEYS PLC", 186.0, 139e9],
  ["MELS", "MELSTACORP PLC", 148.0, 172e9],
  ["DIST", "DISTILLERIES COMPANY OF SRI LANKA PLC", 52.3, 240e9],
  ["EXPO", "EXPOLANKA HOLDINGS PLC", 152.5, 298e9],
  ["LIOC", "LANKA IOC PLC", 131.0, 70e9],
  ["CARG", "CARGILLS (CEYLON) PLC", 520.0, 134e9],
  ["HHL", "HEMAS HOLDINGS PLC", 31.9, 95e9],
  ["NTB", "NATIONS TRUST BANK PLC", 248.0, 74e9],
  ["SLTL", "SRI LANKA TELECOM PLC", 96.4, 174e9],
  ["TKYO", "TOKYO CEMENT COMPANY (LANKA) PLC", 84.9, 34e9],
  ["RCL", "ROYAL CERAMICS LANKA PLC", 44.1, 49e9],
  ["AEL", "ACCESS ENGINEERING PLC", 62.7, 63e9],
  ["DIPD", "DIPPED PRODUCTS PLC", 73.2, 44e9],
  ["VONE", "VALLIBEL ONE PLC", 88.0, 100e9],
  ["CINS", "CEYLINCO HOLDINGS PLC", 3150.0, 83e9],
  ["SPEN", "AITKEN SPENCE PLC", 162.0, 66e9],
  ["BIL", "BROWNS INVESTMENTS PLC", 8.4, 125e9],
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7);
const day = () => Math.floor(Date.now() / 864e5);

export function sampleQuotes(): Quote[] {
  return BASE.map(([ticker, name, base, cap], i) => {
    const r = rng(hash(ticker) + day());
    const pct = (r() - 0.48) * 6;
    const prev = base;
    const price = +(prev * (1 + pct / 100)).toFixed(2);
    const vol = Math.floor(r() * 4e6) + 5e4;
    return {
      id: 9000 + i,
      symbol: `${ticker}.N0000`,
      ticker,
      name,
      price,
      change: +(price - prev).toFixed(2),
      changePct: pct,
      prevClose: prev,
      open: +(prev * (1 + (r() - 0.5) / 100)).toFixed(2),
      high: +(Math.max(price, prev) * (1 + r() / 100)).toFixed(2),
      low: +(Math.min(price, prev) * (1 - r() / 100)).toFixed(2),
      volume: vol,
      turnover: vol * price,
      trades: Math.floor(r() * 900) + 20,
      marketCap: cap * (1 + pct / 100),
      lastTraded: Date.now() - Math.floor(r() * 36e5),
    };
  });
}

export function sampleIndices(): IndexQuote[] {
  const r = rng(day());
  const mk = (code: "ASPI" | "SNP", name: string, base: number): IndexQuote => {
    const pct = (r() - 0.48) * 2.4;
    const value = +(base * (1 + pct / 100)).toFixed(2);
    return { code, name, value, change: +(value - base).toFixed(2), changePct: pct, high: value * 1.004, low: value * 0.995, ts: Date.now() };
  };
  return [mk("ASPI", "All Share Price Index", 22024), mk("SNP", "S&P Sri Lanka 20", 6293)];
}

export function sampleSectors(): Sector[] {
  const names = ["Banks", "Capital Goods", "Food, Beverage & Tobacco", "Telecommunication", "Materials", "Energy", "Insurance", "Consumer Services", "Real Estate", "Diversified Financials"];
  const r = rng(day() + 5);
  return names.map((name, i) => {
    const pct = (r() - 0.48) * 3;
    const value = 1000 + r() * 4000;
    return { symbol: `S${i}`, name, value, change: (value * pct) / 100, changePct: pct, turnover: r() * 9e8 };
  });
}

export function sampleHistory(key: string, last: number, range: Range): Point[] {
  const n = { "1D": 78, "1W": 5, "1M": 22, "3M": 64, "1Y": 243 }[range];
  const step = range === "1D" ? 5 * 6e4 : 864e5;
  const vol = range === "1D" ? 0.0015 : 0.012;
  const r = rng(hash(key + range) + day());
  const out: Point[] = [];
  let p = last;
  const end = Date.now();
  for (let i = 0; i < n; i++) {
    out.unshift({ t: end - i * step, p: +p.toFixed(2), v: Math.floor(r() * 1e6) });
    p = p / (1 + (r() - 0.5) * 2 * vol);
  }
  return out;
}

export function sampleAnnouncements(): Announcement[] {
  return BASE.slice(0, 8).map(([t, name], i) => ({
    id: `s${i}`,
    kind: i % 2 ? "financial" : "disclosure",
    company: name,
    title: i % 2 ? "Interim Financial Statements for the latest quarter" : "Corporate Disclosure",
    ts: Date.now() - i * 54e5,
  }));
}
