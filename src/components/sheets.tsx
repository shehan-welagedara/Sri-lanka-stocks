"use client";
import { useEffect, useState } from "react";
import { api, useMarket, useMe } from "@/lib/api";
import { alertsStore, holdingsStore, useLocal } from "@/lib/local";
import { price } from "@/lib/fmt";
import { site } from "@/config/site";
import { Button, Field, inputCls, Segmented, Sheet } from "./ui";
import { SymbolSearch, useApp } from "./app";

export function HoldingSheet({ open, onClose, ticker: preset }: { open: boolean; onClose: () => void; ticker?: string }) {
  const { market } = useMarket();
  const { toast } = useApp();
  const [ticker, setTicker] = useState(preset || "");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const q = market?.quotes.find((x) => x.ticker === ticker);
  useEffect(() => { if (open) { setTicker(preset || ""); setQty(""); } }, [open, preset]);
  // Prefill the average cost with the last price whenever the sheet opens or the company changes.
  const lastPrice = q?.price;
  useEffect(() => { if (open) setCost(lastPrice ? String(lastPrice) : ""); }, [open, ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(qty), c = Number(cost);
    if (!q || !(n > 0) || !(c > 0)) return;
    holdingsStore.set((all) => {
      const ex = all.find((h) => h.ticker === ticker);
      if (!ex) return [...all, { ticker, qty: n, cost: c }];
      const total = ex.qty + n; // weighted average cost
      return all.map((h) => (h.ticker === ticker ? { ticker, qty: total, cost: (ex.qty * ex.cost + n * c) / total } : h));
    });
    toast(`${ticker} added to your portfolio`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add holding">
      <form onSubmit={save}>
        {q ? (
          <div className="mb-3 flex h-14 items-center justify-between rounded-[16px] bg-bg px-4">
            <span><span className="block text-[15px] font-bold">{q.ticker}</span><span className="block text-[12.5px] text-muted">Last Rs {price(q.price)}</span></span>
            {!preset && <button type="button" className="text-[14px] font-semibold text-muted underline" onClick={() => setTicker("")}>Change</button>}
          </div>
        ) : (
          <div className="mb-3 rounded-full border border-line"><SymbolSearch placeholder="Search a company" autoFocus onPick={setTicker} /></div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shares"><input className={inputCls} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" required /></Field>
          <Field label="Avg. cost (Rs)"><input className={inputCls} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" required /></Field>
        </div>
        <p className="mb-4 text-[12.5px] text-muted">Your portfolio is a private tracker stored on this device. No orders are placed.</p>
        <Button variant="lime" className="w-full" disabled={!q || !(Number(qty) > 0) || !(Number(cost) > 0)}>Add to portfolio</Button>
      </form>
    </Sheet>
  );
}

export function AlertSheet({ open, onClose, ticker, last }: { open: boolean; onClose: () => void; ticker: string; last: number }) {
  const alerts = useLocal(alertsStore);
  const me = useMe();
  const { toast } = useApp();
  const [dir, setDir] = useState<"above" | "below">("above");
  const [target, setTarget] = useState("");
  useEffect(() => { if (open) setTarget(""); }, [open]);
  const mine = alerts.filter((a) => a.ticker === ticker);
  const activeCount = alerts.filter((a) => !a.fired).length;
  const blocked = !me?.premium && activeCount >= site.free.alerts;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(target);
    if (!(p > 0) || blocked) return;
    alertsStore.set((all) => [...all, { id: Math.random().toString(36).slice(2), ticker, dir, price: p }]);
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    toast(`Alert set for ${ticker} ${dir} Rs ${price(p)}`);
    setTarget("");
  };
  return (
    <Sheet open={open} onClose={onClose} title={`${ticker} price alerts`}>
      <form onSubmit={save}>
        <p className="mb-3 text-[14px] text-muted">Last price Rs {price(last)}. Alerts trigger while the app is open.</p>
        <Segmented value={dir} onChange={setDir} options={[{ value: "above", label: "Rises above" }, { value: "below", label: "Falls below" }]} className="mb-3" />
        <Field label="Target price (Rs)"><input className={inputCls} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={price(last)} required /></Field>
        {blocked && <p className="mb-3 text-[13.5px] font-medium text-down">Free accounts can keep {site.free.alerts} active alerts. Upgrade to Premium for unlimited alerts.</p>}
        <Button variant="lime" className="w-full" disabled={blocked || !(Number(target) > 0)}>Set alert</Button>
      </form>
      {mine.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {mine.map((a) => (
            <li key={a.id} className="flex h-12 items-center justify-between text-[14px]">
              <span className="num">{a.dir === "above" ? "Above" : "Below"} Rs {price(a.price)} {a.fired && <span className="ml-1 text-muted">· triggered</span>}</span>
              <button className="font-semibold text-down" onClick={() => alertsStore.set((all) => all.filter((x) => x.id !== a.id))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

// Broker referral: collects a consented lead for partner stockbrokers.
export function BrokerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ fullName: "", phone: "", district: "", consent: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("/api/requests", { method: "POST", json: { type: "lead", data: { ...f, consent: f.consent ? "yes" : "no" } } });
      toast("Thanks! A licensed stockbroker will contact you.");
      onClose();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Start investing">
      <p className="mb-4 text-[14px] text-muted">To buy shares on the Colombo Stock Exchange you need a CDS account, opened free through a licensed stockbroker. Leave your details and a partner broker will help you set one up.</p>
      {site.brokers.map((b) => (
        <a key={b.name} href={b.url} target="_blank" rel="noopener noreferrer sponsored" className="mb-2 block rounded-[16px] border border-line p-3.5 hover:bg-chip">
          <span className="block text-[15px] font-bold">{b.name}</span><span className="block text-[13px] text-muted">{b.blurb}</span>
        </a>
      ))}
      <form onSubmit={submit}>
        <Field label="Full name"><input className={inputCls} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoComplete="name" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile number"><input className={inputCls} type="tel" inputMode="tel" placeholder="07X XXX XXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" required /></Field>
          <Field label="District"><input className={inputCls} value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} placeholder="Colombo" /></Field>
        </div>
        <label className="mb-4 flex min-h-[44px] cursor-pointer items-start gap-3 text-[13.5px]">
          <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-[#17171a]" />
          <span>I agree that {site.name} may share these details with licensed partner stockbrokers so they can contact me.</span>
        </label>
        {err && <p role="alert" className="mb-3 text-[14px] font-medium text-down">{err}</p>}
        <Button variant="lime" className="w-full" disabled={busy}>{busy ? "Sending…" : "Request a call back"}</Button>
      </form>
    </Sheet>
  );
}

export function VerifySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ organisation: "", role: "", website: "", contact: "" });
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api("/api/requests", { method: "POST", json: { type: "verify", data: f } }); toast("Application received. We'll be in touch."); onClose(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Apply for verification">
      <p className="mb-4 text-[14px] text-muted">Verified profiles are for listed companies, licensed brokers, registered analysts and media. From Rs {site.verified.monthlyLkr.toLocaleString()} a month, including post analytics and longer posts.</p>
      <form onSubmit={submit}>
        <Field label="Organisation"><input className={inputCls} value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} required /></Field>
        <Field label="Your role"><input className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></Field>
        <Field label="Website"><input className={inputCls} type="url" inputMode="url" placeholder="https://" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
        <Field label="Work email or phone"><input className={inputCls} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} required /></Field>
        {err && <p role="alert" className="mb-3 text-[14px] font-medium text-down">{err}</p>}
        <Button variant="lime" className="w-full">Submit application</Button>
      </form>
    </Sheet>
  );
}
