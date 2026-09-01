// ─────────────────────────────────────────────────────────────────────────────
// THE SESSION — who is holding the phone, and what the app is allowed to show.
//
// ── THE CREDENTIAL IS NOT IN HERE ───────────────────────────────────────────
// Nothing in this file can authenticate a request. The credential is an
// httpOnly cookie (`lms_borrower`) minted by /api/portal/otp/verify, and
// JavaScript cannot read it by design. What this module holds is the app's
// BELIEF about that cookie — enough to decide which screen to render — and that
// belief is always a cache of something the server said, never a substitute for
// asking it.
//
// The practical consequence, and it is the one that matters: a screen must
// never treat `status === "verified"` as permission. The server re-checks on
// every call and can answer 401 at any moment, because the cookie lasts ONE
// HOUR (MAX_AGE_S in connected-suite/src/lib/portal/session.ts) and an app left
// open on a phone overnight will come back to a session that has quietly ended.
// `onUnauthorised` below is how that arrives, and it is not an error path — it
// is the normal end of an hour.
//
// ── THE SECOND FACTOR ───────────────────────────────────────────────────────
// The phone is server-authoritative and comes from the cookie. The NATIONAL ID
// does not: every gated route takes it in the body as a knowledge factor, so a
// SIM swap alone does not open somebody's loan book. That means the app has to
// keep it, and where it keeps it is a real decision:
//
//   · Not localStorage. That outlives the one-hour cookie by months, on a phone
//     that is often shared, and the ID is the one factor a thief on the handset
//     would otherwise still need.
//   · sessionStorage. Dies with the tab, is not shared across tabs, and is
//     roughly the lifetime of the thing it accompanies. A reload — the actual
//     UX need — survives it.
//
// It is worth being clear about what this is NOT protecting against: an ID here
// grants nothing on its own, because every route also demands the cookie. The
// storage choice is about the shared-handset case, not about secrecy.
// ─────────────────────────────────────────────────────────────────────────────
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  enrolment as fetchEnrolment,
  getSession,
  sendOtp,
  signOut as apiSignOut,
  verifyOtp,
  type Enrolment,
} from "./api/portal";
import { onUnauthorised } from "./net/transport";

/**
 * `unknown` is a real state and collapsing it into `anonymous` is the bug that
 * makes an app flash its sign-in screen at somebody who is already signed in.
 * On first paint the app has not yet asked the server anything.
 */
export type SessionStatus = "unknown" | "anonymous" | "verified";

/** Where the customer stands with this lender, once we have asked. */
export type Enrolled = "unknown" | "returning" | "new" | "undetermined";

interface Ctx {
  status: SessionStatus;
  /** "0712 ••• 678". Display only — never send it to an endpoint. */
  phoneMasked: string | null;
  /** The second factor, once given. Held for the tab, not for the device. */
  nationalId: string | null;
  enrolled: Enrolled;
  /** Only known after an enrolment check that found somebody. */
  firstName: string | null;
  lender: string | null;
  /** The last enrolment answer in full, for screens that need `ambiguous`. */
  enrolment: Enrolment | null;

  /** Step one of signing in. Returns the server's own message to show. */
  requestCode: (phone: string) => Promise<{ ok: boolean; delivered: boolean; devCode?: string; message: string }>;
  /** Step two. On success the cookie exists and `status` becomes "verified". */
  submitCode: (phone: string, code: string) => Promise<{ ok: boolean; reason?: string; message: string }>;
  /** Step three: the second factor, and the returning-or-new decision. */
  identify: (nationalId: string) => Promise<Enrolment>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Ctx | null>(null);

const ID_KEY = "me.nid";

function readStoredId(): string | null {
  try {
    return sessionStorage.getItem(ID_KEY);
  } catch {
    // Private windows and locked-down browsers throw on ACCESS, not only on
    // write. A stored convenience is never worth a blank screen.
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("unknown");
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [nationalId, setNationalIdState] = useState<string | null>(readStoredId);
  const [enrolled, setEnrolled] = useState<Enrolled>("unknown");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lender, setLender] = useState<string | null>(null);
  const [enrolmentState, setEnrolmentState] = useState<Enrolment | null>(null);

  const setNationalId = useCallback((v: string | null) => {
    setNationalIdState(v);
    try {
      if (v) sessionStorage.setItem(ID_KEY, v);
      else sessionStorage.removeItem(ID_KEY);
    } catch {
      /* the ID stays in memory for this page; a reload will re-ask */
    }
  }, []);

  const clear = useCallback(() => {
    setStatus("anonymous");
    setPhoneMasked(null);
    setEnrolled("unknown");
    setFirstName(null);
    setEnrolmentState(null);
    setNationalId(null);
  }, [setNationalId]);

  // ── Resume on load ────────────────────────────────────────────────────────
  // The cookie survives a reload and the app must not send a signed-in customer
  // back to the phone gate — that burns an SMS, spends one of their three codes
  // per fifteen minutes, and reads as the app having forgotten them.
  //
  // A failure here is NOT a sign-out. A network blip on first paint would
  // otherwise log everybody out, so the status falls to "anonymous" only when
  // the server actually says `authenticated: false`.
  //
  // ── NO "HAVE WE ASKED YET" REF HERE, AND THAT IS DELIBERATE ───────────────
  // The obvious guard — a ref that makes this run once — DEADLOCKS under
  // StrictMode, which double-invokes effects in development. The first pass
  // starts the fetch and sets the flag; its cleanup sets `alive = false`; the
  // second pass returns early because the flag is set. So the only request in
  // flight has its result thrown away by a dead closure and the app sits on
  // "Checking your session…" for ever. It cost a screenshot to find, because
  // the code reads as though it obviously works.
  //
  // Letting it run twice in development is the cheaper mistake: this is an
  // idempotent GET, and in a production build StrictMode does not double-invoke.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSession();
        if (!alive) return;
        if (s.authenticated) {
          setStatus("verified");
          setPhoneMasked(s.phoneMasked ?? null);
        } else {
          clear();
        }
      } catch {
        if (alive) setStatus("anonymous");
      }
    })();
    return () => {
      alive = false;
    };
  }, [clear]);

  // ── The hour running out ──────────────────────────────────────────────────
  // Any gated call can come back 401 `needsOtp` at any time. Rather than have
  // every screen handle that, the transport publishes it once and the session
  // resets here — so the guard in App.tsx moves the customer to the gate on the
  // next render, wherever they happen to be standing.
  useEffect(() => onUnauthorised(() => clear()), [clear]);

  const requestCode = useCallback(async (phone: string) => {
    try {
      const r = await sendOtp(phone);
      return {
        ok: Boolean(r.success),
        // The route answers 200 with success:true even when NO PROVIDER COULD
        // SEND. Reading only `success` tells somebody to check a phone that
        // will never buzz, so the screen is given the real answer.
        delivered: Boolean(r.delivered),
        devCode: r.devCode,
        message: r.message ?? "",
      };
    } catch (e) {
      return { ok: false, delivered: false, message: messageOf(e, "We could not send the code. Try again.") };
    }
  }, []);

  const submitCode = useCallback(async (phone: string, code: string) => {
    try {
      const r = await verifyOtp(phone, code);
      if (!r.success) return { ok: false, reason: r.reason, message: r.message ?? "That code is not right." };
      setStatus("verified");
      // The server hands back the normalised msisdn; the mask is ours to make
      // and is only ever display text.
      setPhoneMasked(maskLocal(r.phone ?? phone));
      if (r.lender) setLender(r.lender);
      return { ok: true, message: "" };
    } catch (e) {
      // A wrong or expired code arrives as a 401 ApiError, not as a false
      // `success` — so the reason has to be read off the error body.
      const reason = reasonOf(e);
      return { ok: false, reason, message: messageOf(e, "That code is not right.") };
    }
  }, []);

  const identify = useCallback(
    async (id: string) => {
      const r = await fetchEnrolment(id);
      setNationalId(id);
      setEnrolmentState(r);
      setLender(r.lender ?? null);
      setFirstName(r.firstName ?? null);
      // `enrolled: false` with `reachable: false` is "we could not check", and
      // treating it as "new" is what would push a ten-year customer through KYC
      // and open a second account against their phone. It gets its own state.
      setEnrolled(r.enrolled ? "returning" : r.reachable && !r.ambiguous ? "new" : "undetermined");
      return r;
    },
    [setNationalId],
  );

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } catch {
      // The cookie may already be gone, or the network down. Either way the
      // local belief must be cleared — a sign-out that appears not to work is
      // worse than one that races the server.
    }
    clear();
  }, [clear]);

  const value = useMemo(
    () => ({
      status,
      phoneMasked,
      nationalId,
      enrolled,
      firstName,
      lender,
      enrolment: enrolmentState,
      requestCode,
      submitCode,
      identify,
      signOut,
    }),
    [status, phoneMasked, nationalId, enrolled, firstName, lender, enrolmentState, requestCode, submitCode, identify, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionContext);
  if (!c) throw new Error("useSession must be used inside <SessionProvider>");
  return c;
}

/** 254712345678 → "0712 ••• 678". Mirrors maskMsisdn on the server so a resumed
 *  session and a fresh one read identically. */
function maskLocal(msisdn: string): string {
  const digits = msisdn.replace(/\D/g, "");
  const local = `0${digits.slice(-9)}`;
  return `${local.slice(0, 4)} ••• ${local.slice(-3)}`;
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** The `reason` the verify route puts on its 401 body — "invalid" | "expired" |
 *  "locked". They are three different instructions to the customer and
 *  collapsing them makes the retry advice wrong most of the time. */
function reasonOf(e: unknown): string | undefined {
  const body = (e as { body?: unknown })?.body;
  if (body && typeof body === "object" && "reason" in body) {
    const r = (body as { reason?: unknown }).reason;
    if (typeof r === "string") return r;
  }
  return undefined;
}
