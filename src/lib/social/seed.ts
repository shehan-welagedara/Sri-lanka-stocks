// First-run content: the platform's own account plus clearly labelled demo
// accounts so the feed is not empty in development. Set SEED_DEMO=0 to skip the
// demo accounts (recommended for production).
import type { Store } from "./store";

export const OFFICIAL_ID = "official";
export const CSE_BOT_ID = "cse-disclosures";

export function seed(s: Store) {
  const now = Date.now();
  const h = 36e5;
  s.createUser({ id: OFFICIAL_ID, handle: "lankastocks", name: "LankaStocks", bio: "The home of Sri Lanka's investor community.", kind: "media", verified: true, official: true, onboarded: true });
  s.createUser({ id: CSE_BOT_ID, handle: "cse_disclosures", name: "CSE Disclosures", bio: "Automated feed of company announcements published on the Colombo Stock Exchange.", kind: "media", verified: true, official: true, onboarded: true });

  s.addPost({ authorId: OFFICIAL_ID, createdAt: now - 2 * h, text: "Welcome to LankaStocks. Follow companies using cashtags like $JKH or $COMB, build a watchlist, and share analysis with other investors. Keep it professional: no adult content, no scams, no pump-and-dump. #welcome", tickers: ["JKH", "COMB"], tags: ["welcome"], likes: 12, impressions: 180 });
  s.addPost({ authorId: OFFICIAL_ID, createdAt: now - 26 * h, text: "Investor tip: a share price alone says nothing about value. Compare market capitalisation, earnings and dividends before deciding. Nothing on this platform is financial advice. #investing101", tags: ["investing101"], likes: 7, impressions: 140 });

  if (process.env.SEED_DEMO === "0") return;
  const demo = [
    ["demo_nimal", "Nimal (demo)", "Long-term dividend investor. Demo account.", "investor"],
    ["demo_research", "Colombo Research (demo)", "Independent equity research. Demo account.", "analyst"],
    ["demo_broker", "Sample Stockbrokers (demo)", "Demo broker profile.", "broker"],
    ["demo_shop", "Sample Holdings PLC (demo)", "Demo listed-company investor relations profile.", "business"],
  ] as const;
  const ids = demo.map(([handle, name, bio, kind], i) => s.createUser({ handle, name, bio, kind, verified: i > 0, onboarded: true }).id);
  const posts: [number, number, string, string[], number, number][] = [
    [0, 0.4, "Banks are leading turnover again today. Watching $COMB, $HNB and $SAMP into the quarterly results. What is everyone's view on net interest margins? #banks", ["COMB", "HNB", "SAMP"], 9, 90],
    [1, 1.2, "Checklist we use before the results season: revenue growth, margin trend, net debt, and cash conversion. A simple framework beats a hot tip every time. #research", [], 21, 260],
    [2, 3, "New to the market? You need a CDS account opened through a licensed stockbroker before you can buy your first share. It is free to open. #beginners", [], 5, 120],
    [3, 5, "Our Q2 investor presentation is now available. Management will host a webinar for shareholders next week. #investorrelations", [], 3, 75],
    [0, 7, "Added to my $JKH position this week. Long horizon, reinvesting dividends. Not advice - just sharing my journal. #longterm", ["JKH"], 14, 150],
    [1, 11, "ASPI breadth matters more than the index level. Count advancers versus decliners on the Markets tab before reading too much into a green day. #marketbreadth", [], 17, 210],
    [0, 20, "Telecoms have been quiet. Anyone tracking $DIAL and $SLTL data-revenue growth? #telecom", ["DIAL", "SLTL"], 4, 80],
  ];
  for (const [u, ageH, text, tickers, likes, impressions] of posts)
    s.addPost({ authorId: ids[u], createdAt: now - ageH * h, text, tickers, tags: (text.match(/#\w+/g) || []).map((t) => t.slice(1)), likes, impressions, dwellMs: impressions * 4200 });
  s.addPost({ authorId: ids[2], createdAt: now - 4 * h, promoted: true, text: "Open a CDS account online in minutes and start investing in the Colombo Stock Exchange. (Sample promoted post)", likes: 2, impressions: 400 });
}
