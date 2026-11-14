"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, ChevronLeft, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pct, tone } from "@/lib/fmt";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-[24px] bg-card", className)} {...rest}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-[28px] items-center justify-between gap-3 px-1">
      <h2 className="text-[17px] font-bold leading-tight tracking-[-0.01em]">{children}</h2>
      {action && <div className="shrink-0 text-[14px] font-medium text-muted">{action}</div>}
    </div>
  );
}

// iOS-style segmented control / pill tabs.
export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: {
  value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[]; className?: string; size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cx("no-scrollbar flex gap-1.5 overflow-x-auto", className)}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const on = v === value;
        return (
          <button key={v} role="tab" aria-selected={on} onClick={() => onChange(v)}
            className={cx("press shrink-0 rounded-full font-semibold whitespace-nowrap", size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-[14px]",
              on ? "bg-ink text-bg" : "text-muted hover:bg-chip")}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Change({ value, className, pill = false }: { value: number; className?: string; pill?: boolean }) {
  const t = tone(value);
  const color = t === "up" ? "text-up" : t === "down" ? "text-down" : "text-muted";
  const arrow = t === "up" ? "▲" : t === "down" ? "▼" : "";
  return (
    <span className={cx("num inline-flex items-center gap-1 font-semibold whitespace-nowrap", color,
      pill && "rounded-full px-2 py-0.5", pill && (t === "up" ? "bg-up-soft" : t === "down" ? "bg-down-soft" : "bg-chip"), className)}>
      {arrow && <span className="text-[0.62em] leading-none">{arrow}</span>}
      {pct(value)}
    </span>
  );
}

const HUES = [152, 200, 262, 24, 340, 44, 180, 290];
export function Avatar({ label, size = 40, square = false }: { label: string; size?: number; square?: boolean }) {
  const text = label.replace(/[^A-Za-z0-9]/g, "").slice(0, square ? 4 : 2).toUpperCase() || "?";
  const hue = HUES[[...label].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  return (
    <span aria-hidden className={cx("inline-flex shrink-0 items-center justify-center font-bold text-white select-none", square ? "rounded-[12px]" : "rounded-full")}
      style={{ width: size, height: size, fontSize: Math.max(10, size * (text.length > 3 ? 0.26 : text.length > 2 ? 0.3 : 0.38)), background: `hsl(${hue} 42% 38%)`, letterSpacing: "-0.02em" }}>
      {text}
    </span>
  );
}

export const Verified = ({ size = 16 }: { size?: number }) => (
  <BadgeCheck size={size} className="shrink-0 fill-lime text-lime-ink" aria-label="Verified" />
);

export function Button({ variant = "dark", className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "dark" | "lime" | "ghost" | "outline" }) {
  const v = { dark: "bg-hero text-hero-ink", lime: "bg-lime text-lime-ink", ghost: "bg-chip text-ink", outline: "border border-line bg-transparent text-ink" }[variant];
  return (
    <button className={cx("press inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-50",
      !/(^|\s)h-/.test(className || "") && "h-12", !/(^|\s)px-/.test(className || "") && "px-5", v, className)} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx("press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink", className)} {...rest}>
      {children}
    </button>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <p className="text-[16px] font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[14px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Page header: back button + centred title on mobile detail pages, large title on tab roots.
export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  const router = useRouter();
  if (back)
    return (
      <header className="glass sticky top-0 z-30 grid h-[60px] grid-cols-[44px_1fr_auto] items-center gap-3 px-4 pt-[env(safe-area-inset-top)] lg:static lg:mb-2 lg:!bg-transparent lg:px-0 lg:!backdrop-filter-none" style={{ height: "calc(60px + env(safe-area-inset-top))" }}>
        <IconButton label="Back" onClick={() => (history.length > 1 ? router.back() : router.push("/"))}><ChevronLeft size={22} /></IconButton>
        <div className="min-w-0 text-center lg:text-left">
          <p className="truncate text-[16px] leading-tight font-bold lg:text-[22px] lg:font-extrabold">{title}</p>
          {subtitle && <p className="truncate text-[12.5px] leading-tight text-muted lg:text-[14px]">{subtitle}</p>}
        </div>
        <div className="flex min-w-[44px] justify-end gap-2">{right}</div>
      </header>
    );
  return (
    <header className="flex min-h-[64px] items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+8px)] lg:px-0 lg:pt-6">
      <div className="min-w-0">
        <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="truncate text-[14px] text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {right}
        {title !== "Profile" && <Link href="/profile" aria-label="Profile" className="press flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card lg:hidden"><User size={20} /></Link>}
      </div>
    </header>
  );
}

// Bottom sheet on phones, centred dialog on desktop.
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={cx("sheet-in flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-card outline-none sm:rounded-[28px]", wide ? "sm:max-w-[600px]" : "sm:max-w-[460px]")}>
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line sm:hidden" />
        <div className="grid grid-cols-[44px_1fr_44px] items-center px-3 pt-2 pb-1">
          <span />
          <p className="truncate text-center text-[16px] font-bold">{title}</p>
          <button aria-label="Close" onClick={onClose} className="press flex h-9 w-9 items-center justify-center justify-self-end rounded-full bg-chip"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-[calc(20px+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12.5px] text-muted">{hint}</span>}
    </label>
  );
}
export const inputCls = "h-12 w-full rounded-[14px] border border-line bg-bg px-4 outline-none placeholder:text-muted focus:border-ink";

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
