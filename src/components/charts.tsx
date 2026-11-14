"use client";
import { useId, useMemo, useState } from "react";
import type { Point, Range } from "@/lib/market/types";
import { dateLk, price as fmtPrice, pct, timeLk } from "@/lib/fmt";
import { cx, useSize } from "./ui";

function path(xs: number[], ys: number[]) {
  let d = "";
  for (let i = 0; i < xs.length; i++) d += `${i ? "L" : "M"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`;
  return d;
}

export function Sparkline({ points, up, width = 72, height = 32 }: { points: number[]; up?: boolean; width?: number; height?: number }) {
  const id = useId();
  if (points.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((p) => 3 + (1 - (p - min) / span) * (height - 6));
  const rising = up ?? points[points.length - 1] >= points[0];
  const color = rising ? "var(--up)" : "var(--down)";
  const d = path(xs, ys);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Low-high range with a marker at the current price.
export function RangeBar({ low, high, value, className }: { low: number; high: number; value: number; className?: string }) {
  const span = high - low;
  const pos = span > 0 ? Math.min(1, Math.max(0, (value - low) / span)) : 0.5;
  return (
    <div className={cx("relative h-1.5 rounded-full bg-chip", className)} role="img" aria-label={`Range ${fmtPrice(low)} to ${fmtPrice(high)}, now ${fmtPrice(value)}`}>
      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-ink" style={{ left: `${pos * 100}%` }} />
    </div>
  );
}

const niceTicks = (min: number, max: number, n = 5) => {
  const span = max - min || Math.abs(max) * 0.02 || 1;
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(6));
  return out;
};

export function PriceChart({ points, range, prevClose, height = 280, loading }: { points: Point[]; range: Range; prevClose?: number; height?: number; loading?: boolean }) {
  const [ref, w] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const padR = 58, padT = 12, padB = 26;
  const innerW = Math.max(0, w - padR), innerH = height - padT - padB;

  const m = useMemo(() => {
    if (points.length < 2 || innerW <= 0) return null;
    const base = range === "1D" && prevClose ? prevClose : points[0].p;
    const vals = points.map((p) => p.p);
    let min = Math.min(...vals, range === "1D" && prevClose ? prevClose : Infinity);
    let max = Math.max(...vals, range === "1D" && prevClose ? prevClose : -Infinity);
    const pad = (max - min) * 0.08 || max * 0.01 || 1;
    min -= pad; max += pad;
    const x = (i: number) => (i / (points.length - 1)) * innerW;
    const y = (v: number) => padT + (1 - (v - min) / (max - min)) * innerH;
    const xs = points.map((_, i) => x(i)), ys = points.map((p) => y(p.p));
    const last = vals[vals.length - 1];
    const nT = Math.min(w < 420 ? 4 : 5, points.length);
    const xTicks = Array.from({ length: nT }, (_, k) => Math.round((k / (nT - 1 || 1)) * (points.length - 1)));
    const yTicks = niceTicks(min, max);
    const dec = yTicks.some((t) => t % 1 !== 0) ? 2 : 0;
    return { base, min, max, xs, ys, y, up: last >= base, yTicks, dec, xTicks: [...new Set(xTicks)] };
  }, [points, range, prevClose, innerW, innerH, w]);

  const label = (t: number) => (range === "1D" ? timeLk(t) : dateLk(t, range === "1Y"));
  const onMove = (e: React.PointerEvent) => {
    if (!m) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / innerW));
    setHover(Math.round(frac * (points.length - 1)));
  };
  const color = m?.up ? "var(--up)" : "var(--down)";
  const h = hover != null && m ? Math.min(hover, points.length - 1) : null;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {!m ? (
        <div className="flex h-full items-center justify-center text-[14px] text-muted">{loading || !w ? <div className="skeleton h-full w-full" /> : "No trades in this period"}</div>
      ) : (
        <>
          <svg width={w} height={height} className="block touch-pan-y" role="img" aria-label="Price chart"
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.2" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {m.yTicks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerW} y1={m.y(t)} y2={m.y(t)} stroke="var(--line)" strokeWidth="1" />
                <text x={w} y={m.y(t) + 4} textAnchor="end" fontSize="11.5" fill="var(--muted)" className="num">{t.toLocaleString("en-LK", { minimumFractionDigits: m.dec, maximumFractionDigits: m.dec })}</text>
              </g>
            ))}
            {m.xTicks.map((i, k) => (
              <text key={i} x={m.xs[i]} y={height - 6} fontSize="11.5" fill="var(--muted)" textAnchor={k === 0 ? "start" : k === m.xTicks.length - 1 ? "end" : "middle"}>{label(points[i].t)}</text>
            ))}
            <line x1={0} x2={innerW} y1={m.y(m.base)} y2={m.y(m.base)} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
            <path d={`${path(m.xs, m.ys)}L${innerW},${padT + innerH}L0,${padT + innerH}Z`} fill={`url(#${id})`} />
            <path d={path(m.xs, m.ys)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {h != null && (
              <g>
                <line x1={m.xs[h]} x2={m.xs[h]} y1={padT} y2={padT + innerH} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 4" />
                <circle cx={m.xs[h]} cy={m.ys[h]} r="5" fill={color} stroke="var(--card)" strokeWidth="2.5" />
              </g>
            )}
          </svg>
          {h != null && (
            <div className="num pointer-events-none absolute top-1 z-10 min-w-[136px] rounded-[14px] bg-hero px-3 py-2 text-[12.5px] text-hero-ink shadow-lg"
              style={{ left: Math.min(Math.max(m.xs[h] - 68, 0), Math.max(0, innerW - 136)) }}>
              <div className="flex justify-between gap-4"><span className="text-hero-muted">{label(points[h].t)}</span><span className="font-semibold">{fmtPrice(points[h].p)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-hero-muted">Change</span>
                <span className={cx("font-semibold", points[h].p >= m.base ? "text-[#4ade80]" : "text-[#f87171]")}>{pct((points[h].p / m.base - 1) * 100)}</span></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
