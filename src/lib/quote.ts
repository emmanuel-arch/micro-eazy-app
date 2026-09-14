// ─────────────────────────────────────────────────────────────────────────────
// THE QUOTE — what a product costs, before there is an application.
//
// ── THIS FILE APPEARS TO CONTRADICT reshape.ts, AND DOES NOT ────────────────
// lib/schedule/reshape.ts says, in capitals, that interest is computed in
// exactly one place and never in the client. That rule is about the OFFER: the
// numbers a customer signs and the numbers the lender books have to come from
// one function, or the day they drift somebody signs one figure and owes
// another.
//
// A QUOTE is a different object with a different job. It is the shop window —
// "KSh 5,000 over ten weeks costs you KSh 4,125" — and it exists before any
// application row does, so there is nothing on the server to ask. Every lender
// in this market publishes one; the ones that do not are the ones customers
// distrust, because a product you cannot price until after you have applied is
// a product you are being walked into.
//
// The boundary is enforced by the TYPES rather than by good intentions:
//
//   Quote   is produced here, is marked indicative on every screen that shows
//           it, and is accepted by ProductChoice and by the schedule editor.
//   Offer   comes only from GET /api/portal/offer/:id, and is the ONLY thing
//           LoanAgreement will render or sign. There is no path from a Quote
//           to a signature.
//
// So a drift between this arithmetic and the lender's is a cosmetic bug on a
// comparison screen, not a contractual one — and to keep even that from
// happening, the two branches below are a line-for-line port of buildSchedule
// in connected-suite/src/lib/lending/schedule.ts, including its rounding and
// its remainder convention. scripts/test-quote.mjs checks them against the
// same figures the server produces.
// ─────────────────────────────────────────────────────────────────────────────
import { toCents, type Row } from "./schedule/reshape";

/** Two decimals, the server's convention. Ported verbatim so the two agree. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** One row of a lender's shelf, as POST /api/lms/products returns it. */
export interface Product {
  id: string;
  name: string;
  description: string | null;
  minPrincipal: number;
  maxPrincipal: number;
  /** As published — per `interestUnit`, NOT per term. See wholeTermRate(). */
  interestRate: number;
  interestUnit: string;
  interestMethod: "flat" | "reducing";
  repaymentPeriod: number;
  repaymentUnit: string;
  minCreditScore: number | null;
  disbursementMode?: string | null;
  /** The lender's product id, when the product lives on their book. */
  serviceSuiteProductId?: number;
  /**
   * The SHORTEST term this product books. A flat product may be repaid over any
   * number of periods from here up to `repaymentPeriod`, and the customer
   * chooses — see termOptions().
   */
  minRepaymentPeriod?: number;
  /**
   * The lender's own fee sheet — Micromart's ProductFees, read live by
   * /api/lms/products. A 6% processing fee arrives with its KSh 650 floor and
   * KSh 6,000 ceiling, exactly as their price list clamps it.
   */
  charges?: ShelfCharge[];
}

export type ChargeWhen = "before-disbursement" | "on-disbursement" | "on-repayment";

export interface ShelfCharge {
  code: string;
  name: string;
  when: ChargeWhen;
  percent: boolean;
  value: number;
  min: number | null;
  max: number | null;
  fromPrincipal: number | null;
  toPrincipal: number | null;
  mandatory: boolean;
}

/** What one fee costs at a principal — the lender's own clamp, ported from the server. */
export function priceCharge(c: ShelfCharge, principal: number): number {
  if (!c.percent) return Math.round(c.value);
  let v = (principal * c.value) / 100;
  if (c.min != null && c.min > 0) v = Math.max(v, c.min);
  if (c.max != null && c.max > 0) v = Math.min(v, c.max);
  return Math.round(v);
}

/** The fees that apply at this principal. */
export function chargesAt(p: Product, principal: number): { code: string; name: string; when: ChargeWhen; amount: number }[] {
  return (p.charges ?? [])
    .filter((c) => (c.fromPrincipal == null || principal >= c.fromPrincipal) && (c.toPrincipal == null || c.toPrincipal <= 0 || principal <= c.toPrincipal))
    .map((c) => ({ code: c.code, name: c.name, when: c.when, amount: priceCharge(c, principal) }));
}

/** The repayment periods a customer may choose, shortest first. */
export function termOptions(p: Product): number[] {
  const max = Math.max(1, p.repaymentPeriod);
  if (p.interestMethod !== "flat") return [max];
  const min = Math.max(1, Math.min(max, p.minRepaymentPeriod ?? 1));
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** The rate for ONE repayment period — "8.25% a week" — whatever unit it was published in. */
export function ratePerPeriod(p: Product): number {
  if (p.interestUnit.toLowerCase() === "term") return p.interestRate / Math.max(1, p.repaymentPeriod);
  return p.interestRate * (unitDays(p.repaymentUnit) / unitDays(p.interestUnit));
}

/** How many days a repayment unit is worth. A month is taken as 30 — good
 *  enough to restate a rate, never used to place a date (stepDate does that on
 *  the calendar, exactly as the server does). */
const DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
const unitDays = (u: string) => DAYS[u.toLowerCase().replace(/s$/, "")] ?? 30;

/**
 * The rate for the WHOLE TERM, which is what the arithmetic below wants.
 *
 * /api/lms/products restates a whole-term rate per repayment period so it reads
 * the way a lender quotes it — Micromart's 82.5% over ten weeks comes back as
 * "8.25%/week" — so the display rate has to be multiplied back up. Where the two
 * units differ (a monthly rate on a weekly product) they are converted through
 * days rather than assumed equal: assuming it would understate the cost roughly
 * fourfold, and understating a cost is the one error direction that is never a
 * rounding argument.
 */
export function wholeTermRate(p: Product): number {
  if (p.interestUnit.toLowerCase() === "term") return p.interestRate;
  const perPeriod = p.interestRate * (unitDays(p.repaymentUnit) / unitDays(p.interestUnit));
  return round2(perPeriod * p.repaymentPeriod);
}

/** Advance a date by `count` repayment units. Ported from schedule.ts. */
export function stepDate(from: Date, unit: string, count: number): Date {
  const d = new Date(from);
  const u = unit.toLowerCase();
  if (u.startsWith("month")) d.setMonth(d.getMonth() + count);
  else if (u.startsWith("week")) d.setDate(d.getDate() + 7 * count);
  else d.setDate(d.getDate() + count);
  return d;
}

export interface Quote {
  product: Product;
  principal: number;
  periods: number;
  unit: string;
  method: "flat" | "reducing";
  totalInterest: number;
  totalRepayable: number;
  /** The typical instalment — every row but the last, which carries the
   *  remainder. Shown as "about", because on most terms it is. */
  perPeriod: number;
  /** Charges taken before or at disbursement (paid upfront + deducted). */
  upfrontCharges: number;
  /** Every fee on the sheet at this principal, priced. */
  fees: { code: string; name: string; when: ChargeWhen; amount: number }[];
  /** Paid before the money moves. */
  upfront: number;
  /** Taken out of the principal that is sent. */
  deducted: number;
  /** Spread across the instalments, and inside `totalRepayable`. */
  spread: number;
  /** What actually lands on the customer's M-PESA. */
  netDisbursed: number;
  /** The rate for one period, and for the whole chosen term. */
  ratePerPeriod: number;
  totalRatePct: number;
  /** Integer cents, ready for the reshape editor without a second conversion. */
  rows: Row[];
  firstDueDate: string;
  clearDate: string;
  /**
   * Settling early only costs less on a reducing-balance loan. Under flat the
   * interest was fixed the day the loan was written, and saying otherwise sells
   * a discount that does not exist.
   */
  earlySettlementApplies: boolean;
}

/**
 * Price a product at an amount.
 *
 * `from` is the notional borrow date. It defaults to today, which makes the
 * dates on a comparison screen indicative in the same way the money is — the
 * real first due date is set when the loan is booked.
 */
export function quote(product: Product, principal: number, from: Date = new Date(), termCount?: number): Quote {
  // ── THE CUSTOMER'S TERM ──────────────────────────────────────────────────
  // A flat product's rate is per period, so a shorter term is proportionally
  // cheaper: 8.25% a week over 5 weeks is 41.25%, not the 82.5% of the full ten.
  // With no term given this is the product's full term, exactly as before.
  const options = termOptions(product);
  const count = termCount != null && options.includes(termCount) ? termCount : Math.max(1, product.repaymentPeriod);
  const perPeriod = ratePerPeriod(product);
  const rate = count === product.repaymentPeriod ? wholeTermRate(product) : round2(perPeriod * count);
  const unit = product.repaymentUnit;
  const fees = chargesAt(product, principal);
  const spread = fees.filter((f) => f.when === "on-repayment").reduce((n, f) => n + f.amount, 0);

  const amounts: number[] = [];
  let totalInterest: number;

  if (product.interestMethod === "reducing") {
    // Straight-line principal, interest on the balance still outstanding — the
    // shape the server builds, remainder absorbed by the final row.
    const periodicRate = rate / 100 / count;
    const perPrincipal = round2(principal / count);
    let outstanding = principal;
    let principalPlaced = 0;
    let interestAcc = 0;
    for (let i = 1; i <= count; i++) {
      const principalDue = i === count ? round2(principal - principalPlaced) : perPrincipal;
      const interestDue = round2(outstanding * periodicRate);
      amounts.push(round2(principalDue + interestDue));
      principalPlaced = round2(principalPlaced + principalDue);
      interestAcc = round2(interestAcc + interestDue);
      outstanding = round2(outstanding - principalDue);
    }
    totalInterest = interestAcc;
  } else {
    totalInterest = round2(principal * (rate / 100));
    // A fee "distributed on instalments" is repaid inside them, so it is part of
    // the total the rows add up to — the same total the server prices.
    const total = round2(principal + totalInterest + spread);
    const per = round2(total / count);
    let placed = 0;
    for (let i = 1; i <= count; i++) {
      const amountDue = i === count ? round2(total - placed) : per;
      amounts.push(amountDue);
      placed = round2(placed + amountDue);
    }
  }

  const rows: Row[] = amounts.map((amountDue, i) => ({
    seq: i + 1,
    dueDate: stepDate(from, unit, i + 1).toISOString(),
    cents: toCents(amountDue),
  }));

  const upfront = fees.filter((f) => f.when === "before-disbursement").reduce((n, f) => n + f.amount, 0);
  const deducted = fees.filter((f) => f.when === "on-disbursement").reduce((n, f) => n + f.amount, 0);

  return {
    product,
    principal,
    periods: count,
    unit,
    method: product.interestMethod,
    totalInterest,
    totalRepayable: round2(amounts.reduce((n, a) => n + a, 0)),
    perPeriod: amounts[0],
    upfrontCharges: upfront + deducted,
    fees,
    upfront,
    deducted,
    spread,
    netDisbursed: round2(principal - deducted),
    ratePerPeriod: round2(perPeriod),
    totalRatePct: rate,
    rows,
    firstDueDate: rows[0].dueDate,
    clearDate: rows[rows.length - 1].dueDate,
    earlySettlementApplies: product.interestMethod === "reducing",
  };
}

/**
 * What the customer may actually ask this product for, given their limit.
 *
 * Returns null when the product cannot serve them at all — a minimum above the
 * limit is a real answer and the screen SAYS it, rather than silently dropping
 * the product from the list. A shelf that quietly hides what you do not qualify
 * for is how a customer ends up believing they were never offered anything.
 */
export function affordableRange(p: Product, limit: number): { min: number; max: number } | null {
  const max = Math.min(p.maxPrincipal, limit);
  if (max < p.minPrincipal) return null;
  return { min: p.minPrincipal, max };
}

// ─────────────────────────────────────────────────────────────────────────────
// A QUOTE, IN THE SHAPE OF AN OFFER.
//
// The agreement screen was written against `Offer` — the LoanOffer a lender
// CREATES AFTER an application has been decided — and defaulted to a sample one.
// That default hid a sequencing problem rather than a wiring gap: at the point
// the customer reads their agreement in the onboarding funnel, no LoanOffer
// exists on any server, because they have not applied yet. There was nothing to
// fetch, and `getOffer(id)` would have had no id to fetch it with.
//
// So the pre-application agreement is built from the QUOTE the customer just
// assembled — the same arithmetic in this file that scripts/test-quote.mjs
// checks against the server's own, so the figures on the agreement are the
// figures the server will price.
//
// ── THE EMPTY ID IS THE SIGNAL, AND IT IS LOAD-BEARING ──────────────────────
// `id: ""` means "this is a pre-contract disclosure, not a signed offer". The
// agreement screen keys its whole ceremony off it: with no offer id there is
// nothing to send a signing code FOR and nothing to sign, so agreeing means
// "apply on these terms" and consent is recorded by the apply call. Rendering a
// signing-code flow against an offer that does not exist would ask somebody for
// a code that could never arrive.
// ─────────────────────────────────────────────────────────────────────────────
import type { Offer } from "./api/portal";

export function quoteToOffer(q: Quote, lender: string): Offer {
  const charges = q.fees.map((f) => ({ name: f.name, amount: f.amount, when: f.when }));
  return {
    // Empty ON PURPOSE. See the header.
    id: "",
    status: "OFFERED",
    lender,
    productName: q.product.name,
    principal: q.principal,
    // The agreement shows the WHOLE-TERM rate, because that is what a customer
    // is agreeing to pay in total — "8.25% a week" and "82.5% over ten weeks"
    // are the same price and only one of them reads as the real cost.
    interestRate: q.totalRatePct,
    interestMethod: q.method,
    termCount: q.periods,
    termUnit: q.unit,
    totalInterest: q.totalInterest,
    totalRepayable: q.totalRepayable,
    firstDueDate: q.firstDueDate,
    expectedClearDate: q.clearDate,
    // A quote does not expire — it is recomputed on every render. Null rather
    // than an invented deadline, which would be a pressure tactic dressed as
    // a fact.
    expiresAt: null,
    acceptedAt: null,
    // ── THE PRINCIPAL/INTEREST SPLIT IS DERIVED, NOT CARRIED ────────────────
    // A schedule Row holds only `cents` — the total for that period — because
    // the reshape editor moves TOTALS between weeks and has no opinion about
    // what part of each is interest. So the split is apportioned by each row's
    // share of the whole, which is exact in aggregate and is the only defensible
    // answer once a customer has reshaped the plan: on a flat loan every row
    // carries the same ratio anyway, and on a reshaped one there is no other
    // meaning for "the interest in THIS week".
    schedule: q.rows.map((r, i) => {
      const amountDue = r.cents / 100;
      const share = q.totalRepayable > 0 ? amountDue / q.totalRepayable : 0;
      const interestDue = Math.round(q.totalInterest * share * 100) / 100;
      return {
        seq: r.seq ?? i + 1,
        dueDate: r.dueDate,
        amountDue,
        principalDue: Math.round((amountDue - interestDue) * 100) / 100,
        interestDue,
      };
    }),
    payEarly: {
      savingKes: 0,
      applies: q.earlySettlementApplies,
      note: q.earlySettlementApplies
        ? "This loan charges interest on the reducing balance, so settling early costs you less."
        : "This loan charges flat interest, so settling early does not reduce what you owe.",
    },
    charges,
  };
}
