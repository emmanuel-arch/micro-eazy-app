// ─────────────────────────────────────────────────────────────────────────────
// THE SAMPLE BOOK — one customer, consistent across every screen.
//
// ── WHY THIS FILE EXISTS AND WHY IT IS NOT "MOCK DATA" ──────────────────────
// Every screen here is authenticated: /decision, /ladder, /exposure and
// /my-loan all want a verified OTP session AND a national ID, and this app has
// no sign-in screen yet. Without something to render, seven finished screens
// would be seven spinners, and a screen nobody can look at is a screen nobody
// reviews.
//
// So each screen renders from here until its call is wired, and the swap is one
// line per screen because every constant below is typed as its route's actual
// RESPONSE — not as a convenient shape. If a field is optional here it is
// optional there; if the route can return `found: false`, the screen already
// handles it. That is the whole discipline: sample data whose type is a lie
// makes wiring a rewrite, and makes the demo a promise the software cannot keep.
//
// ── ONE CUSTOMER, NOT SEVEN ────────────────────────────────────────────────
// Emmanuel Kiptoo, ID 32145678, of Micromart Fintech: limit 45,000, one loan
// running, three cleared, score 712, band Kuza. The same person on Home, on the
// ladder, on the decision and on the credit file — because a demo where the
// limit is 45,000 on one screen and 30,000 on the next is a demo the audience
// stops believing at the second screen, and Morris will notice.
// ─────────────────────────────────────────────────────────────────────────────
import type { Product } from "../quote";
import type {
  DecisionResponse, ExposureResponse, LadderResponse, MyLoanResponse, Offer, RatibaPlan,
  HomeResponse, KycStatusResponse, ThreadDetail, ThreadSummary, TrackResponse,
} from "./portal";

/** The customer every sample below is about. */
export const SAMPLE_ID = "32145678";
export const SAMPLE_LENDER = "Micromart Fintech";

// ── MICROMART'S SHELF, READ LIVE ON 9 SEP 2026 ──────────────────────────────
//
// Every figure below came off AvailableLoanProducts for entity 3005
// (connected-suite/scripts/micromart-shelf.cjs prints them). They were
// previously INVENTED, and four fields on the monthly product were wrong — it
// was described as 12%/month REDUCING over FOUR months at 10,000–150,000, and
// Micromart sells it as 22%/month FLAT over TWO months at 10,901–100,000. That
// is not a cosmetic problem: it is the screen a customer accepts terms on.
//
// Rates are PER PERIOD, which is how the lender quotes them and how a customer
// hears them: 8.25%/week over 10 weeks, 22%/month over 2 months.
//
// ── THE THIRD IS THE ENTRY RUNG ─────────────────────────────────────────────
// MICRO CHAP CHAP (30221) is not a variant of the other two — it is the tier
// BELOW them. Its bounds are 5,000–10,900 and Micro Eazy's floor is 10,901, so
// the two are deliberately contiguous: Chap Chap is where a first-time borrower
// starts and Micro Eazy is where the ladder carries them.
//
// It had no row in our Product table, so before the shelf was merged the app
// could not serve ANYBODY asking for less than 10,901 — the whole entry tier was
// invisible, and the customers most likely to be new to formal credit were the
// ones being turned away. Worth stating plainly, because it did not present as a
// bug; it presented as a shorter list.
//
// All three run the same workflow ("Micro Eazy", their WorkflowId 1022 → our
// 00cc3f80-…), which is why SAMPLE_TRACK's two stages are right for any of them.
export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "micro-eazy",
    name: "Micro Eazy",
    description: "Weekly working capital — up to ten weekly instalments. No guarantor, no security.",
    minPrincipal: 10_901,
    maxPrincipal: 100_000,
    interestRate: 8.25,
    interestUnit: "week",
    interestMethod: "flat",
    repaymentPeriod: 10,
    repaymentUnit: "week",
    minCreditScore: 500,
    charges: [{ name: "Registration fee", amount: 450, when: "before-disbursement" }],
  },
  {
    id: "micro-eazy-monthly",
    name: "Micro Eazy Monthly",
    description: "Monthly working capital — up to two monthly instalments. No guarantor, no security.",
    minPrincipal: 10_901,
    maxPrincipal: 100_000,
    interestRate: 22,
    interestUnit: "month",
    interestMethod: "flat",
    repaymentPeriod: 2,
    repaymentUnit: "month",
    minCreditScore: 500,
    charges: [{ name: "Registration fee", amount: 850, when: "before-disbursement" }],
  },
  {
    // `ss:` because there is no local Product row for it — this is the id form
    // /api/lms/products emits for a product that lives only on the lender's own
    // shelf, and /api/portal/apply resolves it by re-reading that shelf.
    id: "ss:30221",
    name: "Micro Chap Chap",
    description: "The first rung — small and quick, cleared over ten weeks. Where a new customer starts.",
    minPrincipal: 5_000,
    maxPrincipal: 10_900,
    interestRate: 8.25,
    interestUnit: "week",
    interestMethod: "flat",
    repaymentPeriod: 10,
    repaymentUnit: "week",
    minCreditScore: 500,
    // No charge is recorded for this product on either side yet. Left EMPTY
    // rather than copied from Micro Eazy — inventing a KSh 450 fee that the
    // lender does not charge is the same class of error as omitting one they do.
  },
];

/** POST /api/portal/my-loan */
export const SAMPLE_LOAN: MyLoanResponse = {
  success: true,
  found: true,
  lender: SAMPLE_LENDER,
  firstName: "Emmanuel",
  clearedLoans: 3,
  activeLoan: {
    ref: "7F3C1A22",
    product: "Micro Eazy",
    status: "ACTIVE",
    loanAmount: 26_000,
    balance: 12_500,
    expectedClearDate: "2026-10-17",
    nextDue: { date: "2026-09-05", amount: 2_600 },
  },
};

/**
 * GET /api/portal/offer/:id
 *
 * An APPROVED offer on the weekly product: 5,000 borrowed, 4,125 interest, ten
 * weeks of 912.50. The same figures scripts/test-quote.mjs checks the client
 * quote against, so a drift between the two shows up as a failing test rather
 * than as a customer signing one number and owing another.
 *
 * `charges` is populated here and is NOT returned by the route today — see the
 * note on Offer in portal.ts. The agreement is rendered with it so the screen
 * can be reviewed complete; the route needs one select to catch up.
 */
export const SAMPLE_OFFER: Offer = {
  id: "8a41f0c2-9e77-4d1b-9d0a-2c3b5e6f7a80",
  status: "OFFERED",
  lender: SAMPLE_LENDER,
  productName: "Micro Eazy",
  principal: 5_000,
  interestRate: 82.5,
  interestMethod: "flat",
  termCount: 10,
  termUnit: "week",
  totalInterest: 4_125,
  totalRepayable: 9_125,
  firstDueDate: "2026-09-06T00:00:00.000Z",
  expectedClearDate: "2026-11-08T00:00:00.000Z",
  expiresAt: "2026-09-03T00:00:00.000Z",
  acceptedAt: null,
  schedule: Array.from({ length: 10 }, (_, i) => ({
    seq: i + 1,
    dueDate: new Date(Date.UTC(2026, 8, 6 + i * 7)).toISOString(),
    amountDue: 912.5,
    principalDue: 500,
    interestDue: 412.5,
  })),
  payEarly: {
    savingKes: 0,
    applies: false,
    note: "This loan charges flat interest, so settling early does not reduce what you owe.",
  },
  charges: [{ name: "Registration fee", amount: 450, when: "before-disbursement" }],
};

/**
 * POST /api/portal/standing-order { action: "offer" }
 *
 * Two of these, because the same endpoint answers two different moments and the
 * screens that read it need opposite states to be worth looking at: the
 * onboarding step is somebody who has NO standing order and is deciding, and
 * Repay is somebody who already has one running. One sample would leave one of
 * those two screens demonstrating the state it is least about.
 *
 * They also have to agree with Home, which shows this customer as having
 * auto-repay on. A demo where Home says Ratiba is collecting and Repay offers
 * to switch it on is a demo the room stops believing at the second screen.
 */
export const SAMPLE_RATIBA: RatibaPlan = {
  success: true,
  available: true,
  amount: 913,
  frequency: "WEEKLY",
  frequencyLabel: "weekly",
  startDate: "2026-09-06T00:00:00.000Z",
  endDate: "2026-11-08T00:00:00.000Z",
  mpesaConfigured: true,
  existing: null,
};

/** The same plan, already authorised on the handset. */
export const SAMPLE_RATIBA_ACTIVE: RatibaPlan = {
  ...SAMPLE_RATIBA,
  amount: 2_600,
  existing: { id: "so_4c81", status: "ACTIVE", amount: 2_600, frequency: "WEEKLY", simulated: false },
};

/**
 * POST /api/portal/decision
 *
 * An APPROVE, not a decline — deliberately. A decline explainer is easy to make
 * look considerate; the harder and more common case is a customer who got the
 * money and still wants to know why the limit stopped where it did, and that is
 * the screen that earns the trust. `howToFix: null` on the last reason is real:
 * some things a customer cannot change, and saying so is the point.
 */
export const SAMPLE_DECISION: DecisionResponse = {
  success: true,
  found: true,
  lender: SAMPLE_LENDER,
  firstName: "Emmanuel",
  decision: {
    ref: "7F3C1A22",
    verdict: "APPROVE",
    status: "DISBURSED",
    decidedAt: "2026-08-14T09:12:00.000Z",
    product: "Micro Eazy",
    requested: 60_000,
    qualifiedFor: 45_000,
    askingAboveLimit: true,
    tone: "approved",
    headline: "This application was approved",
    body: "Here is what the assessment weighed, including what is holding the limit where it is.",
    reasons: [
      {
        code: "RPY",
        title: "Repayment record",
        why: "Three loans cleared, all on or before their due dates. This is the strongest single factor in your favour.",
        howToFix: "Loans cleared on time are the strongest factor. Each one you clear improves this.",
        direction: "up",
      },
      {
        code: "INC",
        title: "Income",
        why: "Six months of M-PESA showed steady inflows averaging KSh 61,400 a month.",
        howToFix: "Assessed from the inflows on your M-PESA statement. A fuller statement reads more of your income.",
        direction: "up",
      },
      {
        code: "EXPOSURE",
        title: "Existing loan load",
        why: "A KSh 12,500 balance is still running here, and the instalments on it are counted against what you could take on next.",
        howToFix:
          "A large share of your income is already going to loan repayments. Clearing one existing loan before applying again lifts this more than any other single action.",
        direction: "down",
      },
      {
        code: "LIM_FIRST_CYCLE",
        title: "Room to grow",
        why: "The ladder caps how far a limit may move in one step, so the full amount your cashflow supports is released over cycles rather than at once.",
        howToFix: null,
        direction: "neutral",
      },
    ],
    appeal: {
      available: false,
      note: "You can ask for this decision to be looked at by a person, and to see the information it was based on.",
    },
  },
};

/**
 * POST /api/portal/ladder
 *
 * Four rungs, and one of them goes DOWN. That is not padding: the route returns
 * decreases and a screen that has only ever been looked at with increases in it
 * is a screen that will be wrong on the day it matters most to somebody.
 */
export const SAMPLE_LADDER: LadderResponse = {
  success: true,
  found: true,
  lender: SAMPLE_LENDER,
  firstName: "Emmanuel",
  current: { limit: 45_000, graduationCount: 3, riskBand: "Kuza", clearedLoans: 3, activeLoans: 1 },
  startedAt: 5_000,
  totalGained: 42_000,
  rungs: [
    {
      id: "r4", at: "2026-08-14T09:12:00.000Z",
      previousLimit: 33_000, newLimit: 45_000, change: 12_000, direction: "up", move: "graduate",
      clearedLoans: 3, provenPrincipal: 26_000, graduationPercent: 40, riskBand: "Kuza", cappedByCeiling: true,
    },
    {
      id: "r3", at: "2026-06-02T11:40:00.000Z",
      previousLimit: 36_000, newLimit: 33_000, change: -3_000, direction: "down", move: "reduce",
      clearedLoans: 2, provenPrincipal: 16_000, graduationPercent: null, riskBand: "Kuza", cappedByCeiling: false,
    },
    {
      id: "r2", at: "2026-04-18T08:05:00.000Z",
      previousLimit: 12_000, newLimit: 36_000, change: 24_000, direction: "up", move: "graduate",
      clearedLoans: 2, provenPrincipal: 16_000, graduationPercent: 200, riskBand: "Kuza", cappedByCeiling: false,
    },
    {
      id: "r1", at: "2026-02-21T14:22:00.000Z",
      previousLimit: 5_000, newLimit: 12_000, change: 7_000, direction: "up", move: "graduate",
      clearedLoans: 1, provenPrincipal: 5_000, graduationPercent: 140, riskBand: "Chipua", cappedByCeiling: false,
    },
  ],
  next: {
    rule: "Limits are reviewed after each loan you clear. Clearing on time is what moves the ladder up; falling into arrears is what moves it down.",
    hasActiveLoan: true,
    action: "Clear the loan you have running now, on or before its due dates.",
  },
};

/**
 * POST /api/portal/exposure
 *
 * `partial` rather than `ok` — on purpose. It is the state that most needs
 * looking at, because it is the one where a careless screen says "nothing found
 * elsewhere" about an answer that is really "we could not ask everybody".
 */
export const SAMPLE_EXPOSURE: ExposureResponse = {
  success: true,
  crb: {
    consented: true,
    available: true,
    checkedAt: "2026-08-14T09:10:00.000Z",
    report: { score: 712, grade: "B", accounts: 6, openAccounts: 2, npaAccounts: 0, worstArrears: 0, stale: false },
    message: null,
  },
  withThisLender: { lender: SAMPLE_LENDER, openLoans: 1 },
  interchange: {
    connected: true,
    state: "partial",
    lenders: 2,
    activeLoans: 2,
    outstandingBand: "KSh 10,000 – 25,000",
    worstBucket: "current",
    velocity14d: 1,
    asOf: "2026-08-31T06:00:00.000Z",
    queried: 5,
    responded: 4,
    message:
      "Some lenders could not be reached, so you may owe more elsewhere than is shown here.",
  },
};

/**
 * POST /api/portal/track
 *
 * The same customer, mid-application: 26,000 on the weekly product, through the
 * first of Micromart's TWO Micro Eazy stages.
 *
 * ── THE CHAIN IS THEIRS, AND IT IS SHORT ────────────────────────────────────
 * This sample described a five-stage workflow — Data Capture, Risk Review,
 * Customer Service, Finance, Disbursement — that Micromart does not have.
 * Their real "Micro Eazy" workflow (00cc3f80-…, which BOTH products point at)
 * is two stages: **Risk** (CRB required, tier 1) then **Customer Service**
 * (finalizes, OTP, tier 2). Run scripts/show-workflow.cjs in connected-suite to
 * print it.
 *
 * Inventing a longer chain made the screen look more impressive and would have
 * been contradicted by the first officer to open the console beside it — which
 * is precisely the comparison this screen invites, and the reason its whole
 * value is that both sides resolve the chain from the same place.
 *
 * `expectedHours` is null on both because Micromart has `slaHours = 0` on every
 * stage. That is the common case, not an omission, and the screen says "No
 * fixed time on this step" rather than inventing a number.
 */
export const SAMPLE_TRACK: TrackResponse = {
  success: true,
  found: true,
  lender: SAMPLE_LENDER,
  firstName: "Emmanuel",
  kycStatus: "VERIFIED",
  application: {
    id: "b1f4c8d2-3a77-4e91-8c22-9f0e5d6a7b31",
    product: "Micro Eazy",
    amount: 26_000,
    approvedLimit: 45_000,
    status: "OFFICER_REVIEW",
    stageTitle: "Customer Service",
    submittedAt: "2026-09-07T08:12:00.000Z",
    decidedAt: null,
    lastMovedAt: "2026-09-08T14:30:00.000Z",
    declined: false,
    // Risk cleared, Customer Service holding it. Two stages, because that is how
    // many Micromart has.
    stages: [
      { title: "Risk", state: "done", expectedHours: null },
      { title: "Customer Service", state: "current", expectedHours: null },
    ],
    stepNumber: 2,
    stepCount: 2,
  },
  loan: null,
  trail: [{ id: "t1", label: "Moved forward", stage: "Customer Service", at: "2026-09-08T14:30:00.000Z" }],
  conversation: { id: "c9e2b5a1-77d3-4f60-9a18-3e4c6b8d0f52", unread: 1 },
};

/** GET /api/portal/messages — the list. */
export const SAMPLE_THREADS: ThreadSummary[] = [
  {
    id: "c9e2b5a1-77d3-4f60-9a18-3e4c6b8d0f52",
    subject: "About my application",
    kind: "APPLICATION",
    state: "AWAITING_CUSTOMER",
    stageTitle: "Customer Service",
    lastAt: "2026-09-08T15:02:00.000Z",
    preview: "Thanks Emmanuel — we can see the statement now. One more thing: the ID photo is a little dark at the…",
    lastAuthor: "staff",
    unread: 1,
    answeredBy: "Grace W.",
    applicationId: "b1f4c8d2-3a77-4e91-8c22-9f0e5d6a7b31",
  },
  {
    id: "a3d7f1e8-2b45-4c09-8e71-5a6d9c0b2f43",
    subject: "About my ID check",
    kind: "KYC_REVIEW",
    state: "RESOLVED",
    stageTitle: null,
    lastAt: "2026-09-06T11:40:00.000Z",
    preview: "That has cleared now — your ID matched on the second try. Nothing else needed from you.",
    lastAuthor: "staff",
    unread: 0,
    answeredBy: "Grace W.",
    applicationId: null,
  },
];

/**
 * GET /api/portal/messages?threadId=…
 *
 * Note the THIRD voice. `author: "system"` rows are the workflow talking — the
 * stage advance lands in the same scroll as the conversation about it, in order,
 * so "what happened to my loan" and "what did you say to me" are one thing to
 * read rather than two to reconcile.
 */
export const SAMPLE_THREAD: ThreadDetail = {
  id: "c9e2b5a1-77d3-4f60-9a18-3e4c6b8d0f52",
  subject: "About my application",
  kind: "APPLICATION",
  state: "AWAITING_CUSTOMER",
  stageTitle: "Customer Service",
  applicationId: "b1f4c8d2-3a77-4e91-8c22-9f0e5d6a7b31",
  assignedStaffName: "Grace W.",
  createdAt: "2026-09-07T09:05:00.000Z",
  messages: [
    {
      id: "m1",
      author: "borrower",
      authorName: "Emmanuel Kiptoo",
      body: "Hello, I applied yesterday for 26,000 but I have not heard anything. Is there something you still need from me?",
      event: null,
      eventData: null,
      attachments: [],
      at: "2026-09-07T09:05:00.000Z",
    },
    {
      id: "m2",
      author: "staff",
      authorName: "Grace W.",
      body: "Hi Emmanuel — nothing needed yet. Your M-PESA statement is being read now, which usually takes under an hour. I will come back to you either way.",
      event: null,
      eventData: null,
      attachments: [],
      at: "2026-09-07T09:41:00.000Z",
    },
    {
      id: "m3",
      author: "system",
      authorName: "Micro Eazy",
      body: "Your application has moved to Customer Service.",
      event: "stage.advanced",
      eventData: { from: "Risk", to: "Customer Service", step: 2, of: 2 },
      attachments: [],
      at: "2026-09-08T14:30:00.000Z",
    },
    {
      id: "m4",
      author: "staff",
      authorName: "Grace W.",
      body: "Thanks Emmanuel — we can see the statement now. One more thing: the ID photo is a little dark at the bottom edge. Could you take it again in better light? Everything else is fine.",
      event: null,
      eventData: null,
      attachments: [],
      at: "2026-09-08T15:02:00.000Z",
    },
  ],
};

/**
 * GET /api/portal/kyc/status — the REFERRED case, not the happy one.
 *
 * Deliberately the anxious state: a customer whose ID photo was not clear enough
 * and whose face match landed in the review band. That is the screen worth
 * reviewing — a verified customer sees one green tick and needs nothing from the
 * design, while this person is the reason the screen exists.
 *
 * `retakeable: true` because BOTH reasons here are fixable by a better
 * photograph. Swap `faceBorderline` for `iprsUnmatched` and it must flip to
 * false — the button changes from "Take the photos again" to "Ask someone",
 * which is the single most important behaviour on the screen.
 */
export const SAMPLE_KYC_REVIEW: KycStatusResponse = {
  success: true,
  found: true,
  lender: SAMPLE_LENDER,
  firstName: "Emmanuel",
  status: "PENDING_REVIEW",
  started: true,
  submittedAt: "2026-09-09T06:40:00.000Z",
  reasons: [
    {
      key: "idQualityLow",
      says: "The photo of your ID was not clear enough for us to read confidently.",
      fixable: true,
    },
    {
      key: "faceBorderline",
      says: "Your selfie is close to the photo on your ID, but we want a person to confirm it.",
      fixable: true,
    },
  ],
  retakeable: true,
  // Micromart's default review SLA (lib/config/kyc.ts). Set to null and the
  // screen says "no fixed time" instead — both states are real and both are
  // reviewed.
  expectedHours: 24,
  conversation: { id: "a3d7f1e8-2b45-4c09-8e71-5a6d9c0b2f43", unread: 1 },
};

/**
 * POST /api/portal/home
 *
 * The same customer as every other sample: 45,000 limit, 12,500 running, one
 * loan, three cleared. `bookSource: "native"` because the sample IS the data —
 * a sample cannot honestly claim to have reached a lender.
 *
 * The schedule is populated here on purpose even though a BRIDGED book returns
 * none: this constant is what a reviewer sees offline, and the schedule panel is
 * one of the screen's better answers to "how much do I still owe and when". The
 * empty case is exercised live against Micromart, where their loan feed carries
 * no instalment breakdown.
 */
export const SAMPLE_HOME: HomeResponse = {
  success: true,
  found: true,
  lender: SAMPLE_LENDER,
  firstName: "Emmanuel",
  kycStatus: "VERIFIED",
  bookSource: "native",
  limit: 45_000,
  outstanding: 12_500,
  available: 32_500,
  loanCount: 1,
  activeLoan: {
    ref: "7F3C1A22",
    product: "Micro Eazy",
    balance: 12_500,
    loanAmount: 26_000,
    nextDue: { date: "2026-09-12", amount: 2_600 },
    expectedClearDate: "2026-10-17",
  },
  schedule: [
    { seq: 1, due: "2026-08-15", amount: 2_600, status: "PAID" },
    { seq: 2, due: "2026-08-22", amount: 2_600, status: "PAID" },
    { seq: 3, due: "2026-08-29", amount: 2_600, status: "PAID" },
    { seq: 4, due: "2026-09-05", amount: 2_600, status: "PAID" },
    { seq: 5, due: "2026-09-12", amount: 2_600, status: "DUE" },
    { seq: 6, due: "2026-09-19", amount: 2_600, status: "UPCOMING" },
  ],
  score: 712,
  scoreMax: 900,
  band: "Kuza",
  scoreTone: "good",
  scoreDrivers: [
    { factor: "Longer account history", direction: "reduces" },
    { factor: "Payments made on time", direction: "reduces" },
    { factor: "Larger loan amounts", direction: "increases" },
  ],
  // Their `CreditScore` field is average daily SALES, not a score — 30,000 a day
  // is what the live account returns. Named correctly here so nobody is ever
  // tempted to render it against a 900 denominator.
  avgDailySales: 30_000,
  // A pot with something in it, so the offline review surface exercises the
  // populated case. The empty and the unreadable cases are both live-only.
  savings: { balance: 1_670, lastAmount: 1_670, lastAt: "2026-09-10T20:38:55.803Z" },
  ratiba: { available: true, active: true, amount: 2_600, frequency: "WEEKLY" },
  unreadMessages: 1,
  messages: [
    {
      id: "c9e2b5a1-77d3-4f60-9a18-3e4c6b8d0f52",
      subject: "About my application",
      preview: "Thanks Emmanuel — we can see the statement now. One more thing: the ID photo is a little dark at the…",
      at: "2026-09-08T15:02:00.000Z",
      fromStaff: true,
      unread: true,
    },
    {
      id: "a3d7f1e8-2b45-4c09-8e71-5a6d9c0b2f43",
      subject: "About my ID check",
      preview: "That has cleared now — your ID matched on the second try. Nothing else needed from you.",
      at: "2026-09-06T11:40:00.000Z",
      fromStaff: true,
      unread: false,
    },
  ],
  application: {
    id: "b1f4c8d2-3a77-4e91-8c22-9f0e5d6a7b31",
    status: "OFFICER_REVIEW",
    stageTitle: "Customer Service",
    amount: 26_000,
    product: "Micro Eazy",
  },
};
