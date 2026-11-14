"use client";
import Link from "next/link";
import { useStock } from "@/lib/api";
import type { IndexQuote, Quote } from "@/lib/market/types";
import { compact, price, signed, titleCase } from "@/lib/fmt";
export { titleCase };
import { Avatar, Card, Change, cx, Skeleton } from "./ui";
import { Sparkline } from "./charts";

export function IndexCard({ index }: { index: IndexQuote }) {
  const { data } = useStock(index.code, "1D");
  const pts = data?.points.map((p) => p.p) || [];
  return (
    <Link href={`/stock/${index.code}`} className="press block">
      <Card className="flex h-full flex-col gap-2 p-4">
        <div className="flex h-[30px] items-center justify-between gap-2">
          <p className="text-[13px] font-medium whitespace-nowrap text-muted">{index.code === "SNP" ? "S&P SL20" : "ASPI"}</p>
          <Sparkline points={pts} up={index.change >= 0} width={60} height={30} />
        </div>
        <p className="num text-[20px] leading-none font-bold tracking-[-0.01em]">{price(index.value)}</p>
        <p className="num flex flex-wrap items-center gap-x-2 text-[13px]"><Change value={index.changePct} /><span className="text-muted">{signed(index.change)}</span></p>
      </Card>
    </Link>
  );
}

export function StockRow({ q, spark, right }: { q: Quote; spark?: boolean; right?: React.ReactNode }) {
  return (
    <Link href={`/stock/${q.ticker}`} className="press flex min-h-[64px] items-center gap-3 px-4 py-2.5 hover:bg-chip/50">
      <Avatar label={q.ticker} size={40} square />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-tight font-bold">{q.ticker}</span>
        <span className="block truncate text-[12.5px] text-muted">{titleCase(q.name)}</span>
      </span>
      {spark && <RowSpark ticker={q.ticker} up={q.change >= 0} />}
      <span className="num shrink-0 text-right">
        <span className="block text-[15px] leading-tight font-bold">{price(q.price)}</span>
        <Change value={q.changePct} className="text-[12.5px]" />
      </span>
      {right}
    </Link>
  );
}

function RowSpark({ ticker, up }: { ticker: string; up: boolean }) {
  const { data } = useStock(ticker, "1M");
  if (!data) return <Skeleton className="h-7 w-16" />;
  return <Sparkline points={data.points.map((p) => p.p)} up={data.points.length > 1 ? data.points[data.points.length - 1].p >= data.points[0].p : up} width={64} height={28} />;
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="num truncate text-[15px] font-semibold">{value}</p>
      {sub && <p className="num text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

export const cap = (v: number) => (v > 0 ? `Rs ${compact(v)}` : "—");
