// ─────────────────────────────────────────────────────────────────────────────
// WALLPAPERS — the one thing in this app a customer gets to choose.
//
// ── WHY ONE IMAGE PER WALLPAPER AND NOT TWO ──────────────────────────────────
// The obvious build is a light file and a dark file per theme. It doubles the
// asset set, doubles the download, and doubles the number of ways the pair can
// drift apart — and it is unnecessary, because the app paints a SCRIM over the
// picture and the scrim is what decides whether the surface is light or dark.
// White at 82% makes any photograph a pale, warm paper; navy at 88% makes the
// same photograph a deep floor with a colour in it. One file, both themes,
// contrast that cannot break.
//
// That is also what makes theme and wallpaper INDEPENDENT choices. A person
// picks the picture they like and the brightness they want, separately, and
// every one of the 24 combinations is legible by construction. If a wallpaper
// needed a matching theme to be readable, the picker would have to prevent
// combinations, and a picker that argues with you is worse than no picker.
//
// ── THE CONTRACT EVERY WALLPAPER HONOURS ─────────────────────────────────────
// A wallpaper is a FLOOR, never a feature. Nothing readable is ever laid
// directly on it — every card, sheet and bar above it has its own surface token
// — so the picture may be as busy as it likes and no sentence is at its mercy.
// This is the same rule the connected suite settled on independently
// (connected-suite/src/lib/theme/skins.ts), and for the same reason.
//
// ── SIZING AND WEIGHT ARE THE PIPELINE'S JOB, NOT THIS FILE'S ────────────────
// Every path below is produced by scripts/media.mjs, which enforces 2560px,
// WebP, and a 300 KB ceiling, and generates the `-thumb` at 480x300 that the
// picker actually renders. Do not hand-add a row here for a file the pipeline
// has not seen: it will render (the ground and the scrim carry it) but it will
// have no blur placeholder and no size guarantee.
// ─────────────────────────────────────────────────────────────────────────────
import { metaFor } from "./media.generated";

export type Wallpaper = {
  id: string;
  /** What it is called in the picker. */
  name: string;
  /** One line. What it feels like, not what it is a photograph of. */
  blurb: string;
  /**
   * Which theme this picture was chosen FOR — used only to order the picker so
   * a dark-mode user sees the dark-leaning ones first. It is a hint, never a
   * restriction: the scrim makes every one of them work in both.
   */
  leans: "light" | "dark" | "either";
};

/** Where the files live. One place, so a folder rename is one edit. */
export const WALLPAPER_DIR = "/wallpapers";

export const srcFor = (id: string) => `${WALLPAPER_DIR}/${id}.webp`;
export const thumbFor = (id: string) => `${WALLPAPER_DIR}/${id}-thumb.webp`;

export const WALLPAPERS: Wallpaper[] = [
  {
    id: "nairobi-dawn",
    name: "Nairobi dawn",
    blurb: "The city, early. Aspirational without saying so.",
    leans: "either",
  },
  {
    id: "savannah",
    name: "Savannah",
    blurb: "Acacia and long light. The one most people keep.",
    leans: "either",
  },
  {
    id: "market-warm",
    name: "Market",
    blurb: "Cloth and colour, out of focus. Warm and mercantile.",
    leans: "light",
  },
  {
    id: "coast",
    name: "Coast",
    blurb: "Turquoise from above. The cool one.",
    leans: "light",
  },
  {
    id: "tea-fields",
    name: "Tea",
    blurb: "Green rows to the horizon. Calm, and a strong pattern.",
    leans: "light",
  },
  {
    id: "mount-kenya",
    name: "Mount Kenya",
    blurb: "Cloud and rock. Height, without the cliché.",
    leans: "either",
  },
  {
    id: "boda-motion",
    name: "Motion",
    blurb: "A street at speed. Hustle, blurred.",
    leans: "dark",
  },
  {
    id: "sunset-silhouette",
    name: "Dusk",
    blurb: "A tree against orange. The warm dark.",
    leans: "dark",
  },
  {
    id: "mesh-navy",
    name: "Navy mesh",
    blurb: "Abstract, in the brand's own blue.",
    leans: "dark",
  },
  {
    id: "mesh-lime",
    name: "Lime mesh",
    blurb: "Abstract, in the brand's own green.",
    leans: "either",
  },
  {
    id: "paper",
    name: "Paper",
    blurb: "Almost nothing. Texture you feel rather than see.",
    leans: "light",
  },
  {
    id: "linen-dark",
    name: "Charcoal",
    blurb: "Almost nothing, in the dark.",
    leans: "dark",
  },
];

/**
 * ── THE DEFAULT, AND WHY IT IS NOT A PHOTOGRAPH ──────────────────────────────
 * "None" is first in the picker and it is what a new customer gets.
 *
 * That is a deliberate reversal of the usual instinct, which is to show off the
 * feature on first run. The first screens a person sees in this app are a
 * verification flow and a request for a photograph of their national ID, and
 * every pixel of confidence on those screens is doing real work. A wallpaper
 * they did not choose is a distraction on exactly the screen that can least
 * afford one — and it is 300 KB spent before they have decided to trust us.
 *
 * So the app opens plain, and the wallpaper is something a person finds and
 * turns on. Which is also when it means something to them.
 */
export const NO_WALLPAPER = "none";

export const wallpaperFor = (id: string | null | undefined): Wallpaper | null =>
  (id && id !== NO_WALLPAPER ? WALLPAPERS.find((w) => w.id === id) ?? null : null);

/**
 * The picker's order for a given theme: the ones chosen for this brightness
 * first, the ambidextrous ones next, the others last. Same twelve, same ids,
 * different first impression — a dark-mode user should not have to scroll past
 * four beach photographs to find the charcoal.
 */
export function orderedFor(theme: "light" | "dark"): Wallpaper[] {
  const rank = (w: Wallpaper) => (w.leans === theme ? 0 : w.leans === "either" ? 1 : 2);
  return [...WALLPAPERS].sort((a, b) => rank(a) - rank(b));
}

/**
 * ── THE SCRIM ────────────────────────────────────────────────────────────────
 * The single number that makes one file serve both themes, kept here rather
 * than in the component so the value and the reasoning live together.
 *
 * These are not taste. They are the lowest opacity at which body copy on
 * `--surface` still clears AA against the busiest wallpaper in the set (the tea
 * fields, which is the worst case by a distance). Lowering either one to let
 * more of a picture through is how a screen becomes unreadable in Kenyan
 * afternoon sun, which is where this app is actually used.
 */
export const SCRIM = {
  light: "rgb(255 255 255 / 0.82)",
  dark: "rgb(4 6 14 / 0.88)",
} as const;

/** Whether the pipeline has actually produced this wallpaper's files. A row
 *  with no encoded file still renders — ground and scrim — but the picker dims
 *  it rather than offering a tile that will never fill in. */
export const isReady = (id: string): boolean => metaFor(srcFor(id)) !== null;
