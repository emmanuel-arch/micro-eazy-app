// ─────────────────────────────────────────────────────────────────────────────
// THE DEVICE HOME SCREEN — a wallpaper in the lender's colour, a grid, a dock.
//
// Ported from connected-suite/src/components/os/screens/Home.tsx. The top of the
// screen is a LIVE LINE, not a slogan: the single most useful fact on the
// customer's own account right now — a reply waiting, a desk their application is
// on, what is left on the loan — and tapping it goes to the thing. If nothing needs
// them, it says so, which is also information.
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from "framer-motion";
import {
  MessageCircle, Wallet, Banknote, Route as RouteIcon, Gauge, HandCoins, TrendingUp, LifeBuoy, MessageSquare, Settings,
  ChevronRight, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { GRID_APPS, DOCK_APPS, type DeviceApp } from "../apps";
import { SPRING } from "../kit";
import type { HomeResponse } from "../../../lib/api/portal";
import { money } from "../../../lib/format";
import type { RiriLang } from "../../../lib/riri/api";

const ICONS: Record<string, LucideIcon> = { MessageCircle, Wallet, Banknote, Route: RouteIcon, Gauge, HandCoins, TrendingUp, LifeBuoy, MessageSquare, Settings };

export type LiveLine = { title: string; detail: string; tone: "brand" | "good" | "warn"; open: DeviceApp["id"] } | null;

export function liveLine(data: HomeResponse | null, lang: RiriLang): LiveLine {
  if (!data) return null;
  const sw = lang === "sw";
  if (data.unreadMessages > 0) {
    return { title: sw ? `Ujumbe ${data.unreadMessages} mpya kutoka kwa timu` : `${data.unreadMessages} new message${data.unreadMessages === 1 ? "" : "s"} from the team`, detail: data.messages[0]?.subject ?? "", tone: "brand", open: "inbox" };
  }
  if (data.application && !["APPROVED", "DECLINED"].includes(data.application.status)) {
    return { title: sw ? `Ombi lako liko kwa ${data.application.stageTitle ?? "timu"}` : `Your application is with ${data.application.stageTitle ?? "the team"}`, detail: money(data.application.amount), tone: "warn", open: "track" };
  }
  if (data.bookSource === "unavailable") return null;
  if (data.activeLoan) {
    return { title: sw ? `${money(data.activeLoan.balance)} imebaki kwenye mkopo wako` : `${money(data.activeLoan.balance)} left on your loan`, detail: data.activeLoan.product ?? "", tone: "brand", open: "repay" };
  }
  if (data.available > 0) {
    return { title: sw ? `${money(data.available)} zinapatikana kukopa` : `${money(data.available)} available to borrow`, detail: sw ? "Hakuna deni kwa sasa" : "Nothing owed right now", tone: "good", open: "apply" };
  }
  return null;
}

export function HomeScreen({
  lender, firstName, lang, data, onOpen,
}: {
  lender: string;
  firstName: string | null;
  lang: RiriLang;
  data: HomeResponse | null;
  onOpen: (app: DeviceApp) => void;
}) {
  const sw = lang === "sw";
  const hour = new Date().getHours();
  const salutation = sw ? (hour < 12 ? "Habari ya asubuhi" : hour < 17 ? "Habari ya mchana" : "Habari ya jioni") : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const lead = liveLine(data, lang);
  const badgeFor = (app: DeviceApp) => (app.id === "inbox" ? data?.unreadMessages ?? 0 : 0);
  const byId = (id: string) => [...GRID_APPS, ...DOCK_APPS].find((a) => a.id === id)!;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, zIndex: 2 }} animate={{ opacity: 1, scale: 1, zIndex: 2 }} exit={{ opacity: 0, scale: 1.03, zIndex: 1 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: "var(--os-paper)" }}
    >
      {/* WALLPAPER — the lender's colour, moving slowly enough to be felt. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="os-aurora absolute -inset-[30%]"
          style={{
            background: "radial-gradient(40% 40% at 30% 25%, var(--brand) 0%, transparent 62%), radial-gradient(38% 38% at 72% 70%, var(--brand-2) 0%, transparent 60%)",
            opacity: 0.2,
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--os-paper) 40%, transparent), color-mix(in oklab, var(--os-paper) 88%, transparent))" }} />
      </div>

      <div className="os-scroll relative flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-2 pt-2">
        <div className="shrink-0">
          <p className="text-[10.5px] font-medium text-ink-soft">{salutation}{firstName ? `, ${firstName}` : ""}</p>
          <h2 className="mt-0.5 text-[19px] font-bold leading-tight tracking-tight text-ink">{lender}</h2>
        </div>

        {/* THE LIVE LINE */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ...SPRING }}
          onClick={() => onOpen(byId(lead?.open ?? "ask"))}
          className="mt-2.5 flex shrink-0 items-center gap-2.5 rounded-2xl border border-line px-3 py-2.5 text-left shadow-sm backdrop-blur transition-all hover:border-[color:var(--brand)] active:scale-[0.985]"
          style={{ background: "var(--os-paper-soft)" }}
        >
          {lead ? (
            <>
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${lead.tone === "good" ? "bg-emerald-500" : lead.tone === "warn" ? "bg-amber-500" : "bg-sky-500"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold leading-tight text-ink">{lead.title}</span>
                {lead.detail && <span className="mt-0.5 block truncate text-[10.5px] leading-tight text-ink-soft">{lead.detail}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold leading-tight text-ink">{sw ? "Hakuna kinachokuhitaji sasa" : "Nothing needs you right now"}</span>
                <span className="mt-0.5 block truncate text-[10.5px] leading-tight text-ink-soft">{sw ? "Niulize chochote — niko hapa." : "Ask me anything — I'm right here."}</span>
              </span>
            </>
          )}
        </motion.button>

        {/* THE GRID — four across, two rows. */}
        <div className="mt-4 grid shrink-0 grid-cols-4 gap-x-2 gap-y-3">
          {GRID_APPS.map((app, i) => {
            const Glyph = ICONS[app.icon] ?? MessageCircle;
            return (
              <motion.button
                key={app.id}
                type="button"
                onClick={() => onOpen(app)}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + i * 0.035, ...SPRING }}
                whileTap={{ scale: 0.9 }}
                className="group flex min-w-0 flex-col items-center gap-1.5"
                title={app.blurb}
              >
                <span
                  className="relative flex aspect-square w-full items-center justify-center rounded-[18px] shadow-lg ring-1 ring-inset ring-white/30"
                  style={{ background: `linear-gradient(147deg, ${app.tile.from}, ${app.tile.to})`, boxShadow: "0 10px 18px -8px rgb(15 23 42 / 0.35)" }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[18px]" style={{ background: "linear-gradient(150deg, rgb(255 255 255 / 0.42), transparent 52%)" }} />
                  <Glyph className="relative h-[22px] w-[22px] text-white drop-shadow-sm" />
                </span>
                <span className="w-full truncate text-center text-[9.5px] font-semibold leading-tight text-ink">{app.name}</span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* THE DOCK — frosted, a layer above the wallpaper. */}
        <div className="mt-3 shrink-0 rounded-[26px] border border-line p-2 shadow-lg backdrop-blur-xl" style={{ background: "var(--os-paper-soft)" }}>
          <div className="grid grid-cols-4 gap-2">
            {DOCK_APPS.map((app) => {
              const Glyph = ICONS[app.icon] ?? MessageCircle;
              const n = badgeFor(app);
              return (
                <motion.button
                  key={app.id}
                  type="button"
                  onClick={() => onOpen(app)}
                  whileTap={{ scale: 0.88 }}
                  className="relative flex aspect-square items-center justify-center rounded-[17px] shadow-md ring-1 ring-inset ring-white/30"
                  style={{ background: `linear-gradient(147deg, ${app.tile.from}, ${app.tile.to})` }}
                  aria-label={app.name}
                  title={app.name}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[17px]" style={{ background: "linear-gradient(150deg, rgb(255 255 255 / 0.4), transparent 52%)" }} />
                  <Glyph className="relative h-5 w-5 text-white" />
                  {n > 0 && (
                    <span className="os-badge absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <p className="mt-2 shrink-0 text-center text-[9px] leading-snug text-ink-faint">
          {sw ? "Riri anajibu kutoka kwa akaunti yako — mtu yuko ujumbe mmoja mbali" : "Riri answers from your own account — a person is one message away"}
        </p>
      </div>
    </motion.div>
  );
}
