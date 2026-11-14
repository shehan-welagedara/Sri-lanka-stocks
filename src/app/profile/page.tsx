"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Bookmark, Check, ChevronRight, FileText, Landmark, Shield, Sparkles } from "lucide-react";
import { updateMe, useMe } from "@/lib/api";
import { prefsStore, useLocal, type Prefs } from "@/lib/local";
import { site } from "@/config/site";
import { Avatar, Button, Card, cx, Field, inputCls, PageHeader, SectionTitle, Segmented, Sheet, Skeleton, Verified } from "@/components/ui";
import { BrokerSheet, VerifySheet } from "@/components/sheets";
import { useApp } from "@/components/app";

const PERKS = ["No ads anywhere", "Unlimited watchlist and price alerts", "Full technical analysis on every company", "Longer posts (2,000 characters)"];

export default function ProfilePage() {
  const me = useMe();
  const prefs = useLocal(prefsStore);
  const { toast, onboard } = useApp();
  const [sheet, setSheet] = useState<"" | "edit" | "verify" | "broker">("");
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (me) { setBio(me.bio); setName(me.name); } }, [me, sheet]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await updateMe({ name, bio }); setSheet(""); toast("Profile updated"); } catch (e) { setErr((e as Error).message); }
  };
  const togglePremium = async () => {
    const want = !me?.premium;
    try { const u = await updateMe({ premium: want }); toast(u.premium !== want ? "Premium checkout is not available yet." : want ? "Premium is on (demo checkout)" : "Premium turned off"); }
    catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="space-y-7 px-4 pt-2 lg:px-0">
        <Card className="flex items-center gap-4 p-5">
          {me ? <Avatar label={me.name} size={64} /> : <Skeleton className="h-16 w-16 !rounded-full" />}
          <div className="min-w-0 flex-1">
            {me ? (
              <>
                <p className="flex items-center gap-1.5 text-[19px] leading-tight font-bold"><span className="truncate">{me.name}</span>{me.verified && <Verified size={18} />}</p>
                <p className="truncate text-[14px] text-muted">@{me.handle} · {me.followers} followers · {me.following} following</p>
                {me.bio && <p className="mt-1 line-clamp-2 text-[14px]">{me.bio}</p>}
              </>
            ) : <Skeleton className="h-10 w-48" />}
          </div>
          {me && (me.onboarded ? <Button variant="ghost" className="h-10 shrink-0 px-4" onClick={() => setSheet("edit")}>Edit</Button> : <Button variant="lime" className="h-10 shrink-0 px-4" onClick={() => onboard()}>Set up</Button>)}
        </Card>

        <section id="premium" className="scroll-mt-6">
          <div className="rings rounded-[24px] bg-hero p-5 text-hero-ink">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-lime"><Sparkles size={16} /> {site.name} Premium</p>
            <p className="num mt-2 text-[26px] leading-tight font-bold tracking-[-0.02em]">Rs {site.premium.monthlyLkr.toLocaleString()}<span className="text-[15px] font-medium text-hero-muted"> / month</span></p>
            <p className="num text-[13px] text-hero-muted">or Rs {site.premium.yearlyLkr.toLocaleString()} a year (2 months free)</p>
            <ul className="mt-4 space-y-2.5">
              {PERKS.map((p) => <li key={p} className="flex items-start gap-2.5 text-[14.5px]"><Check size={17} strokeWidth={2.6} className="mt-0.5 shrink-0 text-lime" />{p}</li>)}
            </ul>
            <Button variant="lime" className="relative z-10 mt-5 w-full" onClick={togglePremium}>{me?.premium ? "Premium active — turn off" : "Try Premium"}</Button>
            <p className="mt-2.5 text-center text-[12px] text-hero-muted">Demo checkout. Online payment is not connected yet, so nothing is charged.</p>
          </div>
        </section>

        <section>
          <SectionTitle>For you</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            <Row icon={Landmark} title="Open a CDS account" sub="Get started with a licensed stockbroker" onClick={() => setSheet("broker")} />
            <Row icon={BadgeCheck} title={me?.verified ? "You are verified" : "Get verified"} sub="For companies, brokers, analysts and media" onClick={() => !me?.verified && setSheet("verify")} />
            <Row icon={Bookmark} title="Saved posts" href="/feed?tab=bookmarks" />
          </Card>
        </section>

        <section>
          <SectionTitle>Preferences</SectionTitle>
          <Card className="space-y-4 p-5">
            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted">Appearance</p>
              <Segmented<Prefs["theme"]> value={prefs.theme} onChange={(theme) => prefsStore.set((p) => ({ ...p, theme }))} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted">Language</p>
              <Segmented<Prefs["lang"]> value={prefs.lang} onChange={(lang) => prefsStore.set((p) => ({ ...p, lang }))} options={[{ value: "en", label: "English" }, { value: "si", label: "සිංහල" }, { value: "ta", label: "தமிழ்" }]} />
              {prefs.lang !== "en" && <p className="mt-2 text-[12.5px] text-muted">Navigation is translated. Full Sinhala and Tamil coverage is coming soon.</p>}
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle>About</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            <Row icon={Shield} title="Community guidelines" href="/legal/guidelines" />
            <Row icon={FileText} title="Privacy policy" href="/legal/privacy" />
            <Row icon={FileText} title="Disclaimer" href="/legal/disclaimer" />
          </Card>
          <p className="mt-3 px-1 text-[12px] text-muted">Market data is delayed and provided for information only. Nothing on {site.name} is investment advice.</p>
        </section>
      </div>

      <Sheet open={sheet === "edit"} onClose={() => setSheet("")} title="Edit profile">
        <form onSubmit={save}>
          <Field label="Display name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required /></Field>
          <Field label="Bio" hint={`${bio.length}/160`}><textarea className={cx(inputCls, "h-24 resize-none py-3")} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} /></Field>
          {err && <p role="alert" className="mb-3 text-[14px] font-medium text-down">{err}</p>}
          <Button variant="lime" className="w-full">Save</Button>
        </form>
      </Sheet>
      <VerifySheet open={sheet === "verify"} onClose={() => setSheet("")} />
      <BrokerSheet open={sheet === "broker"} onClose={() => setSheet("")} />
    </div>
  );
}

function Row({ icon: Icon, title, sub, href, onClick }: { icon: typeof Shield; title: string; sub?: string; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip"><Icon size={19} /></span>
      <span className="min-w-0 flex-1 text-left"><span className="block text-[15px] font-semibold">{title}</span>{sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}</span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </>
  );
  const cls = "press flex min-h-[64px] w-full items-center gap-3.5 px-4 py-2.5 hover:bg-chip/50";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}
