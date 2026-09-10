// ─────────────────────────────────────────────────────────────────────────────
// THE LOADER — one place where "we are fetching this" is turned into a screen.
//
// ── WHY THE SCREENS DO NOT DO THIS THEMSELVES ───────────────────────────────
// Every screen in this app takes its data as a prop and defaults it to a
// sample. That is deliberate and it is worth keeping: a presentational screen
// can be opened, reviewed and argued about without a server, and it has no
// opinion about where its numbers came from. Putting a `useEffect` and four
// pieces of loading state into each one would throw that away, and it would
// throw it away six times with six slightly different spellings of the same
// three failure states.
//
// So the fetch lives here and the screens stay dumb.
//
// ── THE FOUR OUTCOMES, AND WHY "EMPTY" IS NOT AN ERROR ──────────────────────
//   loading   The first read. A spinner, not a skeleton of a loan that may not
//             exist — a skeleton is a promise about the shape of what is coming.
//   ready     Render the screen with real data.
//   empty     The server answered honestly that there is nothing: `found: false`
//             on a customer with no history, or a bridged lender whose book we
//             are not allowed to guess at. THIS IS NOT A FAILURE and must not
//             look like one. It is the correct answer to "what do you have for
//             me", and the screen says so in words.
//   error     The call failed. Retry is offered, because most of these are one
//             bad minute on a mobile connection.
//
// A 401 is none of the above: the transport publishes it and the session guard
// moves the customer to the gate, so it never reaches this component as an
// error to render. See net/transport.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw, Inbox } from "lucide-react";
import { LiquidButton } from "../ui/LiquidButton";
import { Sky } from "../shell/Sky";
import { useSession } from "../../lib/session";

type State<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "empty"; message: string }
  | { status: "error"; message: string };

interface Props<T> {
  /**
   * The heading the real screen will show. Rendered while loading so the header
   * does not pop into place a second after the body — the screen the customer
   * asked for should be recognisable from the first frame, with only its
   * contents pending.
   */
  title: string;
  /** Takes the national ID — the second factor every gated route requires. */
  load: (nationalId: string) => Promise<T>;
  /**
   * Returns a message when the response is a legitimate "nothing here", or null
   * when it is real data. Each route says this differently (`found: false`,
   * `available: false`, `bridged: true`), so the caller decides rather than this
   * component guessing at a shape it does not know.
   */
  emptyWhen?: (data: T) => string | null;
  /**
   * `reload` re-runs `load` — the same path the error state's "Try again" uses.
   *
   * It is handed to the screen because some screens CAUSE the data to change:
   * Home raises an M-PESA prompt, and the balance behind it moves once the
   * lender confirms. Without this, the only way to see the new figure is to
   * navigate away and back, which customers read as the payment not having
   * worked. Screens that never mutate anything simply ignore it.
   */
  children: (data: T, reload: () => void) => ReactNode;
}

export function Resource<T>({ title, load, emptyWhen, children }: Props<T>) {
  const { nationalId } = useSession();
  const [state, setState] = useState<State<T>>({ status: "loading" });

  // The national ID is the input; re-running on every render of a parent would
  // hammer a rate-limited endpoint. `load` is usually an inline arrow, so it is
  // held in a ref rather than made a dependency — otherwise every parent render
  // is a new function and a new fetch.
  const loadRef = useRef(load);
  loadRef.current = load;
  const emptyRef = useRef(emptyWhen);
  emptyRef.current = emptyWhen;

  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // ── IT ASKS EVEN WITHOUT THE SECOND FACTOR, AND THAT IS THE FIX ───────────
  // This used to return early when there was no national ID, leaving the state
  // on "loading". The comment said the guard would send them to the gate. The
  // guard does no such thing — it checks `status` only — so nothing moved, no
  // request was made, and the screen sat on "Checking with your lender…" for
  // ever with an empty console. Every screen, for any customer who signed in
  // through the SMS-password door or simply closed the tab.
  //
  // An early return that leaves a spinner up is the worst available answer,
  // because it is indistinguishable from a slow network and it never resolves.
  // The call now goes out regardless, and the SERVER decides:
  //
  //   · Routes that can identify the borrower from the cookie answer normally.
  //     /api/portal/ladder already does exactly this — it falls back to the
  //     session's own borrower id when no national ID is supplied.
  //   · Routes that genuinely need the ID answer with a message, and this
  //     component renders it as an error with a Try again — something the
  //     customer can read and act on.
  //
  // Either is better than a spinner that means nothing. And with the ID now
  // restored from /api/portal/session on boot, this path is the exception
  // rather than the rule.
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    (async () => {
      try {
        const data = await loadRef.current(nationalId ?? "");
        if (!alive) return;
        const empty = emptyRef.current?.(data) ?? null;
        setState(empty ? { status: "empty", message: empty } : { status: "ready", data });
      } catch (e) {
        if (!alive) return;
        setState({
          status: "error",
          message: e instanceof Error && e.message ? e.message : "We could not load this. Check your connection.",
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [nationalId, attempt]);

  if (state.status === "loading") return <Panel title={title}><Spinner /></Panel>;

  if (state.status === "empty") {
    return (
      <Panel title={title}>
        <span
          className="grid h-11 w-11 place-items-center rounded-2xl"
          style={{ background: "color-mix(in oklab, var(--navy) 10%, transparent)", color: "var(--navy-ink)" }}
        >
          <Inbox className="h-5 w-5" strokeWidth={2} />
        </span>
        <p className="mt-3 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-soft">{state.message}</p>
      </Panel>
    );
  }

  if (state.status === "error") {
    return (
      <Panel title={title}>
        <p className="max-w-[38ch] text-[13px] font-semibold">We could not load this</p>
        <p className="mt-1.5 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-soft">{state.message}</p>
        <LiquidButton size="md" variant="metal" icon={RefreshCw} className="mt-4" onClick={retry}>
          Try again
        </LiquidButton>
      </Panel>
    );
  }

  return <>{children(state.data, retry)}</>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Sky title={title} />
      <div className="relative z-10 -mt-12 px-4">
        <section className="card flex flex-col items-center px-5 py-12 text-center">{children}</section>
      </div>
    </>
  );
}

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <span
        className="h-9 w-9 animate-spin rounded-full border-2"
        style={{ borderColor: "var(--line-strong)", borderTopColor: "var(--green-ink)" }}
      />
      <span className="text-[12.5px] text-ink-faint">Checking with your lender…</span>
    </div>
  );
}
