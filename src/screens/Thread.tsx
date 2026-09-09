// ─────────────────────────────────────────────────────────────────────────────
// ONE CONVERSATION.
//
// Three voices in one scroll, and the third is the reason this screen exists in
// the shape it does:
//
//   the customer   right-aligned, brand fill
//   an officer     left-aligned, card
//   the WORKFLOW   centred, chip — "Your application moved to Risk Review"
//
// System rows are written by the console the moment a stage advances (see
// connected-suite/src/lib/conversation/threads.ts → announce()), so the answer
// to "what happened to my loan" and the answer to "what did you say to me" are
// the same scroll, in order. Splitting them into a chat tab and a history tab is
// what every LMS does and it is precisely what makes a customer ring up: they
// are holding two accounts of the same week and cannot line them up.
//
// ── /messages/new IS THE SAME SCREEN ────────────────────────────────────────
// A composer with no thread yet. It renders the same frame with an empty scroll
// and the same box at the bottom; the first send creates the thread server-side
// (findOrOpenThread) and this screen swaps to it. A separate "new message"
// screen would be a second copy of the composer, and the two would drift.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Send, RefreshCw, GitBranch } from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { LiquidButton } from "../components/ui/LiquidButton";
import { sinceNow } from "../lib/format";
import { readThread, sendMessage, type Message, type ThreadDetail, type ThreadKind } from "../lib/api/portal";
import { SAMPLE_THREAD } from "../lib/api/samples";

const KINDS: ThreadKind[] = ["APPLICATION", "KYC_REVIEW", "LOAN", "REPAYMENT", "GENERAL"];

export default function Thread() {
  const { threadId } = useParams<{ threadId: string }>();
  const [search] = useSearchParams();
  const go = useNavigate();

  const isNew = !threadId || threadId === "new";

  const [thread, setThread] = useState<ThreadDetail | null>(isNew ? null : SAMPLE_THREAD);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(isNew ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const foot = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (isNew || !threadId) return;
    setStatus("loading");
    try {
      const r = await readThread(threadId);
      setThread(r.thread);
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error && e.message ? e.message : "We could not open this conversation.");
    }
  }, [threadId, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  // Land on the newest message, not the top. A conversation opened at its
  // beginning makes somebody scroll past their own history to find the reply
  // they came for.
  useEffect(() => {
    if (status === "ready") foot.current?.scrollIntoView({ block: "end" });
  }, [status, thread?.messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await sendMessage({
        ...(isNew
          ? {
              kind: pickKind(search.get("kind")),
              ...(search.get("applicationId") ? { applicationId: search.get("applicationId")! } : {}),
              ...(search.get("subject") ? { subject: search.get("subject")! } : {}),
            }
          : { threadId }),
        body: text,
      });
      setDraft("");
      if (isNew) {
        // The thread exists now. `replace` so Back does not return to an empty
        // composer that would open a SECOND thread on the next send.
        go(`/messages/${r.threadId}`, { replace: true });
      } else {
        await load();
      }
    } catch (e) {
      // The message is deliberately left in the box. Clearing a draft that
      // failed to send is how somebody loses the careful paragraph they just
      // wrote about why their ID photo is dark.
      setError(e instanceof Error && e.message ? e.message : "That did not send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const title = isNew ? "Write to us" : thread?.subject ?? "Conversation";

  return (
    <>
      <Sky title={title} onBack={() => go("/messages")}>
        {thread?.stageTitle && !isNew && (
          <p className="max-w-[38ch] text-[13px] leading-relaxed text-sky-ink-soft">
            Your application is with {thread.stageTitle}.
            {thread.assignedStaffName ? ` ${thread.assignedStaffName} is handling it.` : ""}
          </p>
        )}
        {isNew && (
          <p className="max-w-[38ch] text-[13px] leading-relaxed text-sky-ink-soft">
            A real person reads this. Their reply appears here and you will see it next time you open the app.
          </p>
        )}
      </Sky>

      <div className="relative z-10 -mt-12 px-4">
        <div className="mx-auto max-w-[720px] space-y-3">
          {status === "error" && (
            <section className="card p-5">
              <p className="text-[13px] font-semibold">We could not open this</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{error}</p>
              <LiquidButton size="sm" variant="metal" icon={RefreshCw} className="mt-4" onClick={() => void load()}>
                Try again
              </LiquidButton>
            </section>
          )}

          {status !== "error" && (
            <section className="card p-4 sm:p-5">
              {isNew && (
                <p className="pb-3 text-[12.5px] leading-relaxed text-ink-faint">
                  Tell us what is going on. If it is about an application, say which one — though we can usually see it.
                </p>
              )}

              <div className="space-y-3">
                {thread?.messages.map((m) => <Bubble key={m.id} m={m} />)}
                <div ref={foot} />
              </div>

              {/* ── THE COMPOSER ────────────────────────────────────────────
                  A textarea and not an input: people write paragraphs when they
                  are explaining a problem, and a single-line box that scrolls
                  sideways makes them write less than they need to. */}
              <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends only WITH a modifier. A bare Enter sending is
                    // right for a chat app and wrong here — this is a form
                    // people compose in, and half-sent explanations are worse
                    // than an extra click.
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={3}
                  maxLength={4000}
                  placeholder={isNew ? "What would you like to ask?" : "Write a reply…"}
                  aria-label="Your message"
                  className="w-full resize-y rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed outline-none"
                  style={{
                    background: "var(--surface-sunk)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                />

                {/* Only a SEND failure can reach here — a load failure renders
                    the panel above instead, and this branch is unreachable in
                    that case. */}
                {error && (
                  <p className="mt-2 text-[12px] font-semibold" style={{ color: "#dc2626" }}>
                    {error}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[11.5px] text-ink-faint">
                    {draft.length > 3600 ? `${4000 - draft.length} characters left` : "Ctrl + Enter to send"}
                  </span>
                  <LiquidButton size="sm" icon={Send} disabled={!draft.trim() || sending} onClick={() => void send()}>
                    {sending ? "Sending…" : "Send"}
                  </LiquidButton>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function pickKind(raw: string | null): ThreadKind {
  return (KINDS as string[]).includes(raw ?? "") ? (raw as ThreadKind) : "GENERAL";
}

/** One message. Three shapes, because there are three kinds of speaker. */
function Bubble({ m }: { m: Message }) {
  // ── The workflow talking ──────────────────────────────────────────────────
  // Centred and quiet: it is context, not correspondence, and drawing it as a
  // third participant in a speech bubble would imply somebody typed it.
  if (m.author === "system") {
    return (
      <div className="flex justify-center py-1">
        <span
          className="flex max-w-[46ch] items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold"
          style={{
            background: "color-mix(in oklab, var(--navy) 8%, transparent)",
            color: "var(--navy-ink)",
          }}
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          <span className="min-w-0">{m.body}</span>
        </span>
      </div>
    );
  }

  const mine = m.author === "borrower";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] sm:max-w-[75%]">
        {!mine && (
          <p className="mb-1 pl-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
            {m.authorName}
          </p>
        )}
        <div
          className="rounded-2xl px-4 py-3"
          style={
            mine
              ? { background: "var(--navy)", color: "#fff" }
              : { background: "var(--surface-sunk)", border: "1px solid var(--line)", color: "var(--ink)" }
          }
        >
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.body}</p>
        </div>
        <p className={`mt-1 text-[11px] text-ink-faint ${mine ? "pr-1 text-right" : "pl-1"}`}>{sinceNow(m.at)}</p>
      </div>
    </div>
  );
}
