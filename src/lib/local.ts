"use client";
// Small localStorage-backed stores for device-level data (watchlist, portfolio,
// alerts, preferences). Phase 2 syncs these to the user's Supabase account.
import { useSyncExternalStore } from "react";

export type Holding = { ticker: string; qty: number; cost: number };
export type Alert = { id: string; ticker: string; dir: "above" | "below"; price: number; fired?: boolean };
export type Prefs = { theme: "system" | "light" | "dark"; lang: "en" | "si" | "ta" };

function create<T>(key: string, initial: T) {
  let value = initial;
  let loaded = false;
  const subs = new Set<() => void>();
  const read = () => {
    if (!loaded && typeof window !== "undefined") {
      loaded = true;
      try {
        const raw = localStorage.getItem(key);
        if (raw) value = JSON.parse(raw) as T;
      } catch { /* private mode */ }
    }
    return value;
  };
  if (typeof window !== "undefined")
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      loaded = false;
      read();
      subs.forEach((f) => f());
    });
  return {
    get: read,
    set(next: T | ((prev: T) => T)) {
      value = typeof next === "function" ? (next as (p: T) => T)(read()) : next;
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
    initial,
  };
}
type LocalStore<T> = ReturnType<typeof create<T>>;

export const watchlistStore = create<string[]>("ls.watch", ["JKH", "COMB", "HNB", "DIAL"]);
export const holdingsStore = create<Holding[]>("ls.holdings", []);
export const alertsStore = create<Alert[]>("ls.alerts", []);
export const prefsStore = create<Prefs>("ls.prefs", { theme: "system", lang: "en" });

export function useLocal<T>(s: LocalStore<T>): T {
  return useSyncExternalStore(s.subscribe, s.get, () => s.initial);
}

export function applyTheme(theme: Prefs["theme"]) {
  const el = document.documentElement;
  if (theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}
