// ─────────────────────────────────────────────────────────────────────────────
// THE ONBOARDING HOST.
//
// It holds no opinion about what the steps are. It reads them from
// lib/journey/steps.ts, which is the lender's configuration, and renders
// whichever ones this lender asks the customer to do. Adding a step to the
// journey does not touch this file; turning one off does not either.
//
// That indirection is the point rather than an abstraction for its own sake:
// the moment the sequence is hard-coded here, "configurable onboarding" becomes
// a slide rather than a property of the software, and the first lender who wants
// a different order gets a fork.
//
// The screens themselves are dumb: each one takes what it needs and calls
// onDone. None of them knows its own position, so none of them breaks when the
// order changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Construction, MessageSquare, Route } from "lucide-react";
import { Sky } from "../../components/shell/Sky";
import { Stepper } from "../../components/onboarding/Stepper";
import { JourneyAside } from "../../components/onboarding/JourneyAside";
import { LiquidButton } from "../../components/ui/LiquidButton";
import { customerSteps, type JourneyConfig, type StepId } from "../../lib/journey/steps";
import { apply, type ApplyResponse } from "../../lib/api/portal";
import { SAMPLE_LENDER } from "../../lib/api/samples";
import { money } from "../../lib/format";
import { quoteToOffer, type Quote } from "../../lib/quote";
import type { Row } from "../../lib/schedule/reshape";
import CreateAccount from "./CreateAccount";
import Statement from "./Statement";
import ProductChoice from "./ProductChoice";
import ScheduleEditor from "./ScheduleEditor";
import LoanAgreement from "./LoanAgreement";
import Ratiba from "./Ratiba";

/** Micromart's day-one configuration. This will come from the lender's own
 *  settings once the console screen lands; the shape is already correct. */
const MICROMART: JourneyConfig = {};

export default function Onboarding() {
  const steps = useMemo(() => customerSteps(MICROMART), []);
  const [search] = useSearchParams();

  // ?step=<id> opens the journey at one screen. It is here for support ("open
  // the statement step and read it to me") and for reviewing a screen without
  // walking six others to reach it.
  //
  // It grants nothing. The wizard is a PRESENTER: every gate that matters is
  // enforced on the server against the persisted session, and finalize reads
  // that row rather than anything the client says. Skipping to the last screen
  // gets you a screen, not a verification.
  const start = useMemo(() => {
    const wanted = search.get("step");
    const i = wanted ? steps.findIndex((s) => s.id === wanted) : -1;
    return i >= 0 ? i : 0;
  }, [search, steps]);

  const [index, setIndex] = useState(start);

  // ── THE DRAFT ────────────────────────────────────────────────────────────
  // What the customer has built so far, held by the host rather than by any one
  // screen. It exists because the later steps are not independent of the
  // earlier ones: the schedule editor reshapes the chosen product's own rows,
  // and the agreement has to know whether what it is showing is the plan the
  // customer asked for. Keeping it here leaves every screen dumb — none of them
  // knows its own position, so none of them breaks when the order changes.
  //
  // It holds a PROPOSAL and never an entitlement. Nothing in it grants
  // anything: every gate that matters is enforced on the server against the
  // persisted session, so a draft assembled by hand is a draft, not a loan.
  const [nationalId, setNationalId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  const step = steps[index];
  const done = index >= steps.length;

  const next = () => setIndex((i) => Math.min(i + 1, steps.length));
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  if (done || !step) {
    return <Submit nationalId={nationalId} quote={quote} />;
  }

  return (
    <>
      <Sky title={step.title} onBack={index > 0 ? back : undefined}>
        <p className="max-w-[36ch] text-[13px] leading-relaxed text-sky-ink-soft">{step.blurb}</p>
        <div className="mt-4">
          <Stepper total={steps.length} index={index} />
        </div>
      </Sky>

      {/* The step says how much room it wants and the host gives it exactly
          that. A National ID field does not get better at 1040px — it gets
          harder to read across — but the schedule editor is a workspace with
          ten rows and a running total, and squeezing that into a phone column
          on a laptop throws away the only thing the laptop is better at.

          This is a CONTAINER decision, not a viewport one. The editor's own
          two-column grid keys off `xl`, which is the WINDOW being 1280px wide —
          it fired happily inside a 620px container and produced two cramped
          columns instead of one good one. Width has to be granted from above. */}
      {/* ── LANDSCAPE ON A LAPTOP, PORTRAIT ON A PHONE ────────────────────
          Every step used to render as one 620px column centred in the canvas,
          so on a desktop the funnel sat in a portrait strip with a foot of dead
          page either side — while Home, one screen earlier, split into two
          columns and filled its width. Same product, two answers to the same
          window, and the inconsistency is most visible in exactly the setting
          where it costs most: a laptop on a projector.

          So a NARROW step is now a two-column landscape at xl, matching Home's
          grid exactly (minmax(0,1.55fr) / minmax(0,1fr)): the form keeps a
          readable measure — a 980px text field is not more usable than a 620px
          one — and the space beside it carries the journey rather than nothing.

          A WIDE step keeps the full canvas and gets no aside. The schedule
          editor is already a two-column workspace of its own; a third column
          would squeeze the thing the width was granted for. Both shapes fill
          the screen, which is what consistency means here — not that every
          screen has the same number of columns.

          Below xl neither applies and the phone column is untouched. */}
      <div
        className={`relative z-10 -mt-12 px-4 ${
          step.canvas === "wide"
            ? "mx-auto max-w-[1040px]"
            : "mx-auto max-w-[620px] xl:grid xl:max-w-none xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start xl:gap-4"
        }`}
      >
        <div className="min-w-0">
        {step.id === "account" ? (
          <CreateAccount
            onDone={(id) => {
              setNationalId(id);
              next();
            }}
          />
        ) : step.id === "product" ? (
          <ProductChoice
            onDone={(q) => {
              setQuote(q);
              // A new product invalidates a schedule shaped against the old
              // one — ten weekly rows do not survive a move to four monthly
              // ones, and carrying them forward would hand the agreement a
              // plan for a loan nobody chose.
              setRows(null);
              next();
            }}
          />
        ) : step.id === "schedule" ? (
          <ScheduleEditor
            quote={quote}
            onDone={(r) => {
              setRows(r);
              next();
            }}
          />
        ) : step.id === "consent" ? (
          // ── THE AGREEMENT IS BUILT FROM THE QUOTE, NOT FETCHED ───────────
          // There is no LoanOffer to fetch at this point in the funnel: an
          // offer is what a lender CREATES once an application has been
          // decided, and the customer has not applied yet. The screen was
          // defaulting to a sample one, which hid that sequencing rather than
          // a missing call.
          //
          // quoteToOffer() renders the same arithmetic the server will price
          // (scripts/test-quote.mjs checks the two against each other), and it
          // carries `id: ""` — the signal the agreement reads to show a
          // pre-contract disclosure rather than a signing ceremony for an offer
          // that does not exist.
          <LoanAgreement
            offer={quote ? quoteToOffer(quote, SAMPLE_LENDER) : undefined}
            proposed={rows}
            onDone={() => next()}
          />
        ) : step.id === "ratiba" ? (
          <Ratiba onDone={next} />
        ) : step.id === "statement" ? (
          <Statement onDone={next} />
        ) : (
          <NotBuiltYet id={step.id} onSkip={next} />
        )}
        </div>

        {/* The journey, beside the step. Desktop only by construction: the
            aside's own `xl:mt-0` and this grid are what place it, and on a
            handset it stacks under the step where it is a summary rather than
            a sidebar. Wide steps opt out — see the note above. */}
        {step.canvas !== "wide" && <JourneyAside steps={steps} index={index} />}
      </div>
    </>
  );
}

/** A named empty room, not a dead end. Keeping unbuilt steps routable means the
 *  journey is walkable end to end today, which is how the ORDER gets reviewed
 *  before any of the screens exist to argue about. */
function NotBuiltYet({ id, onSkip }: { id: StepId; onSkip: () => void }) {
  return (
    <section className="card flex flex-col items-center gap-3 px-5 py-12 text-center">
      <span
        className="grid h-12 w-12 place-items-center rounded-2xl"
        style={{ background: "color-mix(in oklab, var(--navy) 10%, transparent)", color: "var(--navy-ink)" }}
      >
        <Construction className="h-5 w-5" strokeWidth={2} />
      </span>
      <p className="text-[13px] font-semibold">
        <code className="font-mono">{id}</code> is next to build
      </p>
      <button onClick={onSkip} className="text-[12.5px] font-semibold underline" style={{ color: "var(--green-ink)" }}>
        Walk past it for now
      </button>
    </section>
  );
}

/**
 * ── THE END OF THE FUNNEL, WHICH USED TO BE A DEAD END ──────────────────────
 *
 * This screen said "Onboarding complete. Your lender is reviewing it before the
 * money moves." and posted nothing. Every word of that was untrue: no
 * application existed, no lender was reviewing anything, and the customer had
 * been walked through ID capture, a statement upload and a signed agreement for
 * a record that was never created.
 *
 * So the submit happens HERE, on arrival, and the copy now describes what
 * actually occurred.
 *
 * ── WHY THE POST IS GUARDED BY A REF AND NOT BY STATE ───────────────────────
 * `apply` is not idempotent — two of these is two applications, and once the
 * lender leg is armed it is two rows in Micromart's live book their officers
 * cannot tell apart. A `useEffect` in React 19 StrictMode runs twice in
 * development, and a `submitting` piece of state is set asynchronously, so the
 * second invocation reads the stale `false` and fires a second application. A
 * ref is written synchronously and is the only thing that actually holds here.
 */
function Submit({ nationalId, quote }: { nationalId: string | null; quote: Quote | null }) {
  const go = useNavigate();
  const fired = useRef(false);
  const [state, setState] = useState<
    { s: "idle" } | { s: "sending" } | { s: "done"; r: ApplyResponse } | { s: "error"; message: string }
  >({ s: "idle" });

  useEffect(() => {
    if (fired.current) return;
    // Nothing to submit is not a failure — a lender may configure the product
    // step off entirely, in which case the funnel is an ENROLMENT and the
    // customer applies later from Home.
    if (!quote) return;
    fired.current = true;

    setState({ s: "sending" });
    apply({
      productId: quote.product.id,
      amount: quote.principal,
      ...(nationalId ? { nationalId } : {}),
    })
      .then((r) => setState({ s: "done", r }))
      .catch((e: unknown) =>
        setState({
          s: "error",
          message: e instanceof Error && e.message ? e.message : "We could not file your application.",
        }),
      );
  }, [quote, nationalId]);

  const title =
    state.s === "error" ? "Nearly there" : state.s === "done" ? "Application received" : "You are all set";

  return (
    <>
      <Sky title={title} />
      <div className="relative z-10 -mt-12 px-4">
        <section className="card mx-auto max-w-[620px] px-5 py-10 text-center">
          {state.s === "sending" && (
            <>
              <span
                className="mx-auto block h-9 w-9 animate-spin rounded-full border-2"
                style={{ borderColor: "var(--line-strong)", borderTopColor: "var(--green-ink)" }}
                role="status"
                aria-live="polite"
              />
              <p className="mt-4 text-[15px] font-semibold">Filing your application</p>
              <p className="mx-auto mt-2 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-faint">
                One moment — we are sending this to {SAMPLE_LENDER}.
              </p>
            </>
          )}

          {state.s === "idle" && (
            <>
              <p className="text-[15px] font-semibold">You are verified</p>
              <p className="mx-auto mt-2 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-faint">
                {nationalId ? `ID ${nationalId} verified. ` : ""}
                Your account is ready. Choose an amount from Home whenever you want to borrow.
              </p>
              <LiquidButton size="md" className="mt-5" onClick={() => go("/")}>
                Go to Home
              </LiquidButton>
            </>
          )}

          {state.s === "done" && (
            <>
              <p className="text-[15px] font-semibold">
                {money(state.r.amount)} on {state.r.product}
              </p>
              {/* Exactly what happened, and nothing that is not true. The
                  customer is never shown whether the lender leg was armed —
                  that is a fact about our deployment, not about their loan. */}
              <p className="mx-auto mt-2 max-w-[40ch] text-[12.5px] leading-relaxed text-ink-faint">
                Your application is in. You can watch it move through each stage, and message the team at any point if
                something needs explaining.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <LiquidButton size="md" icon={Route} onClick={() => go("/track")}>
                  Track it
                </LiquidButton>
                {state.r.threadId && (
                  <LiquidButton
                    size="md"
                    variant="metal"
                    icon={MessageSquare}
                    onClick={() => go(`/messages/${state.r.threadId}`)}
                  >
                    Message us
                  </LiquidButton>
                )}
              </div>
            </>
          )}

          {state.s === "error" && (
            <>
              <p className="text-[15px] font-semibold">We could not file it</p>
              <p className="mx-auto mt-2 max-w-[40ch] text-[12.5px] leading-relaxed text-ink-faint">
                {state.message} Everything you have entered is saved — nothing has to be done again.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <LiquidButton
                  size="md"
                  onClick={() => {
                    // The whole point of the ref is undone deliberately here:
                    // a retry the CUSTOMER asked for is not the accidental
                    // double-post the guard exists to prevent.
                    fired.current = false;
                    setState({ s: "idle" });
                  }}
                >
                  Try again
                </LiquidButton>
                <LiquidButton size="md" variant="metal" icon={MessageSquare} onClick={() => go("/messages/new")}>
                  Tell us what happened
                </LiquidButton>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
