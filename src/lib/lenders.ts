// ─────────────────────────────────────────────────────────────────────────────
// THE LENDERS — who a customer can actually borrow from, and what their app
// looks like when they do.
//
// Micro Eazy is not a lender. It is the front door to several, and the moment a
// customer picks one the product stops being ours and starts being theirs: the
// mark at the top of the sidebar, the colour of the primary button, the dots on
// the loading screen and the name in the copy all become the lender's. That is
// not decoration — it is the honest description of what has happened. The money
// is theirs, the book is theirs, the decision is theirs.
//
// ── WHERE THESE VALUES COME FROM ────────────────────────────────────────────
// They are not invented here. Every accent below was read out of the LMS's own
// `Org` table — the same row the lender's staff edit in Brand Studio and the
// same value `connected-suite/src/app/console/layout.tsx` feeds into `--brand`
// for the console. So "the branding you set on the LMS shows up in your
// customers' app" is literally true rather than approximately true.
//
//   slug       name                 accent    accent2
//   micromart  Micromart Africa     #3c320b   #221d06
//   axe        Axe Capital          #056538   #0b4111
//   mular      Mular Credit Ltd     #003c71   #50951d
//   buysimu    Buy Simu             #d22028   #90161b
//
// ── WHY IT IS A TABLE HERE AND NOT A FETCH ──────────────────────────────────
// The chooser is the FIRST screen after the front door, and it has to paint
// before any session exists — there is no cookie yet and nothing to
// authenticate a branding call with. A table that ships in the bundle renders
// in the first frame; a fetch would put a spinner on the screen where a
// customer is being asked to choose who lends to them.
//
// The shape below is deliberately the shape of the `Org` row, so when a
// `GET /api/portal/lenders` exists this file becomes its fallback and its type,
// and nothing that consumes it has to change.
//
// ── ON `available` ──────────────────────────────────────────────────────────
// All four are real organisations on the LMS. Only Micromart is open to
// borrowers today — they are pioneering the ecosystem and their book is the one
// the bridge is wired to. The other three are shown rather than hidden ON
// PURPOSE: a marketplace with one name in it looks like a bug, and a customer
// who can see who is coming understands what this is. They are visibly not
// selectable, never a row that accepts a click and then fails.
// ─────────────────────────────────────────────────────────────────────────────

export type Lender = {
  /** The slug the API takes, and the first segment of every branded URL. */
  slug: string;
  /** The legal-ish name, as the lender writes it. Never hard-code this in copy —
   *  every sentence that names a lender interpolates it from here. */
  name: string;
  /** How a customer says it out loud — "Micromart", "Axe". Used where the name
   *  sits inside a short label: "Micromart login". */
  short: string;
  /** The registered name, for the loading screen. Distinct from `name` because
   *  the LMS stores the trading name. */
  legalName: string;
  /** One line under the legal name on the loading screen — the lender's own
   *  strapline, as it appears on their logo or their existing app. */
  slogan: string;
  /** One line, for the chooser row. */
  tagline: string;

  /** `Org.accent` — the colour the console paints itself with. */
  accent: string;
  /** `Org.accent2` — the second gradient stop. */
  accent2: string;
  /** `Org.accentSoft` — the accent at 12%, for washes and rings. */
  accentSoft: string;
  /**
   * The accent, lightened until it is legible as TYPE on the dark theme's
   * near-black surface (>= 5:1). The raw accent is chosen to be read on WHITE —
   * Micromart's #3c320b is 12.7:1 on paper and about 1.3:1 on the dark card,
   * which in practice is an invisible heading. Same split, same reason, as
   * --navy / --navy-ink in styles/theme.css.
   */
  accentInkDark: string;

  /** The mark alone, on transparency. For chips, splashes and tight corners. */
  mark: string;
  /** The full lockup — mark plus name. For the sidebar letterhead. */
  lockup: string;

  /** Open to borrowers today. See the note above about why the others are
   *  still rendered. */
  available: boolean;
};

export const LENDERS: Lender[] = [
  {
    slug: "micromart",
    name: "Micromart Africa",
    short: "Micromart",
    // As on their own splash and logo: "MICROMART AFRICA LTD / Exceeding the
    // incredible". Written out in full here because it is set in capitals.
    legalName: "Micromart Africa Limited",
    slogan: "Exceeding The Incredible",
    tagline: "Business, school-fees & personal loans",
    accent: "#3c320b",
    accent2: "#221d06",
    accentSoft: "rgba(60,50,11,0.12)",
    accentInkDark: "#9b811c",
    // The only lender with a background-free mark today. The others fall back
    // to their full logo, which is why `mark` and `lockup` are separate fields
    // rather than one path with a suffix convention.
    mark: "/lenders/micromart/logo-transparent.png",
    lockup: "/lenders/micromart/logo.png",
    available: true,
  },
  {
    slug: "axe",
    name: "Axe Capital",
    short: "Axe",
    legalName: "Axe Capital",
    slogan: "We provide, you prosper",
    tagline: "Quick personal credit & trader advances",
    accent: "#056538",
    accent2: "#0b4111",
    accentSoft: "rgba(5,101,56,0.12)",
    accentInkDark: "#089a56",
    mark: "/lenders/axe/logo.png",
    lockup: "/lenders/axe/logo.png",
    available: false,
  },
  {
    slug: "mular",
    name: "Mular Credit Ltd",
    short: "Mular",
    legalName: "Mular Credit Ltd",
    slogan: "Fueling ambitions, building futures",
    tagline: "Trusted by thousands of people & businesses",
    accent: "#003c71",
    accent2: "#50951d",
    accentSoft: "rgba(0,60,113,0.12)",
    accentInkDark: "#0082f6",
    mark: "/lenders/mular/logo.png",
    lockup: "/lenders/mular/logo.png",
    available: false,
  },
  {
    slug: "buysimu",
    name: "Buy Simu",
    short: "Buy Simu",
    legalName: "Buy Simu",
    slogan: "Get the phone you want now",
    tagline: "Buy a phone on credit · iPhone & more",
    accent: "#d22028",
    accent2: "#90161b",
    accentSoft: "rgba(210,32,40,0.12)",
    accentInkDark: "#e45057",
    mark: "/lenders/buysimu/logo.png",
    lockup: "/lenders/buysimu/logo.png",
    available: false,
  },
];

/** The one the app opens on when nothing else says otherwise. */
export const DEFAULT_LENDER_SLUG = "micromart";

export const lenderBySlug = (slug: string | null | undefined): Lender | null =>
  LENDERS.find((l) => l.slug === slug) ?? null;

/** Never null — callers that need A lender rather than THE lender. */
export const lenderOrDefault = (slug: string | null | undefined): Lender =>
  lenderBySlug(slug) ?? lenderBySlug(DEFAULT_LENDER_SLUG)!;

/** Whether a URL's first segment names a lender. Used by the router to tell
 *  `/micromart/signin` from `/messages/42`. */
export const isLenderSlug = (s: string): boolean => LENDERS.some((l) => l.slug === s);
