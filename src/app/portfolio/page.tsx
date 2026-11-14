"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Star, Trash2 } from "lucide-react";
import { useMarket } from "@/lib/api";
import { alertsStore, holdingsStore, useLocal, watchlistStore } from "@/lib/local";
import { compact, int, lkr, pct, price } from "@/lib/fmt";
import { Avatar, Button, Card, Change, cx, Empty, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { StockRow } from "@/components/market";
import { HoldingSheet } from "@/components/sheets";
import { useApp } from "@/components/app";

const COLORS = ["#c6f135", "#0b9a6b", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6", "#64748b"];

export default function PortfolioPage() {
  const { market } = useMarket();
  const holdings = useLocal(holdingsStore);
  const watch = useLocal(watchlistStore);
  const alerts = useLocal(alertsStore);
  const { toast } = useApp();
  const [add, setAdd] = useState(false);
  const quotes = market?.quotes;

  const rows = useMemo(() => {
    if (!quotes) return [];
    return holdings.map((h) => {
      const q = quotes.find((x) => x.ticker === h.ticker);
      const last = q?.price ?? h.cost;
      const value = last * h.qty;
      return { ...h, q, last, value, gain: value - h.cost * h.qty, gainPct: (last / h.cost - 1) * 100, day: (q?.change ?? 0) * h.qty };
    }).sort((a, b) => b.value - a.value);
  }, [quotes, holdings]);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const cost = rows.reduce((s, r) => s + r.cost * r.qty, 0);
  const day = rows.reduce((s, r) => s + r.day, 0);
  const gain = total - cost;
  const watchRows = quotes ? watch.map((w) => quotes.find((q) => q.ticker === w)).filter((q) => !!q) : [];
  const activeAlerts = alerts.filter((a) => !a.fired);

  const exportCsv = () => {
    const csv = ["Ticker,Shares,Avg cost,Last,Value,Gain,Gain %", ...rows.map((r) => [r.ticker, r.qty, r.cost.toFixed(2), r.last.toFixed(2), r.value.toFixed(2), r.gain.toFixed(2), r.gainPct.toFixed(2)].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "portfolio.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const remove = (ticker: string) => { holdingsStore.set((all) => all.filter((h) => h.ticker !== ticker)); toast(`${ticker} removed`); };

  return (
    <div>
      <PageHeader title="Portfolio" />
      <div className="space-y-7 px-4 pt-2 lg:px-0">
        {/* Balance hero */}
        <div className="rings rounded-[28px] bg-hero px-5 pt-6 pb-5 text-center text-hero-ink">
          <p className="text-[14px] text-hero-muted">Your balance</p>
          {quotes ? <p className="num mt-1 text-[34px] leading-tight font-bold tracking-[-0.02em]">{lkr(total)}</p> : <div className="mx-auto mt-2 h-9 w-52 rounded-lg bg-hero-2" />}
          <p className="num mt-1 text-[13.5px]">
            <span className={gain >= 0 ? "text-lime" : "text-[#fca5a5]"}>{gain >= 0 ? "+" : "−"}Rs {compact(Math.abs(gain))} ({pct(cost ? (total / cost - 1) * 100 : 0)})</span>
            <span className="text-hero-muted"> all time · today {day >= 0 ? "+" : "−"}Rs {compact(Math.abs(day))}</span>
          </p>
          <div className="relative z-10 mx-auto mt-5 grid max-w-[360px] grid-cols-3 gap-2 rounded-[22px] bg-hero-2 p-3">
            <HeroAction label="Add" primary onClick={() => setAdd(true)}><Plus size={21} strokeWidth={2.5} /></HeroAction>
            <HeroAction label="Export" onClick={exportCsv} disabled={!rows.length}><Download size={19} /></HeroAction>
            <Link href="/markets" className="press flex flex-col items-center gap-1.5 py-1"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><Star size={19} /></span><span className="text-[13px] font-medium">Discover</span></Link>
          </div>
        </div>

        <section>
          <SectionTitle action={rows.length > 0 && <span>{rows.length} {rows.length === 1 ? "company" : "companies"}</span>}>Holdings</SectionTitle>
          <Card className="overflow-hidden">
            {!quotes ? <Skeleton className="m-4 h-40" /> : rows.length === 0 ? (
              <Empty title="No holdings yet" body="Add the shares you own to track value, profit and allocation. Everything stays on your device." action={<Button variant="lime" onClick={() => setAdd(true)}>Add your first holding</Button>} />
            ) : (
              <>
                <div className="mx-4 mt-4 mb-1 flex h-2.5 overflow-hidden rounded-full" role="img" aria-label="Portfolio allocation">
                  {rows.map((r, i) => <span key={r.ticker} title={`${r.ticker} ${((r.value / total) * 100).toFixed(1)}%`} style={{ width: `${(r.value / total) * 100}%`, background: COLORS[i % COLORS.length] }} className="border-r-2 border-card last:border-0" />)}
                </div>
                <ul className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <li key={r.ticker} className="flex min-h-[72px] items-center gap-3 px-4 py-2.5">
                      <Link href={`/stock/${r.ticker}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="relative"><Avatar label={r.ticker} size={40} square /><span className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-card" style={{ background: COLORS[i % COLORS.length] }} /></span>
                        <span className="min-w-0">
                          <span className="block text-[15px] leading-tight font-bold">{r.ticker}</span>
                          <span className="num block truncate text-[12.5px] text-muted">{int(r.qty)} × {price(r.cost)}</span>
                        </span>
                      </Link>
                      <span className="num shrink-0 text-right">
                        <span className="block text-[15px] leading-tight font-bold">{lkr(r.value)}</span>
                        <span className={cx("text-[12.5px] font-semibold", r.gain >= 0 ? "text-up" : "text-down")}>{r.gain >= 0 ? "+" : "−"}{compact(Math.abs(r.gain))} <Change value={r.gainPct} className="text-[12.5px]" /></span>
                      </span>
                      <button aria-label={`Remove ${r.ticker}`} onClick={() => remove(r.ticker)} className="press -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-chip hover:text-down"><Trash2 size={17} /></button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle action={<Link href="/markets">Add</Link>}>Watchlist</SectionTitle>
          <Card className="overflow-hidden py-1.5">
            {!quotes ? <Skeleton className="m-4 h-32" /> : watchRows.length ? watchRows.map((q) => q && (
              <StockRow key={q.symbol} q={q} spark right={
                <button aria-label={`Remove ${q.ticker} from watchlist`} onClick={(e) => { e.preventDefault(); watchlistStore.set((w) => w.filter((x) => x !== q.ticker)); }} className="press -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-chip"><Star size={18} className="fill-ink" /></button>} />
            )) : <Empty title="Your watchlist is empty" body="Open any company and tap the star." />}
          </Card>
        </section>

        {activeAlerts.length > 0 && (
          <section>
            <SectionTitle>Price alerts</SectionTitle>
            <Card className="divide-y divide-line overflow-hidden">
              {activeAlerts.map((a) => (
                <div key={a.id} className="flex h-14 items-center justify-between px-4 text-[14.5px]">
                  <Link href={`/stock/${a.ticker}`} className="num"><span className="font-bold">{a.ticker}</span> {a.dir} Rs {price(a.price)}</Link>
                  <button className="text-[14px] font-semibold text-down" onClick={() => alertsStore.set((all) => all.filter((x) => x.id !== a.id))}>Remove</button>
                </div>
              ))}
            </Card>
          </section>
        )}
      </div>
      <HoldingSheet open={add} onClose={() => setAdd(false)} />
    </div>
  );
}

function HeroAction({ label, primary, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; primary?: boolean }) {
  return (
    <button className="press flex flex-col items-center gap-1.5 py-1 disabled:opacity-40" {...rest}>
      <span className={cx("flex h-11 w-11 items-center justify-center rounded-full", primary ? "bg-lime text-lime-ink" : "bg-white/10")}>{children}</span>
      <span className="text-[13px] font-medium">{label}</span>
    </button>
  );
}
