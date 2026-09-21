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
// ── ONE PANE (21 Sep 2026) ──────────────────────────────────────────────────
// On a laptop this screen sits in the fixed frame (see components/shell/Deck.tsx
// and the landscape note in AppShell) and does not scroll. It used to be a deck
// of three panes — YOUR MONEY, then HELP & FAQS, then YOUR STANDING (the score
// in full and the schedule). It is now the first pane alone:
//
//   YOUR MONEY   What can I get, why, what do I owe, what is due, who wrote to
//                me — and anything blocking (an unverified ID, an application
//                mid-flight). The three explainers stay as one-line rows under
//                Messages; "Read more" opens /help at that topic.
//
// Help & FAQs is its own screen now (screens/Help.tsx, in the rail under
// Account). The standing pane is gone: the score chip beside the limit links to
// /score, which is the same figure with every reason behind it, and the ledger
// is Repay's. The first screen after sign-in is the one the demo is judged on in
// its first seconds; it should carry the money and nothing that is not.
//
// On a phone the pane is a plain vertical stack, so the handset layout is
// unchanged and still the design target.
//
// ── THE NUMBER AND ITS REASON TRAVEL TOGETHER ───────────────────────────────
// The tier badge beside "Available to borrow" used to read "Major risk" — a
// generic label from a model, in a shield, next to the amount. It said something
// unpleasant without saying anything useful, and the actual credit score (a real
// figure on a real scale that moves with every repayment) was in a card further
// down the page that most people never reached.
//
// So the SCORE is what sits beside the limit now, and "Why your limit is KSh
// 50,000" is directly under it. A number and the reason for it, in one glance,
// on the first pane — which is the promise the footer of this app makes.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Banknote, Gauge, FileText, Landmark, ChevronRight,
  CalendarClock, MessageSquareText, CloudOff, ScanFace, Route as RouteIcon,
  PiggyBank, Smartphone, BookOpen,
} from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { Deck, type Pane } from "../components/shell/Deck";
import { HELP_TOPICS } from "../lib/help/content";
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

const ACTIONS = [
  { icon: Banknote, label: "New loan", note: "Decision in minutes", tint: "#5ec22a", to: "/apply" },
  { icon: Landmark, label: "Repay", note: "M-PESA or Ratiba", tint: "#5b8cff", to: "/repay" },
  { icon: Gauge, label: "My score", note: "Out of 900", tint: "#f0a92b", to: "/score" },
  { icon: FileText, label: "Statements", note: "Crunch a new one", tint: "#a78bfa", to: "/crunch" },
];

/**
 * ── THE THREE EXPLAINERS, ON PANE ONE ───────────────────────────────────────
 * They answer the three questions a call centre hears most, so they sit under
 * Messages — compact, one row each — and "Read more" opens Help & FAQs at that
 * topic.
 */
function AdviceCard() {
  const go = useNavigate();
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b px-5 py-3 lg:py-2.5" style={{ borderColor: "var(--line)" }}>
        <BookOpen className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2.1} />
        <p className="flex-1 text-[13px] font-semibold">Advice and tips</p>
      </div>
      <ul>
        {HELP_TOPICS.map((t) => (
          <li key={t.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0" style={{ borderColor: "var(--line)" }}>
            <Artwork slot={t.slot} motif={t.motif} rounded="rounded-lg" className="!h-10 !w-10 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold leading-tight">{t.title}</span>
              <span className="mt-0.5 block truncate text-[11px] leading-snug text-ink-faint">{t.teaser}</span>
            </span>
            <button
              type="button"
              onClick={() => go(`/help?topic=${t.id}`)}
              className="shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors hover:bg-surface-sunk"
              style={{ borderColor: "var(--line-strong)", color: "var(--brand-ink)" }}
            >
              Read more
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The shape every pane of this screen is laid out in.
 *
 * The split is the one the single column already implied and is now able to
 * honour: LEFT is what the customer came to do, RIGHT is what is true whether or
 * not they act. It starts at `lg` rather than `xl` because `lg` is where the
 * landscape rule begins — a pane that stayed one column between 1024 and 1280
 * would be the only place in the app tall enough to need scrolling, which is the
 * exact thing the deck exists to remove.
 */
function PaneGrid({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-3">{left}</div>
      {right && <div className="space-y-3">{right}</div>}
    </div>
  );
}

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
  // Three different reasons, three different sentences. Only "unreachable" is
  // an outage; the other two are a record only a person can put right, and
  // "try again in a moment" would send somebody round in circles.
  const bookCopy =
    data.bookIssue === "ambiguous"
      ? {
          title: "Your number is on more than one account",
          body: `${data.lender} holds more than one record on this phone number, so we will not guess which balance is yours. Write to us and a person will sort it out.`,
        }
      : data.bookIssue === "mismatch"
        ? {
            title: "This number's account is under a different ID",
            body: `The ${data.lender} account on this phone number does not carry the ID you verified with, so we are not showing it. Write to us and a person will check it.`,
          }
        : {
            title: `We could not reach ${data.lender}`,
            body: "Your balance and limit live on their system and it did not answer just now. Nothing has changed — we simply cannot show you the figures until it does.",
          };
  // The commit buttons navigate imperatively rather than being wrapped in a
  // Link: an <a> around a <button> is two nested interactive elements, which
  // screen readers announce twice and keyboards tab into twice.
  const go = useNavigate();

  const tone = SCORE_TONE[data.scoreTone ?? "warn"];

  // ── THE POSITION ──────────────────────────────────────────────────────────
  const money = (
    <section className="card p-5 lg:p-4">
      {bookDown ? (
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: "color-mix(in oklab, #f59e0b 16%, transparent)", color: "#b45309" }}
          >
            <CloudOff className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{bookCopy.title}</p>
            <p className="mt-1 max-w-[40ch] text-[12.5px] leading-relaxed text-ink-soft">{bookCopy.body}</p>
            {data.bookIssue && data.bookIssue !== "unreachable" && (
              <Link
                to="/messages/new"
                className="mt-2 inline-block text-[12.5px] font-semibold underline underline-offset-4"
                style={{ color: "var(--brand-ink)" }}
              >
                Write to us
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── THE THREE NUMBERS, SIDE BY SIDE ────────────────────────────
              This card showed one figure — what you can borrow — and a
              customer's two other standing questions ("what have I put aside?",
              "what do I still owe?") were nowhere on the screen the app is
              judged by.

              They belong TOGETHER because they are read together: the three of
              them are a position, and a position read one number at a time is
              not a position. Borrowing headlines because it is why most people
              open the app; savings and the balance sit beside it at a smaller
              weight, which is hierarchy rather than omission. */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                Available to borrow
              </p>
              {/* 30px below `sm`. The score chip beside it takes ~120px, and at
                  34px a six-figure limit wrapped onto two lines on a 390px
                  handset — the headline number of the whole app, broken across a
                  line by a chip that was added next to it. */}
              <p className="tnum mt-1 text-[30px] font-bold leading-none tracking-[-0.03em] sm:text-[34px]">
                {kes(data.available)}
              </p>
              <p className="mt-1.5 text-[12px] text-ink-soft">of {kes(data.limit)} limit</p>
            </div>

            {/* ── THE SCORE, WHERE THE BADGE USED TO BE ──────────────────
                This slot held the risk BAND — "Major risk" in a shield, in
                brand green. Three things wrong with it, and the third is the
                one that matters:

                  · The words were the model's, not the customer's. "Major
                    risk" is a tier name from an underwriting table.
                  · It was green. A warning rendered in the brand's own
                    reassurance colour is worse than no warning.
                  · It was not ACTIONABLE. A band cannot go up on Tuesday. A
                    score can, and does, every time somebody repays — which is
                    the entire behavioural promise of a lending app.

                So the real figure sits here instead, in the tone the model
                assigned it, linked to the screen that explains it. The band has
                not been deleted; it is on /score, where it belongs next to its
                own drivers.

                It renders only when there IS a score. A customer who has not
                been scored has no score, which is a different thing from a bad
                one — and a chip reading "— / 900" says the second. */}
            {data.score != null && (
              <Link
                to="/score"
                aria-label={`Your credit score is ${data.score} out of ${data.scoreMax}. See what moved it.`}
                className="group shrink-0 rounded-xl px-3 py-2 text-right transition-colors"
                style={{ background: "var(--surface-sunk)" }}
              >
                <span className="flex items-center justify-end gap-1.5">
                  <Gauge className="h-3 w-3" strokeWidth={2.5} style={{ color: tone.ink }} />
                  {/* "Score" on a handset. The chip sits beside the headline
                      figure, and every pixel of label here is a pixel the limit
                      does not have — at "Credit score" a six-figure limit wrapped
                      onto two lines at 390px. The gauge icon beside it carries
                      the rest of the meaning, and the link's aria-label says the
                      whole thing for anyone who cannot see either. */}
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint">
                    <span className="sm:hidden">Score</span>
                    <span className="hidden sm:inline">Credit score</span>
                  </span>
                </span>
                <span className="mt-1 flex items-baseline justify-end gap-1">
                  <span
                    className="tnum text-[22px] font-bold leading-none tracking-[-0.02em]"
                    style={{ color: tone.ink }}
                  >
                    {data.score}
                  </span>
                  <span className="tnum text-[12px] font-semibold text-ink-faint">/ {data.scoreMax}</span>
                </span>
                {/* The same 300-floor scale as /score, so the two can never
                    draw the same number at two different lengths. */}
                {/* Hidden on the narrowest handsets: it is a second, smaller
                    drawing of a number that is already right above it, and the
                    width it costs is width the limit needs more. */}
                <span
                  aria-hidden
                  className="mt-1.5 hidden h-1 w-[84px] overflow-hidden rounded-full sm:block"
                  style={{ background: "var(--line-strong)" }}
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(4, ((data.score - 300) / (data.scoreMax - 300)) * 100))}%`,
                      background: tone.fill,
                    }}
                  />
                </span>
              </Link>
            )}
          </div>

          {/* The bar carries the same information as the numbers above it,
              which is the point: a number is read, a bar is GLANCED. */}
          <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-sunk)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.max(used * 100, data.outstanding > 0 ? 6 : 0)}%`,
                // --brand-ink, not --brand: a lender accent is chosen to be read
                // on white, and Micromart's brown on the dark theme's track was a
                // bar nobody could see. --brand-ink is the accent in the light
                // theme and the accent lifted to 5:1 in the dark one.
                background: "var(--brand-ink)",
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* ── SAVINGS ──────────────────────────────────────────────────
                `Transactions.dbo.AccountSavings` on the lender's book — where
                an overpayment goes when their RepaymentTrigger has cleared the
                loan and money is left over. Customers have been accruing this
                for years with no way to see it.

                `null` is "we could not ask" and renders as a dash. A present
                zero is "you have saved nothing yet" and renders as KSh 0, which
                is a true and useful statement. Showing the first as the second
                is the same error as showing an outage as a cleared balance. */}
            <div className="rounded-xl p-3" style={{ background: "var(--surface-sunk)" }}>
              <div className="flex items-center gap-1.5">
                <PiggyBank className="h-3.5 w-3.5 shrink-0" strokeWidth={2.3} style={{ color: "var(--brand-ink)" }} />
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

            {/* ── OUTSTANDING ──────────────────────────────────────────────
                The other half of the position. Coloured only when there IS a
                balance: a green zero and a red 12,500 in the same slot is how a
                glance goes wrong. */}
            <div className="rounded-xl p-3" style={{ background: "var(--surface-sunk)" }}>
              <div className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2.3} />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint">You owe</p>
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

      {/* ── THE COMMIT ROW ───────────────────────────────────────────────────
          "Repay" used to navigate to a screen. Pay Now raises the M-PESA prompt
          from here, which is the difference between telling somebody where to go
          and letting them do it: every shilling on this book has previously
          arrived because somebody was chased for it.

          It stays second to "Apply" only when there is nothing owed. With a live
          balance, paying is the more useful act and the buttons swap emphasis —
          the screen should lead with what this particular customer's position
          calls for. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {data.outstanding > 0 ? (
          <>
            <LiquidButton icon={Smartphone} trailingIcon={ArrowRight} size="lg" block onClick={() => setPaying(true)}>
              Pay now
            </LiquidButton>
            <LiquidButton variant="metal" size="lg" block onClick={() => go("/apply")}>
              Apply for a loan
            </LiquidButton>
          </>
        ) : (
          <>
            <LiquidButton icon={Banknote} trailingIcon={ArrowRight} size="lg" block onClick={() => go("/apply")}>
              Apply for a loan
            </LiquidButton>
            <LiquidButton variant="metal" icon={Smartphone} size="lg" block onClick={() => setPaying(true)}>
              Pay now
            </LiquidButton>
          </>
        )}
      </div>
    </section>
  );

  // ── THE REASON, DIRECTLY UNDER THE NUMBER ────────────────────────────────
  // This strip was at the bottom of a long column. It is the app's commitment —
  // the footer promises every decision on this screen can be explained, and this
  // is where that promise is kept — so it now sits on the first pane, one line
  // below the limit it is explaining. Number, then why.
  const whyLimit = (
    <Link to="/score" className="card flex w-full items-center gap-3 p-4 text-left lg:py-3">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}
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
  );

  // ── THE TWO THINGS THAT OUTRANK EVERYTHING ELSE ──────────────────────────
  // An unverified ID and an application mid-workflow are both states where the
  // customer's next action is NOT "apply for a loan" — and leaving the apply
  // button as the loudest thing on the screen sends them into a funnel that will
  // refuse them at the end.
  //
  // They are on PANE ONE for the same reason they were at the top of the column:
  // a blocker a customer has to go looking for is not a blocker, it is a
  // surprise ninety seconds later.
  const prompts = (
    <>
      {/* A customer new to the lender's book who has not started KYC is asked
          to — an existing customer of the lender was verified at the branch
          and has no local KYC status to show, so NONE alone proves nothing. */}
      {(data.kycStatus === "IN_PROGRESS" || data.kycStatus === "FAILED" || data.kycStatus === "PENDING_REVIEW" ||
        (data.kycStatus === "NONE" && (data.bookSource === "onboarding" || data.bookSource === "native"))) && (
        <Link to="/kyc" className="card flex w-full items-center gap-3 p-4 text-left lg:py-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: "color-mix(in oklab, #818cf8 18%, transparent)", color: "#4f46e5" }}
          >
            <ScanFace className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold leading-tight">
              {data.kycStatus === "PENDING_REVIEW"
                ? "Your ID is with our team"
                : data.kycStatus === "NONE"
                  ? "Verify your identity to borrow"
                  : "Finish verifying your ID"}
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
        <Link to="/track" className="card flex w-full items-center gap-3 p-4 text-left lg:py-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}
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
    </>
  );

  // ── THE SHORTCUTS ─────────────────────────────────────────────────────────
  // Two up on a phone, where a tile has to be a thumb target and the page has
  // all the height it wants. FOUR ACROSS on a laptop, stacked icon-over-label,
  // because the landscape frame has width to spend and height it does not: the
  // 2×2 grid was 176px tall and was the thing that pushed this pane over the
  // fold, which on a screen whose whole promise is "nothing is below the fold"
  // is the one failure that matters.
  const actions = (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ACTIONS.map((a) => (
        // ── ON A LAPTOP: ICON AND LABEL ON ONE LINE, THE NOTE UNDER BOTH ────
        // Stacked icon-over-label-over-note was ~110px tall, and with the pager
        // now on its own row above the footer that was the difference between
        // Home fitting a 1440×900 MacBook's ~790px viewport and not. Icon and
        // label share a row (a 146px tile has the width for "Statements" beside
        // a 32px chip), and the note runs the full tile width underneath, where
        // "Decision in minutes" fits on one line — ~78px, no wording lost.
        <Link
          key={a.label}
          to={a.to}
          className="card group flex items-start gap-3 p-4 text-left transition-transform duration-200 active:scale-[0.985] lg:grid lg:grid-cols-[32px_minmax(0,1fr)] lg:items-center lg:gap-x-2 lg:gap-y-1.5 lg:p-3"
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl lg:h-8 lg:w-8 lg:rounded-lg"
            style={{ background: `color-mix(in oklab, ${a.tint} 16%, transparent)`, color: a.tint }}
          >
            <a.icon className="h-[18px] w-[18px] lg:h-4 lg:w-4" strokeWidth={2.2} />
          </span>
          {/* `lg:contents` dissolves this wrapper into the tile's grid, so the
              label takes the cell beside the icon and the note can span both
              columns below — without a second copy of the markup for laptops. */}
          <span className="min-w-0 lg:contents">
            <span className="block truncate text-[14px] font-semibold leading-tight">{a.label}</span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint lg:col-span-2 lg:mt-0 lg:truncate">
              {a.note}
            </span>
          </span>
        </Link>
      ))}
    </section>
  );

  // ── WHAT IS NEXT ──────────────────────────────────────────────────────────
  // The single most asked question in any collections call centre, answered
  // before anybody has to ring.
  const nextPayment = (
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
          <p className="tnum mt-3 text-[26px] font-bold leading-none tracking-[-0.02em]">{kes(loan.nextDue.amount)}</p>
          <p className="mt-1 text-[12px] text-ink-soft">due {shortDate(loan.nextDue.date)}</p>
          <LiquidButton size="sm" block className="mt-3" onClick={() => go("/repay")}>
            Repay now
          </LiquidButton>
        </>
      ) : loan ? (
        // A loan whose instalment breakdown we do not hold. Saying the BALANCE
        // is honest; inventing a "next payment" from it would put a date and a
        // figure on screen that the lender never quoted — and it is precisely
        // the figure a customer would then pay.
        <>
          <p className="tnum mt-3 text-[26px] font-bold leading-none tracking-[-0.02em]">{kes(loan.balance)}</p>
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
  );

  // ── REAL CONVERSATIONS, NOT A BROADCAST ───────────────────────────────────
  // This panel used to render two invented messages from "Micromart Fintech". It
  // shows the customer's own threads — the ones an officer is actually answering
  // — so tapping a row opens the reply rather than a dead notification. A channel
  // used for marketing stops being read, and then the message that mattered goes
  // unread with it, which is why nothing but real correspondence is here.
  const messages = (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
        <MessageSquareText className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2.1} />
        <p className="flex-1 text-[13px] font-semibold">Messages</p>
        {data.unreadMessages > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
            style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}
          >
            {data.unreadMessages} new
          </span>
        )}
      </div>

      {data.messages.length === 0 ? (
        <div className="px-5 py-5">
          <p className="text-[12.5px] leading-relaxed text-ink-faint">
            Nothing yet. If anything about your account or an application is unclear, write to us and a real person
            answers.
          </p>
          <LiquidButton size="sm" variant="metal" block className="mt-3" onClick={() => go("/messages/new")}>
            Write to us
          </LiquidButton>
        </div>
      ) : (
        <ul>
          {data.messages.slice(0, 3).map((m) => (
            <li key={m.id} style={{ borderColor: "var(--line)" }} className="border-b last:border-b-0">
              <Link to={`/messages/${m.id}`} className="flex gap-2.5 px-5 py-3 text-left">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: m.unread ? "var(--brand-ink)" : "transparent" }}
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
  );

  // ── THE PANE ──────────────────────────────────────────────────────────────
  // One. Help & FAQs and the standing pane moved out on 21 Sep 2026 — see the
  // header. It is still a Deck of one rather than a bare grid, because the deck
  // is what fits the pane to the fixed frame on a laptop; with a single pane it
  // draws no pager.
  //
  // ── WHY IT IS IN THIS ORDER ─────────────────────────────────────────────
  // Money, then the reason for it, then anything blocking. The number leads
  // because it is why the app was opened; "Why your limit is KSh 45,000" sits
  // DIRECTLY under it, because a figure and its explanation separated by two
  // cards is a figure with no explanation. The prompts follow rather than lead —
  // an unverified ID needs to be unmissable, and immediately under the balance
  // on a pane that never scrolls is unmissable.
  //
  // A pane has a HEIGHT BUDGET, and everything in it has to earn a share: the
  // shortcuts went four-across to buy 56px on a 900px window. That arithmetic is
  // the real constraint of a fixed frame.
  const panes: Pane[] = [
    {
      id: "money",
      label: "Your money",
      node: (
        <PaneGrid
          left={
            <>
              {money}
              {whyLimit}
              {prompts}
              {actions}
            </>
          }
          right={
            <>
              {nextPayment}
              {messages}
              <AdviceCard />
            </>
          }
        />
      ),
    },
  ];

  return (
    // The column the deck stands in. `lg:h-full` and `min-h-0` are what let the
    // deck below measure itself against the shell's fixed content box rather
    // than against its own content — without them the track has no height to
    // fill and every pane collapses to nothing.
    <div className="flex flex-col lg:h-full lg:min-h-0">
      <div className="shrink-0">
        <Sky title={data.firstName ? `Hello, ${data.firstName}` : "Hello"}>
          <p className="max-w-[34ch] text-[13px] leading-relaxed text-sky-ink-soft lg:max-w-none">
            Your limit is reviewed every time you repay. Nothing here is decided by a person.
          </p>
        </Sky>
      </div>

      {/* `relative z-10` is load-bearing, not tidiness. The Sky is a positioned
          element, so it paints ABOVE any static sibling regardless of DOM order —
          which meant the header covered the top of the first card and swallowed
          both the label and the score chip. Only visible in the light theme,
          because in the dark one the card is translucent and it read as a tint. */}
      <div className="relative z-10 -mt-12 flex min-h-0 flex-1 flex-col px-4">
        <ChannelBadge />
        <Deck panes={panes} label="Home" />
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
    </div>
  );
}
