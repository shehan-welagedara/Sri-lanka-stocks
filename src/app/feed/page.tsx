"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, PageHeader, Segmented } from "@/components/ui";
import { FeedList } from "@/components/feed";
import { ComposerBody } from "@/components/composer";

const TABS = [{ value: "foryou", label: "For you" }, { value: "following", label: "Following" }, { value: "news", label: "News" }, { value: "bookmarks", label: "Saved" }] as const;
type Tab = (typeof TABS)[number]["value"];
const EMPTY: Record<Tab, { title: string; body: string }> = {
  foryou: { title: "The feed is warming up", body: "Be the first to post." },
  following: { title: "Follow investors and companies", body: "Posts from accounts you follow will appear here in order." },
  news: { title: "No announcements yet", body: "Official company announcements appear here as they are published." },
  bookmarks: { title: "Nothing saved yet", body: "Tap the bookmark on any post to keep it here." },
};

function Feed() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q");
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value || "foryou") as Tab;
  return (
    <div>
      <PageHeader title={q ? q : "Feed"} subtitle={q ? "Search results" : undefined} />
      <div className="px-0 pt-1 lg:px-0">
        {!q && <Segmented value={tab} onChange={(v) => router.replace(v === "foryou" ? "/feed" : `/feed?tab=${v}`, { scroll: false })} options={TABS} className="mb-3 px-4 lg:px-0" />}
        <Card className="overflow-hidden rounded-none sm:mx-4 sm:rounded-[24px] lg:mx-0">
          {!q && tab !== "bookmarks" && <div className="hidden border-b border-line px-4 pt-3 pb-2 lg:block"><ComposerBody compact /></div>}
          <FeedList key={q || tab} query={q ? `q=${encodeURIComponent(q)}` : `tab=${tab}`} ads={!q && tab === "foryou"} empty={q ? { title: "No posts found", body: "Try a different tag or keyword." } : EMPTY[tab]}
            accepts={(p) => !p.replyTo && !q && tab !== "bookmarks" && tab !== "news"} />
        </Card>
      </div>
    </div>
  );
}

export default function FeedPage() {
  return <Suspense><Feed /></Suspense>;
}
