// ─────────────────────────────────────────────────────────────────────────────
// STATEMENT CRUNCHER — six months of M-PESA, read in about a minute, in panes.
//
//   1. Get it      the film and the seven keypresses, and the last read if any
//   2. Upload      the PDF, its password, and the customer's own permission
//   3. Crunch      the console's theatre — decrypt, parse, extract, ledger, audit
//   4. Score       the dial, what moved it, the monthly cashflow
//   5. Limit       the starting limit, what set it, and the way to Apply
//
// ── WHOSE STATEMENT ─────────────────────────────────────────────────────────
// A statement scores the person named on it and nobody else. The server compares
// the holder's name with the customer's verified name BEFORE anything is scored,
// and on a mismatch it stops: no score, no limit, no snapshot. A customer has no
// override here (an officer at the counter does, and it is audited). What they
// have is a way to a person — "it IS mine, under another registered name" — which
// opens a support case with the reason in their own words, or a way back to
// upload the right one.
//
// ── WHAT SETS THE LIMIT ─────────────────────────────────────────────────────
// Nothing on this screen. The server runs the thin-file scorecard, the lender's
// credit policy (Geoffrey's rules) and the lender's own cap, and hands back the
// starting limit with its reasons. The screen shows them.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Banknote, CheckCircle2, FileUp, Lock, Mail, MessageSquare, RefreshCw, ScanFace,
  ShieldCheck, TrendingDown, TrendingUp,
} from "lucide-react";
import { FlowScreen, StepCard, type FlowStep } from "../../components/flow/FlowScreen";
import { Field, TextInput, Tick } from "../../components/flow/Fields";
import { LiquidButton } from "../../components/ui/LiquidButton";
import { Film } from "../../components/media/Film";
import { AMBER, GREEN, GREEN_DARK, Glass, MpesaStage, RED, ScoreDial, Theatre, kes, useCountUp } from "../../components/crunch/Theatre";
import { crunchStatement, escalateStatementName, journey, type CrunchRefusal, type CrunchResult, type JourneyResponse } from "../../lib/api/portal";
import { useLender } from "../../lib/lender";
import { longDate, money } from "../../lib/format";
import { USSD_STEPS } from "../onboarding/Statement";
import { Holding } from "../kyc/Kyc";

export default function Cruncher() {
  const [state, setState] = useState<{ s: "loading" } | { s: "error"; message: string } | { s: "ready"; j: JourneyResponse }>({ s: "loading" });
  const load = useCallback(() => {
    setState({ s: "loading" });
    journey()
      .then((j) => setState({ s: "ready", j }))
      .catch((e: unknown) => setState({ s: "error", message: e instanceof Error ? e.message : "We could not load the cruncher." }));
  }, []);
  useEffect(load, [load]);

  if (state.s === "loading") return <Holding title="Statement cruncher" line="Getting ready…" />;
  if (state.s === "error") return <Holding title="Statement cruncher" line={state.message} onRetry={load} />;
  if (!state.j.status.borrower && !state.j.existingCustomer) return <NeedsKyc />;
  return <CrunchFlow j={state.j} />;
}

function NeedsKyc() {
  const go = useNavigate();
  const steps: FlowStep[] = [
    {
      id: "kyc",
      label: "Verify first",
      title: "Statement cruncher",
      blurb: "Your statement is scored against your verified name.",
      required: true,
      why: "A statement only scores the person named on it — so we need to know who you are first.",
      node: (
        <StepCard icon={<ScanFace className="h-[18px] w-[18px]" style={{ color: "var(--brand-ink)" }} />} title="Verify your identity first">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Finish KYC verification, then come back here. It takes a few minutes, and your statement is checked against the
            name you verify.
          </p>
          <LiquidButton size="lg" className="mt-4" icon={ScanFace} trailingIcon={ArrowRight} onClick={() => go("/kyc")}>
            Go to KYC verification
          </LiquidButton>
        </StepCard>
      ),
    },
  ];
  return <FlowScreen label="Statement cruncher" steps={steps} at={0} reachable={0} onAt={() => {}} />;
}

type Attempt = { id: number; file: File; password: string };

function CrunchFlow({ j }: { j: JourneyResponse }) {
  const go = useNavigate();
  const lender = useLender();
  const [at, setAt] = useState(0);
  const [reachable, setReachable] = useState(0);
  const open = (n: number) => {
    setReachable((r) => Math.max(r, n));
    setAt(n);
  };

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [data, setData] = useState<CrunchResult | null>(null);
  const [refusal, setRefusal] = useState<CrunchRefusal | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // ── ONE REQUEST PER ATTEMPT ──────────────────────────────────────────────
  // A crunch is billed and rate-limited. React's development double-mount would
  // otherwise send the same statement twice; a ref keyed on the attempt holds.
  const fired = useRef(0);
  useEffect(() => {
    if (!attempt || fired.current === attempt.id) return;
    fired.current = attempt.id;
    setData(null);
    setRefusal(null);
    setFailure(null);
    crunchStatement(attempt.file, attempt.password)
      .then((r) => {
        if (r.success) {
          setData(r);
          return;
        }
        if (r.needPassword || r.field === "password") {
          setPasswordError(r.message);
          setAt(1);
          setReachable(1);
          return;
        }
        setRefusal(r);
      })
      .catch((e: unknown) => setFailure(e instanceof Error ? e.message : "The upload did not complete. Check your connection and try again."));
  }, [attempt]);

  const start = () => {
    if (!file) return;
    setPasswordError(null);
    setAttempt((a) => ({ id: (a?.id ?? 0) + 1, file, password }));
    open(2);
  };
  const restart = () => {
    setAttempt(null);
    setData(null);
    setRefusal(null);
    setFailure(null);
    setFile(null);
    setPassword("");
    setAt(1);
    setReachable(1);
  };

  const last = j.status.crunch;

  const steps: FlowStep[] = [
    {
      id: "howto",
      label: "Get your statement",
      title: "Your M-PESA statement",
      blurb: "Six months, read in about a minute, and turned into a score out of 900.",
      required: true,
      why: "The limit has to come from evidence. Six months of real cashflow is the evidence a thin file has.",
      node: (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="card overflow-hidden">
            <div className="p-3.5 pb-0">
              <Film slot="statement-walkthrough" />
            </div>
            <div className="px-5 pb-4 pt-3">
              <p className="flex items-start gap-2 text-[12px] leading-snug text-ink-soft">
                <Mail className="mt-px h-3.5 w-3.5 shrink-0 text-ink-faint" />
                Safaricom emails the statement as a locked PDF. The password is in the SMS they send you.
              </p>
            </div>
          </section>
          <div className="space-y-3">
            <section className="card px-5 py-4">
              <p className="text-[13px] font-semibold">The seven keypresses</p>
              <ol className="mt-3">
                {USSD_STEPS.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 pb-2 last:pb-0">
                    <span className="tnum grid h-7 w-[3.2rem] shrink-0 place-items-center rounded-lg border font-mono text-[12px] font-bold" style={{ borderColor: "var(--line-strong)", background: "var(--surface-sunk)", color: "var(--green-ink)" }}>
                      {s.key}
                    </span>
                    <span className="text-[12.5px] leading-snug">{s.label}</span>
                  </li>
                ))}
              </ol>
            </section>
            {last && (
              <section className="card px-5 py-4">
                <p className="text-[13px] font-semibold">Your last read</p>
                <p className="mt-1 text-[12px] text-ink-faint">{longDate(last.at)}{last.fresh ? "" : " · older than 90 days"}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3" style={{ background: "var(--surface-sunk)" }}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint">Score</p>
                    <p className="tnum mt-1 text-[20px] font-bold leading-none">{last.score}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "var(--surface-sunk)" }}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint">Starting limit</p>
                    <p className="tnum mt-1 text-[20px] font-bold leading-none">{last.startingLimit != null ? money(last.startingLimit) : "—"}</p>
                  </div>
                </div>
                {last.fresh && last.eligible && (
                  <button type="button" onClick={() => go("/apply")} className="mt-3 text-[12.5px] font-semibold" style={{ color: "var(--brand-ink)" }}>
                    Use this read and apply →
                  </button>
                )}
              </section>
            )}
            <LiquidButton size="lg" block icon={FileUp} trailingIcon={ArrowRight} onClick={() => open(1)}>
              {last ? "Read a new statement" : "I have my statement"}
            </LiquidButton>
          </div>
        </div>
      ),
    },
    {
      id: "upload",
      label: "Upload",
      title: "Hand it over",
      blurb: "The PDF Safaricom emailed you, and the password from their SMS.",
      required: true,
      why: `The statement is read on ${lender.short}'s servers to work out what you can comfortably repay. It is never shared.`,
      node: (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <StepCard icon={<FileUp className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />} title="Your statement">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors" style={{ borderColor: "var(--line-strong)", background: "var(--surface-sunk)" }}>
              <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "color-mix(in oklab, var(--green) 16%, transparent)", color: "var(--green-ink)" }}>
                <FileUp className="h-5 w-5" strokeWidth={2.1} />
              </span>
              <span className="max-w-full truncate text-[13.5px] font-semibold">{file ? file.name : "Choose the statement PDF"}</span>
              <span className="text-[11.5px] leading-snug text-ink-faint">{file ? `${(file.size / 1024).toFixed(0)} KB · tap to choose another` : "The file Safaricom emailed you"}</span>
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <div className="mt-3">
              <Field label="Statement password" required hint="From Safaricom's SMS. On older statements it is your ID number." error={passwordError}>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <TextInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className="pl-9" />
                </div>
              </Field>
            </div>
          </StepCard>
          <StepCard icon={<ShieldCheck className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />} title="Your permission">
            <Tick checked={consent} onChange={setConsent}>
              I permit {lender.name} to read this M-PESA statement to assess my affordability and set my loan limit.
            </Tick>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
              The statement must be in your own name. A statement in anybody else's name is stopped before it is scored.
            </p>
            <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} disabled={!file || !password.trim() || !consent} onClick={start}>
              {!file ? "Choose your statement first" : !password.trim() ? "Enter the password" : !consent ? "Tick the box to continue" : "Crunch my statement"}
            </LiquidButton>
          </StepCard>
        </div>
      ),
    },
    {
      id: "crunch",
      label: "Crunch",
      title: "Reading your statement",
      blurb: "Decrypt, parse, extract, ledger, audit, score.",
      required: true,
      node: (
        <MpesaStage className="min-h-[520px]">
          {refusal?.nameMismatch ? (
            <NameMismatch refusal={refusal} onDifferent={restart} />
          ) : refusal || failure ? (
            <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${AMBER}22`, border: `2px solid ${AMBER}` }}>
                <AlertTriangle className="h-7 w-7" style={{ color: AMBER }} />
              </div>
              <h2 className="mt-4 text-lg font-bold">We could not read that statement</h2>
              <p className="mt-2 text-[13px] text-white/70">{refusal?.message ?? failure}</p>
              {refusal?.reason === "kyc" ? (
                <button type="button" onClick={() => go("/kyc")} className="mt-5 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})` }}>
                  Go to KYC verification
                </button>
              ) : (
                <button type="button" onClick={restart} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold">
                  <RefreshCw className="h-4 w-4" /> Upload it again
                </button>
              )}
            </div>
          ) : attempt ? (
            <Theatre
              key={attempt.id}
              data={data}
              // Forward only: the sequence finishing must never pull a customer
              // back from a pane they have already moved on to.
              onDone={() => {
                setReachable((r) => Math.max(r, 3));
                setAt((a) => Math.max(a, 3));
              }}
            />
          ) : null}
        </MpesaStage>
      ),
    },
    {
      id: "score",
      label: "Your score",
      title: "Your score, explained",
      blurb: "Every factor, positive and negative.",
      node: data ? <ScorePane data={data} onContinue={() => open(4)} /> : null,
    },
    {
      id: "limit",
      label: "Your limit",
      title: "What you qualify for",
      blurb: "A starting limit, what set it, and why.",
      node: data ? <LimitPane data={data} onApply={() => go("/apply")} /> : null,
    },
  ];

  return <FlowScreen label="Statement cruncher" steps={steps} at={at} reachable={attempt && !data ? Math.min(reachable, 2) : reachable} onAt={(n) => setAt(Math.min(n, reachable))} />;
}

// ── THE COLLAPSE — somebody else's statement ─────────────────────────────────

function NameMismatch({ refusal, onDifferent }: { refusal: CrunchRefusal; onDifferent: () => void }) {
  const go = useNavigate();
  const [raising, setRaising] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ threadId: string; caseRef: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function escalate() {
    setBusy(true);
    setError(null);
    try {
      const r = await escalateStatementName(refusal.statementName ?? "", reason.trim());
      setDone({ threadId: r.threadId, caseRef: r.caseRef });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not open the case.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto w-full max-w-md py-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl" style={{ backgroundColor: `${RED}22`, border: `2px solid ${RED}` }}>
        <AlertTriangle className="h-8 w-8" style={{ color: RED }} />
      </div>
      <h2 className="mt-4 text-xl font-bold">This statement is not in your name</h2>
      <p className="mt-2 text-sm text-white/75">
        It is registered to <span className="font-bold text-white">“{refusal.statementName}”</span>
        {refusal.expectedName ? (
          <>
            , and you are verified as <span className="font-bold text-white">{refusal.expectedName}</span>
          </>
        ) : null}
        . A statement can only score the person named on it, so nothing was scored.
      </p>

      {done ? (
        <Glass className="mt-5 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" style={{ color: GREEN }} /> Case {done.caseRef} is open
          </p>
          <p className="mt-1 text-[12.5px] text-white/70">A person will look at it and reply in Messages. You do not need to upload anything else until they do.</p>
          <button type="button" onClick={() => go(`/messages/${done.threadId}`)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0b3d1a]">
            <MessageSquare className="h-4 w-4" /> Open the conversation
          </button>
        </Glass>
      ) : raising ? (
        <Glass className="mt-5 text-left">
          <label className="block text-[12px] font-semibold text-white/80" htmlFor="why">
            Tell us why this statement is yours
          </label>
          <textarea
            id="why"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. My M-PESA line is registered under my maiden name, Julia Chebet."
            className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/40"
          />
          {error && <p className="mt-2 text-[12px] font-medium" style={{ color: "#fda4af" }}>{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setRaising(false)} className="flex-1 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold">
              Back
            </button>
            <button
              type="button"
              disabled={busy || reason.trim().length < 10}
              onClick={escalate}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})` }}
            >
              {busy ? "Opening…" : "Send to a person"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/45">At least a sentence — the reviewer decides from what you write.</p>
        </Glass>
      ) : (
        <div className="mt-5 space-y-2">
          <button type="button" onClick={onDifferent} className="w-full rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})` }}>
            Upload my own statement
          </button>
          <button type="button" onClick={() => setRaising(true)} className="w-full rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold">
            It is mine — ask a person to check
            <span className="block text-[10.5px] font-normal text-white/55">Opens a support case. Somebody reviews it and replies.</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── THE SCORE ──────────────────────────────────────────────────────────────────

function ScorePane({ data, onContinue }: { data: CrunchResult; onContinue: () => void }) {
  const s = data.creditScore;
  const f = data.features;
  const bars = s.breakdown.filter((b) => b.points !== 0).sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 8);
  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.points)), 1);
  const detailOf = (code: string) => s.reasonCodes.find((r) => r.code === code)?.detail;
  const maxNet = Math.max(...data.monthly.map((m) => Math.abs(m.net)), 1);

  return (
    <MpesaStage>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <ScoreDial data={data} size={180} />
          <p className="mt-3 text-center text-[11.5px] text-white/60">
            {f.monthsCovered} months · {data.transactionCount.toLocaleString()} transactions
            {f.periodStart && f.periodEnd ? ` · ${f.periodStart} to ${f.periodEnd}` : ""}
          </p>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-widest text-white/60">Monthly net cashflow</p>
            <div className="mt-2 flex h-20 items-end gap-1.5">
              {data.monthly.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(6, (Math.abs(m.net) / maxNet) * 100)}%` }} transition={{ duration: 0.6 }} className="w-full rounded-t" style={{ backgroundColor: m.net >= 0 ? GREEN : RED, opacity: 0.85 }} />
                  <span className="text-[8px] text-white/40">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
          <Glass className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/60">Comfortable instalment</p>
                <p className="text-xl font-bold" style={{ color: GREEN }}>
                  {kes(data.affordability.recommendedMaxInstallment)}
                  <span className="text-xs font-normal text-white/50">/mo</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-white/60">Avg income</p>
                <p className="text-sm font-bold">
                  {kes(f.avgMonthlyIncome)}
                  <span className="text-xs font-normal text-white/50">/mo</span>
                </p>
              </div>
            </div>
          </Glass>
        </div>

        <div>
          {data.report?.lifestyle.narrative && <p className="text-[12.5px] leading-relaxed text-white/80">{data.report.lifestyle.narrative}</p>}
          <p className="mt-4 text-[11px] uppercase tracking-widest text-white/60">What drove the score</p>
          <div className="mt-3 space-y-2.5">
            {bars.map((b, i) => {
              const up = b.points > 0;
              const detail = detailOf(b.code);
              return (
                <motion.div key={b.code} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[12px] text-white/85">
                      {up ? <TrendingUp className="h-3.5 w-3.5" style={{ color: GREEN }} /> : <TrendingDown className="h-3.5 w-3.5" style={{ color: RED }} />}
                      {b.factor}
                    </span>
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: up ? GREEN : RED }}>
                      {up ? "+" : ""}
                      {b.points}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(Math.abs(b.points) / maxAbs) * 100}%` }} transition={{ delay: i * 0.08 + 0.1, duration: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: up ? GREEN : RED }} />
                  </div>
                  {detail && <p className="mt-0.5 text-[10.5px] text-white/50">{detail}</p>}
                </motion.div>
              );
            })}
          </div>
          <button type="button" onClick={onContinue} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})` }}>
            See what I qualify for <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-white/45">
            <ShieldCheck className="h-3 w-3" /> Analysed on our servers · never shared
          </p>
        </div>
      </div>
    </MpesaStage>
  );
}

// ── THE LIMIT ──────────────────────────────────────────────────────────────────

function LimitPane({ data, onApply }: { data: CrunchResult; onApply: () => void }) {
  const go = useNavigate();
  const q = data.qualification;
  const limit = useCountUp(q.startingLimit, 1600, q.eligible);
  const cMax = Math.max(q.ceilings.score, q.ceilings.affordability, 1);

  if (!q.eligible) {
    return (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <StepCard icon={<AlertTriangle className="h-[18px] w-[18px]" style={{ color: "#b45309" }} />} title="No starting limit just yet">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Your statement scored {q.internalScore} — {q.scoreBand}. Here is what is holding a limit back:
          </p>
          <ul className="mt-3 space-y-2">
            {q.declineReasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: "#b45309" }} />
                {r}
              </li>
            ))}
          </ul>
        </StepCard>
        <StepCard icon={<ArrowRight className="h-[18px] w-[18px] text-ink-faint" />} title="What you can do">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            A newer statement with steadier income, less borrowing elsewhere and no betting reads differently. You can read a
            new one any time, or ask us what would change the answer.
          </p>
          <LiquidButton size="lg" block className="mt-4" variant="metal" icon={MessageSquare} onClick={() => go("/messages/new")}>
            Ask us
          </LiquidButton>
        </StepCard>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <section className="card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Your starting limit</p>
          <p className="tnum mt-1 text-[40px] font-bold leading-none tracking-[-0.03em]" style={{ color: "var(--green-ink)" }}>
            {money(limit)}
          </p>
          <p className="mt-2 text-[12px] text-ink-soft">
            Score {q.internalScore} · {q.scoreBand}
            {q.cappedByLender ? " · capped at the lender's maximum" : ""}
          </p>
          <div className="mt-4 space-y-2.5">
            {([
              ["Score ceiling", q.ceilings.score, q.ceilings.boundBy !== "affordability"],
              ["Affordability ceiling", q.ceilings.affordability, q.ceilings.boundBy !== "score"],
            ] as const).map(([label, val, bind]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className={bind ? "font-semibold" : "text-ink-faint"}>
                    {label}
                    {bind ? " — sets your limit" : ""}
                  </span>
                  <span className="tnum text-ink-soft">{money(val)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-sunk)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(val / cMax) * 100}%`, background: bind ? "var(--green-ink)" : "var(--line-strong)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />} title="Why this limit">
          <ul className="space-y-2">
            {q.reasonCodes.map((r) => (
              <li key={r.code} className="flex items-start gap-2 text-[12.5px] leading-snug">
                {r.tone === "down" ? (
                  <TrendingDown className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: "#b45309" }} />
                ) : (
                  <TrendingUp className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: r.tone === "up" ? "var(--green-ink)" : "var(--ink-faint)" }} />
                )}
                <span>
                  <span className="font-semibold">{r.label}.</span> <span className="text-ink-soft">{r.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </StepCard>
      </div>

      <div className="space-y-3">
        {q.products.length > 0 && (
          <StepCard icon={<Banknote className="h-[18px] w-[18px] text-ink-faint" />} title="Terms that fit">
            <ul className="space-y-2">
              {q.products.slice(0, 4).map((p) => (
                <li key={`${p.productId}:${p.termCount}`} className="rounded-xl border px-3 py-2.5" style={{ borderColor: p.recommended ? "var(--green-ink)" : "var(--line)" }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold">{p.name}</span>
                    {p.recommended && <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--green-ink)" }}>Best fit</span>}
                  </div>
                  <p className="tnum mt-0.5 text-[11.5px] text-ink-faint">
                    {money(p.principal)} over {p.termCount} {p.termUnit}{p.termCount === 1 ? "" : "s"} · {money(p.installment)} each · {money(p.totalRepayable)} total
                  </p>
                </li>
              ))}
            </ul>
          </StepCard>
        )}
        <StepCard icon={<ArrowRight className="h-[18px] w-[18px] text-ink-faint" />} title="Next">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            Choose your product, the amount and how many weeks to repay — priced exactly before you apply.
          </p>
          <LiquidButton size="lg" block className="mt-4" icon={Banknote} trailingIcon={ArrowRight} onClick={onApply}>
            Apply now
          </LiquidButton>
        </StepCard>
      </div>
    </div>
  );
}
