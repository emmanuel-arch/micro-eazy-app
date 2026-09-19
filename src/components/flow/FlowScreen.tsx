// ─────────────────────────────────────────────────────────────────────────────
// A STEP-BY-STEP SCREEN THAT GOES SIDEWAYS.
//
// KYC verification, the statement cruncher and Apply now are all the same
// shape: a short run of steps, each one a pane, that must be done in order. This
// is that shape, once.
//
//   ┌ Sky: the step's title · what happens here · ▬▬▬▭▭ 3/6 ┐
//   │  ① Standing  ② Product  ③ Amount  ④ Term  ⑤ Schedule …  ← the rail
//   │ ┌ the deck ──────────────────────────────────────────┐ │
//   │ │ pane = the step in hand, full width                │ │
//   │ └────────────────────────────────────────────────────┘ │
//   └─────────────────────────────────────────────────────────┘
//            ‹ ● ● ● ● ● ● ›  Loan overview »        ← the pager, below
//
// ── THE STEPS ARE A RAIL, NOT A COLUMN ──────────────────────────────────────
// They used to be a 280px column down the right-hand side: a vertical list of
// every step with ticks, locks and a "Why we ask" card underneath. Three things
// were wrong with it, in increasing order of cost.
//
//   1. It took a fifth of the width of every flow, permanently, to show six
//      short labels. On the loan-overview step that column was pushing the
//      figures and the lender's terms into two cramped cards beside it.
//   2. It duplicated the pager. The pager under the panes already says where
//      you are and moves you; a second, differently-shaped control saying the
//      same thing in the corner is two things to keep in agreement.
//   3. It was a LIST OF STEPS drawn as a sidebar, which reads as navigation for
//      the page rather than as progress through a flow.
//
// So the steps are a horizontal rail above the pane — the shape every checkout
// in the world uses, because it is the shape that says "these happen in order
// and you are here". It is still clickable, still clamped to `reachable`, and it
// is in sync with the pager below because both read the same `at`.
//
// ── NO WALKING PAST A STEP ──────────────────────────────────────────────────
// The deck is CONTROLLED. The screen decides which pane is in view, and every
// control — rail, pager, wheel, arrow keys, swipe — is clamped to `reachable`:
// the steps already done plus the one in hand. A customer can look back at what
// they did; nothing lets them slide past an identity check they have not passed.
// A step the lender has not switched on is simply not in the list, so it is never
// shown and never counted.
//
// On a phone only the step in hand is on screen, the rail collapses into the
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

          {/* THE BAR IS THE PHONE'S RAIL. Below `lg` there is no width for six
              labels, so the abstract progress bar carries the position — and
              above `lg` it is hidden, because the rail underneath says the same
              thing with the step names on it. Two indicators of the same value,
              one of them vaguer, is the thing that made the old right-hand
              column feel like clutter. */}
          {steps.length > 1 && (
            <div className="mt-3 max-w-[560px] lg:hidden">
              <Stepper total={steps.length} index={i} />
            </div>
          )}

          {/* ── THE RAIL ─────────────────────────────────────────────────────
              Inside the Sky, not under it. The Sky carries 3.5rem of bottom
              padding that the content below deliberately overlaps by 3rem, so
              anything rendered at the top of the content area lands IN that
              overlap — which is how the first cut of this put a line of body
              copy half behind the band's own edge.

              It scrolls sideways rather than wrapping: a second row of tabs
              appearing at step four would move the pane under the customer's
              cursor mid-flow. The scrollbar is hidden because the rail is short
              and the pager below is the control anyone actually reaches for. */}
          {steps.length > 1 && (
            <nav
              aria-label={`${label} steps`}
              className="mt-3 hidden items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] lg:flex"
            >
              {steps.map((s, n) => {
                // `reachable` is the step in progress, so everything before it is done.
                const now = n === i;
                const done = n < reachable && !now;
                const open = n <= reachable;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!open}
                    aria-current={now ? "step" : undefined}
                    onClick={() => onAt(n)}
                    title={open ? s.blurb : "Finish the steps before this one first"}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      now
                        ? "border-transparent bg-white text-[color:var(--navy-deep)] shadow-sm"
                        : open
                          ? "border-white/25 text-sky-ink-soft hover:border-white/45 hover:bg-white/10 hover:text-sky-ink"
                          : "cursor-not-allowed border-white/10 text-sky-ink-soft opacity-45"
                    }`}
                  >
                    {/* The step's standing, in the 17px before its name: a tick
                        once it is behind you, a lock while it is still shut, and
                        its number the rest of the time. */}
                    <span
                      aria-hidden
                      className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full text-[9.5px] font-bold ${
                        now ? "" : done ? "" : "bg-white/15 text-sky-ink"
                      }`}
                      style={
                        done
                          ? { background: "var(--lime)", color: "var(--navy-deep)" }
                          : now
                            ? { background: "color-mix(in oklab, var(--navy-deep) 12%, transparent)", color: "var(--navy-deep)" }
                            : undefined
                      }
                    >
                      {done ? <Check className="h-3 w-3" strokeWidth={3} /> : !open && s.required ? <Lock className="h-[9px] w-[9px]" strokeWidth={2.6} /> : n + 1}
                    </span>
                    <span className="whitespace-nowrap">{s.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* WHY THIS STEP CANNOT BE SKIPPED — one line under the rail, where
              the card in the old right-hand column used to say it at four times
              the size. It is a footnote to the step in hand, not a panel, so it
              costs the flow one line instead of a fifth of the screen. */}
          {/* `mb-6` is load-bearing, not spacing taste. The Sky carries 3.5rem
              of bottom padding and the content below overlaps it by 3rem, so
              the last 48px of this band is under a card. Without the margin this
              line sits in that strip and is read with its lower half behind the
              first card — which is how it looked before the margin existed. */}
          {step?.why && (
            <p className="mt-2.5 mb-6 hidden items-start gap-1.5 text-[11.5px] leading-snug text-sky-ink-soft lg:flex">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
              <span className="min-w-0">{step.why}</span>
            </p>
          )}
        </Sky>
      </div>

      <div className="relative z-10 -mt-12 flex min-h-0 flex-1 flex-col px-4">
        <div className="flex min-h-0 flex-1 flex-col">
          <Deck
            label={label}
            panes={steps.map((s) => ({ id: s.id, label: s.label, node: s.node }))}
            at={i}
            onAt={onAt}
            reachable={reachable}
            mobile="current"
          />
        </div>

        {/* Screens that hung extra cards under the road still get to render
            them; there is simply no column for them to sit in, so they go below
            the pane where the flow has already been read. */}
        {aside && <div className="mt-2 hidden shrink-0 lg:block">{aside}</div>}
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
