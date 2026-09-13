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
import { useLender } from "../../lib/lender";
import { ThemeToggle } from "./ThemeToggle";
import { IdentityMenu } from "./IdentityMenu";

/** The one sentence this app is required to be able to point at. It belongs to
 *  the SHELL, not to a screen, so that no screen can be the one that forgot it. */
const DISCLOSURE =
  "Micro Eazy is a technology platform. Your loan is funded by a licensed lender, and every decision on this screen can be explained to you on request.";

/**
 * The nav registry says Home is `/`. For a signed-in customer home is their
 * lender's, `/<slug>` — and linking to `/` would work (it redirects) but would
 * never light up as active, because the customer is never actually standing on
 * `/`. So the one link is resolved here, where the lender is known.
 */
const resolveTo = (to: string, slug: string) => (to === "/" ? `/${slug}` : to);

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const lender = useLender();
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
                to={resolveTo(item.to, lender.slug)}
                end={item.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    isActive ? "text-white shadow-sm" : "text-ink-soft hover:bg-surface-sunk hover:text-ink"
                  }`
                }
                // The active fill is the LENDER'S brand, exactly as the console
                // does it with --brand — one saturated bar in a column of quiet
                // type, in the colour their own staff see.
                style={({ isActive }) => (isActive ? { backgroundColor: "var(--brand)" } : undefined)}
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
 * The LENDER'S mark at the head of their customers' navigation, drawn the way
 * the LMS console draws it at the head of their staff's: a white card running to
 * the rail's own gutters, the artwork given the whole of it.
 *
 * It is the same FILE the console shows, not a lookalike. `lender.mark` for
 * Micromart is byte-for-byte the `Org.logoUrl` in the LMS brand bucket, so an
 * officer and a borrower looking at their two screens side by side see one
 * object in one corner. That is the claim this whole rebrand exists to make
 * true: the branding a lender sets on the LMS is the branding their customers
 * get.
 *
 * The card stays white in both themes — lender marks carry dark tones that
 * disappear on the dark theme's ground, which is the rule .letterhead follows.
 */
function BrandBlock({ onNavigate }: { onNavigate?: () => void }) {
  const lender = useLender();
  return (
    <NavLink
      to={`/${lender.slug}`}
      onClick={onNavigate}
      aria-label={`${lender.name} — home`}
      className="mx-2.5 mb-2.5 mt-2.5 block shrink-0"
    >
      <span className="letterhead h-[96px] w-full px-4 py-3">
        <img
          src={lender.mark}
          alt=""
          aria-hidden="true"
          draggable={false}
          // `object-contain` in a fixed box is the console's rule: it absorbs a
          // square mark and a wide wordmark alike, so the next lender's file
          // drops in without anybody measuring it.
          //
          // An EXPLICIT 72px, not `h-full`. The card is a grid with an
          // auto-sized row, so a percentage height on the image has nothing
          // definite to resolve against — `h-full` fell back to the file's
          // intrinsic height and the overflow clipped the mark to its bottom half.
          className="h-[72px] w-full object-contain"
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
    // A column of two rows above `lg`: the WORK AREA, which takes every pixel
    // of height it can, and the LEGAL BAR, which takes exactly its own. The
    // whole thing is `h-screen overflow-hidden` — the landscape rule in two
    // utilities — and every flex child below carries `min-h-0`, because a flex
    // item's default `min-height: auto` refuses to shrink below its content and
    // would push the footer off the bottom of the window instead of making the
    // content box smaller.
    //
    // Below `lg` it is ordinary flow: the page scrolls, the footer is the last
    // thing in it, and the bottom padding clears the fixed tab bar.
    <div className="lender-app flex min-h-screen flex-col pb-24 lg:h-screen lg:min-h-0 lg:overflow-hidden lg:pb-0">
      {/* The gap IS the design — chrome and page float apart, ground between. */}
      <div className="flex min-h-0 flex-1 gap-3 px-3 pt-3 sm:gap-5 sm:px-5 lg:gap-5 lg:px-5">
        {/* ── THE RAIL IS AS TALL AS WHAT IS IN IT ─────────────────────────
            It used to run the full height of the window. With ten destinations
            that left a white slab with its bottom third empty — a panel whose
            size said "there is more here" about a list that had already ended.

            `self-start` sizes it to its content. `lg:max-h-full` plus the inner
            scroll is the safety valve for a short window, where the list does
            not fit and the rail is the one place a scroll is still allowed:
            it is navigation, not content, and its group headings make the
            shape of the list visible from the first row. */}
        <aside className="card hidden max-h-full w-[236px] shrink-0 flex-col self-start overflow-hidden rounded-2xl lg:flex">
          <BrandBlock />
          {/* A hairline under the letterhead. Without it the card floats above
              the list and reads as the first (oversized) nav row rather than as
              the head of the page. */}
          <div className="mx-4 mb-3 border-t" style={{ borderColor: "var(--line)" }} />
          <div className="min-h-0 overflow-y-auto pb-3">
            <NavItems />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="mb-3 flex h-10 shrink-0 items-center justify-between gap-2 lg:mb-2">
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
                  `overflow-y-auto` and NOT `overflow-hidden`: a screen that has
                  not been cut into panes yet is taller than this box, and
                  clipping it would put its content somewhere no scroll and no
                  keyboard could reach. It scrolls here, bar hidden, while the
                  rail and the legal bar stay exactly where they are. A deck
                  never reaches this — it sizes itself to exactly this box and
                  clips its own track inside .deck-viewport. */}
              <main
                ref={setMainEl}
                className="relative min-h-0 flex-1 pb-4 lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
              >
                {children}
                <ScrollVeil show={mainCutOff} />
              </main>
            </PagerSlotContext.Provider>

            {/* ── THE PAGER, ON TOP OF THE FOOTER, CENTRED ────────────────────
                It lived inside the legal bar, sharing a strip with the
                disclosure. Two different kinds of thing on one line — a sentence
                a regulator reads and a control a customer presses — and on the
                lender's solid band the control's page ink had nothing to sit on.

                It now sits on its own, centred under the panes it pages, on the
                page ground. `lg:empty:hidden` collapses the slot to nothing on a
                screen with no deck, so a single-pane screen gets no gap for a
                pager it does not have. */}
            <div ref={setPagerSlot} className="hidden shrink-0 justify-center pb-1.5 pt-2 lg:flex lg:empty:hidden" />
          </div>
        </div>
      </div>

      {/* ── THE LEGAL BAR, EDGE TO EDGE, IN THE LENDER'S COLOUR ─────────────
          Outside the work area on purpose, so it runs from the far left of the
          window to the far right — under the rail as well as the page. It is the
          one line that closes every screen in the app, and a strip that stopped
          at the rail's edge read as belonging to the content column only.

          The lender's accent with white type: checked for every lender in
          lib/lenders.ts, the worst case being Buy Simu's red at 5.28:1. */}
      <footer className="legal-bar legal-bar--brand mt-3 shrink-0 px-5 py-2 lg:mt-1.5">
        <p className="legal-ink mx-auto max-w-[1400px] text-center text-[11px] leading-[1.45]">{DISCLOSURE}</p>
      </footer>

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
