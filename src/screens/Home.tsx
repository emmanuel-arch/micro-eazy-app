// ─────────────────────────────────────────────────────────────────────────────
// HOME — the screen the whole app is judged on in the first four seconds.
//
// The layout is the one Safaricom's mini-apps use, and it is used here for a
// reason rather than as homage: a saturated brand SKY at the top, and the real
// content on CARDS THAT OVERLAP IT. The overlap is the entire trick. It puts the
// most important number — what this person can borrow — on a surface that is
// definitely readable, while the brand still owns the top third. A gradient with
// text sitting directly on it looks like a splash screen; a card lifted onto it
// looks like a bank.
//
// The order down the page is the order of the questions a borrower actually
// asks, which is not the order a lender would put them in:
//   1. How much can I get, and what do I owe?      (the balance)
//   2. What can I do right now?                     (the four tiles)
//   3. Why did you decide that?                     (the reason strip)
//   4. Has anyone told me anything?                 (the lender's own messages)
//
// ── ON THE DESKTOP SPLIT ────────────────────────────────────────────────────
// Above `xl` this becomes two columns, and which things move right is not
// arbitrary. The left column is everything the customer CAME to do — the
// balance, the actions, the reason behind the number. The right column is
// everything that is true whether or not they act: what is next, what the lender
// has said, what they might want to learn. On a phone that same split becomes
// simple vertical order, because a phone has no right-hand side.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Banknote, Gauge, ShieldCheck, FileText, Landmark, ChevronRight,
  CalendarClock, MessageSquareText, CloudOff, ScanFace, Route as RouteIcon,
  PiggyBank, Smartphone,
} from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { LiquidButton } from "../components/ui/LiquidButton";
import { Artwork } from "../components/media/Artwork";
import { ChannelBadge } from "../components/shell/ChannelBadge";
import { PayNow } from "../components/money/PayNow";
import { shortDate, sinceNow } from "../lib/format";
import type { HomeResponse } from "../lib/api/portal";
import { SAMPLE_HOME } from "../lib/api/samples";
import { useSession } from "../lib/session";

const kes = (n: number) => `KSh ${n.toLocaleString("en-KE")}`;

/**
 * How the score is coloured. The model hands back a tone rather than the screen
 * deriving one from the number, because the threshold between "moderate" and
 * "high" is a property of the model's probability of default and not of the
 * 300–900 figure it is projected onto.
 */
const SCORE_TONE: Record<"good" | "warn" | "high" | "bad", { ink: string; fill: string }> = {
  good: { ink: "var(--green-ink)", fill: "linear-gradient(90deg, var(--green), var(--lime))" },
  warn: { ink: "#b45309", fill: "linear-gradient(90deg, #f59e0b, #fbbf24)" },
  high: { ink: "#c2410c", fill: "linear-gradient(90deg, #ea580c, #fb923c)" },
  bad: { ink: "#be123c", fill: "linear-gradient(90deg, #e11d48, #fb7185)" },
};

/** Short enough to be read while walking. Each answers a question people
 *  actually ask a call centre, which is why they are here and not in a FAQ. */
const TIPS = [
  { slot: "tip-credit-score", motif: 0 as const, title: "What is a credit score?", body: "What it measures, and why yours moves every time you repay." },
  { slot: "tip-what-moves-limit", motif: 1 as const, title: "What moves your limit", body: "The four things we look at, in plain language." },
  { slot: "tip-charges", motif: 2 as const, title: "Understanding the charges", body: "What you pay, when, and what happens if you are late." },
];

const ACTIONS = [
  { icon: Banknote, label: "New loan", note: "Decision in minutes", tint: "#5ec22a", to: "/join" },
  { icon: Landmark, label: "Repay", note: "M-PESA or Ratiba", tint: "#5b8cff", to: "/repay" },
  { icon: Gauge, label: "My score", note: "Out of 900", tint: "#f0a92b", to: "/score" },
  // Straight to the one step, not to the top of the wizard. `?step=` is a
  // presenter and grants nothing — see the note in onboarding/Onboarding.tsx.
  { icon: FileText, label: "Statements", note: "Crunch a new one", tint: "#a78bfa", to: "/join?step=statement" },
];

export default function Home({
  data = SAMPLE_HOME,
  /** Refetch after a prompt is raised, so the balance catches up on its own. */
  onRefresh,
}: {
  data?: HomeResponse;
  onRefresh?: () => void;
}) {
  const used = data.limit > 0 ? data.outstanding / data.limit : 0;
  const loan = data.activeLoan;
  const { nationalId, phoneMasked } = useSession();
  const [paying, setPaying] = useState(false);

  // ── "WE COULD NOT ASK" IS NOT "YOU OWE NOTHING" ──────────────────────────
  // On a bridged lender the balance comes from THEIR book over THEIR API. When
  // that call fails, every money field on this response is zero — and zero
  // renders as a customer who is completely clear. Showing an outage as good
  // news is the single worst thing this screen could do, so the whole money
  // card changes shape rather than rendering figures nobody stands behind.
  const bookDown = data.bookSource === "unavailable";
  // The commit buttons navigate imperatively rather than being wrapped in a
  // Link: an <a> around a <button> is two nested interactive elements, which
  // screen readers announce twice and keyboards tab into twice.
  const go = useNavigate();

  return (
    <>
      <Sky title={data.firstName ? `Hello, ${data.firstName}` : "Hello"}>
        <p className="max-w-[34ch] text-[13px] leading-relaxed text-sky-ink-soft">
          Your limit is reviewed every time you repay. Nothing here is decided by a person.
        </p>
      </Sky>

      {/* `relative z-10` is load-bearing, not tidiness. The Sky is a positioned
          element, so it paints ABOVE any static sibling regardless of DOM order —
          which meant the header covered the top of this card and swallowed both
          the label and the tier badge. Only visible in the light theme, because
          in the dark one the card is translucent and it read as a tint. */}
      <div className="relative z-10 -mt-12">
        <ChannelBadge />

        <div className="px-4 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start xl:gap-4">
          {/* ── LEFT: what you came to do. ───────────────────────────────── */}
          <div className="space-y-3">
            <section className="card p-5">
              {bookDown ? (
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: "color-mix(in oklab, #f59e0b 16%, transparent)", color: "#b45309" }}
                  >
                    <CloudOff className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">We could not reach {data.lender}</p>
                    <p className="mt-1 max-w-[40ch] text-[12.5px] leading-relaxed text-ink-soft">
                      Your balance and limit live on their system and it did not answer just now. Nothing has changed —
                      we simply cannot show you the figures until it does.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── THE THREE NUMBERS, SIDE BY SIDE ────────────────────
                      This card showed one figure — what you can borrow — and a
                      customer's two other standing questions ("what have I put
                      aside?", "what do I still owe?") were nowhere on the
                      screen the app is judged by.

                      They belong TOGETHER because they are read together: the
                      three of them are a position, and a position read one
                      number at a time is not a position. Borrowing headlines
                      because it is why most people open the app; savings and
                      the balance sit beside it at a smaller weight, which is
                      hierarchy rather than omission. */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                        Available to borrow
                      </p>
                      <p className="tnum mt-1 text-[34px] font-bold leading-none tracking-[-0.03em]">
                        {kes(data.available)}
                      </p>
                      <p className="mt-1.5 text-[12px] text-ink-soft">of {kes(data.limit)} limit</p>
                    </div>
                    {/* The band is the risk tier and a customer may not have one
                        yet. An empty pill reading "undefined" is worse than no
                        pill, so it renders only when there is something in it. */}
                    {data.band && (
                      <span
                        className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ background: "color-mix(in oklab, var(--lime) 22%, transparent)", color: "var(--green-ink)" }}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.4} /> {data.band}
                      </span>
                    )}
                  </div>

                  {/* The bar carries the same information as the numbers above it,
                      which is the point: a number is read, a bar is GLANCED. */}
                  <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-sunk)" }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.max(used * 100, data.outstanding > 0 ? 6 : 0)}%`,
                        background: "linear-gradient(90deg, var(--green), var(--lime))",
                      }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {/* ── SAVINGS ──────────────────────────────────────────
                        `Transactions.dbo.AccountSavings` on the lender's book —
                        where an overpayment goes when their RepaymentTrigger
                        has cleared the loan and money is left over. Customers
                        have been accruing this for years with no way to see it.

                        `null` is "we could not ask" and renders as a dash. A
                        present zero is "you have saved nothing yet" and renders
                        as KSh 0, which is a true and useful statement. Showing
                        the first as the second is the same error as showing an
                        outage as a cleared balance. */}
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-sunk)" }}>
                      <div className="flex items-center gap-1.5">
                        <PiggyBank className="h-3.5 w-3.5 shrink-0" strokeWidth={2.3} style={{ color: "var(--green-ink)" }} />
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint">Savings</p>
                      </div>
                      <p className="tnum mt-1 text-[19px] font-bold leading-none tracking-[-0.02em]">
                        {data.savings ? kes(data.savings.balance) : "—"}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-ink-faint">
                        {!data.savings
                          ? "We could not read this just now"
                          : data.savings.lastAt
                            ? `Last movement ${shortDate(data.savings.lastAt)}`
                            : "Nothing put aside yet"}
                      </p>
                    </div>

                    {/* ── OUTSTANDING ──────────────────────────────────────
                        The other half of the position. Coloured only when
                        there IS a balance: a green zero and a red 12,500 in the
                        same slot is how a glance goes wrong. */}
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-sunk)" }}>
                      <div className="flex items-center gap-1.5">
                        <Landmark className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2.3} />
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint">
                          You owe
                        </p>
                      </div>
                      <p
                        className="tnum mt-1 text-[19px] font-bold leading-none tracking-[-0.02em]"
                        style={data.outstanding > 0 ? { color: "#b45309" } : undefined}
                      >
                        {kes(data.outstanding)}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-ink-faint">
                        {data.outstanding > 0
                          ? `Across ${data.loanCount} loan${data.loanCount === 1 ? "" : "s"}`
                          : "Nothing outstanding"}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* ── THE COMMIT ROW ───────────────────────────────────────────
                  "Repay" used to navigate to a screen. Pay Now raises the
                  M-PESA prompt from here, which is the difference between
                  telling somebody where to go and letting them do it: every
                  shilling on this book has previously arrived because somebody
                  was chased for it.

                  It stays second to "Apply" only when there is nothing owed.
                  With a live balance, paying is the more useful act and the
                  buttons swap emphasis — the screen should lead with what this
                  particular customer's position calls for. */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {data.outstanding > 0 ? (
                  <>
                    <LiquidButton
                      icon={Smartphone}
                      trailingIcon={ArrowRight}
                      size="lg"
                      block
                      onClick={() => setPaying(true)}
                    >
                      Pay now
                    </LiquidButton>
                    <LiquidButton variant="metal" size="lg" block onClick={() => go("/join")}>
                      Apply for a loan
                    </LiquidButton>
                  </>
                ) : (
                  <>
                    <LiquidButton icon={Banknote} trailingIcon={ArrowRight} size="lg" block onClick={() => go("/join")}>
                      Apply for a loan
                    </LiquidButton>
                    <LiquidButton variant="metal" icon={Smartphone} size="lg" block onClick={() => setPaying(true)}>
                      Pay now
                    </LiquidButton>
                  </>
                )}
              </div>
            </section>

            {/* ── THE TWO THINGS THAT OUTRANK EVERYTHING BELOW ──────────────
                An unverified ID and an application mid-workflow are both states
                where the customer's next action is NOT "apply for a loan" — and
                leaving the apply button as the loudest thing on the screen sends
                them into a funnel that will refuse them at the end. */}
            {data.kycStatus !== "VERIFIED" && data.kycStatus !== "NONE" && (
              <Link to="/identity" className="card flex w-full items-center gap-3 p-4 text-left">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: "color-mix(in oklab, #818cf8 18%, transparent)", color: "#4f46e5" }}
                >
                  <ScanFace className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-tight">
                    {data.kycStatus === "PENDING_REVIEW" ? "Your ID is with our team" : "Finish verifying your ID"}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                    {data.kycStatus === "PENDING_REVIEW"
                      ? "A person is checking it. We will message you the moment it clears."
                      : "You cannot borrow until this is done. It takes about a minute."}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </Link>
            )}

            {data.application && (
              <Link to="/track" className="card flex w-full items-center gap-3 p-4 text-left">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: "color-mix(in oklab, var(--lime) 22%, transparent)", color: "var(--green-ink)" }}
                >
                  <RouteIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-tight">
                    {kes(data.application.amount)} on {data.application.product ?? "your application"}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                    {data.application.stageTitle
                      ? `With ${data.application.stageTitle} — follow it through every stage.`
                      : "In progress — follow it through every stage."}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </Link>
            )}

            <section className="grid grid-cols-2 gap-3">
              {ACTIONS.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="card group flex items-start gap-3 p-4 text-left transition-transform duration-200 active:scale-[0.985]"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${a.tint} 16%, transparent)`, color: a.tint }}
                  >
                    <a.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold leading-tight">{a.label}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">{a.note}</span>
                  </span>
                </Link>
              ))}
            </section>

            {/* ── THE SCORE ────────────────────────────────────────────────
                A real number on a real scale, 300–900, that moves with every
                repayment — which is the entire behavioural promise of a lending
                app and was previously a link to a screen.

                It renders ONLY when there is a score. A customer who has not
                been scored has no score, which is different from a bad one, and
                a gauge sitting at zero says the second. The link below survives
                either way, because "how is my limit set" is a fair question
                whether or not there is a number yet. */}
            {data.score != null && (
              <Link to="/score" className="card block p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                      Your credit score
                    </p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span
                        className="tnum text-[34px] font-bold leading-none tracking-[-0.03em]"
                        style={{ color: SCORE_TONE[data.scoreTone ?? "warn"].ink }}
                      >
                        {data.score}
                      </span>
                      <span className="text-[14px] font-semibold text-ink-faint">/ {data.scoreMax}</span>
                    </p>
                    {data.band && <p className="mt-1.5 text-[12px] text-ink-soft">{data.band}</p>}
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint" />
                </div>

                {/* The scale starts at 300, not 0 — a 584 drawn on a 0–900 bar
                    reads as two thirds of the way along, and on the scale the
                    number actually lives on it is closer to a half. Drawing it
                    against the wrong floor flatters every customer. */}
                <div className="mt-4 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-sunk)" }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(2, ((data.score - 300) / (data.scoreMax - 300)) * 100))}%`,
                      background: SCORE_TONE[data.scoreTone ?? "warn"].fill,
                    }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10.5px] text-ink-faint">
                  <span className="tnum">300</span>
                  <span className="tnum">{data.scoreMax}</span>
                </div>

                {/* What moved it. The footer of this screen promises that every
                    decision on it can be explained on request — this is that
                    promise kept where the number is, rather than in a call. */}
                {data.scoreDrivers.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                    {data.scoreDrivers.slice(0, 3).map((d) => (
                      <li key={d.factor} className="flex items-center gap-2 text-[11.5px] leading-snug text-ink-soft">
                        <span
                          aria-hidden
                          className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                          style={{
                            background:
                              d.direction === "reduces"
                                ? "color-mix(in oklab, var(--green) 20%, transparent)"
                                : "color-mix(in oklab, #f59e0b 22%, transparent)",
                            color: d.direction === "reduces" ? "var(--green-ink)" : "#b45309",
                          }}
                        >
                          {d.direction === "reduces" ? "↑" : "↓"}
                        </span>
                        <span className="min-w-0 truncate">{d.factor}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            )}

            {/* The commitment, not a footnote. */}
            <Link to="/score" className="card flex w-full items-center gap-3 p-4 text-left">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ background: "color-mix(in oklab, var(--navy) 12%, transparent)", color: "var(--navy-ink)" }}
              >
                <Gauge className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-tight">
                  {data.limit > 0 ? `Why your limit is ${kes(data.limit)}` : "How your limit is set"}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                  The four things that moved your score, in plain language.
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </Link>

            {/* ── The schedule. ────────────────────────────────────────────
                Every collections call centre in Kenya exists largely to answer
                "how much do I still owe and when is the next one" down a phone.
                It is not a hard question. It has simply never been on the
                customer's own screen — so putting it here removes calls rather
                than deflecting them, which is a different and better thing. */}
            {/* Rendered only when there IS one. A bridged lender's loan feed
                carries no instalment breakdown, so an empty table under the
                heading "Your schedule" would read as a loan with no repayments
                due — the opposite of the truth. Silence is the honest state. */}
            {data.schedule.length > 0 && (
              <section className="card overflow-hidden">
                <div
                  className="flex items-center gap-2.5 border-b px-5 py-3.5"
                  style={{ borderColor: "var(--line)" }}
                >
                  <p className="flex-1 text-[13px] font-semibold">Your schedule</p>
                  <span className="tnum text-[11.5px] text-ink-faint">
                    {data.schedule.filter((s) => s.status === "PAID").length} of {data.schedule.length} paid
                  </span>
                  <Link to="/repay" className="text-[12px] font-semibold" style={{ color: "var(--green-ink)" }}>
                    See all
                  </Link>
                </div>

                <ul>
                  {data.schedule.slice(0, 5).map((s, i, rows) => {
                    const paid = s.status === "PAID";
                    // "Next" is the first row that is not yet paid — a position,
                    // not a status the server sends. Deriving it here means the
                    // highlight cannot disagree with the list it sits in.
                    const next = !paid && rows.slice(0, i).every((r) => r.status === "PAID");
                    return (
                      <li
                        key={s.seq}
                        className="flex items-center gap-3 border-b px-5 py-3 last:border-b-0"
                        style={{
                          borderColor: "var(--line)",
                          background: next ? "color-mix(in oklab, var(--lime) 9%, transparent)" : undefined,
                        }}
                      >
                        <span
                          className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-bold"
                          style={{
                            background: paid
                              ? "color-mix(in oklab, var(--green) 18%, transparent)"
                              : "var(--surface-sunk)",
                            color: paid ? "var(--green-ink)" : "var(--ink-faint)",
                          }}
                        >
                          {paid ? "✓" : s.seq}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium leading-tight">{shortDate(s.due)}</span>
                          <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                            {paid ? "Paid" : s.status === "OVERDUE" ? "Overdue" : next ? "Next" : "Scheduled"}
                          </span>
                        </span>
                        <span
                          className="tnum shrink-0 text-[13.5px] font-semibold"
                          style={{ color: paid ? "var(--ink-faint)" : "var(--ink)" }}
                        >
                          {kes(s.amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>

          {/* ── RIGHT: what is true whether or not you act. ──────────────── */}
          <aside className="mt-3 space-y-3 xl:mt-0">
            {/* What is next. The single most asked question in any collections
                call centre, answered before anybody has to ring. */}
            <section className="card p-5">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: "color-mix(in oklab, #5b8cff 16%, transparent)", color: "#3f6fd8" }}
                >
                  <CalendarClock className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <p className="text-[13px] font-semibold">Your next payment</p>
              </div>

              {loan?.nextDue ? (
                <>
                  <p className="tnum mt-3 text-[26px] font-bold leading-none tracking-[-0.02em]">
                    {kes(loan.nextDue.amount)}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-soft">due {shortDate(loan.nextDue.date)}</p>
                  <LiquidButton size="sm" block className="mt-3" onClick={() => go("/repay")}>
                    Repay now
                  </LiquidButton>
                </>
              ) : loan ? (
                // A loan whose instalment breakdown we do not hold. Saying the
                // BALANCE is honest; inventing a "next payment" from it would put
                // a date and a figure on screen that the lender never quoted —
                // and it is precisely the figure a customer would then pay.
                <>
                  <p className="tnum mt-3 text-[26px] font-bold leading-none tracking-[-0.02em]">
                    {kes(loan.balance)}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-soft">outstanding on {loan.product ?? "your loan"}</p>
                  <p className="mt-3 text-[11.5px] leading-snug text-ink-faint">
                    Your lender holds the instalment dates for this loan. Open Repay to pay any amount towards it.
                  </p>
                  <LiquidButton size="sm" block className="mt-3" onClick={() => go("/repay")}>
                    Repay
                  </LiquidButton>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[13px] font-semibold">Nothing due</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                    You have no running loan. When you take one, the next payment appears here.
                  </p>
                </>
              )}
            </section>

            {/* ── REAL CONVERSATIONS, NOT A BROADCAST ────────────────────
                This panel used to render two invented messages from "Micromart
                Fintech". It now shows the customer's own threads — the ones an
                officer is actually answering — so tapping a row opens the reply
                rather than a dead notification. A channel used for marketing
                stops being read, and then the message that mattered goes unread
                with it, which is why nothing but real correspondence is here. */}
            <section className="card overflow-hidden">
              <div className="flex items-center gap-2.5 border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
                <MessageSquareText className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2.1} />
                <p className="flex-1 text-[13px] font-semibold">Messages</p>
                {data.unreadMessages > 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                    style={{ background: "color-mix(in oklab, var(--lime) 24%, transparent)", color: "var(--green-ink)" }}
                  >
                    {data.unreadMessages} new
                  </span>
                )}
              </div>

              {data.messages.length === 0 ? (
                <div className="px-5 py-5">
                  <p className="text-[12.5px] leading-relaxed text-ink-faint">
                    Nothing yet. If anything about your account or an application is unclear, write to us and a real
                    person answers.
                  </p>
                  <LiquidButton size="sm" variant="metal" block className="mt-3" onClick={() => go("/messages/new")}>
                    Write to us
                  </LiquidButton>
                </div>
              ) : (
                <ul>
                  {data.messages.map((m) => (
                    <li key={m.id} style={{ borderColor: "var(--line)" }} className="border-b last:border-b-0">
                      <Link to={`/messages/${m.id}`} className="flex gap-2.5 px-5 py-3.5 text-left">
                        <span
                          aria-hidden
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: m.unread ? "var(--green-ink)" : "transparent" }}
                        />
                        <span className="min-w-0">
                          <span className="flex items-baseline gap-2">
                            <span className="truncate text-[12px] font-semibold">{m.subject}</span>
                            <span className="shrink-0 text-[11px] text-ink-faint">{sinceNow(m.at)}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-ink-soft">
                            {m.fromStaff ? "" : "You: "}
                            {m.preview}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Advice and tips. A lending app that only ever asks for things is
                a lending app people close. */}
            <section>
              <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
                <h2 className="text-[15px] font-bold tracking-[-0.015em]">Advice and tips</h2>
                <button className="text-[12.5px] font-semibold" style={{ color: "var(--green-ink)" }}>
                  View all
                </button>
              </div>

              {/* A scrolling row on a phone — bleeding to the edge, so a clipped
                  card is the affordance. A plain stack on a desktop, where the
                  column has the height and horizontal scrolling is a nuisance. */}
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0 [&::-webkit-scrollbar]:hidden">
                {TIPS.map((t) => (
                  <article
                    key={t.slot}
                    className="card w-[228px] shrink-0 snap-start overflow-hidden xl:flex xl:w-auto xl:shrink"
                  >
                    <Artwork
                      slot={t.slot}
                      motif={t.motif}
                      rounded="rounded-none"
                      className="xl:h-full xl:w-[104px] xl:shrink-0"
                    />
                    <div className="p-3.5">
                      <h3 className="text-[13.5px] font-semibold leading-tight">{t.title}</h3>
                      <p className="mt-1 text-[11.5px] leading-snug text-ink-faint">{t.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <p className="px-5 pb-2 pt-4 text-center text-[11px] leading-relaxed text-ink-faint">
          Micro Eazy is a technology platform. Your loan is funded by a licensed lender, and every decision on this
          screen can be explained to you on request.
        </p>
      </div>

      {/* ── PAY NOW ─────────────────────────────────────────────────────────
          Mounted at the screen level rather than inside the card, because it is
          a modal over the whole page and a sheet rendered inside a `relative
          z-10` column inherits that column's stacking context.

          `nationalId` comes from the session — the server holds it and hands it
          back, so it survives a closed tab and the password door, neither of
          which the old sessionStorage copy did. */}
      <PayNow
        open={paying}
        onClose={() => setPaying(false)}
        nationalId={nationalId ?? ""}
        outstanding={data.outstanding}
        phone={phoneMasked}
        onPushed={onRefresh}
      />
    </>
  );
}
