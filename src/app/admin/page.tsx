"use client";
import { useCallback, useEffect, useState } from "react";
import { ago } from "@/lib/fmt";
import type { FeedPost, Request as Req } from "@/lib/social/types";
import { Button, Card, Empty, inputCls, SectionTitle } from "@/components/ui";

type Item = FeedPost & { reportReasons: string[] };
type Data = { queue: Item[]; reported: Item[]; requests: (Req & { user?: string })[]; stats: Record<string, number> };

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async (k: string) => {
    const res = await fetch("/api/admin", { headers: { "x-admin-key": k } });
    if (!res.ok) { setErr("Wrong admin key."); setData(null); return; }
    setErr(""); setData(await res.json());
    sessionStorage.setItem("ls.admin", k);
  }, []);
  useEffect(() => { const k = sessionStorage.getItem("ls.admin"); if (k) { setKey(k); load(k); } }, [load]);
  const act = async (action: string, id: string) => {
    await fetch("/api/admin", { method: "POST", headers: { "x-admin-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) });
    load(key);
  };

  if (!data)
    return (
      <form className="mx-auto mt-24 max-w-sm" onSubmit={(e) => { e.preventDefault(); load(key); }}>
        <h1 className="mb-4 text-[24px] font-extrabold">Admin console</h1>
        <input className={inputCls} type="password" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
        {err && <p role="alert" className="mt-2 text-[14px] font-medium text-down">{err}</p>}
        <Button className="mt-3 w-full">Sign in</Button>
      </form>
    );

  const PostItem = ({ p }: { p: Item }) => (
    <div className="p-4">
      <p className="text-[13px] text-muted">@{p.author.handle} · {ago(p.createdAt)} · flags: {p.flags.join(", ") || "none"} · reports: {p.reports}{p.reportReasons.length ? ` (${[...new Set(p.reportReasons)].join("; ")})` : ""}</p>
      <p className="mt-1 text-[15px] break-words whitespace-pre-wrap">{p.text}</p>
      {p.media.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{p.media.map((m) => m.type === "image" ? <img key={m.id} src={m.url} alt="" className="h-32 rounded-xl" /> : <video key={m.id} src={m.url} controls className="h-32 rounded-xl" />)}</div>}
      <div className="mt-3 flex gap-2"><Button variant="lime" className="h-10" onClick={() => act("approve-post", p.id)}>Approve</Button><Button variant="ghost" className="h-10 text-down" onClick={() => act("remove-post", p.id)}>Remove + strike</Button></div>
    </div>
  );

  return (
    <div className="space-y-7 pt-8">
      <h1 className="text-[28px] font-extrabold">Admin console</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(data.stats).map(([k, v]) => <Card key={k} className="p-4"><p className="text-[13px] text-muted capitalize">{k}</p><p className="num text-[22px] font-bold">{v}</p></Card>)}
      </div>
      <section><SectionTitle>Held for review ({data.queue.length})</SectionTitle><Card className="divide-y divide-line">{data.queue.length ? data.queue.map((p) => <PostItem key={p.id} p={p} />) : <Empty title="Queue is clear" />}</Card></section>
      <section><SectionTitle>Reported, still live ({data.reported.length})</SectionTitle><Card className="divide-y divide-line">{data.reported.length ? data.reported.map((p) => <PostItem key={p.id} p={p} />) : <Empty title="No reported posts" />}</Card></section>
      <section>
        <SectionTitle>Requests ({data.requests.length})</SectionTitle>
        <Card className="divide-y divide-line">
          {data.requests.length ? data.requests.map((r) => (
            <div key={r.id} className="p-4">
              <p className="text-[13px] text-muted"><b className="text-ink uppercase">{r.type}</b> · @{r.user} · {ago(r.createdAt)}</p>
              <dl className="mt-1 grid grid-cols-[120px_1fr] gap-x-3 text-[14px]">{Object.entries(r.data).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="break-words">{v || "—"}</dd></div>)}</dl>
              <div className="mt-3 flex gap-2"><Button variant="lime" className="h-10" onClick={() => act("approve-request", r.id)}>{r.type === "lead" ? "Mark handled" : "Approve"}</Button><Button variant="ghost" className="h-10" onClick={() => act("reject-request", r.id)}>Reject</Button></div>
            </div>
          )) : <Empty title="No open requests" />}
        </Card>
      </section>
    </div>
  );
}
