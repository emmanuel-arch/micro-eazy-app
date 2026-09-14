// ─────────────────────────────────────────────────────────────────────────────
// ONE CONVERSATION.
//
// Four voices in one scroll, and the last two are the reason this screen exists in
// the shape it does:
//
//   the customer   right-aligned, brand fill
//   an officer     left-aligned, card
//   the WORKFLOW   centred, chip — "Your application moved to Risk Review"
//   RIRI           her hand-off note — what was asked, what she checked, and the
//                  one thing a person needs to decide. The customer reads exactly
//                  what the officer reads: her working, shown to both chairs.
//
// System rows are written by the console the moment a stage advances (see
// connected-suite/src/lib/conversation/threads.ts → announce()), so the answer
// to "what happened to my loan" and the answer to "what did you say to me" are
// the same scroll, in order.
//
// ── /messages/new IS RIRI FIRST ─────────────────────────────────────────────
// It used to be a blank composer straight into an officer's queue. It is now the
// door to Riri (Riri Ecosystem AI plan §07): every "Write to us" in the app —
// Home, Track, the ID check, the statement cruncher — lands here, and here opens
// her with the context the link carried. A question she resolves never becomes a
// thread and never becomes a number on the counter; one she cannot resolve arrives
// triaged, in the SAME conversation this screen renders.
//
// Replying inside an existing conversation is unchanged: once a person has the
// case, the customer talks to the person.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Send, RefreshCw, GitBranch, UserRound, Sparkles } from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { LiquidButton } from "../components/ui/LiquidButton";
import { RiriAvatar } from "../components/riri/RiriAvatar";
import { sinceNow } from "../lib/format";
import { readThread, sendMessage, type Message, type ThreadDetail } from "../lib/api/portal";
import { SAMPLE_THREAD } from "../lib/api/samples";
import { openRiri } from "../lib/riri/whyHere";

/** What a contextual "write to us" link was about, said as the customer would start. */
const DRAFTS: Record<string, string> = {
  APPLICATION: "Where is my application?",
  KYC_REVIEW: "Why is my ID check under review?",
  LOAN: "What do I owe?",
  REPAYMENT: "I have a question about a payment",
};

export default function Thread() {
  const { threadId } = useParams<{ threadId: string }>();
  const [search] = useSearchParams();
  const go = useNavigate();

  const isNew = !threadId || threadId === "new";
  const draft = DRAFTS[search.get("kind") ?? ""] ?? "";
  // Set only when the lender has switched Riri's first response off (see RiriDock).
  const direct = search.get("direct") === "1";

  // Arriving at /messages/new opens Riri, once, with the link's context in her box.
  useEffect(() => {
    if (!isNew || direct) return;
    const t = window.setTimeout(() => openRiri({ draft }), 250);
    return () => window.clearTimeout(t);
  }, [isNew, draft, direct]);

  if (isNew && direct) return <DirectComposer />;
  if (isNew) return <RiriFirst onBack={() => go("/messages")} draft={draft} />;
  return <Conversation threadId={threadId ?? ""} />;
}

/** The old "write to us" — only for a lender who has turned Riri's first response off. */
function DirectComposer() {
  const go = useNavigate();
  const [search] = useSearchParams();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const KINDS = ["APPLICATION", "KYC_REVIEW", "LOAN", "REPAYMENT", "GENERAL"] as const;
  const kindRaw = search.get("kind") ?? "";
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as (typeof KINDS)[number]) : "GENERAL";

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await sendMessage({
        kind,
        ...(search.get("applicationId") ? { applicationId: search.get("applicationId")! } : {}),
        ...(search.get("subject") ? { subject: search.get("subject")! } : {}),
        body: text,
      });
      go(`/messages/${r.threadId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Sky title="Write to us" onBack={() => go("/messages")}>
        <p className="max-w-[38ch] text-[13px] leading-relaxed text-sky-ink-soft">A real person reads this. Their reply appears in Messages.</p>
      </Sky>
      <div className="relative z-10 -mt-12 px-4">
        <section className="card mx-auto max-w-[720px] p-4 sm:p-5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="What would you like to ask?"
            aria-label="Your message"
            className="w-full resize-y rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed outline-none"
            style={{ background: "var(--surface-sunk)", border: "1px solid var(--line)", color: "var(--ink)" }}
          />
          {error && <p className="mt-2 text-[12px] font-semibold" style={{ color: "#dc2626" }}>{error}</p>}
          <div className="mt-3 flex justify-end">
            <LiquidButton size="sm" icon={Send} disabled={!draft.trim() || sending} onClick={() => void send()}>
              {sending ? "Sending…" : "Send"}
            </LiquidButton>
          </div>
        </section>
      </div>
    </>
  );
}

function RiriFirst({ onBack, draft }: { onBack: () => void; draft: string }) {
  return (
    <>
      <Sky title="Ask Riri first" onBack={onBack}>
        <p className="max-w-[40ch] text-[13px] leading-relaxed text-sky-ink-soft">
          She answers from your own account straight away — and anything she can't sort out, she hands to the team with what she already checked.
        </p>
      </Sky>
      <div className="relative z-10 -mt-12 px-4">
        <section className="card mx-auto max-w-[720px] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full shadow ring-2 ring-white">
              <RiriAvatar size={48} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">Riri is your first contact</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                Most questions — what you owe, when to pay, where your application is, how Ratiba works — have an answer in
                seconds. If yours needs a person, say so, and Riri opens the conversation with the team for you. You will not
                have to explain it twice.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <LiquidButton size="md" icon={Sparkles} onClick={() => openRiri({ draft })}>
              Ask Riri
            </LiquidButton>
            <LiquidButton size="md" variant="metal" icon={UserRound} onClick={() => openRiri({ prompt: "I want to talk to a person" })}>
              I'd like a person
            </LiquidButton>
          </div>
        </section>
      </div>
    </>
  );
}

function Conversation({ threadId }: { threadId: string }) {
  const go = useNavigate();
  const [thread, setThread] = useState<ThreadDetail | null>(SAMPLE_THREAD);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const foot = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
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
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Land on the newest message, not the top.
  useEffect(() => {
    if (status === "ready") foot.current?.scrollIntoView({ block: "end" });
  }, [status, thread?.messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage({ threadId, body: text });
      setDraft("");
      await load();
    } catch (e) {
      // The message is deliberately left in the box. Clearing a draft that
      // failed to send is how somebody loses the careful paragraph they just wrote.
      setError(e instanceof Error && e.message ? e.message : "That did not send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Sky title={thread?.subject ?? "Conversation"} onBack={() => go("/messages")}>
        {thread?.stageTitle && (
          <p className="max-w-[38ch] text-[13px] leading-relaxed text-sky-ink-soft">
            Your application is with {thread.stageTitle}.
            {thread.assignedStaffName ? ` ${thread.assignedStaffName} is handling it.` : ""}
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
              <div className="space-y-3">
                {thread?.messages.map((m) => <Bubble key={m.id} m={m} />)}
                <div ref={foot} />
              </div>

              {/* ── THE COMPOSER ────────────────────────────────────────────
                  A textarea and not an input: people write paragraphs when they
                  are explaining a problem. */}
              <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends only WITH a modifier — this is a form people compose in.
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={3}
                  maxLength={4000}
                  placeholder="Write a reply…"
                  aria-label="Your message"
                  className="w-full resize-y rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed outline-none"
                  style={{ background: "var(--surface-sunk)", border: "1px solid var(--line)", color: "var(--ink)" }}
                />

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

/** One message. Four shapes, because there are four kinds of speaker. */
function Bubble({ m }: { m: Message }) {
  // ── The workflow talking ──────────────────────────────────────────────────
  // Centred and quiet: it is context, not correspondence.
  if (m.author === "system") {
    return (
      <div className="flex justify-center py-1">
        <span
          className="flex max-w-[46ch] items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold"
          style={{ background: "color-mix(in oklab, var(--navy) 8%, transparent)", color: "var(--navy-ink)" }}
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          <span className="min-w-0">{m.body}</span>
        </span>
      </div>
    );
  }

  // ── Riri handing over ─────────────────────────────────────────────────────
  // A note, not a chat bubble: it is addressed to the officer and readable by the
  // customer, and it should look like a case summary rather than like somebody
  // talking over them.
  if (m.author === "assistant") {
    const [head, ...rest] = m.body.split("\n");
    return (
      <div className="flex gap-2.5">
        <span className="mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full shadow ring-2 ring-white">
          <RiriAvatar size={32} animated={false} name={m.authorName} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 pl-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{m.authorName} · handed to the team</p>
          <div className="rounded-2xl px-4 py-3" style={{ background: "color-mix(in oklab, var(--brand) 7%, var(--surface))", border: "1px solid color-mix(in oklab, var(--brand) 24%, var(--line))" }}>
            <p className="text-[12.5px] font-bold">{head}</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">{rest.join("\n").trim()}</p>
          </div>
          <p className="mt-1 pl-1 text-[11px] text-ink-faint">{sinceNow(m.at)}</p>
        </div>
      </div>
    );
  }

  const mine = m.author === "borrower";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] sm:max-w-[75%]">
        {!mine && <p className="mb-1 pl-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{m.authorName}</p>}
        <div
          className="rounded-2xl px-4 py-3"
          style={mine ? { background: "var(--navy)", color: "#fff" } : { background: "var(--surface-sunk)", border: "1px solid var(--line)", color: "var(--ink)" }}
        >
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.body}</p>
        </div>
        <p className={`mt-1 text-[11px] text-ink-faint ${mine ? "pr-1 text-right" : "pl-1"}`}>{sinceNow(m.at)}</p>
      </div>
    </div>
  );
}
