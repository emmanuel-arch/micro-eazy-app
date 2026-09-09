// ─────────────────────────────────────────────────────────────────────────────
// HOW A PICTURE ARRIVES.
//
// Every photograph in this app goes through here, and the reason is the same
// reason scripts/media.mjs exists: the app is used on a handset, on a Safaricom
// connection, in a market. Adding twelve wallpapers and fourteen illustrations
// to a product like that is either the thing that makes it feel finished or the
// thing that makes it feel broken, and the difference is entirely in HOW they
// load — not in how big they are.
//
// ── THE THREE STATES, IN ORDER ───────────────────────────────────────────────
//   1. GROUND. The picture's own dominant colour, sampled at build time and
//      inlined. On screen in the first frame, before a single byte of the
//      photograph has been asked for. A grey box says "broken"; the picture's
//      own colour says "loading", and the difference costs nothing.
//   2. LQIP. A ~20px WebP, base64, also inlined — so it is not a request and
//      cannot be late. Scaled up and blurred, it is the shape and the light of
//      the real picture. Most people never consciously see this state; they see
//      a page that was never empty.
//   3. THE PHOTOGRAPH, cross-faded in on decode. `decode()` rather than `onLoad`
//      because onLoad fires when the bytes are in, not when the pixels are
//      ready — fading on the former hands a mid-range Android a half-decoded
//      image to composite, which is the flicker this was written to avoid.
//
// ── THE RULE THAT MATTERS MOST: DO NOT LOAD IT AT ALL ────────────────────────
// A person on a metered 2G connection has told the browser so, and the browser
// will tell us if we ask (`navigator.connection`, `prefers-reduced-data`).
// Downloading 300 KB of decorative wallpaper to somebody paying by the megabyte,
// on a screen where the wallpaper is under an 82% scrim, is indefensible. So on
// a saving connection the ladder STOPS at the LQIP: the page looks composed, the
// layout is identical, and no photograph is fetched. Nothing is broken and
// nothing is spent.
//
// `priority` opts out of that for the one image that IS the content of a screen
// — never for decoration.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { metaFor } from "../../lib/media/media.generated";

/**
 * Is this connection one we should be spending a photograph on?
 *
 * Read once per call rather than subscribed to: connection type changes mid-load
 * are rare, and a component that re-renders every image on the page when
 * somebody walks out of wi-fi range is worse than one that is occasionally a
 * minute out of date.
 *
 * Every branch is guarded. `navigator.connection` is Chromium-only, and
 * `matchMedia` with an unknown feature throws in some older WebViews — this runs
 * on the exact devices where that is not theoretical.
 */
export function isSavingData(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    const c = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (c?.saveData) return true;
    if (c?.effectiveType === "slow-2g" || c?.effectiveType === "2g") return true;
    return window.matchMedia?.("(prefers-reduced-data: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

export function ProgressiveImage({
  src,
  alt,
  className = "",
  imgClassName = "",
  /** Above the fold and part of the content — load it eagerly, and load it even
   *  on a saving connection. Decoration must never pass this. */
  priority = false,
  /** Rendered width hint for the browser's own selection logic. */
  sizes,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
  onError?: () => void;
}) {
  const meta = metaFor(src);
  // WHICH picture has decoded, not whether one has — so changing `src` puts the
  // blur back in the same render, with no reset written into the effect body.
  // A boolean here means the next photograph appears instantly at full opacity
  // wearing the previous one's "already loaded" state, which is the one thing
  // this whole component exists to prevent.
  const [decoded, setDecoded] = useState<string | null>(null);
  const shown = decoded === src;
  const [skip] = useState(() => !priority && isSavingData());
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (!img || skip) return;
    let live = true;
    // The image may already be complete from cache before this effect runs, in
    // which case there is no load event coming and a naive listener waits for
    // ever on a picture that is already on screen.
    const reveal = () => {
      if (!live) return;
      setDecoded(src);
    };
    if (img.complete && img.naturalWidth > 0) {
      img.decode().then(reveal, reveal);
    } else {
      img.addEventListener("load", () => img.decode().then(reveal, reveal), { once: true });
    }
    return () => {
      live = false;
    };
  }, [src, skip]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      // The ground. Present before anything is requested, and still present
      // underneath if the photograph never arrives at all.
      style={{ backgroundColor: meta?.dominant ?? "var(--surface-sunk)" }}
    >
      {meta && (
        <img
          src={meta.lqip}
          alt=""
          aria-hidden
          // `scale-110` hides the soft edge a blur leaves at the frame; without
          // it there is a visible pale halo around the inside of every card.
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-xl transition-opacity duration-500 ${
            shown ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      {!skip && (
        <img
          ref={ref}
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fetchPriority={priority ? "high" : "low"}
          decoding="async"
          onError={onError}
          className={`relative h-full w-full object-cover transition-opacity duration-700 ${
            shown ? "opacity-100" : "opacity-0"
          } ${imgClassName}`}
        />
      )}
    </div>
  );
}
