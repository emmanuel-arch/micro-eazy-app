// ─────────────────────────────────────────────────────────────────────────────
// THE DECK — a screen that goes sideways instead of down.
//
// The rule, in one line: on a laptop this app does not scroll. The window is the
// frame, the frame is fixed, and the footer that names the licensed lender is on
// screen at all times. Content that does not fit becomes a second PANE of the
// same counter — same rectangle, same width, same place — rather than a second
// screenful below the fold.
//
//     ┌─ the canvas ─────────────────────────┐
//     │  pane 0        │ pane 1   │ pane 2   │   ← one track, translated
//     │  (in view)     │ (waiting)│          │
//     └────────────────┴──────────┴──────────┘
//       ‹ ●━● ›  What next »        ← the pager, drawn into the shell's footer
//
// ── HOW IT MOVES, AND WHY THERE IS NO MEASUREMENT ───────────────────────────
// The track is exactly one viewport wide and every pane is `flex: 0 0 100%`, so
// `translateX(calc(var(--pane) * -100%))` resolves against the track's own width
// and lands on the right pane at ANY window size. No ResizeObserver, no pixel
// arithmetic, nothing to recompute when the sidebar collapses or the browser is
// zoomed. See .deck-track in styles/theme.css.
//
// ── THE WHEEL IS BORROWED, NOT STOLEN ───────────────────────────────────────
// Turning the wheel moves to the next pane — which is the whole point, because
// the muscle memory of "there is more below" has to land somewhere. But it is
// borrowed carefully:
//
//   · A pane whose own content overflows (a short laptop, a 200% browser zoom)
//     scrolls ITSELF first, and only pages on once it has hit the edge. A deck
//     that swallowed the wheel over scrollable content would hide that content
//     with no way to reach it.
//   · At the first and last pane the wheel is not preventDefault()ed at all, so
//     nothing is trapped.
//   · A lock window stops one flick of a trackpad from firing four times.
//
// Trackpad users get horizontal deltas for free (deltaX), which is a real
// sideways swipe on the hardware most of this app's desktop viewers own.
//
// ── ON A PHONE THIS COMPONENT IS ALMOST NOTHING ─────────────────────────────
// Below `lg` the CSS turns the track into a plain vertical stack, the pager does
// not render, and the page scrolls the way a phone should. The handset is still
// the design target; the deck is the adaptation, and it costs the phone one
// wrapper div.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { usePagerSlot } from "./chrome";
import { ScrollVeil, useCutOff } from "./ScrollVeil";

export type Pane = {
  id: string;
  /** Two or three words. It is read as "what is over there", on a control the
   *  width of a pill — a sentence truncates and tells nobody anything. */
  label: string;
  node: ReactNode;
};

const DESKTOP = "(min-width: 1024px)";

/** Whether the landscape rule is in force. The deck is inert below `lg`. */
function useIsDesktop(): boolean {
  const [on, setOn] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(DESKTOP).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return on;
}

export function Deck({
  panes,
  /** Names the region for a screen reader — "Home, 3 panels" and so on. */
  label,
}: {
  panes: Pane[];
  label: string;
}) {
  const [at, setAt] = useState(0);
  const desktop = useIsDesktop();
  const slot = usePagerSlot();
  const viewportRef = useRef<HTMLDivElement>(null);
  /** Each pane, so the wheel handler can ask whether THIS one still has room to
   *  scroll before deciding the gesture belongs to the deck. */
  const paneRefs = useRef<(HTMLElement | null)[]>([]);
  /** Wall-clock until which further wheel deltas are ignored. One flick of a
   *  trackpad is dozens of events; without this it crosses the whole deck. */
  const lockUntil = useRef(0);

  const count = panes.length;
  /** Whether the pane in view has content below its own bottom edge — a short
   *  window, or a browser zoomed to 200%. Drives the fade, and nothing else:
   *  the wheel handler asks the element directly, because it needs the answer
   *  for the current gesture rather than for the last render. */
  const cutOff = useCutOff(() => paneRefs.current[at] ?? null, [at, desktop, count]);
  // Clamped, not wrapped. The wheel and the keyboard must have ends, or a
  // customer at the last pane who keeps scrolling is silently returned to the
  // first and cannot tell whether they moved forwards or backwards.
  const clamp = useCallback(
    (n: number) => Math.max(0, Math.min(count - 1, n)),
    [count],
  );

  // A window narrowed to phone width while parked on pane 2 leaves `at` pointing
  // at a pane the stacked layout no longer positions. Reset rather than carry a
  // stale index back when it widens again.
  useEffect(() => {
    if (!desktop) setAt(0);
  }, [desktop]);

  // ── THE WHEEL ────────────────────────────────────────────────────────────
  // A native listener, not React's onWheel: `preventDefault` inside a passive
  // listener is ignored (and warns), and React attaches wheel handlers passively
  // at the root. Nothing is prevented unless this deck is actually going to act
  // on the event — see the guards below.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !desktop || count < 2) return;

    const onWheel = (e: WheelEvent) => {
      const pane = paneRefs.current[at];
      // The pane scrolls itself first. Only once it is against the edge in the
      // direction of travel does the wheel belong to the deck.
      if (pane && pane.scrollHeight - pane.clientHeight > 4) {
        const atTop = pane.scrollTop <= 0;
        const atEnd = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1;
        if (e.deltaY > 0 ? !atEnd : !atTop) return;
      }

      // A trackpad's sideways swipe is a horizontal delta and means exactly this
      // gesture; a mouse wheel only ever has a vertical one.
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 8) return;

      const next = clamp(at + (delta > 0 ? 1 : -1));
      // At either end, hand the event back. Trapping it there would make the
      // deck feel stuck rather than finished.
      if (next === at) return;

      e.preventDefault();
      const now = Date.now();
      if (now < lockUntil.current) return;
      lockUntil.current = now + 620;
      setAt(next);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [at, clamp, count, desktop]);

  // ── THE KEYBOARD ─────────────────────────────────────────────────────────
  // Left and right, which is what the layout now means. Deliberately NOT while
  // somebody is in a field: a customer moving the caret through a phone number
  // must not page the screen out from under the input they are typing into.
  useEffect(() => {
    if (!desktop || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
      )
        return;
      if (e.key === "ArrowRight") setAt((i) => clamp(i + 1));
      else if (e.key === "ArrowLeft") setAt((i) => clamp(i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clamp, count, desktop]);

  // ── THE SWIPE ────────────────────────────────────────────────────────────
  // For the tablet in landscape, which is a real way this app is opened by staff
  // sitting with a customer. 48px of travel and a dominant horizontal axis, so a
  // finger drifting sideways while scrolling a pane does not page it.
  const touch = useRef<{ x: number; y: number } | null>(null);

  const pager =
    count < 2 ? null : (
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setAt((i) => clamp(i - 1))}
          disabled={at === 0}
          aria-label="Previous panel"
          className="grid h-8 w-8 place-items-center rounded-full border text-ink-soft transition-colors hover:bg-surface-sunk hover:text-ink disabled:pointer-events-none disabled:opacity-35"
          style={{ borderColor: "var(--line-strong)" }}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
        </button>

        {/* The steps are BUTTONS. Three panes is few enough that going straight
            to the one you want beats pressing next twice. */}
        <span className="flex items-center gap-1.5">
          {panes.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="deck-step"
              aria-current={i === at}
              aria-label={p.label}
              title={p.label}
              onClick={() => setAt(i)}
            />
          ))}
        </span>

        {/* ── THE ONE THAT TEACHES THE GESTURE ──────────────────────────────
            It names the pane it is going to rather than saying "next", because
            the first time anybody meets a screen that moves sideways they need
            to be told that there IS a next and what is on it. At the last pane
            it turns round and offers the way back, so the control is never a
            dead rectangle. */}
        <button
          type="button"
          onClick={() => setAt((i) => (i >= count - 1 ? 0 : i + 1))}
          className="group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunk hover:text-ink"
          style={{ borderColor: "var(--line-strong)" }}
        >
          <span className="max-w-[16ch] truncate">
            {at >= count - 1 ? panes[0].label : panes[at + 1].label}
          </span>
          {at >= count - 1 ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.4} />
          ) : (
            <ChevronsRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.4} />
          )}
        </button>
      </div>
    );

  return (
    <div className="deck">
      <div
        ref={viewportRef}
        className="deck-viewport"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || !desktop) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          setAt((i) => clamp(i + (dx < 0 ? 1 : -1)));
        }}
      >
        <div
          className="deck-track"
          // A custom property rather than an inline transform, so the rule that
          // KNOWS about the breakpoint stays in CSS. Below lg the same value is
          // set and simply never read, which is how the phone gets a plain
          // vertical stack without this component branching on width.
          style={{ "--pane": at } as React.CSSProperties}
          role="group"
          aria-label={label}
        >
          {panes.map((p, i) => (
            <section
              key={p.id}
              ref={(n) => {
                paneRefs.current[i] = n;
              }}
              className="deck-pane"
              // Below lg every pane is on the page at once and none of them is
              // hidden — the attribute is only meaningful where the CSS acts on
              // it, and `desktop` is what keeps the two in step.
              aria-hidden={desktop && i !== at}
              aria-label={p.label}
            >
              {p.node}
            </section>
          ))}
        </div>

        {/* On the viewport rather than inside the pane: a fade that lived in the
            scroll container would scroll away with the content it is there to
            hint at. */}
        <ScrollVeil show={cutOff} />
      </div>

      {/* Into the shell's footer if there is one, in place if there is not. */}
      {desktop && pager && (slot ? createPortal(pager, slot) : <div className="mt-2 flex justify-end">{pager}</div>)}
    </div>
  );
}

export default Deck;
