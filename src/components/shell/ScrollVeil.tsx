// ─────────────────────────────────────────────────────────────────────────────
// THE SOFT EDGE — the affordance a hidden scrollbar takes away.
//
// The landscape frame scrolls nothing on a laptop, by design. But two places
// still can, and both of them hide their scrollbar:
//
//   · A DECK PANE on a short window or at 200% browser zoom. Panes are composed
//     to fit a 768px laptop; clipping anything taller would hide content with no
//     way to reach it, so the pane scrolls quietly instead.
//   · A SCREEN NOT YET CUT INTO PANES. It scrolls inside the content box while
//     the sidebar and the legal bar stay put.
//
// Hiding the bar in those cases removes the only signal that there is more. This
// puts it back as a fade at the foot: content passing under a soft edge reads as
// continuing, which is the same thing a scrollbar says and quieter about it.
//
// ── IT IS MEASURED, NOT ASSUMED ─────────────────────────────────────────────
// The obvious build is a gradient that is simply always there. That was tried
// and it is wrong: on the overwhelmingly common case — a screen that FITS — it
// paints a grey band across the bottom of a page with nothing under it, which
// reads as a rendering seam. So the fade appears only when there is genuinely
// something below the fold, and disappears again once you have scrolled to it.
//
// ── WHY A RESOLVER AND NOT A REF ────────────────────────────────────────────
// The deck's scroll container changes when the customer moves sideways, and a
// `RefObject` handed in at mount cannot express "whichever pane is showing now".
// A function plus a dependency list can, and it costs the simpler caller
// (AppShell, one fixed element) nothing but an arrow.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";

/**
 * Whether `resolve()` currently has content below its own bottom edge.
 *
 * Re-measures on: the element changing (via `deps`), the element resizing, its
 * content resizing, and every scroll. That covers a window resize, a card
 * expanding, a slow API filling a list in, and the customer scrolling to the
 * end — which between them are every way this answer changes.
 */
export function useCutOff(resolve: () => HTMLElement | null, deps: unknown[]): boolean {
  const [cutOff, setCutOff] = useState(false);

  useEffect(() => {
    const el = resolve();
    if (!el) {
      setCutOff(false);
      return;
    }

    // 8px of slack. Sub-pixel layout regularly leaves scrollHeight a fraction
    // above clientHeight on a box that visibly fits, and a fade that flickers on
    // for one rounded pixel is worse than no fade.
    const measure = () =>
      setCutOff(
        el.scrollHeight - el.clientHeight > 8 &&
          el.scrollTop + el.clientHeight < el.scrollHeight - 8,
      );

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The container's own size is not enough: content growing INSIDE it changes
    // scrollHeight without changing clientHeight, and that is the case that
    // matters most — a list that arrives from the server after first paint.
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", measure, { passive: true });

    // ── THE FIRST MEASURE IS TAKEN IN THE WRONG FONT ──────────────────────────
    // On a cold load, the first layout happens before Inter has arrived from
    // Google Fonts, in a fallback that sets taller. Home's first pane overflows
    // by a few pixels in THAT font, the fade switches on — and when Inter lands
    // and everything reflows a little shorter, the change can happen deep inside
    // a card, below anything the observer above is watching. The fade stayed on
    // over a pane that fitted perfectly: a pale band across the bottom of the
    // screen with nothing under it.
    //
    // So measure again when the fonts are ready, when any image in the box
    // finishes (an image with no reserved height is the other late reflow), and
    // once more after a beat as a backstop.
    let alive = true;
    const again = () => alive && measure();
    document.fonts?.ready.then(again);
    el.addEventListener("load", again, true);
    const late = window.setTimeout(again, 1200);

    return () => {
      alive = false;
      ro.disconnect();
      el.removeEventListener("scroll", measure);
      el.removeEventListener("load", again, true);
      window.clearTimeout(late);
    };
    // `resolve` is deliberately not a dependency — it is a fresh closure every
    // render, and the caller's `deps` are what actually say when to look again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return cutOff;
}

/** The fade itself. Absolutely positioned, so its parent must be `relative`. */
export function ScrollVeil({ show }: { show: boolean }) {
  if (!show) return null;
  return <span aria-hidden className="scroll-veil hidden lg:block" />;
}

export default ScrollVeil;
