// ─────────────────────────────────────────────────────────────────────────────
// WHERE MY LOAN ACTUALLY IS.
//
// The screen the whole "transparent ecosystem" claim rests on. It renders the
// SAME stage chain the officer is working — resolved once on the server by
// connected-suite/src/lib/workflow/chain.ts and read by both this screen and
// POST /api/console/applications/[id] — so "Risk Review" names the same desk on
// a customer's phone and on a staff console, and neither can drift from the
// other.
//
// ── WHY THE STAGES CARRY THE LENDER'S OWN NAMES ─────────────────────────────
// It would be softer to translate "Risk Review" into "We are checking a few
// things". It would also put the app and the console back into two vocabularies,
// which is exactly the gap this closes: a customer who rings up and says "it has
// been on Risk Review since Tuesday" is describing something the officer can see
// on their own screen, by name. That is the entire value. Softening the words
// throws it away for a small gain in tone.
//
// ── WAITING IS THE PRODUCT ──────────────────────────────────────────────────
// Most of a borrower's relationship with an application is waiting for it, and
// the complaint is never "it took two days" — it is "nobody told me anything".
// So the current stage is the loudest thing on the screen, it says how long that
// stage is meant to take (the lender's own configured SLA, not a number we
// invented), it says when it last moved, and there is a way to ASK sitting right
// under it. A tracker with no way to ask names a wall without a door.
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from "react-router-dom";
import { Check, CircleDot, Circle, XCircle, MessageSquare, Clock, Banknote } from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { LiquidButton } from "../components/ui/LiquidButton";
import { money, shortDate, sinceNow } from "../lib/format";
import type { StageState, TrackResponse } from "../lib/api/portal";
import { SAMPLE_TRACK } from "../lib/api/samples";

export default function Track({ data = SAMPLE_TRACK }: { data?: TrackResponse }) {
  const go = useNavigate();
  const app = data.application ?? null;

  // ── An account, but nothing applied for ───────────────────────────────────
  // A real state and a good one — it is the difference between "we lost your
  // application" and "you have not made one". Rendering a dead tracker here
  // would imply the first.
  if (!app) {
    return (
      <>
        <Sky title="Your application">
          <p className="max-w-[36ch] text-[13px] leading-relaxed text-sky-ink-soft">
            Nothing is in progress right now.
          </p>
        </Sky>
        <div className="relative z-10 -mt-12 px-4">
          <section className="card px-5 py-10 text-center">
            <p className="text-[15px] font-semibold">No application yet</p>
            <p className="mx-auto mt-2 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-faint">
              When you apply, every stage it passes through appears here — the same stages your lender sees, with the
              name of the desk it is sitting on.
            </p>
            <LiquidButton size="md" icon={Banknote} className="mt-5" onClick={() => go("/join")}>
              Apply for a loan
            </LiquidButton>
          </section>
        </div>
      </>
    );
  }

  const current = app.stages.find((s) => s.state === "current") ?? null;
  const stopped = app.declined;

  return (
    <>
      <Sky title="Your application">
        <p className="max-w-[38ch] text-[13px] leading-relaxed text-sky-ink-soft">
          {stopped
            ? "This application was not approved. The reasons are below."
            : current
              ? `Step ${app.stepNumber} of ${app.stepCount} — with ${current.title}.`
              : "Approved. Your lender is preparing the payout."}
        </p>
      </Sky>

      <div className="relative z-10 -mt-12 px-4 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start xl:gap-4">
        {/* ── LEFT: the chain ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <section className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  {app.product ?? "Loan"} · applied {shortDate(app.submittedAt)}
                </p>
                <p className="tnum mt-1 text-[30px] font-bold leading-none tracking-[-0.03em]">{money(app.amount)}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={
                  stopped
                    ? { background: "color-mix(in oklab, #dc2626 16%, transparent)", color: "#dc2626" }
                    : { background: "color-mix(in oklab, var(--lime) 22%, transparent)", color: "var(--green-ink)" }
                }
              >
                {stopped ? "Declined" : app.stageTitle ?? app.status}
              </span>
            </div>

            {/* ── THE CHAIN ────────────────────────────────────────────────
                A vertical rail rather than a horizontal bar: stage names are
                words, not ticks, and five of them across a phone becomes five
                truncated words that all read as "Cust…". Vertical also lets the
                current stage carry its own paragraph without shoving the rest
                of the row out of alignment. */}
            <ol className="mt-6 space-y-0">
              {app.stages.map((s, i) => (
                <StageRow
                  key={`${s.title}-${i}`}
                  title={s.title}
                  state={s.state}
                  expectedHours={s.expectedHours}
                  last={i === app.stages.length - 1}
                  movedAt={s.state === "current" ? app.lastMovedAt : null}
                />
              ))}
            </ol>
          </section>

          {/* The one thing a waiting customer can actually do. It is under the
              chain rather than in the aside because on a phone the aside is
              below the fold, and "ask about this" being out of sight is the
              same as it not existing. */}
          <section className="card p-5">
            <p className="text-[13px] font-semibold">Something not right?</p>
            <p className="mt-1.5 max-w-[44ch] text-[12.5px] leading-relaxed text-ink-soft">
              Message the team handling this. They can see exactly what you can see, and their reply lands here.
            </p>
            <LiquidButton
              size="md"
              variant="metal"
              icon={MessageSquare}
              className="mt-4"
              onClick={() =>
                go(
                  data.conversation
                    ? `/messages/${data.conversation.id}`
                    : `/messages/new?kind=APPLICATION&applicationId=${encodeURIComponent(app.id)}`,
                )
              }
            >
              {data.conversation
                ? data.conversation.unread > 0
                  ? `Open conversation (${data.conversation.unread} new)`
                  : "Open conversation"
                : "Ask about this application"}
            </LiquidButton>
          </section>
        </div>

        {/* ── RIGHT: what has already happened ───────────────────────────── */}
        <aside className="mt-3 space-y-3 xl:mt-0">
          {data.loan && (
            <section className="card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Your loan</p>
              <p className="tnum mt-1 text-[22px] font-bold leading-none tracking-[-0.03em]">
                {money(data.loan.amount)}
              </p>
              <p className="mt-1.5 text-[12px] text-ink-soft">
                {data.loan.disbursedAt ? `Paid out ${shortDate(data.loan.disbursedAt)}` : data.loan.status}
              </p>
            </section>
          )}

          <section className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">History</p>
            {data.trail && data.trail.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {[...data.trail].reverse().map((t) => (
                  <li key={t.id} className="flex gap-3">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--line-strong)" }}
                    />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold">{t.label}</p>
                      <p className="text-[11.5px] text-ink-faint">
                        {t.stage ? `${t.stage} · ` : ""}
                        {shortDate(t.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
                Nothing has moved yet. This fills in as your application passes each desk.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

/** One stage on the rail. */
function StageRow({
  title,
  state,
  expectedHours,
  last,
  movedAt,
}: {
  title: string;
  state: StageState;
  expectedHours: number | null;
  last: boolean;
  movedAt: string | null;
}) {
  const done = state === "done";
  const isCurrent = state === "current";
  const isStopped = state === "stopped";

  const Icon = done ? Check : isCurrent ? CircleDot : isStopped ? XCircle : Circle;

  const tint = done
    ? "var(--green-ink)"
    : isCurrent
      ? "var(--navy-ink)"
      : isStopped
        ? "#dc2626"
        : "var(--ink-faint)";

  return (
    <li className="flex gap-3">
      {/* The rail and the marker. The connector is drawn by the row ABOVE its
          successor rather than between rows, so the last stage has no dangling
          tail below it. */}
      <div className="flex flex-col items-center">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
          style={{
            background: done
              ? "color-mix(in oklab, var(--lime) 26%, transparent)"
              : isCurrent
                ? "color-mix(in oklab, var(--navy) 12%, transparent)"
                : isStopped
                  ? "color-mix(in oklab, #dc2626 14%, transparent)"
                  : "var(--surface-sunk)",
            color: tint,
          }}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={2.6} />
        </span>
        {!last && (
          <span
            className="w-px flex-1"
            style={{ minHeight: 22, background: done ? "var(--green-ink)" : "var(--line)" }}
          />
        )}
      </div>

      <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-5"}`}>
        <p
          className={`text-[13.5px] ${isCurrent ? "font-bold" : "font-semibold"} ${
            state === "upcoming" ? "text-ink-faint" : ""
          }`}
        >
          {title}
        </p>

        {isCurrent && (
          <div className="mt-1 space-y-1">
            {movedAt && <p className="text-[11.5px] text-ink-soft">Here since {sinceNow(movedAt)}</p>}
            <p className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
              <Clock className="h-3.5 w-3.5" strokeWidth={2.2} />
              {/* An expectation, never a promise — and where the lender has set
                  no SLA we say that rather than inventing a number, because a
                  number we made up is the one thing that turns a waiting
                  customer into an angry one. */}
              {expectedHours
                ? `Usually ${expectedHours < 24 ? `${expectedHours} hours` : `${Math.round(expectedHours / 24)} days`}`
                : "No fixed time on this step"}
            </p>
          </div>
        )}

        {isStopped && <p className="mt-1 text-[11.5px] text-ink-faint">Not reached</p>}
      </div>
    </li>
  );
}
