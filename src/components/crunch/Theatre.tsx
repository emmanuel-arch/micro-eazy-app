// ─────────────────────────────────────────────────────────────────────────────
// THE CRUNCH THEATRE — ported from the console's /console/crunch.
//
// connected-suite/src/components/statement/CrunchTheatre.tsx is the counter's
// version: a full-screen, Safaricom-branded sequence an officer runs with the
// customer beside them. This is the same sequence for the customer's own phone,
// cut to fit a pane instead of the whole window — the same backdrop, the same
// conic Safaricom ring, the same stages in the same order:
//
//   decrypt → parse → extract → post to ledgers → audit → score
//
// ── THE STAGING IS THEATRE, THE NUMBERS ARE NOT ─────────────────────────────
// Only the receipt codes that flicker while the server works are placeholders.
// The extract stage WAITS for the real response, and from that point on every
// counter, ledger bar, audit line and the score dial is the customer's actual
// statement. Nothing after extract is invented.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import type { CrunchResult } from "../../lib/api/portal";

export const GREEN = "#4CB749";
export const GREEN_DARK = "#1E8B3A";
export const AMBER = "#d97706";
export const RED = "#e11d48";
const SLATE = "#94a3b8";

export const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
const short = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(Math.round(n)));

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export function useCountUp(target: number, duration = 1200, active = true) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(target * easeOut(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return v;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const fakeReceipt = () =>
  "U" + CHARS[Math.floor(Math.random() * 26)] + Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");

/** The M-PESA ground every theatre pane stands on. A fixed look in both themes. */
export function MpesaStage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-[22px] text-white lg:h-full ${className}`}>
      <div aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: "url('/mpesa/mpesa-background.jpg')" }} />
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/65 backdrop-blur-[2px]" />
      <div className="h-full overflow-y-auto px-4 py-5 [scrollbar-width:none] sm:px-6">{children}</div>
    </div>
  );
}

export function SafaricomLoader({ size = 132 }: { size?: number }) {
  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ height: size, width: size }}>
      <span className="absolute inset-2 animate-ping rounded-full bg-white/15" />
      <span
        className="absolute inset-0 animate-spin rounded-full"
        style={{
          background: `conic-gradient(from 0deg, rgba(76,183,73,0) 0%, ${GREEN} 60%, #ffffff 95%, rgba(76,183,73,0) 100%)`,
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 7px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 7px))",
          animationDuration: "1.1s",
        }}
      />
      <span className="relative z-10 flex items-center justify-center rounded-2xl bg-white p-2.5 shadow-2xl ring-1 ring-white/60">
        <img src="/mpesa/safaricom-25.gif" alt="Safaricom" className="h-auto w-20 rounded-lg object-contain" />
      </span>
    </div>
  );
}

export function Glass({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md ${className}`}>{children}</div>;
}

// ── The stages ─────────────────────────────────────────────────────────────────

type Stage = "unlock" | "parse" | "extract" | "classify" | "audit" | "score";
const ORDER: Stage[] = ["unlock", "parse", "extract", "classify", "audit", "score"];
const DUR: Record<Stage, number> = { unlock: 700, parse: 800, extract: 1300, classify: 1200, audit: 1900, score: 2300 };
const RAIL: { stage: Stage; label: string }[] = [
  { stage: "unlock", label: "Decrypt" },
  { stage: "parse", label: "Parse" },
  { stage: "extract", label: "Extract" },
  { stage: "classify", label: "Ledger" },
  { stage: "audit", label: "Audit" },
  { stage: "score", label: "Score" },
];

const COPY: Record<Stage, { title: string; sub: string }> = {
  unlock: { title: "Decrypting your statement", sub: "Unlocking the password-protected PDF from Safaricom" },
  parse: { title: "Reading the document", sub: "Rebuilding every page, line and column" },
  extract: { title: "Extracting transactions", sub: "Posting each entry to the ledger" },
  classify: { title: "Posting to ledgers", sub: "Classifying every shilling in and out" },
  audit: { title: "Running the audit", sub: "Reconciling balances and testing behaviour" },
  score: { title: "Your credit score", sub: "Built from six months of real cashflow" },
};

const LIFE_TONE: Record<string, string> = {
  Betting: RED, "Alcohol & Nightlife": "#a855f7", Fuel: "#0ea5e9", Transport: "#38bdf8",
  "Food & Dining": AMBER, Groceries: GREEN, Health: "#ef4444", Education: "#6366f1",
  Utilities: "#64748b", "Airtime & Data": "#64748b", "Rent & Housing": "#8b5cf6", Savings: GREEN,
  "Financial & Loans": AMBER, Government: "#64748b", "Retail & Shopping": "#14b8a6",
  Transfers: SLATE, "Cash / ATM": SLATE, Other: SLATE,
};
const lifeTone = (c: string) => LIFE_TONE[c] ?? SLATE;

const CAT: Record<string, { label: string; tone: string }> = {
  income_received: { label: "Received money", tone: GREEN }, business_in: { label: "Business inflow", tone: GREEN },
  salary: { label: "Salary", tone: GREEN }, deposit: { label: "Agent deposit", tone: GREEN },
  savings_in: { label: "Savings in", tone: GREEN }, loan_in: { label: "Loans taken", tone: AMBER },
  send_money: { label: "Send money", tone: SLATE }, paybill: { label: "Paybill", tone: SLATE },
  till: { label: "Buy goods (Till)", tone: SLATE }, withdraw: { label: "Agent withdrawal", tone: SLATE },
  airtime: { label: "Airtime", tone: SLATE }, bank_transfer: { label: "Bank transfer", tone: SLATE },
  loan_repay: { label: "Loan repayments", tone: AMBER }, savings_out: { label: "Savings out", tone: SLATE },
  charge: { label: "Transaction charges", tone: SLATE }, gambling: { label: "Betting", tone: RED }, other: { label: "Other", tone: SLATE },
};
const catOf = (c: string) => CAT[c] ?? { label: c.replace(/_/g, " "), tone: SLATE };

function ExtractStage({ data }: { data: CrunchResult | null }) {
  const [feed, setFeed] = useState<{ id: number; receipt: string; details: string; amount: number; direction: "in" | "out" }[]>([]);
  const idRef = useRef(0);
  useEffect(() => {
    const iv = setInterval(() => {
      const id = idRef.current++;
      const row = data?.sample?.length ? data.sample[id % data.sample.length] : null;
      setFeed((f) =>
        [
          {
            id,
            receipt: fakeReceipt(),
            details: row ? row.details : "Reading entry…",
            amount: row ? row.amount : Math.round(Math.random() * 4000) + 50,
            direction: row ? row.direction : Math.random() > 0.5 ? ("in" as const) : ("out" as const),
          },
          ...f,
        ].slice(0, 5),
      );
    }, 190);
    return () => clearInterval(iv);
  }, [data]);

  const count = useCountUp(data?.transactionCount ?? 0, 2200, !!data);
  const pIn = useCountUp(data?.paidIn ?? 0, 2200, !!data);
  const pOut = useCountUp(data?.paidOut ?? 0, 2200, !!data);

  return (
    <div className="w-full">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-widest text-white/60">Transactions extracted</p>
        <p className="text-5xl font-bold tabular-nums" style={{ color: GREEN }}>
          {data ? Math.round(count).toLocaleString() : <span className="text-white/40">····</span>}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Glass className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/60">Paid in</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: GREEN }}>{data ? kes(pIn) : "—"}</p>
        </Glass>
        <Glass className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/60">Paid out</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-white">{data ? kes(pOut) : "—"}</p>
        </Glass>
      </div>
      <div className="mt-3 min-h-[150px] space-y-1.5">
        <AnimatePresence initial={false}>
          {feed.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5"
            >
              <span className="shrink-0 font-mono text-[10px] text-white/40">{r.receipt}</span>
              <span className="flex-1 truncate text-[11px] text-white/70">{r.details}</span>
              <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: r.direction === "in" ? GREEN : "#fff" }}>
                {r.direction === "in" ? "+" : "−"}
                {short(r.amount)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ClassifyStage({ data }: { data: CrunchResult }) {
  const life = data.report?.spendByCategory ?? [];
  const top = life.length
    ? life.slice(0, 8).map((c) => ({ label: c.category, count: c.count, amount: c.amount, tone: lifeTone(c.category) }))
    : data.categories.slice(0, 8).map((c) => ({ label: catOf(c.category).label, count: c.count, amount: c.amount, tone: catOf(c.category).tone }));
  const max = Math.max(...top.map((c) => c.amount), 1);
  return (
    <div className="w-full space-y-2">
      {top.map((c, i) => (
        <motion.div key={c.label} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="truncate text-white/80">{c.label}</span>
            <span className="shrink-0 tabular-nums text-white/50">
              {c.count} · {kes(c.amount)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(c.amount / max) * 100}%` }}
              transition={{ delay: i * 0.07 + 0.1, duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: c.tone }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function AuditStage({ data }: { data: CrunchResult }) {
  const f = data.features;
  const monthsWithIncome = Math.round(f.incomeMonthsRatio * f.monthsCovered);
  const nc = data.nameCheck;
  const checks: { ok: boolean; text: string }[] = [
    ...(nc.expectedName
      ? [{ ok: nc.matched, text: nc.matched ? `Statement holder “${nc.statementName}” matches ${nc.expectedName}` : "Could not read the holder's name from the statement header" }]
      : []),
    { ok: true, text: `Reconciled ${data.transactionCount.toLocaleString()} entries · closing balance ${kes(f.closingBalance)}` },
    { ok: f.incomeMonthsRatio >= 0.8, text: `Income received in ${monthsWithIncome} of ${f.monthsCovered} months` },
    { ok: f.incomeVolatility <= 0.5, text: `Income volatility ${f.incomeVolatility} (${f.incomeVolatility <= 0.5 ? "stable" : "erratic"})` },
    { ok: f.gamblingRatio <= 0.02, text: f.gamblingOutflow > 0 ? `Betting ${Math.round(f.gamblingRatio * 100)}% of outflow (${kes(f.gamblingOutflow)})` : "Betting: none detected" },
    { ok: f.loanDependencyRatio <= 0.15, text: `Loan dependency ${Math.round(f.loanDependencyRatio * 100)}% of inflow · ${f.loanEventCount} events` },
    { ok: f.avgMonthlyNet > 0, text: `Monthly surplus ${kes(f.avgMonthlyNet)} after spending` },
  ];
  return (
    <div className="w-full space-y-1.5">
      {checks.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.22 }}
          className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"
        >
          {c.ok ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0" style={{ color: GREEN }} /> : <AlertTriangle className="mt-px h-4 w-4 shrink-0" style={{ color: AMBER }} />}
          <span className="text-[12px] leading-snug text-white/80">{c.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

const TONE_COLOR: Record<string, string> = { good: GREEN, warn: AMBER, high: "#f97316", bad: RED };

export function ScoreDial({ data, size = 200 }: { data: CrunchResult; size?: number }) {
  const s = data.creditScore;
  const MIN = 300;
  const pctTarget = Math.max(0, Math.min(1, (s.score - MIN) / (s.maxScore - MIN)));
  const shown = useCountUp(s.score, 1800);
  const arc = useCountUp(pctTarget, 1800);
  const color = TONE_COLOR[s.tone] ?? GREEN;
  const R = 78;
  const C = 2 * Math.PI * R;
  const GAP = 0.25;
  return (
    <div className="w-full text-center">
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 200 200" className="-rotate-[225deg]">
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${C * (1 - GAP)} ${C}`} />
          <circle cx="100" cy="100" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${C * (1 - GAP) * arc} ${C}`} style={{ filter: `drop-shadow(0 0 10px ${color}66)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-5xl font-bold tabular-nums text-white">{Math.round(shown)}</p>
          <p className="text-[11px] text-white/50">of {s.maxScore}</p>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
        <p className="text-lg font-bold" style={{ color }}>{s.band}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70">Default risk {s.pdPercent}</span>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * The running sequence. Starts the moment it mounts; `data` arrives whenever the
 * server answers. Calls `onDone` once the score has landed.
 */
export function Theatre({ data, onDone }: { data: CrunchResult | null; onDone: () => void }) {
  const [stage, setStage] = useState<Stage>("unlock");
  const [tick, setTick] = useState(fakeReceipt());
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (data) return;
    const iv = setInterval(() => setTick(fakeReceipt()), 110);
    return () => clearInterval(iv);
  }, [data]);

  const waiting = stage === "extract" && !data;
  useEffect(() => {
    if (waiting) return;
    const t = setTimeout(() => {
      if (stage === "score") doneRef.current();
      else setStage((s) => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(s) + 1)]);
    }, DUR[stage]);
    return () => clearTimeout(t);
  }, [stage, waiting]);

  const activeIdx = RAIL.findIndex((r) => r.stage === stage);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-5 flex items-center gap-1">
        {RAIL.map((r, i) => (
          <div key={r.stage} className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: GREEN }}
                initial={{ width: 0 }}
                animate={{ width: i < activeIdx ? "100%" : i === activeIdx ? "50%" : "0%" }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className={`mt-1 text-center text-[8px] uppercase tracking-wide ${i <= activeIdx ? "text-white/70" : "text-white/30"}`}>{r.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70">
          <FileText className="h-3 w-3" /> M-PESA STATEMENT CRUNCHER
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={stage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            <h2 className="mt-2 text-xl font-bold text-white drop-shadow">{COPY[stage].title}</h2>
            <p className="mt-1 text-[12px] text-white/70">{waiting ? `Scanning entry ${tick}` : COPY[stage].sub}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={stage} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.28 }}>
          {(stage === "unlock" || stage === "parse") && (
            <div className="py-4">
              <SafaricomLoader />
              <div className="mt-6 flex items-center justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-white" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="mt-4 text-center font-mono text-[10px] text-white/40">{tick}</p>
            </div>
          )}
          {stage === "extract" && <ExtractStage data={data} />}
          {stage === "classify" && data && <ClassifyStage data={data} />}
          {stage === "audit" && data && <AuditStage data={data} />}
          {stage === "score" && data && <ScoreDial data={data} />}
        </motion.div>
      </AnimatePresence>

      {data && stage !== "score" && (
        <button type="button" onClick={() => setStage("score")} className="mt-5 w-full text-center text-[11px] text-white/45 hover:text-white/80">
          Skip to my score
        </button>
      )}
    </div>
  );
}
