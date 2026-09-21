// ─────────────────────────────────────────────────────────────────────────────
// APPLY NOW — from limit to application, one decision per pane.
//
//   1. Standing     your limit, your score, your verification — and the credit
//                   bureau check, with your permission, where the lender's Risk
//                   stage requires one
//   2. Product      what your limit opens: a limit up to KSh 10,900 opens Micro
//                   Chap Chap; from KSh 10,901 every product is open. Products
//                   you cannot have yet are shown locked, with the reason
//   3. Amount       your limit or anything below it
//   4. Period       how many weeks — priced per week, so fewer weeks cost less
//   5. Schedule     move money between instalments; the total cannot change
//   6. Overview     every figure, every fee and when it is taken, the lender's
//                   terms word for word, and Apply now
//   7. Submitted    where it went — the lender's Risk stage — and how to follow it
//
// ── THE SHELF RULES, NOT THIS FILE ──────────────────────────────────────────
// Which product opens at which limit is each product's own minimum and maximum
// on the lender's live shelf; the price is the lender's own fee sheet. Nothing
// here hard-codes KSh 10,901. Change the shelf and the screen follows.
//
// ── THE QUOTE IS NOT THE LOAN ───────────────────────────────────────────────
// The figures are priced with lib/quote.ts, a port of the server's arithmetic.
// The server prices the application again on submit and keeps the customer's
// reshaped schedule only if it adds up to its own total to the cent.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Banknote, CalendarDays, Check, CheckCircle2, Clock, FileSpreadsheet, FileText, Gauge, Lock, MessageSquare,
  Route as RouteIcon, ScanFace, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { FlowScreen, Notice, StepCard, type FlowStep } from "../../components/flow/FlowScreen";
import { Tick } from "../../components/flow/Fields";
import { LiquidButton } from "../../components/ui/LiquidButton";
import ScheduleEditor from "../onboarding/ScheduleEditor";
import { Holding } from "../kyc/Kyc";
import {
  apply, home, journey, listProducts,
  type ApplyPlacement, type ApplyResponse, type HomeResponse, type JourneyResponse,
} from "../../lib/api/portal";
import { affordableRange, quote, termOptions, ratePerPeriod, type Product } from "../../lib/quote";
import type { Row } from "../../lib/schedule/reshape";
import { money, shortDate, longDate } from "../../lib/format";
import { useLender } from "../../lib/lender";
import { useSession } from "../../lib/session";
import {
  MICROMART_ADDRESS, MICROMART_CONTACT, MICROMART_CRB_CONSENT, MICROMART_TERMS, MICROMART_TERMS_TITLE, MICROMART_TERMS_VERSION,
} from "../../lib/terms/micromart";

type Loaded = { j: JourneyResponse; h: HomeResponse | null; products: Product[] };

export default function ApplyNow() {
  const { nationalId } = useSession();
  const [state, setState] = useState<{ s: "loading" } | { s: "error"; message: string } | { s: "ready"; d: Loaded }>({ s: "loading" });

  const load = useCallback(() => {
    setState({ s: "loading" });
    Promise.all([journey(), home(nationalId ?? "").catch(() => null), listProducts().catch(() => null)])
      .then(([j, h, p]) => setState({ s: "ready", d: { j, h, products: p?.products ?? [] } }))
      .catch((e: unknown) => setState({ s: "error", message: e instanceof Error ? e.message : "We could not load your application." }));
  }, [nationalId]);
  useEffect(load, [load]);

  if (state.s === "loading") return <Holding title="Apply now" line="Reading your limit and your lender's products…" />;
  if (state.s === "error") return <Holding title="Apply now" line={state.message} onRetry={load} />;
  return <ApplyFlow d={state.d} reload={load} />;
}

const unitWord = (unit: string, n: number) => {
  const u = unit.toLowerCase().replace(/s$/, "");
  return n === 1 ? u : `${u}s`;
};

function ApplyFlow({ d, reload }: { d: Loaded; reload: () => void }) {
  const go = useNavigate();
  const lender = useLender();
  const { j, h } = d;
  const st = j.status;
  const c = j.contract;

  // ── THE LIMIT AND THE SCORE ──────────────────────────────────────────────
  // The lender's own book speaks for an existing customer; a new customer's
  // limit is the one the statement cruncher allocated.
  const bookLimit = h && h.bookSource === "lender" ? h.available : null;
  const limit = bookLimit ?? st.borrower?.loanLimit ?? st.crunch?.startingLimit ?? 0;
  const score = st.crunch?.score ?? st.borrower?.creditScore ?? h?.score ?? null;

  // ── WHAT STANDS IN THE WAY ───────────────────────────────────────────────
  const kycOk =
    j.existingCustomer ||
    st.borrower?.kycStatus === "VERIFIED" ||
    (st.borrower?.kycStatus === "PENDING_REVIEW" && (st.kyc?.flags ?? ["manualReview"]).every((f) => f === "manualReview"));
  const crunchOk = limit > 0 && (bookLimit != null || (st.crunch?.eligible ?? false) || (st.borrower?.loanLimit ?? 0) > 0);
  const blocked: { icon: typeof ScanFace; title: string; body: string; cta: string; to: string } | null =
    !st.borrower && !j.existingCustomer
      ? { icon: ScanFace, title: "Verify your identity first", body: "Applying starts with KYC verification.", cta: "Go to KYC verification", to: "/kyc" }
      : !kycOk
        ? st.borrower?.kycStatus === "PENDING_REVIEW"
          ? { icon: Clock, title: "Your ID is with our team", body: "A person is reviewing your identity. You can apply as soon as it clears — we will message you.", cta: "Messages", to: "/messages" }
          : { icon: ScanFace, title: "Finish your KYC verification", body: "Your identity check is not complete yet.", cta: "Go to KYC verification", to: "/kyc" }
        : st.application
          ? { icon: RouteIcon, title: "You already have an application", body: `${money(st.application.amount)} on ${st.application.product ?? "your application"} is ${st.application.stageTitle ? `with ${st.application.stageTitle}` : "in progress"}. One application at a time.`, cta: "Track it", to: "/track" }
          : st.activeLoan && c.flags.oneActiveLoan
            ? { icon: Banknote, title: "Clear your current loan first", body: `${lender.short} lends one loan at a time. Once your running loan is cleared, your next one is a few taps away.`, cta: "Repay", to: "/repay" }
            : !crunchOk
              ? { icon: FileSpreadsheet, title: "Read your statement first", body: "Your starting limit comes from your M-PESA statement.", cta: "Go to the statement cruncher", to: "/crunch" }
              : null;

  // ── THE BUREAU — AUTHORISED HERE, PULLED AT RISK ─────────────────────────
  // Until 22 Sep 2026 the customer pressed "Run my credit check" here and the
  // app bought the Metropol file itself, before a product was even chosen. The
  // pull belongs to the lender's Risk stage: an officer requests it from the
  // console (through the Interchange) while reviewing THIS application, and the
  // console's own gate will not let Risk be actioned without it. So this step
  // takes the customer's authorisation and nothing else — the lawful basis the
  // officer's pull stands on — and says where the check actually happens.
  const crbFresh = st.crb ? Date.now() - new Date(st.crb.at).getTime() < 30 * 86_400_000 : false;
  const [crbConsent, setCrbConsent] = useState(false);
  const crbDone = !st.crbRequired || crbFresh || crbConsent;

  // ── THE CHOICES ──────────────────────────────────────────────────────────
  const products = d.products;
  const [productId, setProductId] = useState<string | null>(null);
  const product = products.find((p) => p.id === productId) ?? null;
  const range = product ? affordableRange(product, limit) : null;
  const [amount, setAmount] = useState(0);
  const [term, setTerm] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [crbShare, setCrbShare] = useState(false);
  // The authorisation given on step one carries to the last step's box, so a
  // customer is not asked the same question twice in one sitting.
  useEffect(() => {
    if (crbConsent) setCrbShare(true);
  }, [crbConsent]);

  const q = useMemo(
    () => (product && range && amount >= range.min && amount <= range.max && term ? quote(product, amount, new Date(), term) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- range is a fresh object each render; its bounds are the dependency
    [product, range?.min, range?.max, amount, term],
  );

  const [at, setAt] = useState(0);
  const [reachable, setReachable] = useState(0);
  const open = (n: number) => {
    setReachable((r) => Math.max(r, n));
    setAt(n);
  };
  /** A change upstream invalidates everything priced after it. */
  const invalidateFrom = (n: number) => setReachable((r) => Math.min(r, n));

  // ── SUBMIT ───────────────────────────────────────────────────────────────
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<{ message: string; to?: string; step?: number } | null>(null);
  const [placed, setPlaced] = useState<(ApplyResponse & ApplyPlacement) | null>(null);
  const fired = useRef(false);

  async function submit() {
    if (!product || !q || fired.current) return;
    fired.current = true;
    setSending(true);
    setSendError(null);
    try {
      const plan = rows ?? q.rows;
      const r = await apply({
        productId: product.id,
        amount: q.principal,
        termCount: q.periods,
        schedule: plan.map((x) => ({ seq: x.seq, dueDate: x.dueDate, amount: x.cents / 100 })),
        agreement: { accepted: true, version: MICROMART_TERMS_VERSION, crbConsent: crbShare },
      });
      setPlaced(r);
      open(6);
    } catch (e) {
      fired.current = false;
      const body = (e as { body?: { reason?: string; field?: string; message?: string } }).body;
      const reason = body?.reason;
      setSendError({
        message: body?.message ?? (e instanceof Error ? e.message : "We could not file your application."),
        ...(reason === "crb" ? { step: 0 } : reason === "crunch" ? { to: "/crunch" } : reason === "kyc" ? { to: "/kyc" } : {}),
      });
    } finally {
      setSending(false);
    }
  }

  const isMicromart = lender.slug === "micromart";
  const unit = product?.repaymentUnit ?? "week";

  const steps: FlowStep[] = [
    // 1 ── STANDING ─────────────────────────────────────────────────────────
    {
      id: "standing",
      label: "Your standing",
      title: "Apply now",
      blurb: "Your limit, your score, and the checks behind them.",
      required: true,
      why: st.crbRequired ? `${lender.short}'s Risk team decides every application with a current credit bureau report in hand.` : undefined,
      node: blocked ? (
        <StepCard icon={<blocked.icon className="h-[18px] w-[18px]" style={{ color: "var(--brand-ink)" }} />} title={blocked.title}>
          <p className="text-[13px] leading-relaxed text-ink-soft">{blocked.body}</p>
          <LiquidButton size="lg" className="mt-4" trailingIcon={ArrowRight} onClick={() => go(blocked.to)}>
            {blocked.cta}
          </LiquidButton>
        </StepCard>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <section className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">You can borrow up to</p>
                  <p className="tnum mt-1 text-[36px] font-bold leading-none tracking-[-0.03em]">{money(limit)}</p>
                  <p className="mt-2 text-[12px] text-ink-soft">{bookLimit != null ? `From your ${lender.short} account` : "Set from your M-PESA statement"}</p>
                </div>
                {score != null && (
                  <div className="rounded-xl px-3 py-2 text-right" style={{ background: "var(--surface-sunk)" }}>
                    <p className="flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-faint">
                      <Gauge className="h-3 w-3" /> Score
                    </p>
                    <p className="tnum mt-1 text-[22px] font-bold leading-none">{score}</p>
                  </div>
                )}
              </div>
              <ul className="mt-4 space-y-2 border-t pt-3 text-[12.5px]" style={{ borderColor: "var(--line)" }}>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: "var(--green-ink)" }} />
                  {j.existingCustomer && !st.borrower ? `Verified by ${lender.short}` : st.borrower?.kycStatus === "PENDING_REVIEW" ? "Identity checks passed — sign-off pending" : "Identity verified"}
                </li>
                {st.crunch && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: "var(--green-ink)" }} />
                    Statement read {shortDate(st.crunch.at)}
                  </li>
                )}
              </ul>
            </section>
          </div>

          <div className="space-y-3">
            {st.crbRequired && (
              <StepCard icon={<ShieldCheck className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />} title="Credit bureau check" meta={crbDone ? <Check className="h-4 w-4" style={{ color: "var(--green-ink)" }} /> : undefined}>
                {crbFresh ? (
                  <p className="text-[12.5px] leading-relaxed text-ink-soft">
                    Done on {longDate(st.crb!.at)}. It is current for 30 days, so it is not requested again.
                  </p>
                ) : (
                  <>
                    <p className="text-[12.5px] leading-relaxed text-ink-soft">
                      {lender.short}&apos;s Risk team requests your credit report from <strong className="font-semibold text-ink">Metropol CRB</strong> when
                      they review this application. The KSh 100 CRB fee on your loan covers it.
                    </p>
                    <div className="mt-3">
                      <Tick checked={crbConsent} onChange={setCrbConsent}>
                        I authorise {lender.name} to request my credit reports from Metropol CRB for this application.
                      </Tick>
                    </div>
                  </>
                )}
              </StepCard>
            )}
            <StepCard icon={<ArrowRight className="h-[18px] w-[18px] text-ink-faint" />} title="Continue">
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Next, choose a product your limit opens.</p>
              <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} disabled={!crbDone} onClick={() => open(1)}>
                {crbDone ? "Choose a product" : "Authorise the credit check first"}
              </LiquidButton>
            </StepCard>
          </div>
        </div>
      ),
    },

    // 2 ── PRODUCT ──────────────────────────────────────────────────────────
    {
      id: "product",
      label: "Product",
      title: "Choose your product",
      blurb: `Your limit of ${money(limit)} decides which products are open.`,
      required: true,
      node: (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {products.length === 0 && (
            <Notice tone="warn" icon={<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#b45309" }} />}>
              We could not load {lender.short}'s products just now.{" "}
              <button type="button" onClick={reload} className="font-semibold underline">Try again</button>
            </Notice>
          )}
          {[...products].sort((a, b) => a.minPrincipal - b.minPrincipal).map((p) => {
            // Locked by LIMIT only. The shelf's MinCreditScore is on the lender's
            // own scale, not the 300–900 one, and the server does not gate on it —
            // comparing the two would lock customers out of a product they may have.
            const r = affordableRange(p, limit);
            const locked = !r;
            const on = p.id === productId;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                disabled={locked}
                onClick={() => {
                  setProductId(p.id);
                  const rr = affordableRange(p, limit);
                  if (rr) setAmount(rr.max);
                  setTerm(null);
                  setRows(null);
                  invalidateFrom(2);
                }}
                className="card w-full overflow-hidden text-left transition-transform active:scale-[0.995] disabled:cursor-default"
                // Muted by ink, not by opacity: a translucent card over the Sky
                // turned its name into dark type on a dark band.
                style={{ boxShadow: on ? "0 0 0 2px var(--green-ink), var(--shadow-lift)" : undefined }}
              >
                <div className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border" style={{ borderColor: on ? "transparent" : "var(--line-strong)", background: on ? "var(--lime)" : "transparent" }}>
                    {on ? <Check className="h-3 w-3" strokeWidth={3} style={{ color: "var(--navy-deep)" }} /> : locked ? <Lock className="h-2.5 w-2.5 text-ink-faint" /> : null}
                  </span>
                  <span className={`min-w-0 flex-1 ${locked ? "text-ink-faint" : ""}`}>
                    <span className="block text-[15px] font-bold tracking-[-0.015em]">{p.name}</span>
                    <span className="tnum mt-0.5 block text-[12px] text-ink-soft">
                      {money(p.minPrincipal)} – {money(p.maxPrincipal)} · {ratePerPeriod(p).toFixed(2).replace(/\.00$/, "")}% a {p.repaymentUnit.toLowerCase().replace(/s$/, "")}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                      {termOptions(p).length > 1 ? `Repay over 1 to ${p.repaymentPeriod} ${unitWord(p.repaymentUnit, p.repaymentPeriod)}` : `Repay over ${p.repaymentPeriod} ${unitWord(p.repaymentUnit, p.repaymentPeriod)}`}
                    </span>
                  </span>
                </div>
                {locked && (
                  <div className="flex items-start gap-2 border-t px-4 py-2.5 text-[12px] leading-snug text-ink-soft" style={{ borderColor: "var(--line)", background: "var(--surface-sunk)" }}>
                    <Lock className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" />
                    Opens when your limit reaches {money(p.minPrincipal)}. Repaying on time raises it.
                  </div>
                )}
              </button>
            );
          })}
          <div className="lg:col-span-2">
            <LiquidButton size="lg" block trailingIcon={ArrowRight} disabled={!product || !range} onClick={() => open(2)}>
              {product ? `Continue with ${product.name}` : "Choose a product"}
            </LiquidButton>
          </div>
        </div>
      ),
    },

    // 3 ── AMOUNT ───────────────────────────────────────────────────────────
    {
      id: "amount",
      label: "Amount",
      title: "How much?",
      blurb: range ? `Anything from ${money(range.min)} up to ${money(range.max)}.` : "Choose a product first.",
      required: true,
      node: product && range ? (
        <AmountPane
          min={range.min}
          max={range.max}
          limit={limit}
          amount={amount}
          onAmount={(n) => {
            setAmount(n);
            setRows(null);
            invalidateFrom(3);
          }}
          onDone={() => open(3)}
        />
      ) : null,
    },

    // 4 ── PERIOD ───────────────────────────────────────────────────────────
    {
      id: "period",
      label: "Repayment period",
      title: "How long to repay?",
      blurb: product ? `Priced at ${ratePerPeriod(product).toFixed(2).replace(/\.00$/, "")}% for each ${unit.toLowerCase().replace(/s$/, "")} you choose.` : "",
      required: true,
      node: product && range ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-faint" style={{ borderColor: "var(--line)" }}>
              <span>Period</span>
              <span className="text-right">Interest</span>
              <span className="text-right">Each</span>
              <span className="text-right">Total</span>
            </div>
            <ul className="max-h-[440px] overflow-y-auto [scrollbar-width:thin]">
              {termOptions(product).map((n) => {
                const x = quote(product, amount, new Date(), n);
                const on = term === n;
                return (
                  <li key={n}>
                    <button
                      type="button"
                      onClick={() => {
                        setTerm(n);
                        setRows(null);
                        invalidateFrom(4);
                      }}
                      className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-b px-4 py-2.5 text-left last:border-b-0"
                      style={{ borderColor: "var(--line)", background: on ? "color-mix(in oklab, var(--lime) 14%, transparent)" : undefined }}
                    >
                      <span className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="grid h-4 w-4 place-items-center rounded-full border" style={{ borderColor: on ? "transparent" : "var(--line-strong)", background: on ? "var(--green-ink)" : "transparent" }}>
                          {on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                        </span>
                        {n} {unitWord(unit, n)}
                        <span className="text-[11px] font-normal text-ink-faint">{x.totalRatePct}%</span>
                      </span>
                      <span className="tnum text-right text-[12.5px] text-ink-soft">{money(x.totalInterest)}</span>
                      <span className="tnum text-right text-[12.5px] text-ink-soft">{money(x.perPeriod)}</span>
                      <span className="tnum text-right text-[13px] font-semibold">{money(x.totalRepayable)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <StepCard icon={<CalendarDays className="h-[18px] w-[18px] text-ink-faint" />} title="Your choice">
            {q ? (
              <dl className="space-y-2 text-[12.5px]">
                <Line k="You borrow" v={money(q.principal)} />
                <Line k={`Interest · ${q.totalRatePct}%`} v={money(q.totalInterest)} />
                {q.spread > 0 && <Line k="Fees in your instalments" v={money(q.spread)} />}
                <Line k="You repay" v={money(q.totalRepayable)} strong />
                <Line k={`About each ${unit.toLowerCase().replace(/s$/, "")}`} v={money(q.perPeriod)} />
                <Line k="Clear by" v={shortDate(q.clearDate)} />
              </dl>
            ) : (
              <p className="text-[12.5px] text-ink-soft">Pick a period to see exactly what it costs.</p>
            )}
            <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} disabled={!q} onClick={() => open(4)}>
              {q ? "Shape my repayments" : "Choose a period"}
            </LiquidButton>
          </StepCard>
        </div>
      ) : null,
    },

    // 5 ── SCHEDULE ─────────────────────────────────────────────────────────
    {
      id: "schedule",
      label: "Schedule",
      title: "Shape your repayments",
      blurb: "Move amounts between instalments until the plan fits how you earn.",
      node: q ? (
        <ScheduleEditor
          key={`${q.product.id}:${q.principal}:${q.periods}`}
          quote={q}
          onDone={(r) => {
            setRows(r);
            open(5);
          }}
        />
      ) : null,
    },

    // 6 ── OVERVIEW ─────────────────────────────────────────────────────────
    {
      id: "overview",
      label: "Loan overview",
      title: "Your loan overview",
      blurb: "Every figure and every charge, before you apply.",
      required: true,
      why: "A customer who has not seen the charges has not agreed to them. This is the step that makes every other one defensible.",
      node: q && product ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <StepCard icon={<Banknote className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />} title={product.name}>
              <dl className="space-y-2 text-[12.5px]">
                <Line k="Amount" v={money(q.principal)} strong />
                <Line k="Repayment period" v={`${q.periods} ${unitWord(q.unit, q.periods)}`} />
                <Line k={`Interest · ${q.ratePerPeriod}% × ${q.periods}`} v={`${money(q.totalInterest)} (${q.totalRatePct}%)`} />
                {q.fees.map((f) => (
                  <Line
                    key={f.code}
                    k={`${f.name} · ${f.when === "before-disbursement" ? "paid before the money is sent" : f.when === "on-disbursement" ? "deducted from the amount sent" : "spread across instalments"}`}
                    v={money(f.amount)}
                  />
                ))}
                <Line k="Sent to your M-PESA" v={money(q.netDisbursed)} />
                <Line k="Total to repay" v={money(q.totalRepayable)} strong />
                <Line k="Instalments" v={String((rows ?? q.rows).length)} />
                <Line k="First and last due" v={`${shortDate((rows ?? q.rows)[0].dueDate)} – ${shortDate((rows ?? q.rows)[(rows ?? q.rows).length - 1].dueDate)}`} />
                {rows && rows.some((r, i) => r.cents !== q.rows[i]?.cents) && <Line k="Schedule" v="Shaped by you" />}
              </dl>
            </StepCard>
            <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px] text-ink-faint" />} title="Apply">
              <div className="space-y-2.5">
                <Tick checked={accepted} onChange={setAccepted}>
                  I have read and accept the {isMicromart ? "Micromart Africa terms and conditions" : `${lender.name} loan terms`}, and I request this loan.
                </Tick>
                <Tick checked={crbShare} onChange={setCrbShare}>
                  {isMicromart ? MICROMART_CRB_CONSENT : `I authorise ${lender.name} to query and share my credit information with licensed CRBs.`}
                </Tick>
              </div>
              {sendError && (
                <div className="mt-3">
                  <Notice tone="bad" icon={<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#e11d48" }} />}>
                    {sendError.message}{" "}
                    {sendError.to && <button type="button" className="font-semibold underline" onClick={() => go(sendError.to!)}>Fix it</button>}
                    {sendError.step != null && <button type="button" className="font-semibold underline" onClick={() => setAt(sendError.step!)}>Fix it</button>}
                  </Notice>
                </div>
              )}
              <LiquidButton size="lg" block className="mt-4" icon={Banknote} loading={sending} disabled={!accepted || !crbShare || sending} onClick={submit}>
                {sending ? "Applying" : !accepted || !crbShare ? "Tick both boxes to apply" : "Apply now"}
              </LiquidButton>
            </StepCard>
          </div>

          <section className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[640px]">
            <div className="flex items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "var(--line)" }}>
              <FileText className="h-[18px] w-[18px] shrink-0 text-ink-faint" />
              <p className="flex-1 text-[13px] font-semibold">{isMicromart ? MICROMART_TERMS_TITLE : "Loan terms"}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-[12px] leading-relaxed text-ink-soft" tabIndex={0}>
              {isMicromart ? (
                <>
                  {MICROMART_TERMS.map((s) => (
                    <div key={s.heading}>
                      <p className="font-semibold text-ink">{s.heading}</p>
                      {s.blocks.map((b, i) =>
                        b.kind === "p" ? (
                          <p key={i} className="mt-1">{b.text}</p>
                        ) : (
                          <ul key={i} className="mt-1 list-disc space-y-0.5 pl-4">
                            {b.items.map((t) => <li key={t}>{t}</li>)}
                          </ul>
                        ),
                      )}
                    </div>
                  ))}
                  <p>{MICROMART_CRB_CONSENT}</p>
                  <p className="border-t pt-3 text-[11px] text-ink-faint" style={{ borderColor: "var(--line)" }}>
                    {MICROMART_ADDRESS}
                    <br />
                    {MICROMART_CONTACT}
                  </p>
                </>
              ) : (
                <p>The lender's full terms are sent to you with your offer.</p>
              )}
            </div>
          </section>
        </div>
      ) : null,
    },

    // 7 ── SUBMITTED ────────────────────────────────────────────────────────
    {
      id: "done",
      label: "Submitted",
      title: "Application received",
      blurb: "Where it is now, and how to follow it.",
      node: placed ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />} title={`${money(placed.amount)} on ${placed.product}`}>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Your application is in{placed.stage ? <> and is now with <strong className="font-semibold text-ink">{placed.stage.title}</strong></> : ""}. You can follow it through every stage, and message the team at any
              point.
            </p>
            {placed.stage && (
              <ol className="mt-4 flex flex-wrap items-center gap-2">
                {placed.stage.stages.map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-[12px] font-semibold"
                      style={i === placed.stage!.index ? { background: "var(--brand)", color: "var(--brand-on)" } : { background: "var(--surface-sunk)", color: "var(--ink-faint)" }}
                    >
                      {s}
                    </span>
                    {i < placed.stage!.stages.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />}
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />
                  <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: "var(--surface-sunk)", color: "var(--ink-faint)" }}>
                    Money sent
                  </span>
                </li>
              </ol>
            )}
            {placed.plan && (
              <dl className="mt-4 space-y-2 border-t pt-3 text-[12.5px]" style={{ borderColor: "var(--line)" }}>
                <Line k="Total to repay" v={money(placed.plan.totalRepayable)} strong />
                <Line k="Sent to your M-PESA once approved" v={money(placed.plan.netDisbursed)} />
              </dl>
            )}
          </StepCard>
          <StepCard icon={<ArrowRight className="h-[18px] w-[18px] text-ink-faint" />} title="Follow it">
            <div className="flex flex-col gap-2">
              <LiquidButton size="lg" block icon={RouteIcon} onClick={() => go("/track")}>
                Track my application
              </LiquidButton>
              {placed.threadId && (
                <LiquidButton size="lg" block variant="metal" icon={MessageSquare} onClick={() => go(`/messages/${placed.threadId}`)}>
                  Message the team
                </LiquidButton>
              )}
            </div>
          </StepCard>
        </div>
      ) : null,
    },
  ];

  return (
    <FlowScreen
      label="Apply now"
      steps={blocked ? steps.slice(0, 1) : steps}
      at={blocked ? 0 : at}
      reachable={blocked ? 0 : placed ? 6 : Math.min(reachable, 5)}
      onAt={(n) => !placed && setAt(Math.min(n, reachable))}
    />
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-b-0" style={{ borderColor: "var(--line)" }}>
      <dt className="text-ink-faint">{k}</dt>
      <dd className={`tnum shrink-0 text-right ${strong ? "text-[14px] font-bold" : "font-semibold"}`}>{v}</dd>
    </div>
  );
}

function AmountPane({
  min, max, limit, amount, onAmount, onDone,
}: {
  min: number;
  max: number;
  limit: number;
  amount: number;
  onAmount: (n: number) => void;
  onDone: () => void;
}) {
  const step = max - min > 20_000 ? 500 : 100;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  const value = Math.min(max, Math.max(min, amount || max));
  const chips = [...new Set([min, clamp(min + (max - min) * 0.25), clamp(min + (max - min) * 0.5), clamp(min + (max - min) * 0.75), max])];
  const [typed, setTyped] = useState(String(value));
  useEffect(() => setTyped(String(value)), [value]);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">You want to borrow</p>
          <p className="text-[11.5px] text-ink-faint">
            limit <span className="tnum font-semibold text-ink-soft">{money(limit)}</span>
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[22px] font-bold text-ink-faint">KSh</span>
          <input
            inputMode="numeric"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
            onBlur={() => onAmount(clamp(Number(typed) || min))}
            className="tnum w-full bg-transparent text-[40px] font-bold leading-none tracking-[-0.03em] outline-none"
            aria-label="Amount"
          />
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onAmount(Number(e.target.value))} className="mt-4 w-full" style={{ accentColor: "var(--green-ink)" }} aria-label="Amount slider" />
        <div className="tnum flex justify-between text-[11px] text-ink-faint">
          <span>{money(min)}</span>
          <span>{money(max)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((n) => {
            const on = value === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onAmount(n)}
                className="tnum rounded-full border px-3.5 py-2 text-[12.5px] font-semibold"
                style={{ borderColor: on ? "transparent" : "var(--line-strong)", background: on ? "color-mix(in oklab, var(--lime) 26%, transparent)" : "transparent", color: on ? "var(--green-ink)" : "var(--ink-soft)" }}
              >
                {n === max ? `${money(n)} · max` : money(n)}
              </button>
            );
          })}
        </div>
      </section>
      <StepCard icon={<ArrowRight className="h-[18px] w-[18px] text-ink-faint" />} title="Continue">
        <p className="text-[12.5px] leading-relaxed text-ink-soft">Borrow only what you need — the cost of credit is charged on the amount you take.</p>
        <LiquidButton
          size="lg"
          block
          className="mt-4"
          trailingIcon={ArrowRight}
          onClick={() => {
            const n = clamp(Number(typed) || value);
            onAmount(n);
            onDone();
          }}
        >
          Continue with {money(clamp(Number(typed) || value))}
        </LiquidButton>
      </StepCard>
    </div>
  );
}
