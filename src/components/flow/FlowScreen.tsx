// ─────────────────────────────────────────────────────────────────────────────
// A STEP-BY-STEP SCREEN THAT GOES SIDEWAYS.
//
// KYC verification, the statement cruncher and Apply now are all the same
// shape: a short run of steps, each one a pane, that must be done in order. This
// is that shape, once.
//
//   ┌ Sky: the step's title · what happens here · ▬▬▬▭▭ 3/6 ┐
//   │ ┌ the deck ─────────────────────────┐ ┌ the road ──────┐ │
//   │ │ pane = the step in hand           │ │ ✓ done         │ │
//   │ │                                   │ │ ● this one     │ │
//   │ │                                   │ │ 🔒 still ahead  │ │
//   │ └───────────────────────────────────┘ │ Why we ask     │ │
//   └────────────────────────────────────────└────────────────┘─┘
//
// ── NO WALKING PAST A STEP ──────────────────────────────────────────────────
// The deck is CONTROLLED. The screen decides which pane is in view, and every
// control — pager, wheel, arrow keys, swipe — is clamped to `reachable`: the
// steps already done plus the one in hand. A customer can look back at what they
// did; nothing lets them slide past an identity check they have not passed. A
// step the lender has not switched on is simply not in the list, so it is never
// shown and never counted.
//
// On a phone only the step in hand is on screen, the road collapses into the
// Sky's progress bar, and Back is the arrow in the Sky.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import { Check, Info, Lock } from "lucide-react";
import { Sky } from "../shell/Sky";
import { Deck } from "../shell/Deck";
import { Stepper } from "../onboarding/Stepper";

export interface FlowStep {
  id: string;
  /** Two or three words — it is the pager label and the road's row. */
  label: string;
  /** The Sky's heading while this step is in hand. */
  title: string;
  /** One line under the heading. */
  blurb: string;
  /** Why this step cannot be skipped. Shown beside the step on a laptop. */
  why?: string;
  /** Marked with a lock on the road until reached. */
  required?: boolean;
  node: ReactNode;
}

export function FlowScreen({
  label,
  steps,
  at,
  reachable,
  onAt,
  aside,
}: {
  /** Names the deck for a screen reader. */
  label: string;
  steps: FlowStep[];
  at: number;
  /** Highest step index the customer may move to. */
  reachable: number;
  onAt: (i: number) => void;
  /** Extra cards under the road on a laptop. */
  aside?: ReactNode;
}) {
  const i = Math.max(0, Math.min(at, steps.length - 1));
  const step = steps[i];

  return (
    <div className="flex flex-col lg:h-full lg:min-h-0">
      <div className="shrink-0">
        <Sky title={step?.title ?? label} onBack={i > 0 ? () => onAt(i - 1) : undefined}>
          <p className="max-w-[48ch] text-[13px] leading-relaxed text-sky-ink-soft lg:truncate">{step?.blurb}</p>
          {steps.length > 1 && (
            <div className="mt-3 max-w-[560px] lg:mt-2">
              <Stepper total={steps.length} index={i} />
            </div>
          )}
        </Sky>
      </div>

      <div className="relative z-10 -mt-12 flex min-h-0 flex-1 flex-col px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-0 flex-col lg:h-full">
          <Deck
            label={label}
            panes={steps.map((s) => ({ id: s.id, label: s.label, node: s.node }))}
            at={i}
            onAt={onAt}
            reachable={reachable}
            mobile="current"
          />
        </div>

        <aside className="hidden min-h-0 space-y-3 overflow-y-auto pb-2 [scrollbar-width:none] lg:block">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
              <p className="text-[13px] font-semibold">{label}</p>
              <span className="tnum text-[11.5px] text-ink-faint">
                {i + 1} of {steps.length}
              </span>
            </div>
            <ol className="px-2 py-2">
              {steps.map((s, n) => {
                // `reachable` is the step in progress, so everything before it is done.
                const now = n === i;
                const done = n < reachable && !now;
                const open = n <= reachable;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!open || now}
                      onClick={() => onAt(n)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-colors enabled:hover:bg-surface-sunk"
                    >
                      <span
                        aria-hidden
                        className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[10px] font-bold"
                        style={
                          done
                            ? { background: "var(--lime)", color: "var(--navy-deep)" }
                            : now
                              ? { background: "var(--brand)", color: "var(--brand-on)" }
                              : { background: "var(--surface-sunk)", color: "var(--ink-faint)" }
                        }
                      >
                        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : n + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12.5px] leading-snug ${now ? "font-semibold text-ink" : open ? "text-ink-soft" : "text-ink-faint"}`}>
                          {s.label}
                        </span>
                        {now && <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{s.blurb}</span>}
                      </span>
                      {!open && s.required && <Lock className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" strokeWidth={2.2} aria-label="Required" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {step?.why && (
            <section className="card p-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                  style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}
                >
                  <Info className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <p className="text-[13px] font-semibold">Why we ask</p>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-soft">{step.why}</p>
            </section>
          )}

          {aside}
        </aside>
      </div>
    </div>
  );
}

/** A card-shaped pane body with a header — the common shape of a step. */
export function StepCard({
  icon,
  title,
  meta,
  children,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "var(--line)" }}>
        {icon}
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</p>
        {meta}
      </div>
      <div className="p-5 lg:p-4">{children}</div>
    </section>
  );
}

/** A plain inline notice: tone decides the colour, never the words. */
export function Notice({
  tone = "info",
  children,
  icon,
}: {
  tone?: "info" | "warn" | "bad" | "good";
  children: ReactNode;
  icon?: ReactNode;
}) {
  const bg =
    tone === "bad"
      ? "color-mix(in oklab, #e11d48 9%, transparent)"
      : tone === "warn"
        ? "color-mix(in oklab, #f59e0b 12%, transparent)"
        : tone === "good"
          ? "color-mix(in oklab, var(--green) 12%, transparent)"
          : "var(--surface-sunk)";
  return (
    <div role={tone === "bad" ? "alert" : undefined} className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft" style={{ background: bg }}>
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default FlowScreen;
