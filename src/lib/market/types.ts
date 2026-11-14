export type Source = "cse" | "sample";

export type Quote = {
  id: number;
  symbol: string; // full CSE code, e.g. JKH.N0000
  ticker: string; // short code, e.g. JKH
  name: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  trades: number;
  marketCap: number;
  lastTraded: number;
};

export type IndexQuote = {
  code: "ASPI" | "SNP";
  name: string;
  value: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  ts: number;
};

export type Sector = { symbol: string; name: string; value: number; change: number; changePct: number; turnover: number };

export type Point = { t: number; p: number; v?: number; h?: number; l?: number };

export type Range = "1D" | "1W" | "1M" | "3M" | "1Y";
export const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y"];

export type Announcement = {
  id: string;
  kind: "disclosure" | "financial";
  company: string;
  title: string;
  ts: number;
  url?: string;
};

export type CompanyInfo = {
  isin?: string;
  issued?: number;
  beta?: number;
  hi52?: number;
  lo52?: number;
  ytdHi?: number;
  ytdLo?: number;
  allHi?: number;
  allLo?: number;
  ytdVolume?: number;
  listed?: string;
};

export type MarketSummary = {
  source: Source;
  status: string;
  open: boolean;
  asOf: number;
  indices: IndexQuote[];
  breadth: { up: number; down: number; flat: number };
  turnover: number;
  volume: number;
};
