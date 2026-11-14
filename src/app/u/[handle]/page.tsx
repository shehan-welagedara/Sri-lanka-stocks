"use client";
import { use, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { dateLk } from "@/lib/fmt";
import { Avatar, Button, Card, Empty, PageHeader, Skeleton, Verified } from "@/components/ui";
import { FeedList } from "@/components/feed";

type Profile = { user: { id: string; handle: string; name: string; bio: string; kind: string; verified: boolean; createdAt: number; followers: number; following: number }; viewer: { following: boolean; own: boolean } };

export default function UserPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params);
  const { data, error, mutate } = useSWR<Profile>(`/api/users/${handle}`, (u: string) => api<Profile>(u));
  const [busy, setBusy] = useState(false);
  const follow = async () => {
    if (!data) return;
    setBusy(true);
    const r = await api<{ following: boolean }>("/api/follow", { method: "POST", json: { userId: data.user.id } }).catch(() => null);
    if (r) await mutate({ ...data, viewer: { ...data.viewer, following: r.following }, user: { ...data.user, followers: data.user.followers + (r.following ? 1 : -1) } }, false);
    setBusy(false);
  };
  if (error) return <div><PageHeader back title="Profile" /><Empty title="This account doesn't exist" /></div>;
  const u = data?.user;
  return (
    <div>
      <PageHeader back title={u?.name || "Profile"} subtitle={u ? `@${u.handle}` : undefined} />
      <div className="space-y-4 pt-1 sm:px-4 lg:px-0">
        <Card className="mx-4 p-5 sm:mx-0">
          {!u ? <Skeleton className="h-24" /> : (
            <>
              <div className="flex items-start justify-between gap-3">
                <Avatar label={u.name} size={64} />
                {!data.viewer.own && <Button variant={data.viewer.following ? "ghost" : "dark"} className="h-10 px-5" disabled={busy} onClick={follow}>{data.viewer.following ? "Following" : "Follow"}</Button>}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[20px] leading-tight font-bold">{u.name}{u.verified && <Verified size={18} />}</p>
              <p className="text-[14px] text-muted">@{u.handle} · <span className="capitalize">{u.kind === "business" ? "Company" : u.kind}</span></p>
              {u.bio && <p className="mt-2 text-[15px]">{u.bio}</p>}
              <p className="num mt-3 text-[14px] text-muted"><b className="text-ink">{u.followers}</b> followers · <b className="text-ink">{u.following}</b> following · Joined {dateLk(u.createdAt, true)}</p>
            </>
          )}
        </Card>
        {u && <Card className="overflow-hidden rounded-none sm:rounded-[24px]"><FeedList query={`author=${u.id}`} accepts={(p) => p.author.id === u.id && !p.replyTo} empty={{ title: "No posts yet" }} /></Card>}
      </div>
    </div>
  );
}
