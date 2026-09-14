// ─────────────────────────────────────────────────────────────────────────────
// THE SPLASH.
//
// The first frame of the app, ported from micromart-client-pwa so a customer
// moving between the two does not see the loading screen change. The structure
// is that file's Header.jsx:125 — mark, name, role, dots, "Please wait…" pinned
// to the bottom — and the CSS is its `.pageloader` / `.loader10`, copied across
// with the values intact. See the note in styles/theme.css.
//
// ── TWO LIVERIES, AND WHO DECIDES ───────────────────────────────────────────
// Micro Eazy is the front door; a lender is the product behind it. The splash
// has to say which one the customer is standing in, because it is the first
// thing they see and the thing they see while being handed from one to the
// other:
//
//   platform  Micro Eazy's mark, Micro Eazy green dots. The public front door
//             (/welcome) and the lender chooser — places where no lender has
//             been chosen yet and it would be false to show one.
//   lender    The lender's own mark, their legal name in capitals, their
//             strapline, and dots in their accent. Everywhere else — a branded
//             sign-in, and the whole signed-in app.
//
// The CALLER decides (see `splashLivery` in App.tsx), because the answer depends
// on the route and on whether a lender has been chosen, and neither is this
// component's business. It reads the lender itself, from the store, so it can
// paint on the very first frame before any route has mounted.
//
// ── WHY THE DOTS TAKE `currentColor` ────────────────────────────────────────
// `.loader10` draws its dots with box-shadows in `currentColor`, so the colour is
// set once, inline, on the element. The platform uses --green-ink (Micro Eazy's
// green, legible in both themes); the lender uses --brand-ink, which is their
// accent in the light theme and their accent lifted for the dark one. A brown
// dot of #3c320b on the dark theme's 85%-black ground would be invisible, which
// is the one failure a loading indicator cannot have.
//
// ── WHY IT IS A COMPONENT AND NOT A setTimeout ──────────────────────────────
// The original shows this for a flat two seconds on every screen, from a timer
// that is not tied to anything. Here it is bound to a REAL question — "who is
// holding this phone?", or on Home "has the account arrived?" — and it leaves
// when the answer does. MIN_MS is the one concession: an answer that arrives in
// 80ms would otherwise flash the mark and yank it away, which reads as a glitch.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { useLender } from "../../lib/lender";

/** Below this, a splash reads as a flicker. Above it, it reads as an arrival. */
const MIN_MS = 900;

export type SplashLivery = "platform" | "lender";

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

export function Splash({
  label = "Please wait...",
  livery = "lender",
}: {
  label?: string;
  livery?: SplashLivery;
}) {
  const lender = useLender();
  const platform = livery === "platform";

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
          {platform ? (
            <>
              {/* The chip follows the surface rule in styles/theme.css — none
                  on white, one in the dark theme. */}
              <BrandMark size={84} />
              <p className="mt-3 text-[13px] font-medium text-ink-soft">Micro Eazy</p>
              <p className="mt-0.5 text-[22px] font-bold tracking-[-0.02em] text-ink">Customer Portal</p>
            </>
          ) : (
            <>
              {/* ── BARE ON PAPER, PLATED ON DARK ─────────────────────────────
                  The mark sat on a white plate in both themes, which on the light
                  splash's pale ground is a white box around a logo — the boxed,
                  app-tile look the front door already removed. It now follows
                  the same rule as the auth header's corner mark: transparent on
                  the light theme, a white plate only on the dark one, where the
                  mark's dark tones would otherwise sink. See .splash-mark. */}
              <span className="splash-mark">
                <img
                  src={lender.mark}
                  alt=""
                  aria-hidden="true"
                  className="h-[88px] w-[88px] object-contain"
                  draggable={false}
                />
              </span>
              {/* Set in capitals and tracked, the way the lender's own splash
                  and logo set it. The name comes from the registry — nothing
                  here spells out a lender. */}
              <p className="mt-4 text-[13px] font-bold uppercase tracking-[0.16em] text-ink">
                {lender.legalName}
              </p>
              <p className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-ink">{lender.slogan}</p>
            </>
          )}

          <div
            className="loader10 mx-auto mt-9"
            style={{ color: platform ? "var(--green-ink)" : "var(--brand-ink)" }}
          />
        </div>

        <p className="mt-auto pb-6 text-[12.5px] text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

export default Splash;
