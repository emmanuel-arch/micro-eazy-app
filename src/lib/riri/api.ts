// ─────────────────────────────────────────────────────────────────────────────
// RIRI, TYPED — the customer's first contact, over the same transport as everything else.
//
// The routes live in connected-suite/src/app/api/portal/riri/. Types are read off
// those routes, for the reason lib/api/portal.ts spells out at length: a client type
// that disagrees with its server compiles cleanly and renders nothing.
//
// WHAT THE APP SENDS, AND WHAT IT NEVER SENDS
//   · the question, in the customer's words
//   · the ROUTE they are on — a string the server resolves against the app's map
//   · on a hand-off, the customer's own questions and anything they want to add
//
// Never a balance, never a limit, never "what Riri checked". Every fact on an
// answer and every line of the triage note an officer reads is produced on the
// server from the proven session. A browser that could post those could tell an
// officer a customer in arrears is clear.
//
// ── IDEMPOTENCY ─────────────────────────────────────────────────────────────
//   askRiri          safe to repeat — it reads. EXCEPT a request for a person, which
//                    opens a case; the server's findOrOpenThread keys on the open
//                    thread, so a retry lands in the same case rather than a second.
//                    Still not marked idempotent: no silent retries on this surface.
//   escalateRiri     NOT idempotent. Two taps is one case (same key), but the triage
//                    note would be written twice, and an officer cannot tell which.
//   ririFeedback     safe — a thumb is a row, and a second row is noise, not harm.
// ─────────────────────────────────────────────────────────────────────────────
import { apiFetch } from "../net/transport";
import { lenderSlug } from "../api/portal";

export type RiriLang = "en" | "sw";

export interface RiriHello {
  success: boolean;
  enabled: boolean;
  name: string;
  lender: string;
  opener: Record<RiriLang, string>;
  prompts: Record<RiriLang, string[]>;
}

export type RiriOutcome = "resolved" | "offer" | "escalate" | "escalated";
export type RiriEngine = "record" | "knowledge" | "map" | "model";

export interface RiriAction {
  kind: "navigate";
  label: string;
  /** An app route from the app map. `/` means the lender's home. */
  href: string;
  screenId: string;
}

export interface RiriAnswer {
  success: boolean;
  name: string;
  outcome: RiriOutcome;
  intent: string;
  lang: RiriLang;
  answer: string;
  engine: RiriEngine;
  confidence: "certain" | "likely" | "unsure";
  sources: { id: string; label: string; starter?: boolean }[];
  /** Which tools she read — ids only, never figures. */
  checked: string[];
  actions: RiriAction[];
  suggestions: string[];
  screen: { id: string; title: string } | null;
  escalation: { threadId: string; caseRef: string } | null;
  canEscalate: boolean;
}

export interface RiriHandoff {
  success: boolean;
  threadId?: string;
  caseRef?: string;
  created?: boolean;
  reason?: "not-enrolled";
  message: string;
}

export const ririHello = () =>
  apiFetch<RiriHello>(`/api/portal/riri?lenderSlug=${encodeURIComponent(lenderSlug())}`, {}, { auth: true, idempotent: true });

export const askRiri = (args: { question: string; route: string; history: { role: "user" | "model"; text: string }[]; lang?: RiriLang; nationalId?: string | null }) =>
  apiFetch<RiriAnswer>(
    "/api/portal/riri",
    {
      method: "POST",
      body: JSON.stringify({
        lenderSlug: lenderSlug(),
        question: args.question,
        route: args.route,
        history: args.history.slice(-8),
        ...(args.lang ? { lang: args.lang } : {}),
        ...(args.nationalId ? { nationalId: args.nationalId } : {}),
      }),
    },
    { auth: true, timeoutMs: 30_000 },
  );

export const escalateRiri = (args: { questions: string[]; route: string; note?: string; nationalId?: string | null }) =>
  apiFetch<RiriHandoff>(
    "/api/portal/riri/escalate",
    {
      method: "POST",
      body: JSON.stringify({
        lenderSlug: lenderSlug(),
        questions: args.questions.slice(-6),
        route: args.route,
        ...(args.note?.trim() ? { note: args.note.trim() } : {}),
        ...(args.nationalId ? { nationalId: args.nationalId } : {}),
      }),
    },
    { auth: true, timeoutMs: 30_000 },
  );

export const ririFeedback = (args: { question: string; helpful: boolean; source?: string; intent?: string }) =>
  apiFetch<{ success: boolean }>(
    "/api/portal/riri/feedback",
    { method: "POST", body: JSON.stringify({ lenderSlug: lenderSlug(), ...args }) },
    { auth: true, idempotent: true },
  );

/** Verify a signed hand-off link from another system. Public: the token is the credential. */
export const verifyRiriHandoff = (token: string) =>
  apiFetch<{ success: boolean; reason?: string; fromTitle?: string; question?: string; message?: string }>(
    `/api/riri/handoff?token=${encodeURIComponent(token)}`,
    {},
    { auth: false, idempotent: true },
  );
