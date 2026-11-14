"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Bell, Lock, Star } from "lucide-react";
import { useMarket, useMe, useStock } from "@/lib/api";
import { alertsStore, useLocal, watchlistStore } from "@/lib/local";
import { RANGES, type Range } from "@/lib/market/types";
import { compact, int, price, signed, timeLk } from "@/lib/fmt";
import { site } from "@/config/site";
import { Button, Card, Change, cx, Empty, IconButton, PageHeader, SectionTitle, Segmented, Skeleton } from "@/components/ui";
import { PriceChart, RangeBar } from "@/components/charts";
import { cap, Stat, titleCase } from "@/components/market";
import { FeedList } from "@/components/feed";
import { AlertSheet, BrokerSheet, HoldingSheet } from "@/components/sheets";
import { useApp } from "@/components/app";

export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const key = decodeURIComponent(use(params).symbol).toUpperCase();
  const isIndex = key === "ASPI" || key === "SNP";
  const [range, setRange] = useState<Range>("1M");
  const { data, error, isLoading } = useStock(key, range, !isIndex);
  const { market } = useMarket();
  const me = useMe();
  const watch = useLocal(watchlistStore);
  const alerts = useLocal(alertsStore);
  const { toast, compose } = useApp();
  const [sheet, setSheet] = useState<"" | "hold" | "alert" | "broker">("");

  const live = market?.quotes.find((q) => q.ticker === key || q.symbol === key);
  const q = live || data?.quote;
  const idx = isIndex ? market?.summary.indices.find((i) => i.code === key) || data?.index : undefined;
  const ticker = q?.ticker || key;
  const starred = watch.includes(ticker);
  const hasAlert = alerts.some((a) => a.ticker === ticker && !a.fired);

  const toggleStar = () => {
    if (!starred && !me?.premium && watch.length >= site.free.watchlist) return toast(`Free accounts can watch ${site.free.watchlist} companies. Upgrade to Premium for more.`, "error");
    watchlistStore.set((w) => (starred ? w.filter((x) => x !== ticker) : [...w, ticker]));
    toast(starred ? `${ticker} removed from watchlist` : `${ticker} added to watchlist`);
  };

  if (error && !data) return <div><PageHeader back title={key} /><Empty title="We couldn't find that company" body="Check the ticker symbol, or browse all companies." action={<Link href="/markets"><Button>Browse markets</Button></Link>} /></div>;

  const name = isIndex ? idx?.name : q && titleCase(q.name);
  const last = isIndex ? idx?.value : q?.price;
  const chg = isIndex ? idx?.change : q?.change;
  const chgPct = isIndex ? idx?.changePct : q?.changePct;
  const info = data?.info;
  const tech = data?.technicals;
  const sample = data?.source === "sample" || data?.historySource === "sample";

  return (
    <div>
      <PageHeader back title={isIndex ? (key === "SNP" ? "S&P SL20" : "ASPI") : ticker} subtitle={name}
        right={!isIndex && <>
          <IconButton label="Price alerts" onClick={() => setSheet("alert")} className={cx(hasAlert && "bg-lime text-lime-ink")}><Bell size={19} className={hasAlert ? "fill-current" : ""} /></IconButton>
          <IconButton label={starred ? "Remove from watchlist" : "Add to watchlist"} aria-pressed={starred} onClick={toggleStar}><Star size={20} className={starred ? "fill-ink" : ""} /></IconButton>
        </>} />

      <div className="grid gap-4 px-4 pt-2 lg:px-0 2xl:grid-cols-[minmax(0,1fr)_340px] 2xl:items-start">
        <div className="min-w-0 space-y-4">
          {/* Price hero */}
          <div className="rings flex min-h-[92px] items-center justify-between gap-3 rounded-[24px] bg-hero px-5 py-4 text-hero-ink">
            <div className="min-w-0">
              {last != null ? <p className="num truncate text-[28px] leading-tight font-bold tracking-[-0.02em]">{isIndex ? price(last) : `Rs ${price(last)}`}</p> : <div className="h-8 w-36 rounded-lg bg-hero-2" />}
              <p className="num mt-0.5 truncate text-[13px] text-hero-muted">
                {chg != null && <span>{signed(chg)} today</span>}
                {q?.lastTraded ? <span> · {timeLk(q.lastTraded)}</span> : null}{!isIndex && q && <span className="hidden sm:inline"> · Mkt cap {cap(q.marketCap)}</span>}
              </p>
            </div>
            {chgPct != null && <span className={cx("num relative z-10 shrink-0 rounded-full bg-hero-2 px-3 py-1.5 text-[13.5px] font-bold", chgPct >= 0 ? "text-[#86efac]" : "text-[#fca5a5]")}>{chgPct >= 0 ? "▲" : "▼"} {Math.abs(chgPct).toFixed(2)}%</span>}
          </div>

          {/* Chart */}
          <div>
            <Segmented value={range} onChange={setRange} options={RANGES} className="mb-3 justify-between sm:justify-start" />
            <Card className="p-4 pr-3">
              <PriceChart points={data?.points || []} range={range} prevClose={data?.prevClose} loading={isLoading} height={300} />
            </Card>
            {sample && <p className="mt-2 px-1 text-[12px] font-medium text-[#b45309]">Sample data shown — the live market source is unavailable right now.</p>}
          </div>

          {!isIndex && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="dark" onClick={() => setSheet("hold")}>Add to portfolio</Button>
              <Button variant="lime" onClick={() => setSheet("broker")}>Invest via broker</Button>
            </div>
          )}

        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-4 2xl:col-start-2 2xl:row-span-2 2xl:row-start-1">
          {!isIndex && (
            <Card className="p-5">
              <SectionTitle>Key statistics</SectionTitle>
              {q ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-1 sm:grid-cols-3 2xl:grid-cols-2">
                    <Stat label="Open" value={q.open ? price(q.open) : "—"} />
                    <Stat label="Previous close" value={price(q.prevClose)} />
                    <Stat label="Volume" value={int(q.volume)} sub={`${int(q.trades)} trades`} />
                    <Stat label="Turnover" value={`Rs ${compact(q.turnover)}`} />
                    <Stat label="Market cap" value={cap(q.marketCap)} />
                    <Stat label="Shares issued" value={info?.issued ? compact(info.issued) : "—"} />
                    <Stat label="Beta (vs ASPI)" value={info?.beta ? info.beta.toFixed(2) : "—"} />
                    <Stat label="Listed" value={info?.listed ? titleCase(info.listed.replace(/\//g, " ")) : "—"} />
                  </div>
                  <div className="mt-5 space-y-4 px-1">
                    {q.high > 0 && q.low > 0 && <RangeRow label="Day range" low={q.low} high={q.high} value={q.price} />}
                    {info?.hi52 && info.lo52 ? <RangeRow label="52-week range" low={info.lo52} high={info.hi52} value={q.price} /> : null}
                  </div>
                </>
              ) : <Skeleton className="h-48" />}
            </Card>
          )}
          {isIndex && idx && (
            <Card className="p-5">
              <SectionTitle>Today</SectionTitle>
              <div className="grid grid-cols-2 gap-4 px-1"><Stat label="High" value={price(idx.high)} /><Stat label="Low" value={price(idx.low)} /><Stat label="Advancers" value={market?.summary.breadth.up ?? "—"} /><Stat label="Decliners" value={market?.summary.breadth.down ?? "—"} /></div>
              <div className="mt-5 px-1"><RangeRow label="Day range" low={idx.low} high={idx.high} value={idx.value} /></div>
            </Card>
          )}

          {!isIndex && (
            <Card className="p-5">
              <SectionTitle action={tech && <span className={cx("rounded-full px-2.5 py-1 text-[12.5px] font-bold", tech.verdict === "Bullish" ? "bg-up-soft text-up" : tech.verdict === "Bearish" ? "bg-down-soft text-down" : "bg-chip text-muted")}>{tech.verdict}</span>}>Technical analysis</SectionTitle>
              {!data ? <Skeleton className="h-40" /> : !tech ? <p className="px-1 text-[14px] text-muted">Not enough trading history to calculate indicators.</p> : (
                <div className="relative">
                  <ul className={cx("divide-y divide-line", !me?.premium && "pointer-events-none blur-[5px] select-none")} aria-hidden={!me?.premium}>
                    {tech.signals.map((s) => (
                      <li key={s.label} className="flex h-11 items-center justify-between gap-3 px-1 text-[14px]">
                        <span className="text-muted">{s.label}</span>
                        <span className="num flex items-center gap-2 font-semibold">{s.value}<span className={cx("w-[92px] text-right text-[12.5px] font-medium", s.tone === "up" ? "text-up" : s.tone === "down" ? "text-down" : "text-muted")}>{s.note}</span></span>
                      </li>
                    ))}
                  </ul>
                  {!me?.premium && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-hero text-lime"><Lock size={18} /></span>
                      <p className="max-w-[240px] text-[14px] font-semibold">RSI, MACD, moving averages and risk metrics are a Premium feature</p>
                      <Link href="/profile#premium"><Button variant="lime" className="h-10">See Premium</Button></Link>
                    </div>
                  )}
                </div>
              )}
              <p className="mt-3 px-1 text-[12px] text-muted">Calculated from one year of daily closes. Indicators describe past prices and are not investment advice.</p>
            </Card>
          )}
        </div>

        <div className="min-w-0 2xl:col-start-1">
          {/* Discussion */}
          {!isIndex && (
            <section>
              <SectionTitle action={<button className="font-semibold text-ink" onClick={() => compose({ text: `$${ticker} ` })}>Post about ${ticker}</button>}>Discussion</SectionTitle>
              <Card className="overflow-hidden">
                <FeedList query={`ticker=${encodeURIComponent(ticker)}`} accepts={(p) => p.tickers.includes(ticker) && !p.replyTo}
                  empty={{ title: `No posts about $${ticker} yet`, body: "Be the first to share your analysis." }} />
              </Card>
            </section>
          )}
        </div>
      </div>

      {q && <HoldingSheet open={sheet === "hold"} onClose={() => setSheet("")} ticker={ticker} />}
      {q && <AlertSheet open={sheet === "alert"} onClose={() => setSheet("")} ticker={ticker} last={q.price} />}
      <BrokerSheet open={sheet === "broker"} onClose={() => setSheet("")} />
    </div>
  );
}

function RangeRow({ label, low, high, value }: { label: string; low: number; high: number; value: number }) {
  return (
    <div>
      <p className="mb-2 text-[12.5px] text-muted">{label}</p>
      <RangeBar low={low} high={high} value={value} />
      <p className="num mt-2 flex justify-between text-[12.5px] font-medium"><span>{price(low)}</span><span>{price(high)}</span></p>
    </div>
  );
}
