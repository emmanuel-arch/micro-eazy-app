// The appearance control, in the sky. One button that cycles light → dark →
// match-my-phone, because a header on a 360px screen has room for one control
// and three segments would cost the title its space.
//
// The lender console gets the three-segment version instead: it has the width,
// and staff switch deliberately rather than idly.
import { Moon, Sun, MonitorSmartphone } from "lucide-react";
import { useTheme } from "../../lib/theme";

/**
 * `sky` is the control as it sits on the navy band — white-on-navy, which is
 * wrong the moment it is asked to sit on paper. The signed-in chrome floats its
 * controls directly on the page (the console's pattern), so it needs the panel
 * face: a card with page ink. Two faces, one control, rather than a second
 * component that drifts.
 */
export function ThemeToggle({ variant = "sky" }: { variant?: "sky" | "panel" | "band" }) {
  const { choice, cycle } = useTheme();
  const Icon = choice === "light" ? Sun : choice === "dark" ? Moon : MonitorSmartphone;
  const label = choice === "light" ? "Light" : choice === "dark" ? "Dark" : "Match my phone";
  return (
    <button
      onClick={cycle}
      aria-label={`Appearance: ${label}. Tap to change.`}
      title={label}
      className={
        // "band" is the auth header's case: it sits ON the navy band on a
        // handset and on PAPER above lg, because .sky-phone-only stops painting
        // the band there. One control, two grounds — white-on-navy type was
        // invisible the moment the navy went away.
        variant === "band"
          ? "grid h-10 w-10 place-items-center rounded-full border border-white/20 text-sky-ink transition-colors hover:bg-white/10 lg:rounded-xl lg:border-[color:var(--line)] lg:bg-[var(--surface)] lg:text-ink-soft lg:hover:bg-[var(--surface-sunk)] lg:hover:text-ink"
          : variant === "panel"
          ? "card grid h-10 w-10 place-items-center rounded-xl text-ink-soft transition-colors hover:text-ink"
          : "grid h-10 w-10 place-items-center rounded-full border border-white/20 text-sky-ink transition-colors hover:bg-white/10"
      }
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
    </button>
  );
}

export default ThemeToggle;
