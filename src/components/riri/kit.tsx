// ─────────────────────────────────────────────────────────────────────────────
// THE DEVICE KIT — the pieces every screen on Riri's phone is built from.
//
// Ported from connected-suite/src/components/os/kit.tsx. One file on purpose: these
// are small, they only live inside a ~400px panel, and keeping them together is what
// makes the screens look like one operating system rather than five ideas of a row.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

export const SPRING = { type: "spring" as const, stiffness: 420, damping: 34 };
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * Every screen. The entrance direction is the navigation direction.
 *
 * Screens are OPAQUE LAYERS over one another, and the incoming one is stacked above
 * the one leaving. They are not sequenced with AnimatePresence `mode="wait"`, which
 * mounts the next screen only after the previous one reports its exit finished —
 * so an exit that never reports (a throttled tab, a stalled frame, a screenshot
 * browser on virtual time) leaves a phone with a header and no screen. Here the new
 * screen is there immediately, whatever the old one's animation is doing.
 */
export function Screen({ children, from = "right", className = "", pad = true }: { children: ReactNode; from?: "right" | "below" | "fade"; className?: string; pad?: boolean }) {
  const variants = {
    right: { initial: { opacity: 0, x: 26, zIndex: 2 }, animate: { opacity: 1, x: 0, zIndex: 2 }, exit: { opacity: 0, x: 18, zIndex: 1 } },
    below: { initial: { opacity: 0, scale: 0.97, zIndex: 2 }, animate: { opacity: 1, scale: 1, zIndex: 2 }, exit: { opacity: 0, scale: 1.02, zIndex: 1 } },
    fade: { initial: { opacity: 0, zIndex: 2 }, animate: { opacity: 1, zIndex: 2 }, exit: { opacity: 0, zIndex: 1 } },
  }[from];
  return (
    <motion.div
      {...variants}
      transition={{ duration: 0.24, ease: EASE_OUT }}
      className={`absolute inset-0 flex min-h-0 flex-col ${pad ? "px-3.5" : ""} ${className}`}
      style={{ background: "var(--os-paper)" }}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`px-0.5 text-[9.5px] font-semibold uppercase tracking-[0.15em] text-ink-faint ${className}`}>{children}</p>;
}

/** The standard tappable row. Icon, two lines, a chevron — nothing else, ever. */
export function Row({ icon, title, detail, right, onClick, badge }: { icon?: ReactNode; title: ReactNode; detail?: ReactNode; right?: ReactNode; onClick?: () => void; badge?: number }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className={`flex w-full items-center gap-2.5 rounded-2xl border border-line px-3 py-2.5 text-left transition-all ${onClick ? "hover:border-[color:var(--brand)] active:scale-[0.985]" : ""}`}
      style={{ background: "var(--os-bubble)" }}
    >
      {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-soft" style={{ background: "var(--line)" }}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">{title}</span>
        {detail && <span className="mt-0.5 block truncate text-[10.5px] leading-tight text-ink-soft">{detail}</span>}
      </span>
      {badge != null && badge > 0 && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-bold text-white">{badge}</span>}
      {right ?? (onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" /> : null)}
    </Tag>
  );
}

export function EmptyState({ icon, title, detail, action }: { icon: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl text-ink-faint" style={{ background: "var(--line)" }}>{icon}</span>
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-[240px] text-[11px] leading-snug text-ink-soft">{detail}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function renderInline(text: string, k: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|https?:\/\/\S+)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={k + i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
    ) : /^https?:\/\//.test(p) ? (
      // External links only ever come from a pack's `url`, which the validator
      // guarantees is absolute and external. In-app movement is an action button.
      <a key={k + i} href={p} target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: "var(--brand-ink)" }}>
        {p.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      <span key={k + i}>{p}</span>
    ),
  );
}

/** Bold, bullets, numbered steps and external links. No dependency, no HTML from the server. */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  text.split("\n").forEach((raw, i) => {
    const l = raw.trimEnd();
    if (!l.trim()) {
      out.push(<div key={i} className="h-1.5" />);
      return;
    }
    const bullet = /^-\s+(.*)/.exec(l);
    const num = /^(\d+)\.\s+(.*)/.exec(l);
    if (bullet) {
      out.push(
        <div key={i} className="flex gap-2">
          <span className="mt-px shrink-0" style={{ color: "var(--brand-ink)" }}>•</span>
          <span className="flex-1">{renderInline(bullet[1], `${i}b`)}</span>
        </div>,
      );
    } else if (num) {
      out.push(
        <div key={i} className="flex gap-2">
          <span className="shrink-0 font-semibold" style={{ color: "var(--brand-ink)" }}>{num[1]}.</span>
          <span className="flex-1">{renderInline(num[2], `${i}n`)}</span>
        </div>,
      );
    } else {
      out.push(<p key={i}>{renderInline(l, `${i}p`)}</p>);
    }
  });
  return <div className="space-y-1 text-[13px] leading-relaxed text-ink">{out}</div>;
}
