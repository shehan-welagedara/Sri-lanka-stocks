"use client";
// Translation-ready strings. English is complete; Sinhala and Tamil carry the
// navigation labels as a starting point and fall back to English elsewhere.
import { prefsStore, useLocal } from "./local";

const en = {
  home: "Home", markets: "Markets", feed: "Feed", portfolio: "Portfolio", profile: "Profile", post: "Post",
  watchlist: "Watchlist", trending: "Trending", search: "Search companies",
};
type Key = keyof typeof en;
const dict: Record<string, Partial<Record<Key, string>>> = {
  en,
  si: { home: "මුල් පිටුව", markets: "වෙළඳපොළ", feed: "පුවත්", portfolio: "කළඹ", profile: "පැතිකඩ" },
  ta: { home: "முகப்பு", markets: "சந்தைகள்", feed: "செய்திகள்", portfolio: "முதலீடுகள்", profile: "சுயவிவரம்" },
};

export function useT() {
  const { lang } = useLocal(prefsStore);
  return (k: Key) => dict[lang]?.[k] ?? en[k];
}
