// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW ONLY — canned server answers for the step-by-step screens.
//
// Imported by preview.tsx and nothing else, so it never reaches a production
// bundle. The shapes mirror the connected-suite routes; the figures are a
// plausible Micromart customer, not a real one.
// ─────────────────────────────────────────────────────────────────────────────
import { SAMPLE_HOME, SAMPLE_PRODUCTS } from "./lib/api/samples";
import type { CrunchResult, JourneyResponse, OnboardingContract } from "./lib/api/portal";

const today = new Date().toISOString();

const CONTRACT: OnboardingContract = {
  primary: "ocr",
  methods: [
    { key: "ocr", label: "Read the ID card", blurb: "", ready: true },
    { key: "iprs", label: "National registry", blurb: "", ready: true },
    { key: "manual", label: "Typed", blurb: "", ready: true },
  ],
  allowFallback: true,
  allowManualOverride: false,
  requireConsent: true,
  fields: [
    { key: "firstName", label: "First name", help: "", required: true, verified: true, unique: false },
    { key: "otherName", label: "Other names", help: "", required: true, verified: true, unique: false },
    { key: "dob", label: "Date of birth", help: "", required: true, verified: true, unique: false },
    { key: "gender", label: "Gender", help: "", required: true, verified: false, unique: false },
    { key: "email", label: "Email", help: "", required: false, verified: false, unique: false },
    { key: "businessName", label: "Business name", help: "What your shop or business is called.", required: true, verified: false, unique: false },
    { key: "physicalAddress", label: "Physical address", help: "Estate, road, and a landmark.", required: true, verified: false, unique: false },
    { key: "nextOfKin", label: "Next of kin", help: "", required: true, verified: false, unique: false },
  ],
  idDocument: "national_id",
  ocr: { capture: "front", allowEdit: true },
  selfie: { required: true, liveness: false },
  geo: { ask: true, required: true, places: ["business"] },
  documents: [{ code: "ID_FRONT", name: "ID front", description: "", accept: "image/*", multiple: false, maxSizeMb: 6, parsed: true }],
  detailGroups: [],
  age: { min: 22, max: 70 },
  joiningFee: { amount: 150 },
  automatedChecks: [],
  enabled: true,
  flags: {
    faceMatch: true, liveness: false, requireReview: true, referees: { min: 1, max: 1 }, onDuplicate: "block",
    idPhotoRequired: true, oneActiveLoan: true, requireGeoPin: true, maxLimit: 500_000, minScoreToBorrow: 400,
  },
  capabilities: { ocr: "live", registry: "live", face: "live" },
};

const borrower = {
  id: "b-1", firstName: "Emmanuel", otherName: "Birgen", nationalId: "31234567", dob: "1994-05-12", gender: "M",
  email: null, kycStatus: "VERIFIED" as const, loanLimit: 10_000, creditScore: 612, hasGeo: true,
};

export function journeyFor(screen: string): JourneyResponse {
  const base = { success: true, lender: "Micromart Africa", contract: CONTRACT, existingCustomer: false };
  if (screen.startsWith("kyc")) {
    return { ...base, status: { borrower: null, kyc: null, crunch: null, crb: null, application: null, activeLoan: false, crbRequired: true, next: "kyc" } };
  }
  if (screen.startsWith("crunch")) {
    return { ...base, status: { borrower: { ...borrower, loanLimit: null, creditScore: null }, kyc: null, crunch: null, crb: null, application: null, activeLoan: false, crbRequired: true, next: "crunch" } };
  }
  return {
    ...base,
    status: {
      borrower,
      kyc: { sessionId: "s-1", status: "VERIFIED", nationalId: "31234567", name: "EMMANUEL KIPROTICH BIRGEN", idRead: true, registry: true, selfie: true, liveness: null, flags: [] },
      crunch: { at: today, score: 612, band: "Fair", startingLimit: 10_000, eligible: true, fresh: true },
      crb: { at: today, score: 648, verdict: "CLEAR", band: "Good" },
      application: null,
      activeLoan: false,
      crbRequired: true,
      next: "apply",
    },
  };
}

export const CRUNCH: CrunchResult = {
  success: true,
  nameCheck: { statementName: "EMMANUEL KIPROTICH BIRGEN", expectedName: "Emmanuel Birgen", matched: true, unreadable: false },
  transactionCount: 1284,
  paidIn: 486_200,
  paidOut: 471_900,
  creditScore: {
    modelVersion: "thin-file-expert-v3", score: 612, maxScore: 900, pd: 0.083, pdPercent: "8.3%", band: "Fair", tone: "warn", decision: "APPROVE",
    reasonCodes: [
      { code: "INC_REG", factor: "Regular income", points: 58, direction: "up", detail: "Money came in during all 6 months." },
      { code: "SURPLUS", factor: "Monthly surplus", points: 34, direction: "up", detail: "About KSh 2,400 left over each month." },
      { code: "LOAN_DEP", factor: "Other borrowing", points: -22, direction: "down", detail: "Fuliza and two digital lenders are 9% of inflow." },
      { code: "VOL", factor: "Income swings", points: -14, direction: "down", detail: "Monthly income varies by about 38%." },
    ],
    breakdown: [
      { code: "INC_REG", factor: "Regular income", points: 58 },
      { code: "SURPLUS", factor: "Monthly surplus", points: 34 },
      { code: "TILL", factor: "Business till activity", points: 21 },
      { code: "LOAN_DEP", factor: "Other borrowing", points: -22 },
      { code: "VOL", factor: "Income swings", points: -14 },
      { code: "BET", factor: "Betting", points: -6 },
    ],
  },
  features: {
    monthsCovered: 6, periodStart: "2026-03-01", periodEnd: "2026-08-31", avgMonthlyIncome: 81_000, avgMonthlyExpense: 78_600, avgMonthlyNet: 2_400,
    avgBalance: 3_900, closingBalance: 4_120, incomeVolatility: 0.38, incomeMonthsRatio: 1, gamblingRatio: 0.004, gamblingOutflow: 1_900,
    loanDependencyRatio: 0.09, loanEventCount: 11,
  },
  monthly: [
    { month: "2026-03", income: 74_000, expense: 72_100, net: 1_900, gambling: 300 },
    { month: "2026-04", income: 91_000, expense: 86_500, net: 4_500, gambling: 0 },
    { month: "2026-05", income: 66_000, expense: 68_200, net: -2_200, gambling: 600 },
    { month: "2026-06", income: 88_000, expense: 83_900, net: 4_100, gambling: 0 },
    { month: "2026-07", income: 79_000, expense: 77_400, net: 1_600, gambling: 1_000 },
    { month: "2026-08", income: 88_200, expense: 83_700, net: 4_500, gambling: 0 },
  ],
  affordability: { score: 64, band: "Moderate", recommendedMaxInstallment: 4_800, reasons: [] },
  report: {
    spendByCategory: [
      { category: "Groceries", amount: 142_000, count: 310, share: 0.3 },
      { category: "Transfers", amount: 96_000, count: 140, share: 0.2 },
      { category: "Transport", amount: 51_000, count: 220, share: 0.11 },
      { category: "Financial & Loans", amount: 42_000, count: 38, share: 0.09 },
      { category: "Airtime & Data", amount: 18_400, count: 160, share: 0.04 },
      { category: "Food & Dining", amount: 16_200, count: 84, share: 0.03 },
      { category: "Betting", amount: 1_900, count: 6, share: 0.004 },
    ],
    topMerchants: [],
    loanBehaviour: { lenders: [], repaymentCadence: "weekly", fulizaReliant: false },
    lifestyle: { tags: ["Retail trader", "Weekly restocking"], narrative: "A retail trader with steady weekly takings, restocking most Mondays, and light use of Fuliza to bridge slow weeks." },
    highlights: [],
  },
  categories: [],
  sample: [
    { date: "2026-08-30", details: "Customer Transfer from JANE W", direction: "in", amount: 1_250, category: "income_received" },
    { date: "2026-08-30", details: "Merchant Payment to NAIVAS", direction: "out", amount: 3_400, category: "till" },
    { date: "2026-08-29", details: "Business Payment from KCB", direction: "in", amount: 6_000, category: "business_in" },
    { date: "2026-08-29", details: "Pay Bill to KPLC PREPAID", direction: "out", amount: 500, category: "paybill" },
  ],
  qualification: {
    eligible: true, startingLimit: 10_000, internalScore: 612, scoreBand: "Fair", tier: null,
    ceilings: { score: 12_000, affordability: 10_000, boundBy: "affordability" }, cappedByLender: false, monthlyCapacity: 4_800,
    reasonCodes: [
      { code: "AFF", label: "Affordability sets it", detail: "A KSh 10,000 loan keeps your instalments inside what your statement shows you can repay.", tone: "neutral" },
      { code: "INC", label: "Steady income", detail: "Money came in every month of the six.", tone: "up" },
      { code: "DEP", label: "Some other borrowing", detail: "Repaying other lenders takes part of your cashflow.", tone: "down" },
    ],
    declineReasons: [],
    products: [],
    policyVersion: 3,
  },
  saved: { snapshotId: "snap-1", limitAllocated: 10_000 },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// ── Riri, canned — the shapes of connected-suite/src/app/api/portal/riri/*. The
// words are what the real engine says for these questions (see
// scripts/verify-first-response.ts there), so a screenshot shows her true voice.
const RIRI_HELLO = {
  success: true, enabled: true, name: "Riri", lender: "Micromart Africa",
  opener: {
    en: "I'm Riri. I can help with your loan, your repayments, your limit, M-PESA Ratiba, and how Micro Eazy works — straight from your own account. If I find something I can't solve, I'll pass it to a person at Micromart Africa with everything I've already checked.",
    sw: "Mimi ni Riri. Naweza kukusaidia na mkopo wako, malipo yako, kiwango chako, M-PESA Ratiba, na jinsi Micro Eazy inavyofanya kazi.",
  },
  prompts: {
    en: ["What do I owe?", "When is my next payment?", "Do I need to dial *334# for Ratiba?", "How much can I borrow?", "Where is my application?", "I want to talk to a person"],
    sw: ["Nadaiwa kiasi gani?", "Nilipe lini?", "Ratiba ni nini?", "Naweza kukopa kiasi gani?", "Ombi langu liko wapi?", "Nataka kuongea na mtu"],
  },
};

function ririAnswer(question: string) {
  const q = question.toLowerCase();
  const base = { success: true, name: "Riri", lang: "en", confidence: "certain", checked: ["customer.record"], suggestions: [] as string[], screen: null, escalation: null, canEscalate: false };
  if (/person|human|someone/.test(q)) {
    return { ...base, outcome: "escalated", intent: "human", engine: "record", sources: [], actions: [], answer: "Of course — I'll get you to a person at Micromart Africa. I've passed your conversation to the team with what I can already see on your account, so you won't have to explain it twice. Their reply will appear in Messages.", escalation: { threadId: "t-1", caseRef: "ME-7C21A4" } };
  }
  if (/paid but|not changed|twice|reflect/.test(q)) {
    return { ...base, outcome: "escalate", intent: "dispute", engine: "knowledge", confidence: "likely", canEscalate: true, sources: [{ id: "platform.ratiba@1#4", label: "Platform · platform.ratiba v1" }], actions: [{ kind: "navigate", label: "Open Repay", href: "/repay", screenId: "app-repay" }], answer: "Let me look at your account. A Ratiba payment reaches us and is applied to your loan first, with anything left over going to your savings — that allocation is automatic and nobody, including us, redirects it.\n\nRight now your balance shows KSh 12,400. This is worth a person following to the end rather than you checking back. I can raise it with the team now — they'll see what you told me and what I checked." };
  }
  if (/334|ratiba/.test(q)) {
    return { ...base, outcome: "resolved", intent: "knowledge", engine: "knowledge", checked: ["corpus"], sources: [{ id: "platform.ratiba@1#1", label: "Platform · platform.ratiba v1" }], actions: [], suggestions: ["How do I stop or change my Ratiba standing order?", "Does Ratiba cost me anything?"], answer: "You can use either. Ratiba lives on *334# on your phone, and also inside the M-PESA app — both take you to the same subscriptions, so use whichever is easier for you. If we set the standing order up for you when you took the loan, it is already there; *334# is how you check it, change the amount, or stop it.\n\nMore: https://www.safaricom.co.ke/personal/m-pesa/m-pesa-services/m-pesa-ratiba" };
  }
  if (/next payment|due/.test(q)) {
    return { ...base, outcome: "offer", intent: "due", engine: "record", canEscalate: true, sources: [], actions: [{ kind: "navigate", label: "Open Repay", href: "/repay", screenId: "app-repay" }], suggestions: ["What do I owe?", "How do I repay?"], answer: "I can see your Micro Chap Chap has **KSh 12,400** left and is due to be cleared by **12 Oct 2026**. But the part of Micromart Africa's records I can read doesn't carry the date and amount of each instalment — and I won't work one out, because that's the number you'd actually pay. Your loan agreement and SMS reminders have your schedule, or I can ask the team to confirm your next instalment." };
  }
  return { ...base, outcome: "resolved", intent: "balance", engine: "record", sources: [], actions: [{ kind: "navigate", label: "Open Repay", href: "/repay", screenId: "app-repay" }], suggestions: ["When is my next payment?", "How do I repay?", "How much can I borrow?"], answer: "Your outstanding balance with Micromart Africa is **KSh 12,400**. Your open loan is **Micro Chap Chap**: KSh 10,000 borrowed, **KSh 12,400** left to pay. It's due to be cleared by **12 Oct 2026**." };
}

export function installMocks(screen: string) {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, location.origin).pathname;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    if (path === "/api/portal/riri" && (init?.method ?? "GET") === "GET") return json(RIRI_HELLO);
    if (path === "/api/portal/riri") {
      await wait(500);
      return json(ririAnswer(String(JSON.parse(String(init?.body ?? "{}")).question ?? "")));
    }
    if (path === "/api/portal/riri/escalate") {
      await wait(600);
      return json({ success: true, threadId: "t-1", caseRef: "ME-7C21A4", created: true, message: "Done — I've passed this to the team at Micromart Africa as case ME-7C21A4." });
    }
    if (path === "/api/portal/riri/feedback") return json({ success: true });
    if (path === "/api/portal/messages") return json({ success: true, lender: "Micromart Africa", threads: [], unread: 0 });
    // The doors are shown to somebody signed OUT — a signed-in session makes the
    // sign-in screen forward to the account, and the preview shows nothing.
    if (path === "/api/portal/session") {
      if (["signin", "verify", "join", "lenders"].includes(screen)) return json({ authenticated: false });
      return json({ authenticated: true, lenderSlug: "micromart", phoneMasked: "0758 ••• 032", nationalId: "31234567" });
    }
    if (path === "/api/portal/journey") return json(journeyFor(screen));
    if (path === "/api/portal/home") return json({ ...SAMPLE_HOME, bookSource: screen.startsWith("apply") ? "onboarding" : SAMPLE_HOME.bookSource });
    if (path === "/api/lms/products") return json({ success: true, connected: true, lender: "Micromart Africa", products: SAMPLE_PRODUCTS });
    if (path === "/api/portal/crunch") {
      await wait(1500);
      return json(CRUNCH);
    }
    if (path === "/api/portal/kyc") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.step === "id") {
        await wait(900);
        return json({ success: true, sessionId: "s-1", quality: { score: 92, passed: true, issues: [] }, ocr: { fullName: "EMMANUEL KIPROTICH BIRGEN", idNumber: "31234567", dob: "12.05.1994", serial: "240118832", confidence: 96, engine: "google-vision" }, registryFound: true, gatePassed: true });
      }
      return json({ success: true, sessionId: "s-1" });
    }
    if (path === "/api/portal/apply") {
      await wait(800);
      return json({ success: true, applicationId: "a-1", threadId: "t-1", amount: 10_000, product: "Micro Chap Chap", submittedAt: today, lender: { armed: false, posted: false, loanId: null, shadowed: false, error: null }, stage: { title: "Risk", index: 0, of: 2, stages: ["Risk", "Customer Service"] } });
    }
    return real(input, init);
  };
}

// ── The auto-driver: clicks through steps so a screenshot lands on a later pane ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function clickText(text: string, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const el = [...document.querySelectorAll<HTMLElement>("button, label")].find(
      (b) =>
        b.offsetParent !== null &&
        !b.closest('[aria-hidden="true"]') &&
        (b.textContent ?? "").includes(text) &&
        !(b as HTMLButtonElement).disabled,
    );
    if (el) {
      const box = el.tagName === "LABEL" ? el.querySelector("input") : null;
      (box ?? el).click();
      await sleep(350);
      return true;
    }
    await sleep(150);
  }
  console.warn("[drive] not found:", text);
  return false;
}

function typeInto(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export async function drive(script: string) {
  await sleep(900);
  if (script === "home-help") {
    const reads = [...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) => b.textContent === "Read more");
    reads[2]?.click();
  }
  if (script === "kyc-identity") {
    await clickText("I permit");
    await clickText("Start");
  }
  if (script === "crunch-upload" || script === "crunch-theatre" || script === "crunch-score" || script === "crunch-limit") {
    await clickText("I have my statement");
    const file = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(new File(["%PDF-1.4"], "MPESA_Statement_2026-03-01_to_2026-08-31.pdf", { type: "application/pdf" }));
      file.files = dt.files;
      file.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(300);
    const pw = [...document.querySelectorAll<HTMLInputElement>("input")].find((i) => i.type === "text" && i.offsetParent !== null);
    if (pw) typeInto(pw, "ABC123");
    await clickText("I permit");
    if (script !== "crunch-upload") await clickText("Crunch my statement");
    if (script === "crunch-score" || script === "crunch-limit") await clickText("Skip to my score", 80);
    if (script === "crunch-limit") await clickText("See what I qualify for", 80);
  }
  if (script.startsWith("apply-")) {
    await clickText("Choose a product");
    if (script === "apply-product") return;
    await clickText("Micro Chap Chap");
    await clickText("Continue with Micro Chap Chap");
    if (script === "apply-amount") return;
    await clickText("Continue with KSh");
    if (script === "apply-period") {
      await clickText("5 weeks");
      return;
    }
    await clickText("5 weeks");
    await clickText("Shape my repayments");
    await clickText("Use this plan");
  }
}
