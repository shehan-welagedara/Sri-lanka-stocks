export const site = {
  name: "LankaStocks",
  tagline: "Sri Lanka's market, in one feed",
  currency: "LKR",
  // Free-tier limits; premium removes them.
  free: { watchlist: 10, alerts: 3 },
  premium: { monthlyLkr: 990, yearlyLkr: 9900 },
  verified: { monthlyLkr: 4900 },
  // Partner stockbrokers for CDS-account referrals. Add partners once agreements are signed.
  brokers: [] as { name: string; url: string; blurb: string }[],
};
