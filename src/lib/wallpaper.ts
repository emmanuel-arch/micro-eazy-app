// ─────────────────────────────────────────────────────────────────────────────
// WHICH FLOOR THE APP IS STANDING ON.
//
// A sibling of lib/theme.tsx and deliberately NOT part of it. Theme is how
// bright the app is; wallpaper is what is behind it. Fusing them into one
// "appearance" value is the usual shortcut and it is what forces a picker to
// prevent combinations — pick the dusk photograph and you are handed the dark
// theme whether you wanted it or not. They are two questions, so they are two
// stores, and all 24 answers are legible because the scrim guarantees it (see
// lib/media/wallpapers.ts).
//
// ── WHY useSyncExternalStore AND NOT useState + useEffect ────────────────────
// localStorage is an EXTERNAL STORE. Mirroring it into state and syncing in an
// effect gives one render with the wrong wallpaper followed by a second with the
// right one — and on a full-screen background layer that flash is the entire
// thing worth avoiding. Subscribing means the first render already has the true
// value, and a second tab changing the choice updates this one for free.
//
// The first paint still happens before any React runs, so index.html carries a
// few lines that stamp the choice onto <html> ahead of the bundle. That script
// and this module share KEY and must move together.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_WALLPAPER, wallpaperFor, type Wallpaper } from "./media/wallpapers";

/** Duplicated as a literal in index.html's pre-paint script. Change both. */
export const KEY = "me.wallpaper";

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

/** Where the choice lives when a browser is set to block site data — access
 *  itself throws there, not only writes, and without this the picker would move
 *  and then snap back. Lasts the session, which is all that setting allows.
 *
 *  It starts at the DEFAULT rather than at "none", so a customer whose browser
 *  refuses storage gets the dressed app like everybody else rather than the one
 *  bare floor nobody chose. */
let memory = DEFAULT_WALLPAPER;

/**
 * ── AN UNSET CHOICE IS THE DEFAULT, NOT "NONE" ──────────────────────────────
 * `getItem` answers null for somebody who has never opened the picker, and that
 * is the state most customers are in for ever. Reading that silence as "none"
 * meant the app shipped its Kenyan floor to nobody except the handful of people
 * who went looking for it in Settings.
 *
 * "None" is still a choice a customer can make — the picker writes the literal
 * string, which is a real stored value and therefore survives this. The only
 * thing that changed is what SILENCE means.
 */
function read(): string {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function useWallpaper(): {
  /** The chosen row, or null for "none" — which is the default. */
  wallpaper: Wallpaper | null;
  id: string;
  setWallpaper: (id: string) => void;
} {
  // The snapshot has to be a PRIMITIVE. Returning wallpaperFor(...) here hands
  // React a fresh object every call and it re-renders for ever comparing them.
  const id = useSyncExternalStore(subscribe, read, () => DEFAULT_WALLPAPER);

  const setWallpaper = useCallback((next: string) => {
    memory = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* a preference is a convenience, never a requirement */
    }
    emit();
  }, []);

  return { wallpaper: wallpaperFor(id), id, setWallpaper };
}
