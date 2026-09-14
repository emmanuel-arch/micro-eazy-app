// ─────────────────────────────────────────────────────────────────────────────
// ASK RIRI — the customer's first contact.
//
// Riri Ecosystem AI plan §07. The shape borrowed from the Vercel agent is not the
// styling; it is the OPENING LINE. She tells the customer what happens when she
// fails before they have asked anything — "if I find something I can't solve, I'll
// pass it to a person" — because that is what makes somebody willing to try an
// assistant at all. The cost of it not working is stated up front, and it is not
// "you wasted your afternoon".
//
// THREE OUTCOMES, AND THE SCREEN DRAWS EACH ONE DIFFERENTLY:
//   resolved   the answer, its stamp, and a thumb. No ticket, no counter.
//   offer      the answer, plus a quiet "Raise this with the team".
//   escalate   the answer, plus that same hand-off drawn as THE next step — a money
//              dispute should be followed by a person, and the screen says so.
//   escalated  she already did it (the customer asked for a person): the case
//              reference and the door into the conversation.
//
// THE STAMP IS THE POINT, AS IN THE CONSOLE. Every answer says what it stood on —
// "From your account", "Micro Eazy help", or the lender's pack by id and version —
// so when a customer says "Riri told me the fee was X", the answer is a pack id and
// a date, not an argument.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, AlertCircle, Mic, ArrowRight, ThumbsUp, ThumbsDown, UserRound,
  Wallet, BookOpen, Map as MapIcon, Sparkles, CheckCircle2, MessageSquare, Zap, ShieldCheck,
} from "lucide-react";
import { RichText, Screen } from "../kit";
import { RiriAvatar } from "../RiriAvatar";
import type { RiriAction, RiriAnswer, RiriEngine, RiriLang } from "../../../lib/riri/api";

export type Turn = {
  id: string;
  question: string;
  loading: boolean;
  error?: string;
  data?: RiriAnswer;
  feedback?: "up" | "down";
  /** Set when she handed this turn over from the sheet. */
  handoff?: { caseRef: string; threadId: string; message: string } | { error: string };
};

const ENGINE: Record<RiriEngine, { label: string; icon: typeof Wallet }> = {
  record: { label: "From your account", icon: Wallet },
  knowledge: { label: "Knowledge", icon: BookOpen },
  map: { label: "App map", icon: MapIcon },
  model: { label: "Riri's own words", icon: Sparkles },
};

export function AskScreen({
  name, opener, prompts, lang, turns, flight, onAsk, onNavigate, onFeedback, onHandoff, onOpenThread,
}: {
  name: string;
  opener: string;
  prompts: string[];
  lang: RiriLang;
  turns: Turn[];
  flight: string | null;
  onAsk: (q: string) => void;
  onNavigate: (a: RiriAction, question: string) => void;
  onFeedback: (t: Turn, helpful: boolean) => void;
  onHandoff: (t: Turn) => void;
  onOpenThread: (threadId: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const sw = lang === "sw";

  return (
    <Screen from="right" pad={false} className="min-h-0">
      <div className="os-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        <div className="space-y-4">
          {/* HER OPENING LINE — scope, and the escape hatch. Always first. */}
          <div className="flex gap-2">
            <div className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white">
              <RiriAvatar size={28} name={name} />
            </div>
            <div className="os-bubble-riri min-w-0 flex-1 rounded-2xl rounded-bl-sm px-3.5 py-3">
              <p className="text-[13px] leading-relaxed">{opener}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-soft">
                <UserRound className="h-3 w-3" />
                {sw ? "Ukitaka mtu wakati wowote, sema tu." : "Want a person at any point? Just say so."}
              </p>
            </div>
          </div>

          {turns.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="space-y-1.5 pl-9">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{sw ? "Jaribu kuuliza" : "Try asking"}</p>
              {prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onAsk(p)}
                  className="group flex w-full items-center gap-2 rounded-xl border border-line px-2.5 py-2 text-left text-[12px] leading-snug text-ink transition-colors hover:border-[color:var(--brand)]"
                  style={{ background: "var(--os-paper)" }}
                >
                  <span className="min-w-0 flex-1">{p}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint transition-colors group-hover:text-[color:var(--brand)]" />
                </button>
              ))}
            </motion.div>
          )}

          {turns.map((t) => (
            <TurnView
              key={t.id}
              t={t}
              name={name}
              sw={sw}
              onAsk={onAsk}
              onNavigate={onNavigate}
              onFeedback={onFeedback}
              onHandoff={onHandoff}
              onOpenThread={onOpenThread}
            />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Autopilot flight card — a moving screen is never a mystery. */}
      <AnimatePresence>
        {flight && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-white shadow-xl"
            style={{ backgroundColor: "var(--brand)" }}
          >
            <Zap className="h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug">{sw ? "Autopilot — nakupeleka" : "Autopilot — taking you to"} {flight}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}

function TurnView({
  t, name, sw, onAsk, onNavigate, onFeedback, onHandoff, onOpenThread,
}: {
  t: Turn;
  name: string;
  sw: boolean;
  onAsk: (q: string) => void;
  onNavigate: (a: RiriAction, question: string) => void;
  onFeedback: (t: Turn, helpful: boolean) => void;
  onHandoff: (t: Turn) => void;
  onOpenThread: (threadId: string) => void;
}) {
  const d = t.data;
  const engine = d ? ENGINE[d.engine] : null;
  const EngineIcon = engine?.icon ?? Wallet;
  const escalated = d?.escalation ?? (t.handoff && "caseRef" in t.handoff ? t.handoff : null);
  const handoffError = t.handoff && "error" in t.handoff ? t.handoff.error : null;
  const recommend = d?.outcome === "escalate";
  const canOffer = d && !escalated && (d.outcome === "offer" || d.outcome === "escalate" || d.canEscalate);

  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-[13px] text-white shadow-sm" style={{ backgroundColor: "var(--brand)" }}>
          {t.question}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white">
          <RiriAvatar size={28} state={t.loading ? "thinking" : "idle"} animated={t.loading} name={name} />
        </div>
        <div className="os-bubble-riri min-w-0 flex-1 rounded-2xl rounded-bl-sm px-3.5 py-3">
          {t.loading ? (
            <span className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {sw ? "Naangalia akaunti yako…" : "Checking your account…"}
            </span>
          ) : t.error ? (
            <span className="flex items-start gap-2 text-[13px] text-rose-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t.error}
            </span>
          ) : d ? (
            <>
              <RichText text={d.answer} />

              {/* What she offers to DO — navigation only, always. */}
              {d.actions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {d.actions.map((a) => (
                    <button
                      key={a.screenId + a.label}
                      type="button"
                      onClick={() => onNavigate(a, t.question)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white transition-transform active:scale-95"
                      style={{ backgroundColor: "var(--brand)" }}
                    >
                      {a.label} <ArrowRight className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}

              {/* HANDED OVER — the case, and the door into it. */}
              {escalated && (
                <div className="mt-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "color-mix(in oklab, #10b981 40%, var(--line))", background: "color-mix(in oklab, #10b981 8%, transparent)" }}>
                  <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {sw ? "Imepelekwa kwa timu" : "With the team"} · {escalated.caseRef}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-ink-soft">
                    {sw
                      ? "Wanaona ulichouliza na nilichoangalia. Jibu lao litakuja kwenye Messages."
                      : "They can see what you asked and what I checked. Their reply will come to Messages."}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenThread(escalated.threadId)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ink hover:border-[color:var(--brand)]"
                    style={{ background: "var(--os-paper)" }}
                  >
                    <MessageSquare className="h-3 w-3" /> {sw ? "Fungua mazungumzo" : "Open the conversation"}
                  </button>
                </div>
              )}
              {handoffError && <p className="mt-2 text-[11.5px] text-rose-600">{handoffError}</p>}

              {/* THE OFFER. A recommendation on a dispute; a quiet option otherwise. */}
              {canOffer && (
                <button
                  type="button"
                  onClick={() => onHandoff(t)}
                  className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-transform active:scale-[0.98] ${recommend ? "text-white shadow-sm" : "border border-line text-ink hover:border-[color:var(--brand)]"}`}
                  style={recommend ? { backgroundColor: "var(--brand)" } : { background: "var(--os-paper)" }}
                >
                  <UserRound className="h-3.5 w-3.5" />
                  {recommend
                    ? sw ? "Peleka hili kwa timu" : "Hand this to the team"
                    : sw ? "Ungependa nilipeleke kwa timu?" : "Want me to raise this with the team?"}
                </button>
              )}

              {d.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.suggestions.filter(Boolean).map((sg) => (
                    <button
                      key={sg}
                      type="button"
                      onClick={() => onAsk(sg)}
                      className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-soft hover:border-[color:var(--brand)] hover:text-ink"
                      style={{ background: "var(--os-paper)" }}
                    >
                      {sg}
                    </button>
                  ))}
                </div>
              )}

              {/* THE STAMP — what it stood on — and the thumbs. */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
                  <EngineIcon className="h-2.5 w-2.5" /> {engine?.label}
                </span>
                {d.sources.slice(0, 1).map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 text-[9.5px] text-ink-faint" title={s.id}>
                    {s.starter ? <AlertCircle className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />} {s.label}
                  </span>
                ))}
                {!escalated && (
                  <span className="ml-auto flex items-center gap-0.5">
                    {t.feedback ? (
                      <span className="text-[9.5px] text-ink-faint">{sw ? "Asante — nimeandika" : "Thanks — noted"}</span>
                    ) : (
                      <>
                        <button type="button" aria-label="Helpful" onClick={() => onFeedback(t, true)} className="grid h-6 w-6 place-items-center rounded-full text-ink-faint hover:bg-[var(--line)] hover:text-emerald-600">
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button type="button" aria-label="Not helpful" onClick={() => onFeedback(t, false)} className="grid h-6 w-6 place-items-center rounded-full text-ink-faint hover:bg-[var(--line)] hover:text-rose-600">
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </span>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The composer. Lives in the shell's footer slot so it never scrolls with the thread. */
export function AskComposer({
  input, busy, lang, autoGo, voice, onInput, onAsk,
}: {
  input: string;
  busy: boolean;
  lang: RiriLang;
  autoGo: boolean;
  voice: { supported: boolean; listening: boolean; speaking: boolean; listen: () => void };
  onInput: (v: string) => void;
  onAsk: (q: string) => void;
}) {
  const sw = lang === "sw";
  return (
    <div className="shrink-0 border-t border-line p-2.5" style={{ background: "var(--os-paper-soft)" }}>
      <div className="flex items-center gap-1.5 rounded-2xl border border-line-strong px-2 focus-within:border-[color:var(--brand)]" style={{ background: "var(--os-paper)" }}>
        {voice.supported && (
          <button
            type="button"
            onClick={voice.listen}
            aria-label={voice.listening ? "Stop listening" : "Talk to Riri"}
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${voice.listening ? "text-white" : "text-ink-faint hover:bg-[var(--line)] hover:text-ink"}`}
            style={voice.listening ? { backgroundColor: "var(--brand)" } : undefined}
          >
            <Mic className="h-4 w-4" />
            {voice.listening && <span className="riri-halo absolute inset-0 rounded-lg" style={{ background: "var(--brand)", opacity: 0.35 }} />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onAsk(input);
            }
          }}
          maxLength={500}
          aria-label="Ask Riri"
          placeholder={voice.listening ? (sw ? "Nasikiliza…" : "Listening…") : sw ? "Uliza kuhusu mkopo wako…" : "Ask about your loan, payments, Ratiba…"}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={() => onAsk(input)}
          disabled={busy || !input.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-transform active:scale-90 disabled:opacity-40"
          style={{ backgroundColor: "var(--brand)" }}
          aria-label="Send"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="mt-1 text-center text-[9px] text-ink-faint">
        {voice.speaking ? (sw ? "Nazungumza… · " : "Speaking… · ") : ""}
        {autoGo ? (sw ? "Autopilot imewashwa · " : "Autopilot on · ") : ""}
        {sw ? "Riri anajibu kwanza · mtu yuko ujumbe mmoja mbali" : "Riri answers first · a person is one message away"}
      </p>
    </div>
  );
}
