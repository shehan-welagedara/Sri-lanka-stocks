export type UserKind = "investor" | "business" | "broker" | "analyst" | "media";

export type User = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  kind: UserKind;
  verified: boolean;
  premium: boolean;
  official?: boolean;
  onboarded: boolean;
  createdAt: number;
  strikes: number;
};

export type Media = { id: string; type: "image" | "video"; url: string; checked: boolean };

export type PostStatus = "live" | "review" | "removed";

export type Post = {
  id: string;
  authorId: string;
  text: string;
  tickers: string[];
  tags: string[];
  media: Media[];
  createdAt: number;
  replyTo?: string;
  repostOf?: string;
  link?: string;
  source: "user" | "cse";
  status: PostStatus;
  flags: string[];
  promoted?: boolean;
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  dwellMs: number;
  reports: number;
};

// What the client receives.
export type FeedPost = Post & {
  author: Pick<User, "id" | "handle" | "name" | "kind" | "verified" | "official">;
  viewer: { liked: boolean; reposted: boolean; bookmarked: boolean; following: boolean; own: boolean };
  quoted?: FeedPost;
};

export type RequestType = "verify" | "promote" | "lead";
export type Request = { id: string; type: RequestType; userId: string; data: Record<string, string>; createdAt: number; status: "open" | "approved" | "rejected" };
export type Report = { id: string; postId: string; userId: string; reason: string; createdAt: number };
