// ─────────────────────────────────────────────────────────────────────────────
// THE CONVERSATIONS LIST.
//
// ── WHY THIS SCREEN FETCHES ITSELF ──────────────────────────────────────────
// Every other screen in this app takes its data as a prop and defaults to a
// sample, with the fetch living in components/data/Resource.tsx. That is right
// for a reading surface and wrong here: Resource takes `(nationalId) => Promise`
// and this list is keyed on the SESSION, not on the national ID — a customer who
// has verified a phone but not finished enrolment still has a right to ask a
// question, and requiring the second factor to open their own inbox would lock
// out precisely the people most likely to need help.
//
// It is also the one surface where a reload is a normal action rather than an
// error path, because the other party is a person who may have just replied.
//
// The sample is still the default render before the first response lands, so the
// screen can be reviewed without a server exactly like the others.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquarePlus, RefreshCw, Inbox, ChevronRight } from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { LiquidButton } from "../components/ui/LiquidButton";
import { sinceNow } from "../lib/format";
import { myThreads, type ThreadSummary } from "../lib/api/portal";
import { SAMPLE_THREADS } from "../lib/api/samples";

export default function Messages() {
  const go = useNavigate();
  const [threads, setThreads] = useState<ThreadSummary[]>(SAMPLE_THREADS);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await myThreads();
      setThreads(r.threads);
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error && e.message ? e.message : "We could not load your messages.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Sky title="Messages">
        <p className="max-w-[38ch] text-[13px] leading-relaxed text-sky-ink-soft">
          Talk to the team handling your account. They see the same stages you do.
        </p>
      </Sky>

      <div className="relative z-10 -mt-12 px-4 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start xl:gap-4">
        <div className="space-y-3">
          {status === "error" && (
            <section className="card p-5">
              <p className="text-[13px] font-semibold">We could not load your messages</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{error}</p>
              <LiquidButton size="sm" variant="metal" icon={RefreshCw} className="mt-4" onClick={() => void load()}>
                Try again
              </LiquidButton>
            </section>
          )}

          {status !== "error" && threads.length === 0 && (
            <section className="card flex flex-col items-center px-5 py-12 text-center">
              <span
                className="grid h-11 w-11 place-items-center rounded-2xl"
                style={{ background: "color-mix(in oklab, var(--navy) 10%, transparent)", color: "var(--navy-ink)" }}
              >
                <Inbox className="h-5 w-5" strokeWidth={2} />
              </span>
              <p className="mt-3 text-[15px] font-semibold">No messages yet</p>
              <p className="mt-1.5 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-faint">
                If anything about your account or an application is unclear, write to us here. A real person answers,
                and their reply lands on this screen.
              </p>
            </section>
          )}

          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => go(`/messages/${t.id}`)}
              className="card w-full p-4 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--navy)_4%,transparent)]"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{t.subject}</p>
                    {t.unread > 0 && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                        style={{ background: "var(--green-ink)", color: "#fff" }}
                      >
                        {t.unread} new
                      </span>
                    )}
                  </div>

                  {/* The stage is on the row because it is the single most useful
                      disambiguator when somebody has two conversations open —
                      "the one about Risk Review" is how a customer thinks of it. */}
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                    {t.stageTitle ? `${t.stageTitle} · ` : ""}
                    <StateLabel state={t.state} />
                  </p>

                  {t.preview && (
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">
                      {t.lastAuthor === "borrower" ? "You: " : ""}
                      {t.preview}
                    </p>
                  )}

                  <p className="mt-1.5 text-[11.5px] text-ink-faint">
                    {sinceNow(t.lastAt)}
                    {t.answeredBy ? ` · ${t.answeredBy}` : ""}
                  </p>
                </div>

                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2.2} />
              </div>
            </button>
          ))}
        </div>

        <aside className="mt-3 space-y-3 xl:mt-0">
          <section className="card p-5">
            <p className="text-[13px] font-semibold">Start a conversation</p>
            <p className="mt-1.5 max-w-[40ch] text-[12.5px] leading-relaxed text-ink-soft">
              Ask about an application, a repayment, or your ID check. Nothing you write here changes a decision on its
              own — it reaches the person who can look at it.
            </p>
            <LiquidButton
              size="md"
              icon={MessageSquarePlus}
              block
              className="mt-4"
              onClick={() => go("/messages/new")}
            >
              Write to us
            </LiquidButton>
          </section>
        </aside>
      </div>
    </>
  );
}

/** Whose move it is, in the customer's terms rather than the queue's. */
function StateLabel({ state }: { state: ThreadSummary["state"] }) {
  if (state === "AWAITING_STAFF") return <>Waiting for a reply</>;
  if (state === "AWAITING_CUSTOMER") return <>They replied</>;
  return <>Closed</>;
}
