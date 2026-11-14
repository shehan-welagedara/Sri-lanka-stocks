"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { updateMe, useMe } from "@/lib/api";
import type { UserKind } from "@/lib/social/types";
import { Button, Field, inputCls, Segmented, Sheet } from "./ui";

const KINDS: { value: UserKind; label: string }[] = [
  { value: "investor", label: "Investor" }, { value: "business", label: "Company" }, { value: "broker", label: "Broker" }, { value: "analyst", label: "Analyst" }, { value: "media", label: "Media" },
];

export function Onboarding({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [kind, setKind] = useState<UserKind>("investor");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && me) { setName(me.onboarded ? me.name : ""); setHandle(me.handle); setKind(me.kind); setErr(""); }
  }, [open, me]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return setErr("Please accept the community guidelines to continue.");
    setBusy(true);
    try {
      await updateMe({ name, handle, kind, acceptGuidelines: true });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Create your profile">
      <form onSubmit={submit}>
        <p className="mb-4 text-[14px] text-muted">Join the conversation with Sri Lanka&apos;s investors and businesses. It takes ten seconds.</p>
        <Field label="Display name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name or company" autoComplete="name" required /></Field>
        <Field label="Handle" hint="3-20 letters, numbers or underscores."><input className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))} maxLength={20} autoCapitalize="none" autoCorrect="off" required /></Field>
        <Field label="I am a"><Segmented value={kind} onChange={setKind} options={KINDS} size="sm" /></Field>
        <label className="mt-1 mb-4 flex min-h-[44px] cursor-pointer items-start gap-3 text-[14px]">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#17171a]" />
          <span>I agree to the <Link href="/legal/guidelines" target="_blank" className="font-semibold underline">community guidelines</Link> and <Link href="/legal/privacy" target="_blank" className="font-semibold underline">privacy policy</Link>. No adult content, scams or market manipulation.</span>
        </label>
        {err && <p role="alert" className="mb-3 text-[14px] font-medium text-down">{err}</p>}
        <Button variant="lime" className="w-full" disabled={busy}>{busy ? "Saving…" : "Continue"}</Button>
      </form>
    </Sheet>
  );
}
