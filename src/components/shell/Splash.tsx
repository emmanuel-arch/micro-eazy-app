// ─────────────────────────────────────────────────────────────────────────────
// THE SPLASH.
//
// The first frame of the app, ported from micromart-client-pwa so a customer
// moving between the two does not see the loading screen change. The structure
// is that file's Header.jsx:125 — mark, name, role, dots, "Please wait…" pinned
// to the bottom — and the CSS is its `.pageloader` / `.loader10`, copied across
// with the values intact. See the note in styles/theme.css.
//
// ── WHY IT IS A COMPONENT AND NOT A setTimeout ──────────────────────────────
// The original shows this for a flat two seconds on every screen, from a timer
// that is not tied to anything (`setTimeout(… 2000)` in an effect with no
// dependency array, so it re-arms on every render). That is a two-second tax on
// a customer who is already signed in and just wants their balance.
//
// Here it is bound to a REAL question — "who is holding this phone?" — and it
// leaves when the answer arrives. On a warm session that is a few hundred
// milliseconds; on a cold one it covers the round trip that used to render as a
// bare "Checking your session…" line. Same picture, honest duration.
//
// MIN_MS is the one concession to the original: an answer that arrives in 80ms
// would otherwise flash the mark and yank it away, which reads as a glitch
// rather than as a fast app. It is a floor, never a delay on a slow answer.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";

/** Below this, a splash reads as a flicker. Above it, it reads as an arrival. */
const MIN_MS = 900;

/**
 * True until `MIN_MS` has passed since mount. Callers combine it with their own
 * readiness so the splash lifts on `ready && !holding` — whichever is later.
 */
export function useSplashFloor(minMs: number = MIN_MS): boolean {
  const [holding, setHolding] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHolding(false), minMs);
    return () => clearTimeout(t);
  }, [minMs]);
  return holding;
}

export function Splash({ label = "Please wait..." }: { label?: string }) {
  return (
    // `role="status"` and not `alert`: this is a progress report, and an alert
    // interrupts whatever a screen reader was saying to announce it.
    <div className="pageloader" role="status" aria-live="polite">
      <div className="mx-auto flex h-full max-w-[560px] flex-col items-center px-6 text-center">
        {/* The original's `mb-auto pt-4` spacer — the block sits slightly above
            centre, which is where the eye expects it rather than geometrically
            in the middle. */}
        <div className="mb-auto pt-4" />

        <div className="flex flex-col items-center">
          {/* Bigger than the original's 60px: on a blank white screen the mark
              is the ONLY thing to look at, and at 60 it read as a favicon
              somebody had centred. The chip follows the surface rule in
              styles/theme.css — none on white, one in the dark theme. */}
          <BrandMark size={84} />

          <p className="mt-3 text-[13px] font-medium text-ink-soft">Micro Eazy</p>
          <p className="mt-0.5 text-[22px] font-bold tracking-[-0.02em] text-ink">Customer Portal</p>

          <div className="loader10 mx-auto mt-9" />
        </div>

        <p className="mt-auto pb-6 text-[12.5px] text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

export default Splash;
