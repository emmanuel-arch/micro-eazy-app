// ─────────────────────────────────────────────────────────────────────────────
// THE FRONT-OF-HOUSE LAYOUT.
//
// Every screen a person sees BEFORE they are inside the app — the front door,
// the password door, the code gate, the ID capture — is this one frame:
//
//     ┌──────────────────────┬───────────────────────────┐
//     │ logo (top left)      │                           │
//     │                      │   the deck, full bleed,   │
//     │   the content,       │   still sliding           │
//     │   left of centre     │                           │
//     └──────────────────────┴───────────────────────────┘
//
// ── WHY THIS IS A COMPONENT AND NOT THREE SIMILAR SCREENS ───────────────────
// The sign-in page was built as its own narrow column and looked exactly like
// what it was: a generic form on a plain background, sitting inside a page that
// had clearly been designed somewhere else. The front door had the photography
// and the credibility; the screen where somebody actually types a password had
// none of it. That is backwards — the sign-in page is the one carrying the
// claim that this is a real financial institution.
//
// So the frame belongs to the FLOW, not to any one screen, and the screens are
// just what goes in the left column. A new step added to the funnel tomorrow
// gets the same standing as the front door for free, and cannot drift.
//
// ── THE SIDES, AND WHY THEY ARE THIS WAY ROUND ──────────────────────────────
// Content left, picture right. English reads left to right, so the first thing
// under the eye is the mark and then the thing being asked — the photograph is
// atmosphere and belongs where it is seen second. It also puts the logo in the
// top-left corner, which is where every bank on earth puts it and therefore the
// first place anyone checks to work out whose site they are on.
//
// ── THE DECK KEEPS MOVING ───────────────────────────────────────────────────
// It is one <Voices> instance living in THIS component rather than one per
// screen, so walking from the front door to the password door to the ID capture
// does not restart the slideshow or jump it back to the first plate. The
// photography behaves like a window in the room rather than a background image
// that reloads on every navigation.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import { Voices } from "../media/Voices";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

export function AuthLayout({
  children,
  /** The front door shows the deck on a handset too — it is the argument for
   *  the product, and on a phone it has to arrive before the ask. The later
   *  steps do not: somebody mid-verification does not need to be sold to, and
   *  a 400px photograph above the form pushes the fields below the fold. */
  deckOnMobile = false,
}: {
  children: ReactNode;
  deckOnMobile?: boolean;
}) {
  return (
    <div className="lg:grid lg:h-screen lg:grid-cols-[1fr_1.08fr] xl:grid-cols-[1fr_1.15fr]">
      {/* ── LEFT: the mark, then the content ────────────────────────────── */}
      <div className="flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-y-auto">
        {/* On a phone this is the navy band the brand has always used. On a
            laptop it is a plain wordmark in the corner — a gradient bar next to
            a full-bleed photograph is two surfaces competing to be the subject,
            and the photograph should win. See .sky-phone-only in theme.css. */}
        <header className="sky aurora sky-phone-only relative shrink-0 overflow-hidden rounded-b-[28px] px-5 pb-8 pt-[max(env(safe-area-inset-top),1rem)] lg:rounded-none lg:px-10 lg:pb-0 lg:pt-9">
          <div className="relative z-10 flex items-center gap-3 py-2">
            {/* ── THE MARK ─────────────────────────────────────────────────
                connected-suite/public/images/logo.png, the same file the LMS
                console uses, so the borrower app and the staff console show one
                identity rather than two that merely resemble each other.

                The white chip is no longer wired in here: it is a property of
                the SURFACE, and the .sky band is navy in both themes while
                paper is not. See .brand-chip in styles/theme.css. */}
            <BrandMark size={54} />
            <span className="min-w-0 flex-1 leading-none">
              <span className="block text-[16px] font-bold tracking-[-0.02em] text-sky-ink lg:text-ink">Micro Eazy</span>
              <span className="block pt-1 text-[11.5px] text-sky-ink-soft lg:text-ink-faint">
                Quick loans. Better living.
              </span>
            </span>
            <ThemeToggle variant="band" />
          </div>
        </header>

        {deckOnMobile && (
          <div className="mx-auto w-full max-w-[560px] px-4 pt-6 lg:hidden">
            <Voices />
          </div>
        )}

        {/* `my-auto` rather than `place-items-center`: it centres the content in
            a tall window but lets it start at the top of a short one instead of
            being clipped at both ends. The ID capture surface is tall enough
            that this matters on a laptop, not only on a phone. */}
        {/* `lg:mx-auto` on the INNER block, not just the outer one: the column
            is half a wide screen, so a 440px form pinned to its left padding
            sits hard against the window edge with a gulf of empty page beside
            it. Centred in its own half, the content reads as the subject of
            that half rather than as something that failed to lay out. */}
        <div className="mx-auto flex w-full max-w-[560px] flex-1 items-start px-4 pb-14 pt-8 lg:my-auto lg:max-w-none lg:flex-none lg:px-10 lg:pb-12">
          <div className="w-full lg:mx-auto lg:max-w-[420px]">{children}</div>
        </div>
      </div>

      {/* ── RIGHT: the photography, edge to edge, still sliding ─────────── */}
      <div className="relative hidden lg:block lg:h-screen lg:overflow-hidden">
        <Voices layout="cover" />
      </div>
    </div>
  );
}

export default AuthLayout;
