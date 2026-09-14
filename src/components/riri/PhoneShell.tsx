// ─────────────────────────────────────────────────────────────────────────────
// THE HANDSET — bezel, glass, status bar, home button. Ported from the console.
//
// connected-suite/src/components/os/PhoneShell.tsx, onto this app's tokens and its
// dark theme. It draws a device and nothing else: no conversation, no request, and
// screens are handed to it as children. That separation is why BACK CAN NEVER BE
// MISSING — the bar derives its affordances from the nav stack's depth, so no
// screen can forget to draw one.
//
// THE HOME BUTTON IS PHYSICAL. On a floating panel inside a browser, driven by a
// mouse on the laptop this is demonstrated on, "swipe up from the bottom edge" is
// an instruction nobody receives. A button that travels when pressed and always
// goes home is the affordance this context actually has.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, X, Wifi, BatteryMedium, Signal } from "lucide-react";

let clockCache = "--:--";
const formatClock = () => new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });

function subscribeClock(onChange: () => void) {
  const tick = () => {
    const next = formatClock();
    if (next !== clockCache) {
      clockCache = next;
      onChange();
    }
  };
  tick();
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    tick();
    interval = setInterval(tick, 60_000);
  }, 60_000 - (Date.now() % 60_000));
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
}
function clockSnapshot() {
  const next = formatClock();
  if (next !== clockCache) clockCache = next;
  return clockCache;
}
export const useClock = () => useSyncExternalStore(subscribeClock, clockSnapshot, () => "--:--");

export function PhoneShell({
  title, subtitle, onBack, backLabel, onHome, onClose, action, leading, busy, children, footer, atHome, overlay,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: (() => void) | null;
  backLabel?: string | null;
  onHome: () => void;
  onClose: () => void;
  action?: ReactNode;
  leading?: ReactNode;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  atHome: boolean;
  /** A sheet over the screen — the hand-off to the team. */
  overlay?: ReactNode;
}) {
  const clock = useClock();
  const [pressed, setPressed] = useState(false);

  const press = () => {
    setPressed(true);
    window.setTimeout(() => setPressed(false), 260);
    onHome();
  };

  return (
    <div className="os-frame relative flex h-full w-full flex-col overflow-hidden rounded-[42px] p-[9px]">
      <span aria-hidden className="pointer-events-none absolute -left-[2px] top-[112px] h-9 w-[3px] rounded-l-sm bg-slate-500/70" />
      <span aria-hidden className="pointer-events-none absolute -left-[2px] top-[158px] h-14 w-[3px] rounded-l-sm bg-slate-500/70" />
      <span aria-hidden className="pointer-events-none absolute -right-[2px] top-[136px] h-20 w-[3px] rounded-r-sm bg-slate-500/70" />

      <div className="os-glass relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px]">
        {/* STATUS BAR */}
        <div className="relative z-20 flex h-[26px] shrink-0 items-center justify-between px-5 pt-1.5 text-[10px] font-semibold text-ink-faint">
          <span className="tabular-nums">{clock}</span>
          <span className="flex items-center gap-1">
            <Signal className="h-2.5 w-2.5" />
            <Wifi className="h-2.5 w-2.5" />
            <BatteryMedium className="h-3 w-3" />
          </span>
        </div>

        {/* NAVIGATION BAR — back names where it goes. */}
        <div
          className="relative z-10 flex shrink-0 items-center gap-2 px-3 pb-2 pt-1"
          style={{ background: "linear-gradient(135deg, var(--brand-soft), transparent 70%)" }}
        >
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 flex h-8 shrink-0 items-center gap-0.5 rounded-full pl-1 pr-2 text-[11.5px] font-semibold text-ink-soft transition-colors hover:bg-[var(--line)] hover:text-ink"
              aria-label={`Back to ${backLabel ?? "the previous screen"}`}
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
              <span className="max-w-[84px] truncate">{backLabel ?? "Back"}</span>
            </button>
          ) : (
            leading
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight text-ink">{title}</p>
            <p className="flex items-center gap-1 truncate text-[10.5px] leading-tight text-ink-soft">
              {busy ? (
                <>
                  Thinking
                  <span className="riri-think-dot">.</span>
                  <span className="riri-think-dot" style={{ animationDelay: ".2s" }}>.</span>
                  <span className="riri-think-dot" style={{ animationDelay: ".4s" }}>.</span>
                </>
              ) : (
                <>
                  <span className="os-live inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {subtitle}
                </>
              )}
            </p>
          </div>

          {action}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-[var(--line)] hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* SCREEN — the only scrolling region. */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {children}
          {overlay}
        </div>

        {footer}

        {/* HOME */}
        <div className="relative z-10 flex shrink-0 flex-col items-center gap-1.5 border-t border-line pb-2 pt-1.5" style={{ background: "var(--os-paper-soft)" }}>
          <button
            type="button"
            onClick={press}
            disabled={atHome}
            aria-label="Home"
            className="h-1 w-24 rounded-full bg-[var(--line-strong)] transition-colors disabled:opacity-40"
          />
          <motion.button
            type="button"
            onClick={press}
            disabled={atHome}
            aria-label="Home"
            title="Home"
            whileTap={atHome ? undefined : { scale: 0.9 }}
            className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all ${pressed ? "os-home-press" : ""} ${atHome ? "opacity-40" : "hover:shadow-md"}`}
            style={{
              background: "var(--os-home-face)",
              boxShadow: "0 0 0 1px rgb(15 23 42 / 0.14), 0 1px 2px rgb(15 23 42 / 0.12), 0 1px 0 rgb(255 255 255 / 0.5) inset",
            }}
          >
            <span className="h-3.5 w-3.5 rounded-[5px]" style={{ boxShadow: "0 0 0 1.5px var(--line-strong)" }} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
