-- LankaStocks production schema (Supabase / Postgres).
-- Mirrors the shapes in src/lib/social/types.ts. Not yet wired into the app:
-- the MVP runs on the built-in file store (src/lib/social/store.ts).

create extension if not exists pgcrypto;

create type user_kind as enum ('investor', 'business', 'broker', 'analyst', 'media');
create type post_status as enum ('live', 'review', 'removed');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null check (handle ~ '^[A-Za-z0-9_]{3,20}$'),
  name text not null check (char_length(name) between 2 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  kind user_kind not null default 'investor',
  verified boolean not null default false,
  premium_until timestamptz,
  official boolean not null default false,
  strikes int not null default 0,
  accepted_guidelines_at timestamptz,
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles on delete cascade,
  text text not null default '' check (char_length(text) <= 2000),
  tickers text[] not null default '{}',
  tags text[] not null default '{}',
  media jsonb not null default '[]',
  reply_to uuid references posts on delete cascade,
  repost_of uuid references posts on delete set null,
  link text,
  source text not null default 'user',
  status post_status not null default 'live',
  flags text[] not null default '{}',
  promoted boolean not null default false,
  likes int not null default 0,
  reposts int not null default 0,
  replies int not null default 0,
  bookmarks int not null default 0,
  impressions int not null default 0,
  dwell_ms bigint not null default 0,
  reports int not null default 0,
  created_at timestamptz not null default now()
);
create index posts_feed_idx on posts (created_at desc) where status = 'live' and reply_to is null;
create index posts_author_idx on posts (author_id, created_at desc);
create index posts_reply_idx on posts (reply_to, created_at);
create index posts_tickers_idx on posts using gin (tickers);

create table reactions (
  user_id uuid not null references profiles on delete cascade,
  post_id uuid not null references posts on delete cascade,
  kind text not null check (kind in ('like', 'bookmark', 'repost')),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id, kind)
);

create table follows (
  follower_id uuid not null references profiles on delete cascade,
  followee_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table post_views (
  user_id uuid not null references profiles on delete cascade,
  post_id uuid not null references posts on delete cascade,
  views int not null default 1,
  dwell_ms bigint not null default 0,
  primary key (user_id, post_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('verify', 'promote', 'lead')),
  user_id uuid not null references profiles on delete cascade,
  data jsonb not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- Device data that syncs to the account in phase 2.
create table watchlist (user_id uuid references profiles on delete cascade, ticker text, primary key (user_id, ticker));
create table holdings (user_id uuid references profiles on delete cascade, ticker text, qty numeric not null, cost numeric not null, primary key (user_id, ticker));
create table alerts (id uuid primary key default gen_random_uuid(), user_id uuid references profiles on delete cascade, ticker text not null, dir text not null, price numeric not null, fired boolean not null default false);

-- Keep counters in step with reactions; three reports pull a post for review.
create function bump_reaction() returns trigger language plpgsql security definer as $$
declare d int := case when tg_op = 'INSERT' then 1 else -1 end;
declare r reactions := coalesce(new, old);
begin
  update posts set
    likes = greatest(0, likes + case when r.kind = 'like' then d else 0 end),
    bookmarks = greatest(0, bookmarks + case when r.kind = 'bookmark' then d else 0 end),
    reposts = greatest(0, reposts + case when r.kind = 'repost' then d else 0 end)
  where id = r.post_id;
  return null;
end $$;
create trigger reactions_count after insert or delete on reactions for each row execute function bump_reaction();

create function bump_report() returns trigger language plpgsql security definer as $$
begin
  update posts set reports = reports + 1,
    status = case when reports + 1 >= 3 and status = 'live' then 'review'::post_status else status end
  where id = new.post_id;
  return null;
end $$;
create trigger reports_count after insert on reports for each row execute function bump_report();

-- Row level security: public reads of live content, owners write their own rows.
-- Post inserts go through the server (service role) so moderation cannot be skipped.
alter table profiles enable row level security;
alter table posts enable row level security;
alter table reactions enable row level security;
alter table follows enable row level security;
alter table post_views enable row level security;
alter table reports enable row level security;
alter table requests enable row level security;
alter table watchlist enable row level security;
alter table holdings enable row level security;
alter table alerts enable row level security;

create policy "profiles are public" on profiles for select using (true);
create policy "live posts are public" on posts for select using (status = 'live' or author_id = auth.uid());
create policy "own reactions" on reactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "follows are public" on follows for select using (true);
create policy "own follows" on follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy "own views" on post_views for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "file reports" on reports for insert with check (user_id = auth.uid());
create policy "file requests" on requests for insert with check (user_id = auth.uid());
create policy "own watchlist" on watchlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own holdings" on holdings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own alerts" on alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
