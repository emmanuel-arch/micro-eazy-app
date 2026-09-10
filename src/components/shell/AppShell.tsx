// ─────────────────────────────────────────────────────────────────────────────
// THE SIGNED-IN CHROME — ported from the lender console's shell.
//
// The console's layout language, applied to the borrower app so the two read as
// one product family (connected-suite/src/components/shell/Shell.tsx):
//
//   · No bar across the top. The SIDEBAR runs to the very top edge, with the
//     mark as the first thing in the top-left corner — the console's fix for a
//     layout that otherwise "sags its trousers" four rem down the page.
//   · The only chrome on the right is a floating identity control and the
//     appearance switch, sitting directly on the page rather than in a slab.
//     WHERE you are and WHO you are at opposite ends of one line.
//   · Panels FLOAT with real gaps between them, and the page canvas is capped
//     and centred so the ground shows on every side rather than in a 12px seam.
//   · On a handset the rail becomes a drawer behind a hamburger.
//
// ── WHAT IS DELIBERATELY NOT PORTED ─────────────────────────────────────────
// The console's sidebar is a filtered tree of modules and sub-items, because an
// officer's rights and the lender's plan decide what they may even see. A
// borrower has five destinations and no rights model. Porting the machinery
// would be cargo-culting the wrong half: the LOOK is the thing worth sharing,
// and the structure underneath should stay as small as the problem.
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
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";
import { IdentityMenu } from "./IdentityMenu";

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    // ── GROUPED, BECAUSE TEN FLAT LINKS IS A LIST AND NOT A MAP ─────────────
    // The sidebar now carries the whole app rather than the five that fit a
    // thumb bar (see nav/GlowNav.tsx for why those became two lists). Ten
    // undifferentiated rows is worse than five — the eye has nothing to land
    // on. Four short headings turn it back into somewhere with rooms.
    <div className="space-y-4">
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
                  `group flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium transition-colors ${
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
 * The mark at the head of its own navigation — the console's "letterhead".
 *
 * ── WHY THE WORDS WENT AND THE MARK GREW ────────────────────────────────────
 * This was a 40px mark with "Micro Eazy" at 14px and "Quick loans. Better
 * living." at 10.5px stacked beside it. Three elements competing inside a
 * 236px rail, none of them winning: the mark too small to read as a logo, the
 * name too small to be a wordmark, and a strapline at a size nobody reads.
 *
 * Now the mark holds the corner by itself, centred and plated, at a size that
 * reads as an identity rather than as a favicon. The name it used to spell out
 * lives on the link's aria-label, where it does more good — a screen reader
 * announced "Micro Eazy Quick loans. Better living. home" before, which is
 * three phrases for one destination.
 */
function BrandBlock({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <NavLink
      to="/"
      onClick={onNavigate}
      aria-label="Micro Eazy — home"
      className="mx-2 mb-3 mt-3 flex shrink-0 items-center justify-center rounded-2xl px-2.5 py-2 transition-colors"
    >
      <BrandMark size={62} framed />
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();

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
    <div className="min-h-screen">
      {/* The gap IS the design — chrome and page float apart, ground between. */}
      <div className="flex min-h-screen gap-3 px-3 pb-6 pt-3 sm:gap-5 sm:px-5 lg:gap-6 lg:px-6">
        <aside className="card sticky top-3 hidden h-[calc(100vh-1.5rem)] w-[236px] shrink-0 overflow-y-auto rounded-2xl lg:block">
          <BrandBlock />
          {/* A hairline under the letterhead. Without it the plate floats above
              the list and reads as the first (oversized) nav row rather than as
              the head of the page. */}
          <div className="mx-4 mb-3 border-t" style={{ borderColor: "var(--line)" }} />
          <NavItems />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
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
              page on a wide screen rather than only in the gutters. `pb-28` on
              a handset clears the bottom tab bar. */}
          <main className="mx-auto w-full max-w-[1080px] flex-1 pb-28 lg:pb-2">{children}</main>
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
