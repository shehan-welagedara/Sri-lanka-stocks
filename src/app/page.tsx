"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowUpRight, Plus } from "lucide-react";
import { api, useMarket, useMe } from "@/lib/api";
import { holdingsStore, useLocal, watchlistStore } from "@/lib/local";
import { ago, compact, dateLk, lkr, pct } from "@/lib/fmt";
import type { Announcement } from "@/lib/market/types";
import type { FeedPost } from "@/lib/social/types";
import { Avatar, Card, Change, cx, Empty, SectionTitle, Segmented, Skeleton } from "@/components/ui";
import { IndexCard, StockRow, titleCase } from "@/components/market";
import { MarketStatus, SymbolSearch } from "@/components/app";
import { PostCard } from "@/components/feed";

const MOVERS = [{ value: "gainers", label: "Gainers" }, { value: "losers", label: "Losers" }, { value: "active", label: "Most active" }] as const;

export default function HomePage() {
  const { market } = useMarket();
  const me = useMe();
  const watch = useLocal(watchlistStore);
  const holdings = useLocal(holdingsStore);
  const [movers, setMovers] = useState<(typeof MOVERS)[number]["value"]>("gainers");
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);
  const { data: ann } = useSWR<{ items: Announcement[] }>("/api/announcements", (u: string) => api<{ items: Announcement[] }>(u), { refreshInterval: 120_000 });
  const { data: top } = useSWR<{ posts: FeedPost[] }>("/api/feed?tab=foryou", (u: string) => api<{ posts: FeedPost[] }>(u), { revalidateOnFocus: false });

  const quotes = market?.quotes;
  const port = useMemo(() => {
    if (!quotes) return null;
    let value = 0, cost = 0, day = 0;
    for (const h of holdings) {
      const q = quotes.find((x) => x.ticker === h.ticker);
      if (!q) continue;
      value += q.price * h.qty; cost += h.cost * h.qty; day += q.change * h.qty;
    }
    return { value, cost, day, gainPct: cost ? (value / cost - 1) * 100 : 0 };
  }, [quotes, holdings]);

  const moverRows = useMemo(() => {
    if (!quotes) return [];
    const traded = quotes.filter((q) => q.volume > 0 && !q.ticker.includes("."));
    if (movers === "active") return [...traded].sort((a, b) => b.turnover - a.turnover).slice(0, 5);
    return [...traded].sort((a, b) => (movers === "gainers" ? b.changePct - a.changePct : a.changePct - b.changePct)).slice(0, 5);
  }, [quotes, movers]);

  const aspi = market?.summary.indices[0];
  const b = market?.summary.breadth;
  const breadthPct = b && b.up + b.down ? (b.up / (b.up + b.down)) * 100 : 50;
  const greeting = hour == null ? "Hello" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const watchRows = quotes ? watch.map((w) => quotes.find((q) => q.ticker === w)).filter((q) => !!q) : [];

  return (
    <div>
      <header className="flex min-h-[64px] items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+8px)] lg:px-0 lg:pt-6">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] leading-tight tracking-[-0.02em] lg:text-[28px]">{greeting}, <span className="font-extrabold">{me?.onboarded ? me.name.split(" ")[0] : "investor"}</span></h1>
          <div className="mt-0.5"><MarketStatus /></div>
        </div>
        <Link href="/profile" aria-label="Profile" className="press shrink-0 lg:hidden"><Avatar label={me?.name || "?"} size={44} /></Link>
      </header>

      <div className="space-y-7 px-4 pt-3 lg:px-0">
        <div className="xl:hidden"><SymbolSearch placeholder='Try "JKH" or "Commercial Bank"' /></div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Portfolio hero */}
          <Link href="/portfolio" className="press block overflow-hidden rounded-[24px] bg-hero text-hero-ink">
            <div className="flex h-11 items-center justify-between bg-lime px-5 text-[13px] font-semibold text-lime-ink">
              <span>Your portfolio</span>
              <span>{dateLk(Date.now(), true)}</span>
            </div>
            <div className="rings flex min-h-[112px] items-end justify-between gap-3 px-5 py-5">
              {port && holdings.length > 0 ? (
                <>
                  <div className="min-w-0">
                    <p className="text-[13px] text-hero-muted">Total value</p>
                    <p className="num truncate text-[28px] leading-tight font-bold tracking-[-0.02em]">{lkr(port.value)}</p>
                    <p className="num mt-0.5 text-[13px] text-hero-muted">Today {port.day >= 0 ? "+" : "−"}Rs {compact(Math.abs(port.day))}</p>
                  </div>
                  <span className={cx("num relative z-10 mb-1 shrink-0 text-[15px] font-bold", port.gainPct >= 0 ? "text-lime" : "text-[#f87171]")}>{port.gainPct >= 0 ? "▲" : "▼"} {pct(port.gainPct).replace(/^[+−]/, "")}</span>
                </>
              ) : (
                <>
                  <div><p className="text-[18px] leading-snug font-bold">Track your investments</p><p className="mt-0.5 text-[13px] text-hero-muted">Add your first holding to see profit and loss.</p></div>
                  <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-lime-ink"><Plus size={22} strokeWidth={2.6} /></span>
                </>
              )}
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col justify-between gap-3 p-4">
              <p className="text-[13px] font-medium text-muted">Market direction</p>
              {aspi ? <p className="text-[20px] leading-tight font-bold tracking-[-0.01em]">{aspi.changePct > 0.15 ? "Bullish" : aspi.changePct < -0.15 ? "Bearish" : "Flat"}</p> : <Skeleton className="h-6 w-20" />}
              <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted">{aspi && <Change value={aspi.changePct} className="text-[12.5px]" />}<span className="whitespace-nowrap">ASPI today</span></p>
            </Card>
            <Card className="flex flex-col justify-between gap-3 p-4">
              <p className="text-[13px] font-medium text-muted">Market breadth</p>
              {b ? <p className="text-[20px] leading-tight font-bold tracking-[-0.01em]">{breadthPct > 55 ? "Broad gains" : breadthPct < 45 ? "Broad losses" : "Mixed"}</p> : <Skeleton className="h-6 w-20" />}
              <div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-down" role="img" aria-label={`${b?.up ?? 0} advancers, ${b?.down ?? 0} decliners`}><span className="bg-up" style={{ width: `${breadthPct}%` }} /></div>
                <p className="num mt-1.5 flex justify-between text-[12.5px] text-muted"><span>{b?.up ?? "–"} up</span><span>{b?.down ?? "–"} down</span></p>
              </div>
            </Card>
          </div>
        </div>

        <section>
          <SectionTitle action={market && <span className="num">Turnover Rs {compact(market.summary.turnover)}</span>}>Indices</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            {market ? market.summary.indices.map((i) => <IndexCard key={i.code} index={i} />) : [0, 1].map((i) => <Skeleton key={i} className="h-[104px] !rounded-[24px]" />)}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:gap-4 xl:grid-cols-1 xl:gap-7 2xl:grid-cols-2 2xl:gap-4">
          <section>
            <SectionTitle action={<Link href="/markets">Add</Link>}>Watchlist</SectionTitle>
            <Card className="overflow-hidden py-1.5">
              {!quotes ? <Skeleton className="m-4 h-40" /> : watchRows.length ? watchRows.map((q) => q && <StockRow key={q.symbol} q={q} spark />)
                : <Empty title="Your watchlist is empty" body="Open any company and tap the star to follow its price." />}
            </Card>
          </section>
          <section>
            <SectionTitle action={<Link href="/markets">See all</Link>}>Top movers</SectionTitle>
            <Card className="overflow-hidden pb-1.5">
              <Segmented value={movers} onChange={setMovers} options={MOVERS} size="sm" className="px-3 pt-3 pb-1.5" />
              {!quotes ? <Skeleton className="m-4 h-40" /> : moverRows.map((q) => <StockRow key={q.symbol} q={q} />)}
            </Card>
          </section>
        </div>

        <section>
          <SectionTitle action={<Link href="/feed" className="inline-flex items-center gap-0.5">Open feed <ArrowUpRight size={15} /></Link>}>From the community</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {!top ? <Skeleton className="m-4 h-32" /> : top.posts.filter((p) => !p.promoted).slice(0, 3).map((p) => <PostCard key={p.id} post={p} />)}
          </Card>
        </section>

        <section>
          <SectionTitle action={<Link href="/feed?tab=news">See more</Link>}>Company announcements</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {!ann ? <Skeleton className="m-4 h-32" /> : ann.items.slice(0, 5).map((a) => {
              const body = (
                <>
                  <p className="text-[14px] leading-snug font-bold">{titleCase(a.company)}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13.5px] text-muted">{a.title}</p>
                  <p className="mt-1.5 flex justify-between text-[12px] text-muted"><span>{ago(a.ts)}</span><span>{a.kind === "financial" ? "Financial report" : "CSE disclosure"}</span></p>
                </>
              );
              return a.url ? <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block px-4 py-3.5 hover:bg-chip/50">{body}</a> : <div key={a.id} className="px-4 py-3.5">{body}</div>;
            })}
          </Card>
        </section>
      </div>
    </div>
  );
}
