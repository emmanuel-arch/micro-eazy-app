// ─────────────────────────────────────────────────────────────────────────────
// THE FLOOR.
//
// Every wallpaper in this app is painted here and nowhere else. One component,
// one place a background-image string can exist — which is the fix for the bug
// this pattern always produces otherwise: a utility class naming one file,
// written into three different shells, so the dark theme flips every token and
// every surface and then paints a photograph of a beach behind them. A hard-
// coded string cannot have a second value.
//
// ── THE FOUR LAYERS, AND WHY THERE ARE FOUR ──────────────────────────────────
//   1. GROUND — the theme's own page colour. Never transparent: if nothing else
//      in this component ever renders, the app looks exactly as it did before
//      wallpapers existed. That is the failure mode, and it is invisible.
//   2. LQIP — the picture at 20px, blurred and inlined. Costs no request, so it
//      is on screen in the first frame and the floor is never empty.
//   3. THE PHOTOGRAPH, faded in on decode, or NEVER FETCHED AT ALL on a
//      metered connection (see ProgressiveImage's note on that decision).
//   4. THE SCRIM — white at 82% in light, navy at 88% in dark. This is the
//      layer that lets one file serve both themes, and it is not decoration:
//      it is what guarantees that type two layers above it is legible over a
//      photograph nobody checked the contrast of.
//
// It is `fixed inset-0` and `pointer-events-none`, so it never scrolls and never
// swallows a tap. Everything else in the app is a positioned sibling above it.
//
// ── WHY IT IS NOT AN <img> ───────────────────────────────────────────────────
// This is the one place in the app that does not use ProgressiveImage, and the
// reason is `background-attachment`. A full-viewport fixed <img> has to be
// re-composited as the page scrolls; a fixed div with a background does not, and
// on a mid-range Android that difference is visible in the scroll of a long
// statement. The loading LADDER is the same — ground, LQIP, photograph, and the
// same data-saver rule — it is just painted rather than laid out.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { isSavingData } from "../media/ProgressiveImage";
import { metaFor } from "../../lib/media/media.generated";
import { SCRIM, srcFor } from "../../lib/media/wallpapers";
import { useTheme } from "../../lib/theme";
import { useWallpaper } from "../../lib/wallpaper";

export function Wallpaper() {
  const { resolved } = useTheme();
  const { wallpaper } = useWallpaper();
  const src = wallpaper ? srcFor(wallpaper.id) : null;
  const meta = metaFor(src);

  // The state is WHICH picture has decoded, not whether one has. A boolean would
  // need resetting at the top of the effect when the choice changes — a
  // synchronous setState in an effect body, which is a cascading render.
  // Comparing resets it for free: the moment `src` changes the stored value no
  // longer matches, and the blur is back in the same render rather than one
  // after it.
  const [decoded, setDecoded] = useState<string | null>(null);
  const loaded = decoded !== null && decoded === src;

  // Decode before painting. A background-image swapped in at `load` hands the
  // compositor a half-decoded 2560px picture to scale across the viewport, which
  // on a mid-range handset is a visible hitch on a layer that is supposed to be
  // the calmest thing on screen.
  useEffect(() => {
    if (!src || isSavingData()) return;
    let live = true;
    const img = new Image();
    img.src = src;
    img.decode?.().then(
      () => live && setDecoded(src),
      // A decode failure is not an error worth surfacing — the LQIP and the
      // scrim are already a finished-looking floor.
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [src]);

  return (
    <div
      aria-hidden
      // -z-10 puts this behind every screen and above the page canvas. It works
      // only because the ground colour lives on <html> rather than <body> —
      // see the note beside that rule in styles/theme.css before changing
      // either one.
      className="pointer-events-none fixed inset-0 -z-10"
    >
      {meta && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${meta.lqip}')`, filter: "blur(24px)", transform: "scale(1.06)" }}
        />
      )}
      {src && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{ backgroundImage: `url('${src}')`, opacity: loaded ? 1 : 0 }}
        />
      )}
      {/* The scrim goes on even with no wallpaper chosen. It is transparent over
          the page colour in that case, so there is no second code path and no
          second set of surface values to keep in step. */}
      {src && <div className="absolute inset-0" style={{ background: SCRIM[resolved] }} />}
    </div>
  );
}
