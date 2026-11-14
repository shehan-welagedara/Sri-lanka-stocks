"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { BarChart3, Home, MessagesSquare, PieChart, Plus, Search, User } from "lucide-react";
import { api, useMarket, useMe } from "@/lib/api";
import { alertsStore, applyTheme, prefsStore, useLocal, watchlistStore } from "@/lib/local";
import { useT } from "@/lib/i18n";
import { compact, price } from "@/lib/fmt";
import { site } from "@/config/site";
import { Avatar, Card, Change, cx, SectionTitle, Verified } from "./ui";
import { Composer, type ComposeOpts } from "./composer";
import { Onboarding } from "./onboarding";

type Toast = { id: number; text: string; tone: "ok" | "error" };
type Ctx = {
  toast: (text: string, tone?: "ok" | "error") => void;
  compose: (opts?: ComposeOpts) => void;
  onboard: (then?: () => void) => void;
};
const AppCtx = createContext<Ctx>({ toast: () => {}, compose: () => {}, onboard: () => {} });
export const useApp = () => useContext(AppCtx);

const NAV = [
  { href: "/", key: "home", icon: Home },
  { href: "/markets", key: "markets", icon: BarChart3 },
  { href: "/feed", key: "feed", icon: MessagesSquare },
  { href: "/portfolio", key: "portfolio", icon: PieChart },
  { href: "/profile", key: "profile", icon: User },
] as const;
const active = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [composeOpts, setComposeOpts] = useState<ComposeOpts | null>(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const after = useRef<(() => void) | undefined>(undefined);
  const me = useMe();
  const prefs = useLocal(prefsStore);

  useEffect(() => applyTheme(prefs.theme), [prefs.theme]);
  useEffect(() => { document.documentElement.lang = prefs.lang; }, [prefs.lang]);

  const toast = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const onboard = useCallback((then?: () => void) => { after.current = then; setOnboardOpen(true); }, []);
  const compose = useCallback((opts: ComposeOpts = {}) => {
    if (me && !me.onboarded) return onboard(() => setComposeOpts(opts));
    setComposeOpts(opts);
  }, [me, onboard]);
  const ctx = useMemo(() => ({ toast, compose, onboard }), [toast, compose, onboard]);

  const bare = path.startsWith("/admin");
  return (
    <AppCtx.Provider value={ctx}>
      <AlertWatcher />
      {bare ? <main className="mx-auto max-w-[960px] px-4 pb-16">{children}</main> : (
        <>
          <div className="mx-auto max-w-[1360px] lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:px-6 xl:grid-cols-[232px_minmax(0,1fr)_336px]">
            <Sidebar />
            <main className="min-w-0 pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-12">{children}</main>
            <RightRail />
          </div>
          <BottomTabs />
        </>
      )}
      <Composer opts={composeOpts} onClose={() => setComposeOpts(null)} />
      <Onboarding open={onboardOpen} onClose={() => setOnboardOpen(false)} onDone={() => { setOnboardOpen(false); after.current?.(); after.current = undefined; }} />
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8">
        {toasts.map((t) => (
          <div key={t.id} className={cx("sheet-in pointer-events-auto max-w-md rounded-full px-5 py-3 text-[14px] font-medium shadow-xl", t.tone === "error" ? "bg-down text-white" : "bg-hero text-hero-ink")}>{t.text}</div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex h-11 items-center gap-2.5 px-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-hero">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-9" /></svg>
      </span>
      <span className="text-[18px] font-extrabold tracking-[-0.02em]">{site.name}</span>
    </Link>
  );
}

function Sidebar() {
  const path = usePathname();
  const t = useT();
  const me = useMe();
  const { compose } = useApp();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col py-5 lg:flex">
      <Logo />
      <nav className="mt-5 flex flex-col gap-1">
        {NAV.map(({ href, key, icon: Icon }) => {
          const on = active(path, href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={cx("press flex h-12 items-center gap-3.5 rounded-full px-4 text-[16px]", on ? "bg-card font-bold shadow-[0_1px_2px_rgba(0,0,0,0.04)]" : "font-medium text-muted hover:bg-chip hover:text-ink")}>
              <Icon size={21} strokeWidth={on ? 2.4 : 2} />
              {t(key)}
            </Link>
          );
        })}
      </nav>
      <button onClick={() => compose()} className="press mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-lime text-[16px] font-bold text-lime-ink">
        <Plus size={20} strokeWidth={2.6} /> {t("post")}
      </button>
      <div className="mt-auto">
        {me && (
          <Link href="/profile" className="press flex items-center gap-3 rounded-[20px] p-2.5 hover:bg-chip">
            <Avatar label={me.name} size={40} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[14px] font-bold"><span className="truncate">{me.name}</span>{me.verified && <Verified size={15} />}</span>
              <span className="block truncate text-[13px] text-muted">@{me.handle}</span>
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}

function BottomTabs() {
  const path = usePathname();
  const t = useT();
  const { compose } = useApp();
  const items = [NAV[0], NAV[1], null, NAV[2], NAV[3]];
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
      <div className="mx-auto grid h-[64px] max-w-[560px] grid-cols-5 items-center">
        {items.map((it) => {
          if (!it)
            return (
              <button key="compose" aria-label="New post" onClick={() => compose()} className="press mx-auto -mt-6 flex h-[56px] w-[56px] items-center justify-center rounded-full bg-hero shadow-[0_8px_20px_rgba(0,0,0,0.22)] ring-4 ring-bg">
                <Plus size={26} strokeWidth={2.6} className="text-lime" />
              </button>
            );
          const on = active(path, it.href);
          const Icon = it.icon;
          return (
            <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={cx("press flex h-full flex-col items-center justify-center gap-1", on ? "text-ink" : "text-muted")}>
              <Icon size={23} strokeWidth={on ? 2.5 : 1.9} />
              <span className={cx("text-[11px] leading-none", on ? "font-bold" : "font-medium")}>{t(it.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SymbolSearch({ placeholder, autoFocus, onPick }: { placeholder?: string; autoFocus?: boolean; onPick?: (ticker: string) => void }) {
  const { market } = useMarket();
  const router = useRouter();
  const t = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!s || !market) return [];
    return market.quotes
      .filter((x) => x.ticker.startsWith(s) || x.name.includes(s))
      .sort((a, b) => Number(b.ticker.startsWith(s)) - Number(a.ticker.startsWith(s)) || b.turnover - a.turnover)
      .slice(0, 7);
  }, [q, market]);
  const pick = (ticker: string) => { setQ(""); setOpen(false); if (onPick) onPick(ticker); else router.push(`/stock/${ticker}`); };
  return (
    <div className="relative">
      <Search size={19} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
      <input value={q} autoFocus={autoFocus} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Enter" && results[0] && pick(results[0].ticker)}
        placeholder={placeholder || t("search")} aria-label={t("search")} enterKeyHint="search" autoComplete="off" autoCapitalize="characters"
        className="h-12 w-full rounded-full bg-card pr-4 pl-11 outline-none placeholder:text-muted focus:ring-2 focus:ring-ink/10" />
      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-[54px] z-30 overflow-hidden rounded-[20px] border border-line bg-card py-1.5 shadow-xl">
          {results.map((r) => (
            <button key={r.symbol} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r.ticker)} className="flex h-[52px] w-full items-center gap-3 px-4 text-left hover:bg-chip">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold">{r.ticker}</span>
                <span className="block truncate text-[12.5px] text-muted">{r.name}</span>
              </span>
              <span className="num text-right text-[13.5px] font-semibold">{price(r.price)}<br /><Change value={r.changePct} className="text-[12px]" /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Trending = { tickers: { ticker: string; posts: number }[]; suggested: { id: string; handle: string; name: string; verified: boolean; kind: string }[] };

function RightRail() {
  const { market } = useMarket();
  const t = useT();
  const watch = useLocal(watchlistStore);
  const { data: trending } = useSWR<Trending>("/api/trending", (u: string) => api<Trending>(u), { refreshInterval: 60_000 });
  const rows = market ? watch.map((w) => market.quotes.find((q) => q.ticker === w)).filter((q) => !!q) : [];
  return (
    <aside className="no-scrollbar sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto py-5 xl:flex">
      <SymbolSearch />
      <Card className="p-4">
        <SectionTitle action={market && <MarketStatus />}>{t("markets")}</SectionTitle>
        {market?.summary.indices.map((i) => (
          <Link key={i.code} href={`/stock/${i.code}`} className="flex h-[52px] items-center justify-between rounded-[14px] px-1 hover:bg-chip">
            <span><span className="block text-[14px] font-bold">{i.code === "SNP" ? "S&P SL20" : i.code}</span><span className="block text-[12px] text-muted">{i.name}</span></span>
            <span className="num text-right text-[14px] font-semibold">{price(i.value)}<br /><Change value={i.changePct} className="text-[12.5px]" /></span>
          </Link>
        ))}
        {market && <p className="mt-2 px-1 text-[12px] text-muted">Turnover Rs {compact(market.summary.turnover)} · {market.summary.breadth.up} up, {market.summary.breadth.down} down</p>}
      </Card>
      <Card className="p-4">
        <SectionTitle action={<Link href="/portfolio">Manage</Link>}>{t("watchlist")}</SectionTitle>
        {rows.length === 0 && <p className="px-1 pb-1 text-[13.5px] text-muted">Star a company to track it here.</p>}
        {rows.map((q) => q && (
          <Link key={q.symbol} href={`/stock/${q.ticker}`} className="flex h-[48px] items-center justify-between rounded-[14px] px-1 hover:bg-chip">
            <span className="text-[14px] font-bold">{q.ticker}</span>
            <span className="num flex items-center gap-3 text-[14px] font-semibold">{price(q.price)}<Change value={q.changePct} pill className="min-w-[74px] justify-center text-[12.5px]" /></span>
          </Link>
        ))}
      </Card>
      {trending && trending.tickers.length > 0 && (
        <Card className="p-4">
          <SectionTitle>{t("trending")}</SectionTitle>
          {trending.tickers.slice(0, 5).map((x, i) => (
            <Link key={x.ticker} href={`/stock/${x.ticker}`} className="flex h-[46px] items-center gap-3 rounded-[14px] px-1 hover:bg-chip">
              <span className="num w-4 text-[13px] text-muted">{i + 1}</span>
              <span className="flex-1 text-[14px] font-bold">${x.ticker}</span>
              <span className="text-[12.5px] text-muted">{x.posts} {x.posts === 1 ? "post" : "posts"}</span>
            </Link>
          ))}
        </Card>
      )}
      <p className="px-2 text-[12px] leading-relaxed text-muted">
        <Link href="/legal/guidelines" className="hover:underline">Community guidelines</Link> · <Link href="/legal/privacy" className="hover:underline">Privacy</Link> · <Link href="/legal/disclaimer" className="hover:underline">Disclaimer</Link>
        <br />Market data delayed. Not investment advice.
      </p>
    </aside>
  );
}

export function MarketStatus() {
  const { market } = useMarket();
  if (!market) return null;
  const { open, source } = market.summary;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
      <span className={cx("h-2 w-2 rounded-full", source === "sample" ? "bg-[#f59e0b]" : open ? "bg-up" : "bg-muted")} />
      {source === "sample" ? "Sample data" : open ? "Open · delayed" : "Closed"}
    </span>
  );
}

// Fires price alerts while the app is open (toast + system notification when permitted).
function AlertWatcher() {
  const { market } = useMarket();
  const alerts = useLocal(alertsStore);
  const { toast } = useApp();
  useEffect(() => {
    if (!market || market.summary.source === "sample") return;
    const hit = alerts.filter((a) => {
      if (a.fired) return false;
      const q = market.quotes.find((x) => x.ticker === a.ticker);
      return q && (a.dir === "above" ? q.price >= a.price : q.price <= a.price);
    });
    if (!hit.length) return;
    alertsStore.set((all) => all.map((a) => (hit.some((h) => h.id === a.id) ? { ...a, fired: true } : a)));
    for (const a of hit) {
      const text = `${a.ticker} is ${a.dir} Rs ${price(a.price)}`;
      toast(text);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Price alert", { body: text });
    }
  }, [market, alerts, toast]);
  return null;
}
