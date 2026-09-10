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
          {/* ── ALIGNED TO THE COLUMN, NOT TO THE WINDOW ────────────────────
              The content below is centred inside a 420px column (see the
              wrapper further down), so a mark pinned to the header's own `px-10`
              sat ~120px to the left of the "Welcome." it belongs to. Two
              left edges in a layout that has room for one reads as an accident.
              The same max-width and centring here puts the mark directly above
              the first line of type, which is what makes it look placed rather
              than parked. Below `lg` this is a no-op: the navy band is
              full-bleed and the mark belongs in its corner. */}
          <div className="relative z-10 flex items-start justify-between gap-3 py-2 lg:mx-auto lg:max-w-[420px]">
            {/* ── THE MARK, ON ITS OWN ─────────────────────────────────────
                connected-suite/public/images/logo.png, the same file the LMS
                console uses, so the borrower app and the staff console show one
                identity rather than two that merely resemble each other.

                THE WORDS ARE GONE. "Micro Eazy / Quick loans. Better living."
                used to sit beside this at 16px and 11.5px. On the front door —
                the one screen whose job is to say whose money this is — that
                read as a favicon with a caption. The mark is now large enough
                to be read as a logo, which is the job a logo has, and the
                accessible name moved onto the link/aria-label rather than being
                set in grey type nobody read.

                The plate (see .brand-plate) is what lets it hold the corner at
                this size without floating: on the navy band it is the white
                ground the navy half of the artwork needs, and on paper it is a
                real surface with its own light. */}
            <BrandMark size={64} framed />
            <ThemeToggle variant="band" />
          </div>
          {/* The name, for anything that does not render pictures. The visible
              wordmark is gone; the accessible one must not be. */}
          <span className="sr-only">Micro Eazy</span>
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
        <div className="mx-auto flex w-full max-w-[560px] flex-1 items-start px-4 pb-6 pt-8 lg:my-auto lg:max-w-none lg:flex-none lg:px-10 lg:pb-6">
          <div className="w-full lg:mx-auto lg:max-w-[420px]">{children}</div>
        </div>

        {/* ── THE FOOTER ─────────────────────────────────────────────────────
            One line, at the bottom of the column the customer is reading, on
            every front-of-house screen. It belongs to the LAYOUT and not to any
            one screen for the same reason the frame does: a step added to the
            funnel tomorrow should not be able to lose it.

            NO `mt-auto`, deliberately. The content block above already owns the
            free space — `flex-1` on a handset, `lg:my-auto` on a laptop — so it
            lands at the bottom on both. Adding a third auto margin here would
            make three of them share the slack, which stops the form being
            centred in the landscape window and is exactly the drift the
            landscape rule exists to catch. */}
        <footer className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 text-center lg:px-10">
          <p className="text-[11.5px] font-medium tracking-[0.01em] text-ink-faint">
            Powered by <span className="font-semibold text-ink-soft">Micro Eazy</span>
          </p>
        </footer>
      </div>

      {/* ── RIGHT: the photography, edge to edge, still sliding ─────────── */}
      <div className="relative hidden lg:block lg:h-screen lg:overflow-hidden">
        <Voices layout="cover" />
      </div>
    </div>
  );
}

export default AuthLayout;
