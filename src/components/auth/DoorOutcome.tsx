// ─────────────────────────────────────────────────────────────────────────────
// WHAT HAPPENS WHEN THE NUMBER BELONGS SOMEWHERE ELSE.
//
// The create-account door asks the lender where a phone number lives before it
// sends a code. Every answer that is not "a new customer" used to arrive as a
// red line under the field — "an account already exists", "we could not check" —
// which names a problem and leaves the customer to find the door themselves.
//
// These panels are the doors. Each one says what is true in one sentence and
// then offers exactly the actions that fix it, with the most useful one first:
//
//   other book   the number is on Micromart Africa's book → call customer support
//                (no link to any other app — the two apps are not linked)
//   pipeline     a countdown to the day they cross to Fintech, the date we will
//                text them, and customer support if they need a loan before then
//   both         a case reference already raised, and the two ways to reach IT
//   unreachable  try again — and an explicit promise that nothing is wrong with
//                the number, because "we could not check" read as a refusal is
//                how a duplicate account gets opened
//
// The one answer that needs no reading at all — an existing Fintech account — is
// not a panel: it becomes the sign-in page with the number already filled in.
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from "framer-motion";
import { ArrowLeft, BellRing, CalendarCheck, LifeBuoy, Mail, Phone, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { LiquidButton } from "../ui/LiquidButton";
import type { PrecheckAnswer } from "../../lib/api/portal";
import { longDate } from "../../lib/format";

type Panel = Extract<PrecheckAnswer, { route: "africa-active" | "africa-portal" | "africa-pipeline" | "both" | "unreachable" }>;

/** Micromart customer support — used if the server's answer carries none. */
const AFRICA_SUPPORT_PHONE = "0740961275";

const enter = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const } };

export function DoorOutcome({
  outcome,
  lenderShort,
  phoneLabel,
  onBack,
  onRetry,
  retrying,
}: {
  outcome: Panel;
  lenderShort: string;
  phoneLabel: string;
  onBack: () => void;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <motion.div key={outcome.route} {...enter}>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-faint transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
        Use a different number
      </button>

      {(outcome.route === "africa-active" || outcome.route === "africa-portal") && (
        <section>
          <Glyph tone="brand"><LifeBuoy className="h-5 w-5" strokeWidth={2.2} /></Glyph>
          <h1 className="mt-4 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">Your account is with {lenderShort} Africa.</h1>
          <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-ink-soft">
            {phoneLabel} is registered on {lenderShort}'s field book, so an account cannot be opened for it here.{" "}
            <strong className="font-semibold text-ink">Please contact {lenderShort} customer support</strong> and they will help you with your loans.
          </p>
          <SupportCall phone={outcome.support?.phone ?? AFRICA_SUPPORT_PHONE} />
        </section>
      )}
      {outcome.route === "africa-pipeline" && <Pipeline outcome={outcome} lenderShort={lenderShort} phoneLabel={phoneLabel} />}
      {outcome.route === "both" && <BothBooks outcome={outcome} lenderShort={lenderShort} phoneLabel={phoneLabel} />}
      {outcome.route === "unreachable" && (
        <section>
          <Glyph tone="warn"><WifiOff className="h-5 w-5" strokeWidth={2.2} /></Glyph>
          <h1 className="mt-4 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">We could not check just now.</h1>
          <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-ink-soft">
            {lenderShort}'s system did not answer. <strong className="font-semibold text-ink">Nothing is wrong with your number</strong> — we
            simply could not ask whether it already has an account, and we will not guess.
          </p>
          <LiquidButton
            variant="solid"
            size="lg"
            block
            icon={RefreshCw}
            loading={retrying}
            disabled={retrying}
            onClick={onRetry}
            tone={{ fill: "var(--brand)", rim: "var(--brand-2)", ink: "var(--brand-on)" }}
            className="mt-6"
          >
            {retrying ? "Checking again" : "Try again"}
          </LiquidButton>
        </section>
      )}
    </motion.div>
  );
}

function Glyph({ tone, children }: { tone: "brand" | "warn" | "alert"; children: React.ReactNode }) {
  const style =
    tone === "brand"
      ? { background: "var(--brand-soft)", color: "var(--brand-ink)" }
      : tone === "warn"
        ? { background: "color-mix(in oklab, #f59e0b 16%, transparent)", color: "#b45309" }
        : { background: "color-mix(in oklab, #e11d48 12%, transparent)", color: "#be123c" };
  return <span className="grid h-12 w-12 place-items-center rounded-2xl" style={style}>{children}</span>;
}

/** The countdown to Fintech — a date, not a refusal. */
function Pipeline({ outcome, lenderShort, phoneLabel }: { outcome: Extract<Panel, { route: "africa-pipeline" }>; lenderShort: string; phoneLabel: string }) {
  const days = outcome.daysRemaining;
  const due = days != null && days <= 0;
  const R = 44;
  const C = 2 * Math.PI * R;
  // The ring fills as the sixty days pass, so a customer with 3 days to go sees
  // a nearly-closed circle rather than a small number.
  const filled = days == null ? 0.18 : Math.max(0.04, Math.min(1, (60 - days) / 60));

  return (
    <section>
      <div className="flex items-center gap-5">
        <div className="relative h-[112px] w-[112px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-sunk)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
              style={{ stroke: "var(--brand-ink)" }}
              initial={{ strokeDasharray: `0 ${C}` }}
              animate={{ strokeDasharray: `${C * filled} ${C}` }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            {days == null ? (
              <CalendarCheck className="h-7 w-7" style={{ color: "var(--brand-ink)" }} strokeWidth={2} />
            ) : (
              <span>
                <span className="tnum block text-[30px] font-bold leading-none tracking-[-0.03em] text-ink">{Math.max(0, days)}</span>
                <span className="mt-1 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  day{days === 1 ? "" : "s"} to go
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--brand-ink)" }}>
            On the way to {lenderShort} Fintech
          </p>
          <h1 className="mt-1.5 text-[24px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">
            {due ? "You move tonight." : "You can apply from home soon."}
          </h1>
        </div>
      </div>

      <p className="mt-5 max-w-[42ch] text-[14px] leading-relaxed text-ink-soft">
        {phoneLabel} is on {lenderShort}'s field book, and your loans there are settled. Customers move to {lenderShort} Fintech — where
        this app lends — 60 days after their last loan is cleared.{" "}
        {outcome.eligibleOn && !due ? (
          <>That is <strong className="font-semibold text-ink">{longDate(outcome.eligibleOn)}</strong>.</>
        ) : due ? (
          <>Your 60 days are up, and the move runs overnight.</>
        ) : (
          <>We are confirming your exact date now.</>
        )}
      </p>

      <div className="assurance mt-5 flex items-start gap-3 p-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
          <BellRing className="h-[17px] w-[17px]" strokeWidth={2.3} />
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">You do not need to do anything.</strong> {lenderShort} will text {phoneLabel} the day your account
          moves, with your new PIN instructions. Come back then and your account will be ready.
        </p>
      </div>

      <p className="mt-5 text-[13.5px] font-semibold text-ink">Need a loan before then?</p>
      <SupportCall phone={outcome.support?.phone ?? AFRICA_SUPPORT_PHONE} />
    </section>
  );
}

/** Customer support as a tap-to-call row — the only way out of these panels. */
function SupportCall({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone.replace(/\s/g, "")}`}
      className="mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors hover:bg-surface-sunk"
      style={{ borderColor: "var(--line-strong)" }}
    >
      <Phone className="h-4 w-4 shrink-0" style={{ color: "var(--brand-ink)" }} strokeWidth={2.2} />
      <span className="min-w-0">
        <span className="block text-[12px] text-ink-faint">Customer support</span>
        <span className="tnum block text-[15px] font-semibold text-ink">{phone}</span>
      </span>
    </a>
  );
}

/** The one case that needs a person — raised already, with a reference. */
function BothBooks({ outcome, lenderShort, phoneLabel }: { outcome: Extract<Panel, { route: "both" }>; lenderShort: string; phoneLabel: string }) {
  return (
    <section>
      <Glyph tone="alert"><ShieldAlert className="h-5 w-5" strokeWidth={2.2} /></Glyph>
      <h1 className="mt-4 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">This number has two accounts.</h1>
      <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-ink-soft">
        {phoneLabel} is registered on both of {lenderShort}'s books. Opening either one could show you a balance that is not yours, so we have
        stopped here and <strong className="font-semibold text-ink">raised it with {lenderShort}'s IT team</strong> to merge them.
      </p>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--line-strong)", background: "var(--surface)" }}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            <LifeBuoy className="h-4 w-4" strokeWidth={2.2} /> Your case
          </span>
          <span className="tnum rounded-lg px-2.5 py-1 font-mono text-[13px] font-bold tracking-[0.04em] text-ink" style={{ background: "var(--surface-sunk)" }}>
            {outcome.caseRef}
          </span>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">Quote this reference and they will find it straight away.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href={`tel:${outcome.support.phone.replace(/\s/g, "")}`} className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-sunk" style={{ borderColor: "var(--line)" }}>
            <Phone className="h-4 w-4 shrink-0" style={{ color: "var(--brand-ink)" }} strokeWidth={2.2} />
            <span className="tnum truncate">{outcome.support.phone}</span>
          </a>
          <a href={`mailto:${outcome.support.email}?subject=${encodeURIComponent(`Two accounts on one number — ${outcome.caseRef}`)}`} className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-sunk" style={{ borderColor: "var(--line)" }}>
            <Mail className="h-4 w-4 shrink-0" style={{ color: "var(--brand-ink)" }} strokeWidth={2.2} />
            <span className="truncate">{outcome.support.email}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export default DoorOutcome;
