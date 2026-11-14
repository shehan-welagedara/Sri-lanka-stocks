"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { useMarket } from "@/lib/api";
import type { Quote } from "@/lib/market/types";
import { compact, price, signed } from "@/lib/fmt";
import { Avatar, Button, Card, Change, cx, Empty, Field, inputCls, PageHeader, SectionTitle, Segmented, Sheet, Skeleton } from "@/components/ui";
import { cap, IndexCard, StockRow, titleCase } from "@/components/market";
import { RangeBar } from "@/components/charts";
import { MarketStatus, SymbolSearch } from "@/components/app";

const VIEWS = [{ value: "active", label: "Most active" }, { value: "gainers", label: "Gainers" }, { value: "losers", label: "Losers" }, { value: "cap", label: "Largest" }, { value: "all", label: "A–Z" }] as const;
type View = (typeof VIEWS)[number]["value"];
type SortKey = "ticker" | "price" | "changePct" | "volume" | "turnover" | "marketCap";
type Filters = { minPrice: string; maxPrice: string; minTurnover: string; size: "any" | "large" | "mid" | "small"; cls: "any" | "voting" | "nonvoting" };
const NO_FILTERS: Filters = { minPrice: "", maxPrice: "", minTurnover: "", size: "any", cls: "any" };
const VIEW_SORT: Record<View, [SortKey, 1 | -1]> = { active: ["turnover", -1], gainers: ["changePct", -1], losers: ["changePct", 1], cap: ["marketCap", -1], all: ["ticker", 1] };

export default function MarketsPage() {
  const { market } = useMarket();
  const [view, setView] = useState<View>("active");
  const [sort, setSort] = useState<[SortKey, 1 | -1] | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [shown, setShown] = useState(40);
  const activeFilters = Object.entries(filters).filter(([, v]) => v && v !== "any").length;

  const rows = useMemo(() => {
    if (!market) return [];
    const f = filters;
    let list = market.quotes.filter((q) => {
      if (f.minPrice && q.price < Number(f.minPrice)) return false;
      if (f.maxPrice && q.price > Number(f.maxPrice)) return false;
      if (f.minTurnover && q.turnover < Number(f.minTurnover) * 1e6) return false;
      if (f.size === "large" && q.marketCap < 50e9) return false;
      if (f.size === "mid" && (q.marketCap < 10e9 || q.marketCap >= 50e9)) return false;
      if (f.size === "small" && q.marketCap >= 10e9) return false;
      if (f.cls === "voting" && q.ticker.includes(".")) return false;
      if (f.cls === "nonvoting" && !q.ticker.includes(".")) return false;
      return true;
    });
    if (view === "gainers") list = list.filter((q) => q.changePct > 0 && q.volume > 0);
    if (view === "losers") list = list.filter((q) => q.changePct < 0 && q.volume > 0);
    const [key, dir] = sort || VIEW_SORT[view];
    return [...list].sort((a, b) => (key === "ticker" ? a.ticker.localeCompare(b.ticker) * dir : ((a[key] as number) - (b[key] as number)) * dir));
  }, [market, view, sort, filters]);

  const th = (label: string, key: SortKey, align = "text-right") => {
    const cur = sort || VIEW_SORT[view];
    const on = cur[0] === key;
    return (
      <th scope="col" className={cx("px-3 py-0 font-semibold", align)} aria-sort={on ? (cur[1] === 1 ? "ascending" : "descending") : "none"}>
        <button className={cx("inline-flex h-11 items-center gap-1 hover:text-ink", on && "text-ink")} onClick={() => setSort([key, on ? (cur[1] === 1 ? -1 : 1) : key === "ticker" ? 1 : -1])}>
          {label}{on && (cur[1] === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
        </button>
      </th>
    );
  };

  return (
    <div>
      <PageHeader title="Markets" right={<MarketStatus />} />
      <div className="space-y-6 px-4 pt-2 lg:px-0">
        <div className="xl:hidden"><SymbolSearch placeholder='Try "JKH"' /></div>
        <div className="grid grid-cols-2 gap-4">
          {market ? market.summary.indices.map((i) => <IndexCard key={i.code} index={i} />) : [0, 1].map((i) => <Skeleton key={i} className="h-[104px] !rounded-[24px]" />)}
        </div>

        <section>
          <SectionTitle>Sectors</SectionTitle>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {market ? [...market.sectors].sort((a, b) => b.changePct - a.changePct).map((s) => (
              <Card key={s.symbol} className="flex h-[84px] w-[168px] shrink-0 flex-col justify-between p-3.5">
                <p className="truncate text-[13px] font-semibold" title={s.name}>{s.name}</p>
                <p className="num flex items-baseline justify-between gap-2 text-[13px]"><span className="text-muted">{price(s.value)}</span><Change value={s.changePct} /></p>
              </Card>
            )) : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[84px] w-[168px] shrink-0 !rounded-[24px]" />)}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Segmented value={view} onChange={(v) => { setView(v); setSort(null); setShown(40); }} options={VIEWS} className="-mx-4 flex-1 px-4 lg:mx-0 lg:px-0" />
            <button onClick={() => { setDraft(filters); setSheet(true); }} aria-label="Screener filters" className={cx("press relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold", activeFilters ? "bg-lime text-lime-ink" : "bg-card")}>
              <SlidersHorizontal size={16} /><span className="hidden sm:inline">Screener</span>{activeFilters > 0 && <span className="num">{activeFilters}</span>}
            </button>
          </div>
          <Card className="overflow-hidden">
            {!market ? <Skeleton className="m-4 h-80" /> : rows.length === 0 ? <Empty title="No companies match" body="Loosen the screener filters to see more." action={<Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>} /> : (
              <>
                {/* Desktop table */}
                <table className="hidden w-full table-fixed text-[14px] md:table">
                  <colgroup><col /><col className="w-[88px]" /><col className="w-[92px]" /><col className="w-[84px]" /><col className="hidden w-[96px] lg:table-column" /><col className="hidden w-[112px] 2xl:table-column" /><col className="w-[128px]" /></colgroup>
                  <thead className="border-b border-line text-[12.5px] text-muted">
                    <tr>{th("Company", "ticker", "text-left pl-4")}{th("Price", "price")}{th("Change", "changePct")}{th("Volume", "volume")}{th("Turnover", "turnover", "text-right hidden lg:table-cell")}{th("Mkt cap", "marketCap", "text-right hidden 2xl:table-cell")}<th scope="col" className="px-4 text-right font-semibold">Day range</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.slice(0, shown).map((q) => <DesktopRow key={q.symbol} q={q} />)}
                  </tbody>
                </table>
                {/* Mobile list */}
                <div className="divide-y divide-line md:hidden">{rows.slice(0, shown).map((q) => <StockRow key={q.symbol} q={q} />)}</div>
                {rows.length > shown && <div className="border-t border-line p-3"><Button variant="ghost" className="w-full" onClick={() => setShown((n) => n + 60)}>Show more ({rows.length - shown})</Button></div>}
              </>
            )}
          </Card>
          <p className="mt-3 px-1 text-[12px] text-muted">{rows.length} securities · Prices in LKR, delayed · Source: Colombo Stock Exchange public data</p>
        </section>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Stock screener">
        <form onSubmit={(e) => { e.preventDefault(); setFilters(draft); setShown(40); setSheet(false); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min price (Rs)"><input className={inputCls} inputMode="decimal" value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="Any" /></Field>
            <Field label="Max price (Rs)"><input className={inputCls} inputMode="decimal" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="Any" /></Field>
          </div>
          <Field label="Min turnover today (Rs million)"><input className={inputCls} inputMode="decimal" value={draft.minTurnover} onChange={(e) => setDraft({ ...draft, minTurnover: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="Any" /></Field>
          <Field label="Company size (market cap)"><Segmented size="sm" value={draft.size} onChange={(size) => setDraft({ ...draft, size })} options={[{ value: "any", label: "Any" }, { value: "large", label: "Large 50B+" }, { value: "mid", label: "Mid 10–50B" }, { value: "small", label: "Small <10B" }]} /></Field>
          <Field label="Share class"><Segmented size="sm" value={draft.cls} onChange={(cls) => setDraft({ ...draft, cls })} options={[{ value: "any", label: "Any" }, { value: "voting", label: "Ordinary voting" }, { value: "nonvoting", label: "Non-voting & other" }]} /></Field>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={() => setDraft(NO_FILTERS)}>Reset</Button>
            <Button variant="lime">Show results</Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}

function DesktopRow({ q }: { q: Quote }) {
  return (
    <tr className="group h-[60px] hover:bg-chip/50">
      <td className="pl-4">
        <Link href={`/stock/${q.ticker}`} className="flex items-center gap-3">
          <Avatar label={q.ticker} size={36} square />
          <span className="min-w-0"><span className="block font-bold group-hover:underline">{q.ticker}</span><span className="block truncate text-[12.5px] text-muted">{titleCase(q.name)}</span></span>
        </Link>
      </td>
      <td className="num px-3 text-right font-semibold">{price(q.price)}</td>
      <td className="num px-3 text-right"><Change value={q.changePct} /><span className="block text-[12px] text-muted">{signed(q.change)}</span></td>
      <td className="num px-3 text-right text-muted">{compact(q.volume)}</td>
      <td className="num hidden px-3 text-right text-muted lg:table-cell">{compact(q.turnover)}</td>
      <td className="num hidden px-3 text-right text-muted 2xl:table-cell">{cap(q.marketCap)}</td>
      <td className="px-4">
        {q.high > 0 && q.low > 0 ? <><RangeBar low={q.low} high={q.high} value={q.price} /><span className="num mt-1.5 flex justify-between text-[11.5px] text-muted"><span>{price(q.low)}</span><span>{price(q.high)}</span></span></> : <span className="block text-right text-muted">—</span>}
      </td>
    </tr>
  );
}
