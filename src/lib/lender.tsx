// ─────────────────────────────────────────────────────────────────────────────
// WHICH LENDER THE APP IS CURRENTLY WEARING.
//
// A sibling of lib/theme.tsx and lib/wallpaper.tsx, and the same shape for the
// same reasons. Theme is how bright the app is, wallpaper is what is behind it,
// and THIS is whose product it is.
//
// ── IT IS A STORE AND NOT A ROUTE PARAM, AND THAT MATTERS ───────────────────
// The URL carries the lender on the branded screens (`/micromart/signin`), so
// the obvious build is to read it from the route and be done. That fails in
// three places, and all three are real:
//
//   · The SPLASH paints before the router mounts. It has to know whose dots to
//     draw on the very first frame.
//   · `lib/api/portal.ts` sends `lenderSlug` in the body of every call. Those
//     are made from effects and handlers that have no route context.
//   · A customer who signed in at Micromart and then opens `/messages/42` is
//     still a Micromart customer. The lender outlives the URL segment.
//
// So the route SETS this (see LenderRoute in App.tsx) and everything else READS
// it. One direction, one owner.
//
// ── WHY useSyncExternalStore ────────────────────────────────────────────────
// localStorage is an external store. Mirroring it into state and syncing in an
// effect gives one render with the wrong brand followed by a second with the
// right one — and on a screen that repaints its entire colour scheme, that
// flash is the whole thing worth avoiding.
//
// There is no pre-paint script for this, unlike theme and wallpaper, and that is
// deliberate: before the bundle runs, #root is empty, so there is nothing on
// screen for a lender's colour to be wrong ON. The first thing React paints is
// the splash, and LenderThemeProvider has written the palette to <html> during
// that same render.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { isLenderSlug, lenderOrDefault, type Lender } from "./lenders";
import { lenderSlug, setApiLenderSlug } from "./api/portal";

/** The storage key for this browser's lender. */
export const KEY = "me.lender";

/** The build's own lender — VITE_LENDER_SLUG, or micromart. Read once, before
 *  anything has had a chance to change it. */
const BUILD_DEFAULT = lenderSlug();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` fires for OTHER tabs only; `emit` above is the local half.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Where the choice lives when a browser blocks site data — access itself
 *  throws there, not only writes. */
let memory = BUILD_DEFAULT;

function read(): string {
  try {
    const stored = localStorage.getItem(KEY);
    // A slug from a lender since removed from the registry is not a lender; fall
    // back rather than paint a brand that no longer exists.
    return stored && isLenderSlug(stored) ? stored : memory;
  } catch {
    return memory;
  }
}

/**
 * Whether this browser has ever been handed to a lender — by picking one, by
 * opening a branded URL, or by signing in. The front door uses it to decide
 * whose splash to show, and the guard uses it to decide whose sign-in page an
 * expired session belongs on. A first-time visitor has not, and must see Micro
 * Eazy rather than a lender they never chose.
 */
export function hasChosenLender(): boolean {
  try {
    const stored = localStorage.getItem(KEY);
    return Boolean(stored && isLenderSlug(stored));
  } catch {
    return memory !== BUILD_DEFAULT;
  }
}

// ── THE API FOLLOWS THE STORE FROM THE FIRST CALL ───────────────────────────
// Module evaluation, not an effect: lib/session.tsx asks /api/portal/session on
// boot, and that call must already carry the lender this browser belongs to.
setApiLenderSlug(read());

/**
 * Set the lender for this browser. Called by the router when a branded URL is
 * entered, and by the chooser when a customer picks one.
 *
 * It also paints the accent onto <html> immediately, rather than waiting for
 * the provider to re-render — the difference between the next frame already
 * being in the lender's colour and one frame of the previous one.
 */
export function setLenderSlug(slug: string): void {
  if (!isLenderSlug(slug)) return;
  const changed = read() !== slug || !hasChosenLender();
  memory = slug;
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    /* a brand is a presentation, never a requirement */
  }
  // The API first. Everything else here is how the app LOOKS; this is which
  // lender's book the next request is read from, and it must never lag.
  setApiLenderSlug(slug);
  paint(lenderOrDefault(slug));
  // Only notify when something moved. The router calls this on every render of
  // a branded route, and an unconditional emit would re-render every subscriber
  // on every one of those.
  if (changed) emit();
}

/** Stamp a lender's palette onto the document. Called by the setter above and by
 *  the provider on every render, which covers the case where storage was empty
 *  and nothing has ever called the setter. */
export function paint(lender: Lender): void {
  const el = document.documentElement;
  el.style.setProperty("--brand", lender.accent);
  el.style.setProperty("--brand-2", lender.accent2);
  el.style.setProperty("--brand-soft", lender.accentSoft);
  el.style.setProperty("--brand-ink-dark", lender.accentInkDark);
}

export function useLender(): Lender {
  // The snapshot has to be a PRIMITIVE. Returning lenderOrDefault(...) here
  // hands React a fresh object every call and it re-renders for ever comparing
  // them — the same trap lib/wallpaper.ts documents.
  const slug = useSyncExternalStore(subscribe, read, () => BUILD_DEFAULT);
  return lenderOrDefault(slug);
}

/** The setter on its own, for callers that do not need to re-render on change. */
export function useSetLender(): (slug: string) => void {
  return useCallback((slug: string) => setLenderSlug(slug), []);
}

/**
 * Paints the palette for whatever lender is current, and keeps painting it when
 * the choice changes. It renders no markup of its own — the colours live on
 * <html> so that `position: fixed` layers (the splash, the wallpaper, a modal)
 * are inside the scope, which they would not be if this were a wrapper div.
 */
export function LenderThemeProvider({ children }: { children: ReactNode }) {
  const lender = useLender();
  // Not an effect. An effect runs AFTER paint, which is one frame of the wrong
  // colour on every navigation — small, and exactly the kind of small that
  // reads as cheap.
  paint(lender);
  return <>{children}</>;
}
