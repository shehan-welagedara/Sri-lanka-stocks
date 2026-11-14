"use client";
import { use } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { FeedPost } from "@/lib/social/types";
import { Button, Card, Empty, PageHeader, Skeleton } from "@/components/ui";
import { FeedList, PostCard } from "@/components/feed";
import { ComposerBody } from "@/components/composer";

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useSWR<{ post: FeedPost }>(`/api/posts/${id}`, (u: string) => api<{ post: FeedPost }>(u));
  return (
    <div>
      <PageHeader back title="Post" />
      <div className="pt-1 sm:px-4 lg:px-0">
        {error ? <Empty title="This post is unavailable" body="It may have been deleted or removed for breaking the guidelines." action={<Link href="/feed"><Button>Back to feed</Button></Link>} /> : (
          <Card className="overflow-hidden rounded-none sm:rounded-[24px]">
            {data ? <PostCard post={data.post} detail /> : <Skeleton className="m-4 h-32" />}
            {data && <div className="border-y border-line px-4 pt-2 pb-2"><ComposerBody compact opts={{ replyTo: data.post }} /></div>}
            <FeedList query={`parent=${id}`} accepts={(p) => p.replyTo === id} empty={{ title: "No replies yet", body: "Start the conversation." }} />
          </Card>
        )}
      </div>
    </div>
  );
}
