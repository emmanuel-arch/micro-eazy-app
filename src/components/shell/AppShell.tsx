// ─────────────────────────────────────────────────────────────────────────────
// THE SIGNED-IN CHROME — ported from the lender console's shell.
//
// The console's layout language, applied to the borrower app so the two read as
// one product family (connected-suite/src/components/shell/Shell.tsx):
//
//   · No bar across the top. The SIDEBAR runs to the very top edge, with the
//     LETTERHEAD as the first thing in the top-left corner — a white card the
//     full width of the rail with the mark centred in it, exactly as the console
//     draws a lender's logo. See .letterhead in styles/theme.css.
//   · The only chrome on the right is a floating identity control and the
//     appearance switch, sitting directly on the page rather than in a slab.
//     WHERE you are and WHO you are at opposite ends of one line.
//   · Panels FLOAT with real gaps between them, and the page canvas is capped
//     and centred so the ground shows on every side rather than in a 12px seam.
//   · On a handset the rail becomes a drawer behind a hamburger.
//
// ── THE LANDSCAPE RULE ──────────────────────────────────────────────────────
// Above `lg` this shell is a FIXED FRAME: `h-screen`, `overflow-hidden`, and no
// page scroll anywhere in the app. Three things follow from that, and they are
// the whole reason it is worth doing:
//
//   1. THE FOOTER IS ALWAYS ON SCREEN. The line that says Micro Eazy is a
//      technology platform and the money comes from a licensed lender used to
//      live at the bottom of Home and nowhere else, below a fold most people
//      never reached. It is now a bar at the foot of the frame, on every signed-
//      in screen, and no screen can lose it.
//   2. THE FLOOR STAYS PUT. The canvas is capped and centred on a photograph of
//      Nairobi at dawn, which on a desktop is most of what is on screen. A page
//      that scrolls drags its panels across that picture and the composition
//      comes apart; a fixed frame keeps them in a settled relationship.
//   3. CONTENT GOES SIDEWAYS. A screen with more to say than fits cuts itself
//      into panes and slides — same rectangle, same width, nothing widened. See
//      components/shell/Deck.tsx.
//
// A screen that has NOT been cut into panes yet still gets the frame: it scrolls
// inside its own content box, with no bar and a soft fade at the foot, so the
// footer and the rail stay where they are. That is the migration path, and it
// is a correct-looking state rather than a broken one.
//
// Below `lg` none of this applies. A phone scrolls down, the tab bar is at the
// bottom, and the footer is the last thing in the flow — which is right, because
// a handset has no horizontal room to spend and the thumb travels vertically.
//
// ── WHAT IS DELIBERATELY NOT PORTED ─────────────────────────────────────────
// The console's sidebar is a filtered tree of modules and sub-items, because an
// officer's rights and the lender's plan decide what they may even see. A
// borrower has ten destinations and no rights model. Porting the machinery would
// be cargo-culting the wrong half: the LOOK is the thing worth sharing, and the
// structure underneath should stay as small as the problem.
//
// ── THE BOTTOM TABS SURVIVE ─────────────────────────────────────────────────
// They are the thumb-first primary nav on a phone and they are better than a
// drawer for the five places somebody goes constantly. The drawer is not a
// replacement for them; it carries the same five PLUS the things that have
// nowhere else to live on a handset — the account and the way out.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Bell, Menu, X } from "lucide-react";
import { NAV_GROUPS } from "../nav/GlowNav";
import { PagerSlotContext } from "./chrome";
import { ScrollVeil, useCutOff } from "./ScrollVeil";
import { ThemeToggle } from "./ThemeToggle";
import { IdentityMenu } from "./IdentityMenu";

/** The one sentence this app is required to be able to point at. It belongs to
 *  the SHELL, not to a screen, so that no screen can be the one that forgot it. */
const DISCLOSURE =
  "Micro Eazy is a technology platform. Your loan is funded by a licensed lender, and every decision on this screen can be explained to you on request.";

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    // ── GROUPED, BECAUSE TEN FLAT LINKS IS A LIST AND NOT A MAP ─────────────
    // The sidebar now carries the whole app rather than the five that fit a
    // thumb bar (see nav/GlowNav.tsx for why those became two lists). Ten
    // undifferentiated rows is worse than five — the eye has nothing to land
    // on. Four short headings turn it back into somewhere with rooms.
    <div className="space-y-3.5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-0.5 px-2">
          <p className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    isActive ? "text-white shadow-sm" : "text-ink-soft hover:bg-surface-sunk hover:text-ink"
                  }`
                }
                // The active fill is the brand, exactly as the console does it —
                // one saturated bar in a column of quiet type.
                style={({ isActive }) => (isActive ? { backgroundColor: "var(--navy)" } : undefined)}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-4 w-4 shrink-0 ${isActive ? "" : "text-ink-faint group-hover:text-ink-soft"}`}
                      strokeWidth={2.2}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * ── THE LETTERHEAD ──────────────────────────────────────────────────────────
 * The mark at the head of its own navigation, drawn the way the lender console
 * draws a lender's: a white card running to the rail's own gutters, with the
 * artwork given the FULL WIDTH of that card and centred inside it.
 *
 * What it replaces was a ~62px plate floating in the middle of a 236px column.
 * At that size, with that much air on either side, it read as a sticker somebody
 * had put on the sidebar rather than as the masthead of the page — the same
 * failure the wordmark-beside-a-favicon arrangement had before it, arrived at
 * from the opposite direction.
 *
 * ── THE FILE ────────────────────────────────────────────────────────────────
 * `/brand/micro-eazy/logo-lockup.png` is the full lockup — mark, name and
 * strapline — trimmed to its own alpha bounds, so the card's padding is the
 * card's and not the PNG's. The untrimmed original carries 27% dead width and
 * 52% dead height; given `w-full` it would have drawn a small logo in the middle
 * of a large white rectangle, which is precisely the look being fixed here.
 *
 * The card stays WHITE in both themes. The artwork is navy and green on
 * transparency, and on a near-black ground its navy half disappears — the same
 * rule .brand-chip and .brand-plate already follow.
 */
function BrandBlock({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <NavLink
      to="/"
      onClick={onNavigate}
      // The visible artwork carries the name, so the accessible name lives here
      // rather than in grey type nobody reads. A screen reader announced "Micro
      // Eazy Quick loans. Better living. home" when it was set three ways.
      aria-label="Micro Eazy — home"
      className="mx-2.5 mb-2.5 mt-2.5 block shrink-0"
    >
      <span className="letterhead w-full px-3.5 py-3">
        <img
          src="/brand/micro-eazy/logo-lockup.png"
          alt=""
          aria-hidden="true"
          // `w-full object-contain` is the console's rule verbatim: it absorbs
          // whatever aspect ratio the artwork has without us needing to know the
          // file's dimensions, so replacing the file never distorts it.
          className="h-auto w-full object-contain"
        />
      </span>
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  /** The footer node a screen's pager portals into. A callback ref rather than
   *  a plain one, so the first render that HAS the node also re-renders the
   *  provider — a `useRef` here would hand every deck `null` for ever. */
  const [pagerSlot, setPagerSlot] = useState<HTMLElement | null>(null);
  /** The content box, so the fade at its foot can be driven by whether there is
   *  actually anything under it. Re-measured whenever the route changes, because
   *  that is when the thing being measured is replaced wholesale. */
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);
  const mainCutOff = useCutOff(() => mainEl, [mainEl, pathname]);

  // The drawer traps scroll while open, and closes on navigation — a drawer
  // left standing over the screen you just asked for is the commonest bug in
  // this pattern.
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  // Escape closes it. A drawer with no keyboard exit is a trap for anybody not
  // using a touchscreen, which on this app includes the staff walking customers
  // through it on a laptop.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    // ── THE FRAME ─────────────────────────────────────────────────────────
    // `lg:h-screen lg:overflow-hidden` is the landscape rule in two utilities.
    // Everything below it is written to live inside a box of known height —
    // `min-h-0` on every flex child, because a flex item's default `min-height:
    // auto` refuses to shrink below its content and would push the footer off
    // the bottom of the window rather than making the content box smaller.
    <div className="min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden">
      {/* The gap IS the design — chrome and page float apart, ground between. */}
      <div className="flex min-h-screen gap-3 px-3 pb-6 pt-3 sm:gap-5 sm:px-5 lg:h-full lg:min-h-0 lg:gap-5 lg:px-5 lg:pb-4">
        <aside className="card hidden w-[236px] shrink-0 flex-col overflow-hidden rounded-2xl lg:flex lg:h-full">
          <BrandBlock />
          {/* A hairline under the letterhead. Without it the card floats above
              the list and reads as the first (oversized) nav row rather than as
              the head of the page. */}
          <div className="mx-4 mb-3 border-t" style={{ borderColor: "var(--line)" }} />
          {/* The rail is the ONE place a scrollbar is still allowed, and only
              when the ten destinations genuinely do not fit the window. It is
              navigation, not content: nothing here is hidden from a customer who
              never scrolls, because the group headings make the shape of the
              list visible from the first row. */}
          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            <NavItems />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:h-full lg:min-h-0">
          <div className="mb-3 flex h-10 shrink-0 items-center justify-between gap-2">
            {/* The drawer button. Mobile only — on a laptop the rail is already
                standing and a button to reveal it would open nothing. */}
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
              aria-expanded={drawer}
              className="card grid h-10 w-10 place-items-center rounded-xl text-ink-soft transition-colors hover:text-ink lg:hidden"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            {/* Holds the right-hand group out when there is no drawer button. */}
            <span className="hidden lg:block" />

            <div className="flex items-center gap-2">
              {/* Moved up from Sky, where it was painted once per screen. It is
                  still unwired — there is no updates route yet — and it is kept
                  rather than dropped so the affordance customers already see
                  does not vanish in a layout change. */}
              <button
                type="button"
                aria-label="Updates"
                className="card grid h-10 w-10 place-items-center rounded-xl text-ink-soft transition-colors hover:text-ink"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <ThemeToggle variant="panel" />
              <IdentityMenu />
            </div>
          </div>

          {/* Capped and centred, so the ground breathes on BOTH sides of the
              page on a wide screen rather than only in the gutters. */}
          <div className="mx-auto flex w-full min-w-0 max-w-[1080px] flex-1 flex-col lg:min-h-0">
            <PagerSlotContext.Provider value={pagerSlot}>
              {/* ── THE CONTENT BOX ────────────────────────────────────────
                  `relative` for the veil. `overflow-y-auto` and NOT
                  `overflow-hidden`: a screen that has not been cut into panes
                  yet is taller than this box, and clipping it would put its
                  content somewhere no scroll and no keyboard could reach. It
                  scrolls here instead, with the bar hidden, while the rail and
                  the legal bar stay exactly where they are.

                  A deck never reaches this: it sizes itself to exactly this box
                  (`lg:h-full`) and clips its own track inside .deck-viewport, so
                  the sideways track cannot widen the page either.

                  `pb-28` on a handset clears the bottom tab bar. */}
              <main
                ref={setMainEl}
                className="relative min-h-0 flex-1 pb-28 lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
              >
                {children}
                {/* Only when there is genuinely something below the fold — see
                    the note in ScrollVeil about why an always-on gradient reads
                    as a rendering seam on the screens that fit. */}
                <ScrollVeil show={mainCutOff} />
              </main>
            </PagerSlotContext.Provider>

            {/* ── THE LEGAL BAR ────────────────────────────────────────────
                The disclosure on the left, the current screen's pager on the
                right, on one solid strip at the foot of the frame. On a handset
                it is the last thing in the scroll, clear of the tab bar. */}
            <footer className="legal-bar mb-24 mt-3 flex shrink-0 items-center gap-4 px-4 py-2.5 lg:mb-0">
              <p className="min-w-0 flex-1 text-[10.5px] leading-[1.4] text-ink-faint">{DISCLOSURE}</p>
              {/* The slot. Empty on a screen with one pane, which is the right
                  amount of chrome for a screen with nowhere to go. */}
              <div ref={setPagerSlot} className="hidden shrink-0 lg:block" />
            </footer>
          </div>
        </div>
      </div>

      {/* ── The drawer ───────────────────────────────────────────────────── */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            aria-hidden
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: "rgb(4 6 14 / 0.45)" }}
            onClick={() => setDrawer(false)}
          />
          <div
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col shadow-2xl"
            style={{ background: "var(--bg)" }}
          >
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-sunk hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto pt-1">
              <BrandBlock onNavigate={() => setDrawer(false)} />
              <NavItems onNavigate={() => setDrawer(false)} />
            </div>
            {/* The account and the way out. On a laptop these live in the
                identity control top-right; on a handset that control is a
                40px circle and this is where they can actually be read. */}
            <div className="shrink-0 border-t p-2" style={{ borderColor: "var(--line)" }}>
              <IdentityMenu inline onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppShell;
