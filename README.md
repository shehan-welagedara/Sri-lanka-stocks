# LankaStocks

Colombo Stock Exchange market data, portfolio tracking and an investor social feed in one app. Web (mobile + desktop layouts), installable PWA, and an Android shell via Capacitor.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

Copy `.env.example` to `.env.local`. Set `ADMIN_KEY` before deploying; the admin console is at `/admin` (in development the key is `dev-admin`).

If your network needs an HTTP proxy to reach `www.cse.lk`, start Node with `NODE_USE_ENV_PROXY=1`.

## What is in the MVP

| Area | Details |
| --- | --- |
| Markets | Live (delayed) prices for every CSE security, ASPI and S&P SL20, sector indices, movers, sortable table, screener filters, search |
| Company page | Interactive chart (1D to 1Y), key statistics, day and 52-week ranges, technical analysis (RSI, MACD, moving averages, volatility, drawdown), price alerts, `$TICKER` discussion |
| Feed | For you (ranked), Following, News (official CSE announcements), Saved. Posts with text, images and video, replies, quote reposts, likes, bookmarks, follows, reports |
| Safety | On-device nudity screening before upload, server text rules (adult content, abuse, scams, manipulation), review queue, three-report auto-hide, strikes, rate limits |
| Portfolio | Holdings with profit and loss, allocation, CSV export, watchlist |
| Revenue hooks | Sponsored slots and promoted posts, Premium tier gating, verified-profile applications, broker (CDS account) lead capture |

## Architecture

- `src/lib/market` — data layer. `cse.ts` adapts the public cse.lk endpoints (cached, with stale and sample fallbacks). Replace this one file to move to a licensed feed.
- `src/lib/social` — `store.ts` (file-backed store), `moderation.ts`, `ranking.ts` (feed algorithm), `server.ts` (sessions, announcement ingest).
- `src/app/api` — route handlers. `src/app/*` — screens. `src/components` — UI kit, charts, feed, shell.
- `supabase/schema.sql` — production database schema (tables, counters, row-level security).

### Feed ranking (`src/lib/social/ranking.ts`)

1. Candidates: live posts from the last 14 days.
2. Score: Bayesian-smoothed engagement rate (likes, reposts, replies, bookmarks, dwell time) x 8-hour half-life decay x personal affinity (follows, watchlist and portfolio tickers, past interactions) x credibility (verified, strikes, reports) x repeat-view fatigue.
3. Re-rank: diversity pass against author and ticker repetition; every sixth slot is reserved for a fresh post that has not had an audience yet.
4. Blend: promoted posts at fixed slots, always labelled.

## Known limits of this MVP

- **Storage** is a single JSON file (`.data/`), fine for one server. Supabase wiring (auth, database, media storage, realtime) is the next phase; the schema is ready.
- **Accounts** are guest sessions held by a cookie. There is no email, Google or phone sign-in yet.
- **Payments** are not connected. The Premium button is a demo toggle and is disabled in production builds.
- **Watchlist, portfolio and alerts** live on the device. Alerts fire only while the app is open.
- **Market data** comes from unofficial public endpoints and is shown as delayed. Commercial redistribution may need a CSE data licence.
- **Media screening** runs on the user's device, so a modified client could skip it; unchecked media is held for review and reports still apply.
- **Sinhala and Tamil** cover navigation labels only.

## Android

```bash
CAP_SERVER_URL=https://your-domain.lk npx cap add android
npm run android:open     # build and sign in Android Studio
```

The Android app loads the hosted web app, so one deploy updates both.
