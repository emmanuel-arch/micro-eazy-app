// ─────────────────────────────────────────────────────────────────────────────
// THE LENDER, TYPED.
//
// One function per borrower-facing endpoint the Connected Suite already exposes.
// The app calls these; nothing in a screen builds a URL or picks a road.
//
// The endpoints are not new — /api/portal/* has been serving the existing PWA.
// What is new is that every one of them now goes through the dual-road
// transport, and that each declares HERE whether it is safe to send twice.
// That declaration is the whole safety model, so it lives beside the call rather
// than at the call site where it would be forgotten:
//
//   pay()            NOT idempotent. Two of these is two STK pushes to a real
//                    phone for real money. It never fails over.
//   ratibaSetup()    NOT idempotent. Two standing orders is two debits a month.
//   signOffer()      NOT idempotent — a code is consumed on use.
//   sendSigningCode() NOT idempotent — a second SMS invalidates the first, so a
//                    silent retry makes the code the customer is holding wrong.
//   everything else  reads, or writes the server already deduplicates.
//
// ── THE TYPES ARE READ OFF THE ROUTES, NOT GUESSED ──────────────────────────
// Every interface below mirrors the JSON its route actually returns — the files
// are named above each block. That is worth the length: the previous draft of
// this file described /my-loan as { loan, limit, available } and the route has
// always returned { found, activeLoan, clearedLoans }, so every screen written
// against it would have compiled cleanly and rendered nothing. A client type
// that disagrees with its server is worse than no type at all, because it fails
// silently and at runtime.
// ─────────────────────────────────────────────────────────────────────────────
import { apiFetch, SLOW_TIMEOUT } from "../net/transport";
import type { Product } from "../quote";

// ── THE SLUG, AND WHY `??` WAS THE WRONG OPERATOR ───────────────────────────
// This read `import.meta.env.VITE_LENDER_SLUG ?? "micromart"`, and the build
// running on portal.servicesuitecloud.com today ships `lenderSlug: ""` on every
// call. `??` only catches null and undefined. Vite inlines an env var that is
// SET BUT EMPTY as the empty string, so `"" ?? "micromart"` is `""` — the
// fallback never fires, and the suite answers 400 "Choose a lender" to a
// customer who did nothing wrong.
//
// `||` catches the empty string too, and .trim() catches the whitespace-only
// value that a dashboard text field quietly produces. Both are needed: the bug
// is not in the default, it is in which values reach it. Both survive below,
// on ENV_SLUG, for exactly the same reason.
//
// ── AND WHY IT IS NO LONGER A CONSTANT AT ALL ───────────────────────────────
// It was a build-time constant, which is correct for "one deployment per
// lender" and wrong for what this app now is: ONE deployment, a chooser on the
// front door, and a customer who picks their lender before a code is even sent.
// A constant cannot express that, and threading the slug through ~20 call sites
// as an argument would put it in the signature of functions that have no
// business knowing about it.
//
// So the slug is a module-level value with a setter, and the env var is its
// DEFAULT rather than its definition — a single-lender deployment still works
// exactly as before by setting VITE_LENDER_SLUG and never calling the setter.
//
// lib/lender.tsx owns the customer-facing half of the same fact (the palette,
// the marks, the name in the copy) and calls `setLenderSlug` here whenever it
// changes, so there is exactly one place the two can disagree and it is that
// one line.
const ENV_SLUG = (import.meta.env.VITE_LENDER_SLUG ?? "").trim() || "micromart";

let activeSlug = ENV_SLUG;

/** Which lender's book this app is standing in, right now. */
export const lenderSlug = (): string => activeSlug;

/** Point every subsequent call at a different lender. Called by lib/lender.tsx;
 *  nothing else should need it. */
export function setApiLenderSlug(slug: string): void {
  if (slug && slug.trim()) activeSlug = slug.trim();
}

/** Every /api/portal route takes the slug and the ID in the body. */
const who = (nationalId: string) => JSON.stringify({ lenderSlug: lenderSlug(), nationalId });

// ── Session ──────────────────────────────────────────────────────────────────

/**
 * GET /api/portal/session — connected-suite/src/app/api/portal/session/route.ts
 *
 * READ THE ROUTE, NOT THE OLD TYPE. This interface previously declared
 * `{ success, verified, phone, name }`, and the route has never returned any of
 * those four fields. Every one of them would have been `undefined` at runtime,
 * so `if (session.verified)` was permanently false and the app would have sent
 * a verified customer back to the phone gate on every reload — compiling
 * cleanly the whole way. It is the exact failure this file's header warns
 * about, and it was sitting in the file that does the warning.
 *
 * THE PHONE COMES BACK MASKED, and that is not a formatting choice: the cookie
 * is the credential, so the number itself is never re-issued to the client.
 * `phoneMasked` is display text ("0712 ••• 678") and must never be sent back to
 * an endpoint that expects a real msisdn.
 */
export interface Session {
  authenticated: boolean;
  /** Which lender the cookie is bound to. A borrower verified at one lender
   *  holds no standing at another — the server enforces it, and this lets the
   *  client notice a mismatch before making a call that will 401. */
  lenderSlug?: string;
  /** "0712 ••• 678" — for showing, never for sending. */
  phoneMasked?: string;
  /**
   * The national ID on the borrower record this cookie belongs to.
   *
   * The SERVER is the source of truth for this, and that is a correction rather
   * than an addition. The app used to hold the only copy in `sessionStorage`,
   * which dies with the tab — so a customer who closed the tab, or who signed in
   * through the SMS-password door (which never asks for an ID), came back
   * authenticated and unable to load a single screen. See the note on this
   * endpoint in connected-suite.
   *
   * Absent when the lookup found nothing or could not run. The app carries on
   * without it: the routes that can answer from the cookie alone still do.
   */
  nationalId?: string;
  /** Only present when the request asked `?phone=`. Answers "is this the
   *  number you already verified?" and nothing else. */
  matchesPhone?: boolean;
}

export const getSession = () => apiFetch<Session>("/api/portal/session", {}, { auth: false });

/**
 * The body every gated portal route returns with its 401 (see `otpRequired()`
 * in connected-suite/src/lib/portal/session.ts). `needsOtp` is the instruction
 * to send the customer back to the phone gate rather than to render an error —
 * an expired session is the normal end of an hour, not a fault.
 */
export interface NeedsOtp {
  success: false;
  needsOtp: true;
  message: string;
}

export function isNeedsOtp(body: unknown): body is NeedsOtp {
  return Boolean(body && typeof body === "object" && (body as { needsOtp?: unknown }).needsOtp === true);
}

export const signOut = () =>
  apiFetch<{ success: boolean }>("/api/portal/session", { method: "DELETE" }, { auth: true, idempotent: true });

/**
 * POST /api/portal/otp — connected-suite/src/app/api/portal/otp/route.ts
 *
 * `delivered` is the field that matters and the old type omitted it. It is
 * FALSE when no SMS provider could be reached, and the route still answers 200
 * with `success: true` — because from the funnel's point of view the request
 * was accepted. A screen that reads only `success` therefore tells somebody to
 * check a phone that will never buzz.
 *
 * `devCode` is present ONLY outside production and only when delivery failed.
 * It exists so the flow is walkable locally without an SMS bill. Never render
 * it without saying what it is.
 */
export interface OtpSent {
  success: boolean;
  /** False when no provider could send. The screen must say so. */
  delivered: boolean;
  expiresInSec: number;
  /** Non-production only, and only when `delivered` is false. */
  devCode?: string;
  message: string;
}

export const sendOtp = (phone: string, lang?: "en" | "sw") =>
  apiFetch<OtpSent>(
    "/api/portal/otp",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), phone, ...(lang ? { lang } : {}) }) },
    // Safe to repeat: the server rate-limits, and a customer who did not get the
    // first SMS pressing "resend" is the expected case rather than an error.
    { auth: false, idempotent: true },
  );

/**
 * POST /api/portal/otp/verify — .../otp/verify/route.ts
 *
 * THERE IS NO TOKEN. The old type declared `token?: string`, and the route has
 * never issued one — it mints an httpOnly `lms_borrower` cookie and returns
 * `{ success, phone, lender }`. Anything written against that optional token
 * would have silently held `undefined` forever, which is also the standing
 * answer to TRANSPORT_TODO in net/transport.ts: until this route returns a
 * bearer, authenticated calls cannot cross to the fallback origin.
 *
 * A wrong or expired code is a **401** carrying `reason`, so the screen can
 * tell "that code is wrong" from "that code has expired" — two different
 * instructions to the customer, and collapsing them into one makes the retry
 * advice wrong half the time.
 */
export interface OtpVerified {
  success: boolean;
  /** The msisdn the session is now bound to, server-normalised to 2547XXXXXXXX. */
  phone?: string;
  lender?: string;
  /** Present on the 401 body only. */
  reason?: "invalid" | "expired" | "locked";
  message?: string;
}

export const verifyOtp = (phone: string, code: string) =>
  apiFetch<OtpVerified>(
    "/api/portal/otp/verify",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), phone, code }) },
    { auth: false },
  );

export const signInWithPin = (nationalId: string, pin: string) =>
  apiFetch<{ success: boolean; message?: string }>(
    "/api/portal/pin",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), nationalId, pin }) },
    { auth: false },
  );

/**
 * POST /api/portal/micromart — connected-suite/src/app/api/portal/micromart/route.ts
 *
 * THE EXISTING CUSTOMER'S DOOR. Phone plus the password Micromart already SMS'd
 * them, checked against Micromart's own Login API on the server, which then
 * mints the SAME `lms_borrower` cookie the OTP funnel issues. So a customer who
 * comes in this way is indistinguishable downstream from one who came in through
 * the code — every gated screen behind it works identically.
 *
 * This is NOT signInWithPin. That door compares a bcrypt hash in our own
 * Postgres, which is the right check for somebody who onboarded through this
 * platform and the wrong one for Micromart's existing book: their credentials
 * have never been in our database and are not going to be.
 *
 * ── THE FOUR ANSWERS, AND WHY 503 IS NOT 401 ────────────────────────────────
 * A 401 is "that did not match". A 503 means no book could be REACHED, and
 * rendering it as a refusal tells a ten-year customer they are not registered
 * because a network hop failed — which invites them to register again. A 409 is
 * `ambiguous`: the number is on more than one Micromart book, a data fault only
 * a human can fix.
 */
export interface MicromartSignIn {
  success: boolean;
  authenticated?: boolean;
  entityId?: number;
  name?: string | null;
  accountNumber?: string | null;
  /** Present on failures. `reachable: false` accompanies the 503. */
  reason?: "rejected" | "ambiguous";
  reachable?: boolean;
  message?: string;
}

export const micromartSignIn = (phone: string, password: string) =>
  apiFetch<MicromartSignIn>(
    "/api/portal/micromart",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), phone, password }) },
    { auth: false },
  );

/**
 * Ask Micromart to mint a new password and SMS it — through their own outbox,
 * under their own sender id.
 *
 * NOT idempotent, and it must never be retried automatically: every accepted
 * call invalidates the password the customer is currently holding, so a silent
 * second attempt makes the SMS they are reading wrong. Same rule as
 * sendSigningCode().
 *
 * The reply is the same whether or not the number is known — it would otherwise
 * be an endpoint whose only job is answering "does this number bank here?".
 */
export const micromartResetPassword = (phone: string) =>
  apiFetch<{ success: boolean; reachable?: boolean; message?: string }>(
    "/api/portal/micromart",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), phone, reset: true }) },
    { auth: false },
  );

// ── Reading the card ─────────────────────────────────────────────────────────
// connected-suite/src/app/api/portal/kyc/route.ts

/**
 * What the OCR made of the photograph.
 *
 * ── `engine` IS THE FIELD THAT MATTERS, AND IT IS NOT COSMETIC ───────────────
 * With no GOOGLE_CLOUD_API_KEY configured, performIdOcr() falls back to a
 * SEEDED SIMULATION: it returns a plausible name, a plausible date of birth and
 * a confidence of 88-99 **without opening the image at all**. That is the right
 * behaviour for the pipeline — a missing vendor key should not sink a
 * verification — and it is a catastrophe on a screen, because it looks exactly
 * like a successful read.
 *
 * So every surface that shows these fields must also show where they came from.
 * A customer told "we read your card" about a name that was invented is being
 * lied to, and an officer who believes it is worse.
 */
export interface IdOcr {
  fullName: string | null;
  idNumber: string | null;
  dob: string | null;
  serial: string | null;
  /** Completeness, NOT a verdict: it counts fields found. See vision.ts. */
  confidence: number;
  /** "google-vision" = the card was actually read. "simulation" = it was not. */
  engine?: "google-vision" | "simulation";
}

export interface IdStepResult {
  success: boolean;
  sessionId?: string;
  mode?: string;
  step?: string;
  quality?: { score: number; passed: boolean; issues: string[] };
  /** Present only when the quality gate passed. */
  ocr?: IdOcr;
  iprs?: { matched: boolean; name?: string | null; note?: string | null };
  name?: { verdict: string; score: number; summary: string };
  /** The typed ID and the read ID disagree — the customer should check. */
  idMismatch?: boolean;
  registryFound?: boolean;
  gatePassed?: boolean;
  blocked?: boolean;
  /** The photograph was too poor to read. Not a failure — a retake. */
  retake?: boolean;
  message?: string;
}

/**
 * POST /api/portal/kyc, step "id" — read the front of the card.
 *
 * REQUIRES A VERIFIED SESSION. A KYC session records "this face, this ID and
 * this phone are one person" and is later promoted onto a Borrower row, so the
 * route takes the phone from the cookie and never from the caller. That is why
 * the capture surface sits AFTER the code in the funnel and not before it.
 *
 * Not idempotent in the retry sense — each call is a billed provider lookup and
 * writes a KycCheck — so it never fails over to a second road.
 */
export const readIdFront = (
  image: string,
  opts: { nationalId?: string; sessionId?: string; bytes?: number; brightness?: number; blurVar?: number } = {},
) =>
  apiFetch<IdStepResult>(
    "/api/portal/kyc",
    {
      method: "POST",
      body: JSON.stringify({
        lenderSlug: lenderSlug(),
        step: "id",
        ...(opts.nationalId ? { nationalId: opts.nationalId } : {}),
        ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
        payload: {
          image,
          bytes: opts.bytes,
          ...(opts.brightness != null ? { brightness: opts.brightness } : {}),
          ...(opts.blurVar != null ? { blurVar: opts.blurVar } : {}),
        },
      }),
    },
    // A big body over a slow bundle. The default timeout is not enough for a
    // 2MB photograph plus a Vision round trip plus a registry lookup.
    { auth: true, timeoutMs: 45_000 },
  );

// ── Are you already a customer? ──────────────────────────────────────────────
// connected-suite/src/app/api/portal/enrolment/route.ts
//
// The question the app must answer the instant a code is verified, because the
// two answers are two different apps: a returning customer opens on their
// balance, a new one opens on onboarding. It checks BOTH books — our Postgres,
// and (for a bridged lender like Micromart) the lender's own ServiceSuite,
// where every customer who predates this platform actually lives.
//
// ── READ `reachable` BEFORE YOU READ `enrolled` ─────────────────────────────
// `enrolled: false` means one of two completely different things, and the
// difference is the whole point of this type:
//
//   reachable: true   Every book was consulted and this person is not in any of
//                     them. They are new. Start onboarding.
//   reachable: false  A book could not be read — the lender's SQL Server is
//                     down, or the connection is not configured. We DO NOT KNOW.
//                     Onboarding them here would push a customer of ten years
//                     through KYC because of somebody else's network, and would
//                     open a second account against a phone that already has one.
//
// So the app holds on `reachable: false` and offers a retry. It never guesses.

export interface Enrolment {
  success: boolean;
  /** True only when the customer was positively found in one of the books. */
  enrolled: boolean;
  /** Which book answered. Null when not found, or not known. */
  where: "local" | "servicesuite" | null;
  lender: string;
  /** First name only, for the greeting. Absent when not found. */
  firstName?: string | null;
  /**
   * TRUE when every book that exists for this lender was actually read. When
   * false, `enrolled: false` is "we could not check", NOT "you are new".
   */
  reachable: boolean;
  /**
   * Several records share this phone number, or the ID disagrees with the row
   * on it. NOT a new customer — signing them up again creates a second account
   * against a live one. This is a case for a human and the screen says so.
   */
  ambiguous?: boolean;
  /**
   * Which ServiceSuite entity was actually read. Returned because it is an
   * IDENTITY BOUNDARY rather than a label: Micromart's 3002 and 3005 hold
   * different people on the same phone numbers, so if this ever reports a
   * long-standing borrower as new, this field is the first thing to check.
   */
  entityId?: number;
  message?: string;
}

/** Needs the verified session — the phone is read from the cookie, not sent. */
export const enrolment = (nationalId: string) =>
  apiFetch<Enrolment>(
    "/api/portal/enrolment",
    { method: "POST", body: who(nationalId) },
    { auth: true, idempotent: true },
  );

// ── The shelf ────────────────────────────────────────────────────────────────
// connected-suite/src/app/api/lms/products/route.ts
//
// The one borrower-facing call in this file that needs NO SESSION: a lender's
// product catalogue is public marketing information, and on the white-label
// subdomains the customer has no account yet. That also makes it the only call
// that can fail over freely today — see the note in net/transport.ts.

export interface ProductsResponse {
  success: boolean;
  /** False when a bridged lender's ServiceSuite could not be reached. The
   *  wizard falls back to a manual amount rather than to an error page. */
  connected: boolean;
  lender: string;
  products: Product[];
}

export const listProducts = () =>
  apiFetch<ProductsResponse>(
    "/api/lms/products",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug() }) },
    { auth: false, idempotent: true },
  );

// ── The loan ─────────────────────────────────────────────────────────────────
// connected-suite/src/app/api/portal/my-loan/route.ts

export interface ActiveLoan {
  ref: string;
  product: string;
  status: "ACTIVE" | "PENDING_DISBURSEMENT";
  loanAmount: number;
  balance: number;
  /** ISO date, no time. Null on a loan with no clear date set. */
  expectedClearDate: string | null;
  nextDue: { date: string; amount: number } | null;
}

export interface MyLoanResponse {
  success: boolean;
  /** False when the ID did not match an account on this phone. NOT an error —
   *  it is the honest answer to "do you have anything for me". */
  found: boolean;
  /** True for a lender whose book lives in their own ServiceSuite. */
  bridged?: boolean;
  lender: string;
  firstName?: string;
  clearedLoans?: number;
  activeLoan?: ActiveLoan | null;
  message?: string;
}

export const myLoan = (nationalId: string) =>
  apiFetch<MyLoanResponse>(
    "/api/portal/my-loan",
    { method: "POST", body: who(nationalId) },
    { auth: true, idempotent: true },
  );

// ── The agreement ────────────────────────────────────────────────────────────
// connected-suite/src/app/api/portal/offer/[id]/route.ts
//
// SIGNING IS TWO CALLS, NOT ONE, and the shape of that is the legal point:
// possession of the verified phone IS the signature, so a code is sent, and the
// code coming back is what accepts the offer. The code is scoped to THIS offer,
// so one issued to prove identity — or to sign a different offer — will not
// accept this one.

export interface OfferScheduleRow {
  seq: number;
  dueDate: string;
  amountDue: number;
  principalDue: number;
  interestDue: number;
}

export interface Offer {
  id: string;
  status: "OFFERED" | "ACCEPTED" | "DECLINED" | "EXPIRED" | string;
  lender: string;
  productName: string;
  principal: number;
  interestRate: number;
  interestMethod: "flat" | "reducing" | string;
  termCount: number;
  termUnit: string;
  totalInterest: number;
  totalRepayable: number;
  firstDueDate: string;
  expectedClearDate: string;
  /** Null on a PRE-APPLICATION quote: a quote is recomputed on every render and
   *  does not expire. An invented deadline there would be a pressure tactic
   *  dressed as a fact. A real LoanOffer always carries one. */
  expiresAt: string | null;
  schedule: OfferScheduleRow[];
  acceptedAt: string | null;
  payEarly: { savingKes: number; applies: boolean; note: string };
  /**
   * NOT RETURNED BY THE ROUTE TODAY, and named here because it must be.
   *
   * The Charge catalogue (schema.prisma, model Charge) holds the lender's own
   * fees and the offer does not project them, so an agreement rendered from
   * this response alone quotes interest and is silent on a registration fee the
   * customer will actually be charged. LoanAgreement renders whatever is here
   * and says so in words when it is empty — the fix is on the server, and it is
   * one select away.
   */
  charges?: { name: string; amount: number; when: string }[];
}

export const getOffer = (offerId: string) =>
  apiFetch<{ success: boolean; offer: Offer; message?: string }>(
    `/api/portal/offer/${encodeURIComponent(offerId)}`,
    {},
    { auth: true, idempotent: true },
  );

/**
 * Step one of signing: ask for the code. NOT idempotent, and this is the case
 * where that matters most subtly — a silent retry does not double-charge
 * anybody, it sends a SECOND code and invalidates the first, so the customer
 * carefully types the code they are looking at and is told it is wrong.
 */
export const sendSigningCode = (offerId: string, lang?: "en" | "sw") =>
  apiFetch<{ success: boolean; codeSent?: boolean; delivered?: boolean; devCode?: string; message?: string }>(
    `/api/portal/offer/${encodeURIComponent(offerId)}`,
    { method: "POST", body: JSON.stringify({ action: "sign", ...(lang ? { lang } : {}) }) },
    { auth: true },
  );

/** Step two: the code IS the signature. A code is consumed on use. */
export const signOffer = (offerId: string, code: string) =>
  apiFetch<{ success: boolean; status?: string; acceptedAt?: string; reason?: string; message?: string }>(
    `/api/portal/offer/${encodeURIComponent(offerId)}`,
    { method: "POST", body: JSON.stringify({ action: "sign", code }) },
    { auth: true },
  );

/**
 * Declining is terminal and it is the customer's right, so it is offered with
 * the same weight as signing rather than hidden as a link.
 *
 * Safe to repeat: the server settles on the offer id and answers a second
 * decline with 409 and the status, which is the same outcome by a different
 * route — so a dropped response does not strand somebody on a screen they have
 * already left.
 */
export const declineOffer = (offerId: string) =>
  apiFetch<{ success: boolean; status?: string; message?: string }>(
    `/api/portal/offer/${encodeURIComponent(offerId)}`,
    { method: "POST", body: JSON.stringify({ action: "decline" }) },
    { auth: true, idempotent: true },
  );

// ── Money out ────────────────────────────────────────────────────────────────
// connected-suite/src/app/api/portal/pay/route.ts

/**
 * NOT IDEMPOTENT, DELIBERATELY. This raises an STK push against the customer's
 * registered phone. A transport-level retry after a timeout would prompt them
 * twice for the same debt, and the second prompt is indistinguishable from a
 * scam to the person holding the handset.
 *
 * The response says the push was SENT, never that it was paid — the money is
 * confirmed by Safaricom's callback, so the screen that calls this watches the
 * balance rather than believing the 200.
 */
/**
 * The purposes the Pay Now sheet offers.
 *
 * A purpose does NOT route the money. The lender's own `RepaymentTrigger`
 * decides where a payment lands — loan balance first, remainder to savings —
 * and no endpoint on their side accepts a destination. What a purpose does is
 * set the expected amount, shape the confirmation, and get RECORDED, because
 * what a customer believed they were paying for is the first question in any
 * dispute. See connected-suite/src/lib/portal/pay-purpose.ts, which owns the
 * rule; `previewAllocation` below is a mirror of it for live feedback and the
 * server's answer is the record.
 */
export type PayPurpose = "repayment" | "savings" | "penalty" | "processing-fee" | "crb";

export interface PayAllocation {
  purpose: PayPurpose;
  toLoan: number;
  toSavings: number;
  clearsLoan: boolean;
  /** The lender will not do what the purpose literally says — say so. */
  divergent: boolean;
  explanation: string;
}

export const pay = (nationalId: string, amount?: number, purpose?: PayPurpose) =>
  apiFetch<{
    success: boolean;
    message?: string;
    amount?: number;
    purpose?: PayPurpose;
    pushed?: boolean;
    /** Where the lender's trigger will actually put it. Null if unreadable. */
    allocation?: PayAllocation | null;
  }>(
    "/api/portal/pay",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), nationalId, amount, purpose }) },
    { auth: true },
  );

// ── Ratiba (M-PESA standing order) ───────────────────────────────────────────
// connected-suite/src/app/api/portal/standing-order/route.ts

export type RatibaFrequency = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "HALFYEAR" | "YEARLY";

export interface RatibaPlan {
  success: boolean;
  /** False where the lender has no active loan for this customer, or is bridged.
   *  Not an error: there is simply nothing to auto-repay. */
  available: boolean;
  amount?: number;
  frequency?: RatibaFrequency;
  frequencyLabel?: string;
  startDate?: string;
  endDate?: string;
  /** False when the lender has no M-PESA credentials — the order is simulated,
   *  and the screen must say so rather than promise a debit that cannot happen. */
  mpesaConfigured?: boolean;
  existing?: { id: string; status: string; amount: number; frequency: string; simulated: boolean } | null;
}

/** What an auto-repay would look like. A read — safe to repeat. */
export const ratibaOffer = (nationalId: string) =>
  apiFetch<RatibaPlan>(
    "/api/portal/standing-order",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), nationalId, action: "offer" }) },
    { auth: true, idempotent: true },
  );

/**
 * Create it. NOT idempotent.
 *
 * The route does guard on an existing PENDING/ACTIVE order and answer
 * `alreadySet`, which makes a retry safe MOST of the time — but the guard reads
 * a row that the first attempt may not have committed yet, and the failure it
 * would miss is two standing orders against one loan. The customer finds that
 * out on payday. A cost that lands on the customer and not on us is exactly the
 * kind we do not gamble with, so this road is never retried.
 */
export const ratibaSetup = (nationalId: string) =>
  apiFetch<{ success: boolean; standingOrderId?: string; status?: string; alreadySet?: boolean; simulated?: boolean; message?: string }>(
    "/api/portal/standing-order",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), nationalId, action: "setup" }) },
    { auth: true },
  );

/** Stop it. Repeating a cancellation cancels nothing twice. */
export const ratibaCancel = (nationalId: string, standingOrderId: string) =>
  apiFetch<{ success: boolean; cancelled?: boolean; message?: string }>(
    "/api/portal/standing-order",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), nationalId, action: "cancel", standingOrderId }) },
    { auth: true, idempotent: true },
  );

// ── Understanding yourself ───────────────────────────────────────────────────
// connected-suite/src/app/api/portal/decision/route.ts

export type ReasonDirection = "up" | "down" | "neutral";

export interface CustomerReason {
  code: string | null;
  title: string;
  /** What the assessment found — restated, never re-decided. */
  why: string;
  /** What to do about it. NULL MEANS NOTHING THE CUSTOMER DOES CHANGES THIS,
   *  and the screen says that in words rather than rendering a blank. */
  howToFix: string | null;
  direction: ReasonDirection;
}

export interface Decision {
  ref: string;
  verdict: "APPROVE" | "DECLINE" | "REFER" | string | null;
  status: string;
  decidedAt: string;
  product: string | null;
  requested: number;
  /** What they could have had — the most actionable number on a decline. */
  qualifiedFor: number | null;
  askingAboveLimit: boolean;
  tone: "declined" | "review" | "approved" | "pending";
  headline: string;
  body: string;
  reasons: CustomerReason[];
  /** A disclosure, not a support link. It ships with the decline or the decline
   *  is incomplete. */
  appeal: { available: boolean; note: string };
}

export interface DecisionResponse {
  success: boolean;
  found: boolean;
  lender: string;
  firstName?: string;
  /** Null when nothing has been decided yet — a real state, not an error. */
  decision?: Decision | null;
}

export const whyThisDecision = (nationalId: string) =>
  apiFetch<DecisionResponse>(
    "/api/portal/decision",
    { method: "POST", body: who(nationalId) },
    // A fan-out across the bridge into the lender own book — see SLOW_TIMEOUT.
    { auth: true, idempotent: true, timeoutMs: SLOW_TIMEOUT },
  );

// connected-suite/src/app/api/portal/ladder/route.ts

export interface Rung {
  id: string;
  at: string;
  previousLimit: number;
  newLimit: number;
  /** Signed, so the screen never infers direction from the label. */
  change: number;
  direction: "up" | "down" | "flat";
  move: string;
  clearedLoans: number;
  provenPrincipal: number;
  graduationPercent: number | null;
  riskBand: string | null;
  /** True when the percentage earned was more than the per-step ceiling paid
   *  out. Hiding it makes the ladder look arbitrary the one time it does not do
   *  what the percentage implies. */
  cappedByCeiling: boolean;
}

export interface LadderResponse {
  success: boolean;
  found: boolean;
  lender: string;
  firstName?: string | null;
  /**
   * Which book the ladder came from. "native" is our own GraduationEvent table;
   * "lender" is the lender's own graduation history, read live.
   *
   * There is deliberately no "unavailable" here. When a bridged lender's records
   * cannot be reached the route answers 503 rather than 200, because the app
   * renders `found: false` as a calm "you have no history yet" — the wrong
   * sentence entirely for a customer who does have one. An error offers Retry.
   */
  source?: "native" | "lender";
  current?: {
    limit: number | null;
    /**
     * Real movements. NOT the lender's own GraduationCount, which their cron
     * increments once per nightly run whether or not the limit moved — one live
     * customer reads 193 against two actual steps.
     */
    graduationCount: number;
    riskBand: string | null;
    clearedLoans: number;
    activeLoans: number;
  };
  startedAt?: number | null;
  totalGained?: number;
  rungs?: Rung[];
  /**
   * How many raw history rows these rungs stand for, when the lender's book
   * records a row per review rather than per movement. Equal to the rung count
   * on a healthy book; far higher on one that re-graduates nightly.
   */
  collapsedFrom?: number;
  /** The RULE, never a promise or a date. */
  next?: { rule: string; hasActiveLoan: boolean; action: string };
}

export const ladder = (nationalId: string) =>
  apiFetch<LadderResponse>(
    "/api/portal/ladder",
    { method: "POST", body: who(nationalId) },
    // A fan-out across the bridge into the lender own book — see SLOW_TIMEOUT.
    { auth: true, idempotent: true, timeoutMs: SLOW_TIMEOUT },
  );

// connected-suite/src/app/api/portal/exposure/route.ts

/**
 * Five states, five different sentences on the screen — and only ONE of them
 * means "you owe nothing elsewhere". Collapsing any of the others into that
 * would tell a customer their record is clean when it is merely unknown.
 */
export type InterchangeState = "not-configured" | "not-consented" | "refused" | "partial" | "ok";

export interface Interchange {
  connected: boolean;
  state: InterchangeState;
  message?: string | null;
  detail?: string;
  lenders?: number;
  activeLoans?: number;
  /** A band, never an amount. "none" when nothing was found. */
  outstandingBand?: string;
  worstBucket?: string | null;
  /** New credit taken anywhere in the network in the last fortnight. */
  velocity14d?: number;
  asOf?: string;
  queried?: number;
  responded?: number;
}

export interface CrbFile {
  consented: boolean;
  available: boolean;
  checkedAt: string | null;
  report: {
    score?: number;
    grade?: string;
    accounts?: number;
    openAccounts?: number;
    npaAccounts?: number;
    worstArrears?: number;
    /** True past 90 days — shown, but flagged as possibly out of date. */
    stale: boolean;
    [k: string]: unknown;
  } | null;
  message: string | null;
}

export interface ExposureResponse {
  success: boolean;
  crb: CrbFile;
  withThisLender: { lender: string; openLoans: number };
  interchange: Interchange;
}

/** What the wider credit system can see — consent-gated, and never a paid pull. */
export const exposure = (nationalId: string) =>
  apiFetch<ExposureResponse>(
    "/api/portal/exposure",
    { method: "POST", body: who(nationalId) },
    // A fan-out across the bridge into the lender own book — see SLOW_TIMEOUT.
    { auth: true, idempotent: true, timeoutMs: SLOW_TIMEOUT },
  );

// connected-suite/src/app/api/portal/consent/route.ts

export interface ConsentGrant {
  key: string;
  label: string;
  detail: string;
  /** Mandatory grants are not un-togglable — a customer may withdraw anything —
   *  but the UI is told which ones stop a future application, so it can say so
   *  BEFORE the toggle rather than after. */
  mandatory: boolean;
  granted?: boolean;
}

export const consents = () =>
  apiFetch<{ success: boolean; catalogue: ConsentGrant[]; grants: Record<string, boolean>; version?: string }>(
    "/api/portal/consent",
    {},
    { auth: true, idempotent: true },
  );

// ── The conversation ─────────────────────────────────────────────────────────
// connected-suite/src/app/api/portal/messages/route.ts
//
// The channel that did not exist until now. A customer whose liveness check
// failed had exactly one route to a human — ring the office and hope the person
// who answers can find them — and an officer holding that case had no way to
// answer where the customer would ever see it.
//
// ── WHY sendMessage IS NOT MARKED IDEMPOTENT ────────────────────────────────
// Two of these is two messages in an officer's queue from a customer who wrote
// once, and the officer cannot tell which is the real one. That is not as
// expensive as a double STK push, but the failure mode is the same shape — a
// retry the customer did not ask for, producing a fact they did not create —
// and the rule in transport.ts is that anything not provably safe to repeat
// says nothing here and does not fail over.

/** borrower · staff · system. `system` is the workflow talking, not a person. */
export type MessageAuthor = "borrower" | "staff" | "system";

export type ThreadKind = "APPLICATION" | "KYC_REVIEW" | "LOAN" | "REPAYMENT" | "GENERAL";
export type ThreadState = "AWAITING_STAFF" | "AWAITING_CUSTOMER" | "RESOLVED";

/** The machine-readable half of a system message. Unknown values render as their
 *  plain text, so the server can add an event without breaking this build. */
export type SystemEventId =
  | "thread.opened" | "application.submitted" | "stage.advanced" | "stage.returned"
  | "decision.made" | "kyc.referred" | "kyc.cleared" | "offer.signed" | "disbursed";

export interface ThreadSummary {
  id: string;
  subject: string;
  kind: ThreadKind;
  state: ThreadState;
  /** Which desk the case was on when this was opened. Null for a general question. */
  stageTitle: string | null;
  lastAt: string;
  preview: string | null;
  lastAuthor: MessageAuthor | null;
  unread: number;
  /** The officer who answered, by name. Never their staff id. */
  answeredBy: string | null;
  applicationId: string | null;
}

export interface Message {
  id: string;
  author: MessageAuthor;
  authorName: string;
  body: string;
  event: SystemEventId | string | null;
  eventData: unknown;
  attachments: unknown;
  at: string;
}

export interface ThreadDetail {
  id: string;
  subject: string;
  kind: ThreadKind;
  state: ThreadState;
  stageTitle: string | null;
  applicationId: string | null;
  assignedStaffName: string | null;
  createdAt: string;
  messages: Message[];
}

export const myThreads = () =>
  apiFetch<{ success: boolean; lender: string; threads: ThreadSummary[]; unread: number }>(
    `/api/portal/messages?lenderSlug=${encodeURIComponent(lenderSlug())}`,
    {},
    { auth: true, idempotent: true },
  );

export const readThread = (threadId: string) =>
  apiFetch<{ success: boolean; lender: string; thread: ThreadDetail }>(
    `/api/portal/messages?lenderSlug=${encodeURIComponent(lenderSlug())}&threadId=${encodeURIComponent(threadId)}`,
    {},
    { auth: true, idempotent: true },
  );

/** NOT idempotent — see the note above. */
export const sendMessage = (args: {
  threadId?: string;
  kind?: ThreadKind;
  subject?: string;
  applicationId?: string;
  body: string;
}) =>
  apiFetch<{ success: boolean; threadId: string; messageId: string; at: string }>(
    "/api/portal/messages",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), ...args }) },
    { auth: true },
  );

// ── The tracker ──────────────────────────────────────────────────────────────
// connected-suite/src/app/api/portal/track/route.ts
//
// The same stage chain the officer is working, resolved once on the server by
// lib/workflow/chain.ts and read by both sides. That shared resolution is the
// whole claim: "Risk Review" means the same desk on the customer's phone and on
// the console, and neither screen can drift from the other.

export type StageState = "done" | "current" | "upcoming" | "stopped";

export interface TrackedStage {
  /** The LENDER'S own name for the desk, not a sanitised customer-facing one. */
  title: string;
  state: StageState;
  /** The lender's own SLA, as an expectation. Null where they set none — the
   *  screen then says so rather than inventing a number. */
  expectedHours: number | null;
}

export interface TrackedApplication {
  id: string;
  product: string | null;
  amount: number;
  approvedLimit: number | null;
  status: string;
  stageTitle: string | null;
  submittedAt: string;
  decidedAt: string | null;
  lastMovedAt: string;
  declined: boolean;
  stages: TrackedStage[];
  stepNumber: number;
  stepCount: number;
}

export interface TrackResponse {
  success: boolean;
  found: boolean;
  lender: string;
  firstName?: string;
  kycStatus?: string;
  /** Null is a real answer: they have an account but have not applied. It is not
   *  the same as `found: false`, and conflating the two tells somebody we have
   *  never heard of them. */
  application?: TrackedApplication | null;
  loan?: { id: string; status: string; amount: number; disbursedAt: string | null } | null;
  trail?: { id: string; label: string; stage: string | null; at: string }[];
  /** An existing conversation about this application, so the screen offers "ask
   *  about this" pointing INTO it rather than opening a second one beside it. */
  conversation?: { id: string; unread: number } | null;
}

export const track = (nationalId: string) =>
  apiFetch<TrackResponse>(
    "/api/portal/track",
    { method: "POST", body: who(nationalId) },
    // A fan-out across the bridge into the lender own book — see SLOW_TIMEOUT.
    { auth: true, idempotent: true, timeoutMs: SLOW_TIMEOUT },
  );

// ── Applying ─────────────────────────────────────────────────────────────────
// connected-suite/src/app/api/portal/apply/route.ts
//
// THE CALL THE FUNNEL NEVER MADE. The wizard assembled a complete draft in React
// state and then rendered "Onboarding complete." — a customer could walk the
// whole journey and no application existed anywhere at the end of it.
//
// ── NOT IDEMPOTENT, AND NOT RETRIED ─────────────────────────────────────────
// Two of these is two applications for one customer, and once the lender leg is
// armed it is two rows in Micromart's live book that their officers cannot tell
// apart. It declares nothing here and therefore never fails over — same rule as
// pay() and ratibaSetup().

export interface ApplyResponse {
  success: boolean;
  applicationId: string;
  /** The conversation opened alongside the application, so the confirmation can
   *  offer "ask about this" pointing at a thread that already exists. */
  threadId: string | null;
  amount: number;
  product: string;
  submittedAt: string;
  /**
   * What happened on the LENDER's side. For staff and the demo badge only —
   * never rendered as a difference to the customer, because whether the founder
   * has armed live posting is not a fact about their loan.
   */
  lender: {
    armed: boolean;
    posted: boolean;
    loanId: string | null;
    shadowed: boolean;
    error: string | null;
  };
}

export const apply = (args: {
  productId: string;
  amount: number;
  nationalId?: string;
  lat?: number;
  lng?: number;
}) =>
  apiFetch<ApplyResponse>(
    "/api/portal/apply",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), ...args }) },
    { auth: true },
  );

// ── The identity check, and the human behind it ──────────────────────────────
// connected-suite/src/app/api/portal/kyc/status/route.ts
//
// A referral used to be a dead end with one word on it. The pipeline said
// FAILED, the app said nothing more, and the customer's only route to a person
// was to ring the office and hope whoever answered could find them.
//
// Now the reasons come back in the customer's own language, from the same policy
// document the decision was made against — so a lender who changes an outcome
// cannot leave behind a message describing the old one.
//
// ── WHAT DELIBERATELY DOES NOT COME BACK ────────────────────────────────────
// The scores. A customer told their face matched at 79 against a floor of 80 has
// been handed the number to beat, and the next attempt is tuned rather than
// honest.

export type KycState = "NONE" | "IN_PROGRESS" | "PENDING_REVIEW" | "VERIFIED" | "FAILED";

export interface KycReason {
  key: string;
  /** One sentence, written for the customer, not for the officer. */
  says: string;
  /** True when a better photograph could plausibly change the answer. */
  fixable: boolean;
}

export interface KycStatusResponse {
  success: boolean;
  found: boolean;
  lender: string;
  firstName?: string | null;
  status: KycState;
  /** False for somebody who has verified a phone and not yet begun. */
  started: boolean;
  submittedAt?: string;
  reasons: KycReason[];
  /**
   * The screen's primary button hangs off this, and it is false unless EVERY
   * firing signal is one a retake could fix. Offering "try again" against a
   * registry miss sends somebody to retake a photo six times for a problem no
   * photograph can solve.
   */
  retakeable: boolean;
  /** The lender's own SLA. Null where they set none — say so, never invent one. */
  expectedHours?: number | null;
  conversation?: { id: string; unread: number } | null;
}

export const kycStatus = () =>
  apiFetch<KycStatusResponse>(
    `/api/portal/kyc/status?lenderSlug=${encodeURIComponent(lenderSlug())}`,
    {},
    { auth: true, idempotent: true },
  );

// ── Home ─────────────────────────────────────────────────────────────────────
// connected-suite/src/app/api/portal/home/route.ts
//
// ONE call, not four. Home asks what can I borrow, what do I owe, has anyone
// told me anything, and is anything of mine in flight — and answering those from
// four routes is four round trips on the screen the app is judged on in the
// first four seconds, over a Kenyan mobile connection.
//
// ── WHY THERE ARE TWO SCORES AND THEY MUST NOT BE MIXED ─────────────────────
// `score` is OURS, out of 900, and is the number the Score screen explains.
// `lenderScore` is Micromart's own, on ServiceSuite's scale — the live account
// returns 30000 — and it is passed through labelled rather than rendered against
// a 900 denominator, which would be nonsense on its face.

/** Whose book answered. NOT cosmetic — see the note on the Home screen. */
export type BookSource = "native" | "lender" | "unavailable";

export interface HomeResponse {
  success: boolean;
  found: boolean;
  lender: string;
  firstName: string | null;
  kycStatus: KycState;

  /**
   * "unavailable" must never render as a zero balance. One means "we could not
   * ask your lender", the other means "you owe nothing", and showing the first
   * as the second tells a customer in arrears that they are clear.
   */
  bookSource: BookSource;
  limit: number;
  outstanding: number;
  available: number;
  loanCount: number;
  activeLoan: {
    ref: string;
    product: string | null;
    balance: number;
    loanAmount: number;
    /** Null on a bridged book: their loan feed carries no instalment
     *  breakdown, and inventing a date and an amount would put a figure on
     *  screen the lender never quoted — and it is the figure a customer pays. */
    nextDue: { date: string; amount: number } | null;
    expectedClearDate: string | null;
  } | null;
  schedule: { seq: number; due: string; amount: number; status: string }[];

  /**
   * ONE SCORE, ONE SCALE — 300–900 — whichever book the customer is on.
   *
   * For a bridged customer it comes from the deployed behavioural model, which
   * is the only thing on that system that speaks this scale: their
   * `Borrowers.RiskScore` is null across most of the book and their
   * `CreditScore` column is average daily sales (see `avgDailySales`). Null
   * still means "not scored", and the screen must not render a zero gauge for
   * it — a customer with no score has no score, which is different from a bad
   * one.
   */
  score: number | null;
  scoreMax: number;
  band: string | null;
  /** How to colour the gauge. Null when there is no score to colour. */
  scoreTone: "good" | "warn" | "high" | "bad" | null;
  /** What moved it, already in plain language. Possibly empty. */
  scoreDrivers: { factor: string; direction: "increases" | "reduces" }[];
  /** The lender's own, on the lender's own scale. Label it or drop it. */
  avgDailySales: number | null;

  /**
   * THE SAVINGS POT — `Transactions.dbo.AccountSavings` on a bridged book.
   *
   * Null means "we could not ask". A present object with `balance: 0` means
   * "you have saved nothing yet". Those are different sentences and the screen
   * has to be able to tell them apart — the same distinction `bookSource`
   * draws for the loan balance, and for the same reason.
   */
  savings: { balance: number; lastAmount: number | null; lastAt: string | null } | null;

  /** Our own Ratiba debits into OUR books, so it is meaningful only for a
   *  native lender. `available: false` is reported rather than the block being
   *  omitted, so Repay can say "not offered by this lender yet" instead of
   *  showing a switch that does nothing — the version a customer taps and then
   *  believes is on. */
  ratiba: { available: boolean; active: boolean; amount: number | null; frequency: string | null };
  unreadMessages: number;
  messages: {
    id: string;
    subject: string;
    preview: string | null;
    at: string;
    /** So the panel says "You:" rather than attributing the customer's own
     *  last message to the lender. */
    fromStaff: boolean;
    unread: boolean;
  }[];
  application: {
    id: string;
    status: string;
    stageTitle: string | null;
    amount: number;
    product: string | null;
  } | null;
}

export const home = (nationalId: string) =>
  apiFetch<HomeResponse>(
    "/api/portal/home",
    { method: "POST", body: who(nationalId) },
    // A fan-out across the bridge into the lender own book — see SLOW_TIMEOUT.
    { auth: true, idempotent: true, timeoutMs: SLOW_TIMEOUT },
  );
