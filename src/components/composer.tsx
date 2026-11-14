"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { api, ApiError, useMe } from "@/lib/api";
import type { FeedPost, Media } from "@/lib/social/types";
import { Avatar, Button, cx, Sheet } from "./ui";
import { useApp } from "./app";

export type ComposeOpts = { replyTo?: FeedPost; quote?: FeedPost; text?: string };

export function emitPost(post: FeedPost) {
  window.dispatchEvent(new CustomEvent("feed:new", { detail: post }));
}

export function Composer({ opts, onClose }: { opts: ComposeOpts | null; onClose: () => void }) {
  const title = opts?.replyTo ? "Reply" : opts?.quote ? "Repost with comment" : "New post";
  return (
    <Sheet open={!!opts} onClose={onClose} title={title} wide>
      {opts && <ComposerBody opts={opts} onDone={onClose} autoFocus />}
    </Sheet>
  );
}

export function ComposerBody({ opts = {}, onDone, autoFocus, compact }: { opts?: ComposeOpts; onDone?: () => void; autoFocus?: boolean; compact?: boolean }) {
  const me = useMe();
  const { toast, onboard } = useApp();
  const [text, setText] = useState(opts.text || "");
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState<"" | "screen" | "post">("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const limit = me?.premium || me?.verified ? 2000 : 500;

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 320) + "px";
  }, [text]);

  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    if (me && !me.onboarded) return onboard();
    setErr("");
    setBusy("screen");
    try {
      for (const file of [...files].slice(0, 4 - media.length)) {
        const { screenFile } = await import("@/lib/nsfw");
        const screen = await screenFile(file);
        if (!screen.ok) { setErr(screen.reason || "That file is not allowed."); continue; }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("checked", screen.checked ? "1" : "0");
        const r = await api<{ media: Media }>("/api/upload", { method: "POST", body: fd });
        setMedia((m) => [...m, r.media]);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (me && !me.onboarded) return onboard();
    setErr("");
    setBusy("post");
    try {
      const r = await api<{ post: FeedPost; notice?: string }>("/api/feed", { method: "POST", json: { text, media, replyTo: opts.replyTo?.id, repostOf: opts.quote?.id } });
      emitPost(r.post);
      toast(r.notice || (opts.replyTo ? "Reply posted" : "Posted"));
      setText(""); setMedia([]);
      onDone?.();
    } catch (e) {
      if (e instanceof ApiError && e.code === "onboard") onboard();
      else setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const over = text.length > limit;
  const canPost = !busy && !over && (text.trim().length > 0 || media.length > 0 || !!opts.quote);
  return (
    <div>
      {opts.replyTo && <p className="mb-2 text-[13.5px] text-muted">Replying to <span className="font-semibold text-ink">@{opts.replyTo.author.handle}</span></p>}
      <div className="flex gap-3">
        <Avatar label={me?.name || "?"} size={compact ? 40 : 44} />
        <div className="min-w-0 flex-1">
          <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} autoFocus={autoFocus} rows={compact ? 1 : 3}
            placeholder={opts.replyTo ? "Post your reply" : "What's moving the market? Use $JKH to tag a company"} aria-label="Post text"
            className="block w-full resize-none bg-transparent py-2.5 text-[16px] leading-snug outline-none placeholder:text-muted" />
          {opts.quote && (
            <div className="mt-1 rounded-[16px] border border-line p-3 text-[14px]">
              <span className="font-bold">{opts.quote.author.name}</span> <span className="text-muted">@{opts.quote.author.handle}</span>
              <p className="mt-0.5 line-clamp-3 text-muted">{opts.quote.text}</p>
            </div>
          )}
          {media.length > 0 && (
            <div className={cx("mt-2 grid gap-2", media.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
              {media.map((m) => (
                <div key={m.id} className="relative overflow-hidden rounded-[16px] bg-chip">
                  {m.type === "image" ? <img src={m.url} alt="" className="max-h-64 w-full object-cover" /> : <video src={m.url} className="max-h-64 w-full" muted playsInline controls />}
                  <button aria-label="Remove attachment" onClick={() => setMedia((x) => x.filter((y) => y.id !== m.id))} className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"><X size={16} /></button>
                </div>
              ))}
            </div>
          )}
          {err && <p role="alert" className="mt-2 text-[14px] font-medium text-down">{err}</p>}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple hidden onChange={(e) => attach(e.target.files)} />
              <button aria-label="Add photo or video" title="Add photo or video" disabled={!!busy || media.length >= 4} onClick={() => fileRef.current?.click()}
                className="press -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-chip disabled:opacity-40">
                {busy === "screen" ? <Loader2 size={21} className="animate-spin" /> : <ImagePlus size={21} />}
              </button>
              {busy === "screen" && <span className="text-[13px] text-muted">Checking media…</span>}
            </div>
            <div className="flex items-center gap-3">
              {text.length > limit * 0.8 && <span className={cx("num text-[13px]", over ? "font-bold text-down" : "text-muted")}>{limit - text.length}</span>}
              <Button variant="lime" className="h-10 px-5" disabled={!canPost} onClick={submit}>{busy === "post" ? "Posting…" : opts.replyTo ? "Reply" : "Post"}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
