"use client";
import useSWR, { mutate } from "swr";
import type { CompanyInfo, IndexQuote, MarketSummary, Point, Quote, Range, Sector, Source } from "./market/types";
import type { Signal } from "./market/indicators";
import type { User } from "./social/types";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Something went wrong. Please try again.", res.status, data.code);
  return data as T;
}
const get = <T,>(url: string) => api<T>(url);

export type MarketData = { summary: MarketSummary; quotes: Quote[]; sectors: Sector[] };
export function useMarket() {
  const { data, error, isLoading } = useSWR<MarketData>("/api/market", get, { refreshInterval: 30_000, keepPreviousData: true });
  return { market: data, error, loading: isLoading };
}

export type StockData = {
  quote?: Quote; index?: IndexQuote; source: Source; historySource?: Source; points: Point[]; prevClose?: number; info?: CompanyInfo;
  technicals?: { signals: Signal[]; verdict: "Bullish" | "Bearish" | "Neutral"; score: number };
};
export function useStock(key: string | null, range: Range, full = false) {
  return useSWR<StockData>(key ? `/api/stock/${encodeURIComponent(key)}?range=${range}${full ? "&full=1" : ""}` : null, get, {
    refreshInterval: range === "1D" ? 60_000 : 0, keepPreviousData: true, revalidateOnFocus: false,
  });
}

export type Me = User & { followers: number; following: number };
export function useMe() {
  const { data } = useSWR<{ user: Me }>("/api/me", get, { revalidateOnFocus: false });
  return data?.user;
}
export async function updateMe(patch: Record<string, unknown>) {
  const r = await api<{ user: Me }>("/api/me", { method: "PATCH", json: patch });
  await mutate("/api/me", r, false);
  return r.user;
}
