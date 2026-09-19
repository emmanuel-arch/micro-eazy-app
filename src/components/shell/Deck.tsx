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
//                 ‹ ●━● ›  Your standing »       ← the pager, centred under
//     ════════════ legal bar, edge to edge ═══════   the panes, above the footer
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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronsRight, Lock } from "lucide-react";
import { usePagerSlot } from "./chrome";
import { ScrollVeil, useCutOff } from "./ScrollVeil";

export type Pane = {
  id: string;
  /** Two or three words. It is read as "what is over there", on a control the
   *  width of a pill — a sentence truncates and tells nobody anything. */
  label: string;
  node: ReactNode;
};

// ── STEERING THE DECK FROM INSIDE A PANE ────────────────────────────────────
// A card on one pane can point at another — Home's "Read more" on a tip opens
// the help pane at that topic. On a laptop that is a slide; on a phone, where the
// panes are stacked, it is a scroll to the pane. The card does not need to know
// which.
type DeckApi = { at: number; goTo: (target: string | number) => void };
const DeckContext = createContext<DeckApi>({ at: 0, goTo: () => {} });
export const useDeck = () => useContext(DeckContext);

const DESKTOP = "(min-width: 1024px)";

/** Whether the landscape rule is in force. The deck is inert below `lg`. */
export function useIsDesktop(): boolean {
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
  at: controlledAt,
  onAt,
  reachable,
  mobile = "stack",
}: {
  panes: Pane[];
  label: string;
  /**
   * ── A STEP-BY-STEP FLOW ──────────────────────────────────────────────────
   * Given, the deck is CONTROLLED: the flow decides which pane is in view, and
   * the pager, wheel, keys and swipe may only move within `reachable` — the steps
   * already completed plus the one in progress. A customer can look back at what
   * they did; they cannot slide past an identity check they have not passed.
   */
  at?: number;
  onAt?: (i: number) => void;
  /** Highest pane index a control may move to. Defaults to the last pane. */
  reachable?: number;
  /** "stack" shows every pane on a phone (a screen). "current" shows only the pane in view (a flow). */
  mobile?: "stack" | "current";
}) {
  const [innerAt, setInnerAt] = useState(0);
  const controlled = controlledAt != null;
  const at = controlled ? controlledAt : innerAt;
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
  const ceiling = Math.max(0, Math.min(count - 1, reachable ?? count - 1));
  const clamp = useCallback(
    (n: number) => Math.max(0, Math.min(ceiling, n)),
    [ceiling],
  );

  const setAt = useCallback(
    (next: number | ((i: number) => number)) => {
      const value = typeof next === "function" ? next(at) : next;
      if (controlled) onAt?.(value);
      else setInnerAt(value);
    },
    [at, controlled, onAt],
  );

  // A window narrowed to phone width while parked on pane 2 leaves `at` pointing
  // at a pane the stacked layout no longer positions. Reset rather than carry a
  // stale index back when it widens again. A controlled flow keeps its step.
  useEffect(() => {
    if (!desktop && !controlled) setInnerAt(0);
  }, [desktop, controlled]);

  const goTo = useCallback(
    (target: string | number) => {
      const i = typeof target === "number" ? target : panes.findIndex((p) => p.id === target);
      if (i < 0) return;
      const next = clamp(i);
      setAt(next);
      // Stacked on a phone: the "slide" is a scroll to the pane.
      if (!desktop && mobile === "stack") {
        requestAnimationFrame(() => paneRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    },
    [clamp, desktop, mobile, panes, setAt],
  );
  const api = useMemo(() => ({ at, goTo }), [at, goTo]);

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

  // ── THE PAGER IS THE MOST IMPORTANT CONTROL ON A SIDEWAYS SCREEN ──────────
  // It is the only thing on the page that says there IS more, and the only
  // thing that moves you to it. Drawn at the size of a footnote, in a strip
  // under the content, customers simply did not see it — they read the pane in
  // front of them and concluded that was the screen.
  //
  // So it is set at a size that matches its job: 40px targets instead of 32,
  // dots that are pills rather than specks, a real border and a panel behind
  // the whole group so it reads as one control rather than three loose pieces
  // floating over the page. The "next" button keeps the label — naming the pane
  // it goes to is what teaches the gesture the first time — and is now filled in
  // the brand colour, because on a screen with one obvious next action that
  // action should look like one.
  const pager =
    count < 2 ? null : (
      <div
        className="flex items-center gap-2 rounded-full border px-2 py-1.5 shadow-sm"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <button
          type="button"
          onClick={() => setAt((i) => clamp(i - 1))}
          disabled={at === 0}
          aria-label="Previous panel"
          className="grid h-10 w-10 place-items-center rounded-full border text-ink-soft transition-colors hover:bg-surface-sunk hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          style={{ borderColor: "var(--line-strong)" }}
        >
          <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </button>

        {/* The steps are BUTTONS. Three panes is few enough that going straight
            to the one you want beats pressing next twice. */}
        <span className="flex items-center gap-2 px-1">
          {panes.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="deck-step"
              aria-current={i === at}
              aria-label={p.label}
              title={p.label}
              disabled={i > ceiling}
              onClick={() => setAt(clamp(i))}
            />
          ))}
        </span>

        {/* ── THE ONE THAT TEACHES THE GESTURE ──────────────────────────────
            It names the pane it is going to rather than saying "next", because
            the first time anybody meets a screen that moves sideways they need
            to be told that there IS a next and what is on it. At the last pane
            it turns round and offers the way back, so the control is never a
            dead rectangle. */}
        {/* A flow whose next step is not open yet names that step and locks it,
            rather than wrapping round to the first pane as though the road ended. */}
        {at >= ceiling && ceiling < count - 1 ? (
          <span
            className="flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold text-ink-faint"
            style={{ borderColor: "var(--line)" }}
            aria-disabled
          >
            <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            <span className="max-w-[18ch] truncate">{panes[at + 1]?.label}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAt((i) => (i >= ceiling ? 0 : i + 1))}
            className="group flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--brand)", color: "var(--brand-on)" }}
          >
            <span className="max-w-[18ch] truncate">
              {at >= ceiling ? panes[0].label : panes[at + 1].label}
            </span>
            {at >= ceiling ? (
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.4} />
            ) : (
              <ChevronsRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.4} />
            )}
          </button>
        )}
      </div>
    );

  return (
    <DeckContext.Provider value={api}>
    <div className={`deck ${mobile === "current" ? "deck--flow" : ""}`}>
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
              aria-hidden={(desktop || mobile === "current") && i !== at}
              aria-label={p.label}
              // A flow on a phone shows only the step in hand.
              hidden={!desktop && mobile === "current" && i !== at}
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

      {/* Into the shell's slot above the legal bar if there is one, in place if
          there is not. */}
      {desktop && pager && (slot ? createPortal(pager, slot) : <div className="mt-2 flex justify-end">{pager}</div>)}
    </div>
    </DeckContext.Provider>
  );
}

export default Deck;
