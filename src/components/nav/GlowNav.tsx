// ─────────────────────────────────────────────────────────────────────────────
// THE GLOW NAV — the same idea as the reference menu bar, moved to where a
// borrower's thumb actually is.
//
// The reference was a horizontal desktop bar whose glow and 3-D card flip were
// driven by `whileHover`. Two problems on a phone: there is no hover, so the
// entire effect never fires; and a top-of-screen horizontal nav is the one place
// a one-handed user cannot reach. The technique survives, the placement does not.
//
//   · Under `lg` it is a BOTTOM TAB BAR, inside the safe-area inset, five items
//     wide — the shape every Kenyan fintech app has, because it is the shape a
//     thumb can hit while holding a matatu rail.
//   · At `lg` and up it becomes a LEFT RAIL with labels, which is where the
//     reference's proportions actually belong.
//
// And the glow follows the ACTIVE ROUTE rather than the cursor, so a touch user
// gets the effect permanently on the tab they are on. Pointer devices still get
// the hover preview and the flip on top of that — `@media (hover: hover)`, so a
// phone is never asked to render an interaction it cannot express.
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { useLender } from "../../lib/lender";
import {
  Home, Wallet, Gauge, FileText, User, MessageSquare, Route as RouteIcon,
  TrendingUp, ShieldCheck, ScanFace, FileSpreadsheet, Banknote, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  to: string;
  /** The radial wash behind an active item. Tinted per destination so the app
   *  has a sense of place — money is green, the score is amber, you are navy. */
  glow: string;
  tint: string;
}

/** A heading in the sidebar. Groups are for the RAIL only — a bottom tab bar has
 *  no room for section labels and does not need them at five items. */
export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── ONE LIST WAS DOING TWO JOBS ─────────────────────────────────────────────
// NAV_ITEMS was five entries rendered into BOTH the bottom tab bar and the
// desktop sidebar, which meant the sidebar could only ever be as big as a thumb
// bar. Two consequences, and the second was the expensive one:
//
//   · A lending app's sidebar read as a demo. Five links is what a prototype
//     has; a customer's real relationship with a lender has more rooms than
//     that, and hiding them behind Home does not make them fewer.
//   · /ladder and /exposure were ROUTED AND FINISHED but appeared in no
//     navigation at all. Two complete screens, reachable only by typing the
//     URL. That is not a small oversight — it is two features the lender paid
//     for and no customer could find.
//
// So the two surfaces are now two lists. The rail carries the whole app,
// grouped. The tab bar carries the five a thumb actually goes to.

const HOME: NavItem = { icon: Home, label: "Home", to: "/", glow: "rgba(47,107,255,0.42)", tint: "#5b8cff" };
const TRACK: NavItem = { icon: RouteIcon, label: "Application", to: "/track", glow: "rgba(37,149,12,0.42)", tint: "#5ec22a" };
const MESSAGES: NavItem = { icon: MessageSquare, label: "Messages", to: "/messages", glow: "rgba(14,165,233,0.42)", tint: "#38bdf8" };
const REPAY: NavItem = { icon: Wallet, label: "Repay", to: "/repay", glow: "rgba(37,149,12,0.42)", tint: "#5ec22a" };
const LOANS: NavItem = { icon: FileText, label: "Your loans", to: "/loans", glow: "rgba(139,92,246,0.42)", tint: "#a78bfa" };
const SCORE: NavItem = { icon: Gauge, label: "Your score", to: "/score", glow: "rgba(245,158,11,0.42)", tint: "#f0a92b" };
const LADDER: NavItem = { icon: TrendingUp, label: "Limit ladder", to: "/ladder", glow: "rgba(245,158,11,0.42)", tint: "#f0a92b" };
const EXPOSURE: NavItem = { icon: ShieldCheck, label: "Credit file", to: "/exposure", glow: "rgba(99,102,241,0.42)", tint: "#818cf8" };
// ── THE BORROWING ROAD, IN ORDER ────────────────────────────────────────────
// "ID check" used to sit under Account, as though proving who you are were a
// settings page. It is the first of three steps to a loan, so the three live
// together under Now, in the order they are done: verify, read the statement,
// apply. /identity still exists — it is where a referred check is explained —
// but it is reached from the KYC screen, not from the rail.
const KYC: NavItem = { icon: ScanFace, label: "KYC verification", to: "/kyc", glow: "rgba(99,102,241,0.42)", tint: "#818cf8" };
const CRUNCH: NavItem = { icon: FileSpreadsheet, label: "Statement cruncher", to: "/crunch", glow: "rgba(76,183,73,0.42)", tint: "#4CB749" };
const APPLY: NavItem = { icon: Banknote, label: "Apply now", to: "/apply", glow: "rgba(37,149,12,0.42)", tint: "#5ec22a" };
const YOU: NavItem = { icon: User, label: "You", to: "/you", glow: "rgba(236,72,153,0.42)", tint: "#f472b6" };

/** The sidebar: everything, in the order a customer's relationship runs — what
 *  is happening now, then the money, then what the lender thinks of them. */
export const NAV_GROUPS: NavGroup[] = [
  { label: "Now", items: [HOME, KYC, CRUNCH, APPLY, TRACK, MESSAGES] },
  { label: "Money", items: [REPAY, LOANS] },
  { label: "Standing", items: [SCORE, LADDER, EXPOSURE] },
  { label: "Account", items: [YOU] },
];

/** Flattened, for anything that wants the whole list without the headings. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * The thumb bar. FIVE, and it stays five.
 *
 * Not an arbitrary cap: the bar is capped at 520px and every item added past
 * five takes width from the labels until they all truncate to three letters,
 * at which point the icons are the only thing distinguishing them and the bar
 * has stopped being navigation. The rail is where breadth goes.
 */
export const TAB_ITEMS: NavItem[] = [HOME, { ...APPLY, label: "Apply" }, TRACK, REPAY, MESSAGES];

const spring = { type: "spring" as const, stiffness: 380, damping: 32 };

function Item({ item, rail }: { item: NavItem; rail: boolean }) {
  const Icon = item.icon;
  // Home is the lender home, /<slug> — linking to "/" would redirect there but
  // never light up as active. Same resolution as the sidebar in AppShell.
  const lender = useLender();
  return (
    <NavLink
      to={item.to === "/" ? "/" + lender.slug : item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `group relative flex ${rail ? "w-full flex-row items-center gap-3 rounded-2xl px-3.5 py-3" : "flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2"} ` +
        `outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--lime)] ` +
        (isActive ? "text-ink" : "text-ink-faint hover:text-ink-soft")
      }
    >
      {({ isActive }) => (
        <>
          {/* The wash. A layout-animated element shared across the whole list, so
              moving between tabs SLIDES the glow rather than cross-fading two of
              them — the detail that makes it feel like one object. */}
          {isActive && (
            <motion.span
              layoutId={rail ? "glow-rail" : "glow-tabs"}
              transition={spring}
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl"
              style={{
                background: `radial-gradient(circle at 50% ${rail ? "50%" : "30%"}, ${item.glow} 0%, transparent 72%)`,
              }}
            />
          )}

          {/* On a pointer device only, the same wash previews on hover. A phone
              never renders this: `hover:` compiles to a media query that a touch
              screen does not match. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-60"
            style={{ background: `radial-gradient(circle at 50% 50%, ${item.glow} 0%, transparent 72%)` }}
          />

          <Icon
            className={`${rail ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]"} shrink-0 transition-transform duration-300 group-hover:-translate-y-px`}
            strokeWidth={isActive ? 2.4 : 1.9}
            style={{ color: isActive ? item.tint : undefined }}
          />
          <span className={rail ? "text-[13.5px] font-medium" : "text-[10.5px] font-semibold tracking-[0.01em]"}>
            {item.label}
          </span>

          {/* The active pip on the tab bar. A rail has room for weight and colour
              to say "here"; a 64px-wide tab does not, so it gets a mark. */}
          {!rail && isActive && (
            <motion.span
              layoutId="tab-pip"
              transition={spring}
              aria-hidden
              className="absolute -top-px h-[3px] w-7 rounded-full"
              style={{ background: item.tint, boxShadow: `0 0 12px ${item.glow}` }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

/** Bottom tabs. Rendered below `lg`; the rail takes over above it. */
export function GlowTabs() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <div
        // Capped and centred: on a tablet a 900px-wide tab bar spreads five
        // items so far apart they stop reading as one control.
        className="mx-3 mb-1 flex max-w-[520px] items-stretch gap-1 rounded-[26px] border border-line px-1.5 py-1 sm:mx-auto"
        style={{
          background: "color-mix(in oklab, var(--surface) 88%, var(--bg))",
          backdropFilter: "blur(28px) saturate(150%)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        {TAB_ITEMS.map((i) => (
          <Item key={i.to} item={i} rail={false} />
        ))}
      </div>
    </nav>
  );
}

/** The desktop rail. Same items, same glow, room for the wordmark. */
export function GlowRail({ children }: { children?: React.ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col gap-1 border-r border-line px-3 py-5 lg:flex"
      style={{ background: "color-mix(in oklab, var(--surface) 92%, var(--bg))", backdropFilter: "blur(28px)" }}>
      {children}
      <div className="mt-2 flex flex-col gap-1">
        {NAV_ITEMS.map((i) => (
          <Item key={i.to} item={i} rail />
        ))}
      </div>
    </aside>
  );
}
