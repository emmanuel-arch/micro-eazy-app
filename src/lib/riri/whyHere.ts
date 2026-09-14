// ─────────────────────────────────────────────────────────────────────────────
// "RIRI BROUGHT YOU HERE BECAUSE YOU ASKED…" — the third rule of Autopilot.
//
// Riri Ecosystem AI plan §06: a hand-off lands with a dismissible bar, so somebody
// who does not recognise where they are can always read why they are there. Two
// things set it:
//
//   · Riri moving the screen inside this app (Autopilot, or a tapped action) —
//     local, no signature needed, the customer watched it happen.
//   · A signed deep link from another system (?riri=<token>) — verified on the
//     server before a single word of its reason is shown.
//
// A module store read with useSyncExternalStore, because the bar lives in the shell
// and the thing that sets it lives in the dock, and neither should own the other.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";

export type WhyHere = {
  /** Their words, shown back to them. */
  question: string;
  /** Who moved them — the assistant's name. */
  from: string;
  /** The other system, when they arrived by a signed hand-off. */
  via?: string;
  /** The path it was set for. Moving anywhere else clears it. */
  path: string;
};

let current: WhyHere | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setWhyHere(v: WhyHere | null) {
  current = v;
  emit();
}

export function useWhyHere(): WhyHere | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}

/** Ask the dock to open — from a Messages button, a "write to us" link, anywhere. */
export function openRiri(detail: { prompt?: string; draft?: string } = {}) {
  window.dispatchEvent(new CustomEvent("riri:open", { detail }));
}
