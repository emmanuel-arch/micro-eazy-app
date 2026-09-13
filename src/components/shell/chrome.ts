// ─────────────────────────────────────────────────────────────────────────────
// WHERE A SCREEN'S PAGER GOES.
//
// The landscape counter has two halves that belong to two different owners:
//
//   · The FRAME — the fixed height, the sidebar, the legal bar across the foot —
//     belongs to AppShell. It is the same on every screen and a screen must not
//     be able to lose it.
//   · The PANES — how this particular screen's content is cut into a sequence,
//     and which one is showing — belongs to the screen, because only the screen
//     knows what its content is.
//
// The pager sits at the join: it is a control ABOUT the panes, drawn into a slot
// the FRAME reserves — centred under the content canvas, directly above the
// legal bar. It used to be inside the legal bar itself, and that put a control a
// customer presses on the same strip as a sentence a regulator reads, on a
// ground (the lender's solid band) that page-ink controls cannot sit on.
// Rendering it inside the deck would float it over the content; passing it up
// through props would make every screen take a prop it does not use.
//
// So the shell hands down the DOM node it has reserved, and the deck portals
// into it. A screen with no deck leaves the slot empty, and the slot collapses
// (`lg:empty:hidden` in AppShell) so there is no gap for a pager that is not
// there.
//
// It is `null` outside AppShell — on the front door, where there is no shell at
// all — and the deck falls back to drawing its pager in place rather than
// throwing. A public screen that grows panes tomorrow should not need this file
// to change.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext } from "react";

export const PagerSlotContext = createContext<HTMLElement | null>(null);

/** The slot above the legal bar to portal a pager into, or null when there is
 *  no shell. */
export const usePagerSlot = () => useContext(PagerSlotContext);
