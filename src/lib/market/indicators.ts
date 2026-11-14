// Technical indicators computed on closing prices.
export function sma(v: number[], n: number): number | null {
  if (v.length < n) return null;
  let s = 0;
  for (let i = v.length - n; i < v.length; i++) s += v[i];
  return s / n;
}

export function ema(v: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  v.forEach((x, i) => out.push(i === 0 ? x : x * k + out[i - 1] * (1 - k)));
  return out;
}

// Wilder's RSI
export function rsi(v: number[], n = 14): number | null {
  if (v.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = v[i] - v[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  for (let i = n + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export function macd(v: number[]): { macd: number; signal: number; hist: number } | null {
  if (v.length < 35) return null;
  const e12 = ema(v, 12), e26 = ema(v, 26);
  const line = e12.map((x, i) => x - e26[i]);
  const sig = ema(line.slice(25), 9);
  const m = line[line.length - 1], s = sig[sig.length - 1];
  return { macd: m, signal: s, hist: m - s };
}

// Annualised volatility from daily closes, in percent.
export function volatility(v: number[]): number | null {
  if (v.length < 20) return null;
  const r: number[] = [];
  for (let i = 1; i < v.length; i++) r.push(Math.log(v[i] / v[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1));
  return sd * Math.sqrt(243) * 100;
}

export function maxDrawdown(v: number[]): number | null {
  if (v.length < 2) return null;
  let peak = v[0], dd = 0;
  for (const x of v) {
    peak = Math.max(peak, x);
    dd = Math.min(dd, x / peak - 1);
  }
  return dd * 100;
}

export type Signal = { label: string; value: string; tone: "up" | "down" | "flat"; note: string };

export function technicalSummary(closes: number[]): { signals: Signal[]; verdict: "Bullish" | "Bearish" | "Neutral"; score: number } {
  const last = closes[closes.length - 1];
  const signals: Signal[] = [];
  let score = 0;
  const add = (label: string, value: string, s: number, note: string) => {
    score += s;
    signals.push({ label, value, tone: s > 0 ? "up" : s < 0 ? "down" : "flat", note });
  };
  const r = rsi(closes);
  if (r != null) add("RSI (14)", r.toFixed(1), r < 30 ? 1 : r > 70 ? -1 : 0, r < 30 ? "Oversold" : r > 70 ? "Overbought" : "Neutral");
  const s20 = sma(closes, 20), s50 = sma(closes, 50), s200 = sma(closes, 200);
  if (s20 != null) add("SMA 20", s20.toFixed(2), last > s20 ? 1 : -1, last > s20 ? "Price above" : "Price below");
  if (s50 != null) add("SMA 50", s50.toFixed(2), last > s50 ? 1 : -1, last > s50 ? "Price above" : "Price below");
  if (s200 != null) add("SMA 200", s200.toFixed(2), last > s200 ? 1 : -1, last > s200 ? "Price above" : "Price below");
  const m = macd(closes);
  if (m) add("MACD (12,26,9)", m.macd.toFixed(2), m.hist > 0 ? 1 : -1, m.hist > 0 ? "Above signal" : "Below signal");
  const vol = volatility(closes);
  if (vol != null) add("Volatility (1Y)", vol.toFixed(1) + "%", 0, vol > 45 ? "High" : vol > 25 ? "Moderate" : "Low");
  const dd = maxDrawdown(closes);
  if (dd != null) add("Max drawdown", dd.toFixed(1) + "%", 0, "Peak to trough");
  return { signals, score, verdict: score >= 2 ? "Bullish" : score <= -2 ? "Bearish" : "Neutral" };
}
