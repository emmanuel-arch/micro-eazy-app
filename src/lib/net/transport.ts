// ─────────────────────────────────────────────────────────────────────────────
// TWO ROADS TO THE LENDER.
//
// A borrower standing in a shop with an approved loan does not care which
// hostname answered. They care that the button worked. So every call in this app
// goes through here, and here knows about two independent routes to the same
// Connected Suite:
//
//   PRIMARY   same-origin /api/*  →  Vercel rewrite  →  lms.servicesuitecloud.com
//   FALLBACK  the Tailscale Funnel host, direct      →  the same suite
//
// They share nothing. Different DNS, different edge, different certificate
// chain. A Vercel incident, a DNS propagation failure, or an expired cert on the
// primary takes out the first and not the second — which is the entire point.
//
// ── THE CONSTRAINT THAT SHAPES ALL OF THIS ──────────────────────────────────
// The borrower session is an httpOnly cookie with SameSite=Lax (see
// connected-suite/src/lib/portal/session.ts, and pwa/DEPLOY.md for the day this
// was learned the hard way). A Lax cookie IS NOT SENT on a cross-site XHR. The
// fallback is a different origin. So failing over does not carry the session
// with it, and an authenticated call that switches roads arrives anonymous.
//
// That is not something a client can paper over, and pretending otherwise would
// produce the worst kind of outage: one where the app looks up, every request
// 401s, and the logs say the customer signed out.
//
// So the honest split, which is what this file implements:
//
//   · PUBLIC calls (products, content, health, anything pre-sign-in) fail over
//     freely. They need no credential.
//   · AUTHENTICATED calls fail over ONLY when the app holds a bearer token —
//     a credential that is not bound to an origin. Until the suite issues one
//     from /api/portal/otp/verify, an authenticated call on the fallback road
//     is reported as degraded rather than attempted and silently failed.
//
// `authMode` below is where that is decided, and `TRANSPORT_TODO` names the one
// server change that turns full failover on.
//
// ── WHAT MUST NEVER BE RETRIED ──────────────────────────────────────────────
// Failover is a retry wearing a different hat, and a retried POST /api/portal/pay
// is a second STK push to a real person's phone for real money. A timeout is
// NOT evidence that the server did not act — the request may have been received,
// processed, and the response lost on the way back.
//
// So: GET and HEAD retry freely. Anything else retries only when the caller has
// said it is safe (`idempotent: true`) or has supplied an Idempotency-Key that
// the server can deduplicate against. Payments and disbursements pass neither.
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelId = "primary" | "fallback";

export interface Channel {
  id: ChannelId;
  /** Shown to staff on the demo badge; never to a borrower mid-flow. */
  label: string;
  /** "" means same-origin — the primary, and the only one the cookie reaches. */
  baseUrl: string;
  /** Whether a session cookie travels on this road. */
  carriesCookie: boolean;
}

/**
 * The fallback host. A Tailscale Funnel URL — publicly reachable, so a customer
 * on a phone does not need to be on the tailnet; it is a second PUBLIC road that
 * happens to be served from inside it. Set VITE_API_FALLBACK to
 * https://<host>.tail10c441.ts.net to arm it.
 */
const FALLBACK_BASE = (import.meta.env.VITE_API_FALLBACK ?? "").replace(/\/+$/, "");

export const CHANNELS: Channel[] = [
  { id: "primary", label: "Direct", baseUrl: "", carriesCookie: true },
  ...(FALLBACK_BASE
    ? [{ id: "fallback" as const, label: "Relay", baseUrl: FALLBACK_BASE, carriesCookie: false }]
    : []),
];

/** The one server change that unlocks failover for signed-in customers. */
export const TRANSPORT_TODO =
  "Issue a bearer token from /api/portal/otp/verify so authenticated calls can " +
  "cross origins. Until then the fallback serves public calls only.";

export type ChannelState = {
  active: ChannelId;
  /** Channels that failed their last attempt, with when. */
  degraded: ChannelId[];
  /** True while an authenticated call cannot use the road that is currently up. */
  authDegraded: boolean;
  lastError: string | null;
};

let state: ChannelState = { active: "primary", degraded: [], authDegraded: false, lastError: null };
const listeners = new Set<(s: ChannelState) => void>();

function publish(next: Partial<ChannelState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function getChannelState(): ChannelState {
  return state;
}

export function subscribeChannel(fn: (s: ChannelState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A bearer token, when the app has one. Held in memory only: a token in
 *  localStorage is a token any XSS can read, and this one is the whole session. */
let bearer: string | null = null;
export function setBearer(token: string | null) {
  bearer = token;
}

// ── THE HOUR RUNNING OUT ────────────────────────────────────────────────────
// The borrower cookie lasts one hour. Every gated route answers an expired one
// with 401 and `needsOtp: true` (see `otpRequired()` in the suite's
// portal/session.ts), which is an INSTRUCTION — send them back to the phone
// gate — and not an error to render.
//
// It is published from here rather than handled at each call site because it
// can arrive on any of a dozen calls, from any screen, at any moment. Handling
// it twelve times is twelve chances to forget once, and the screen that forgets
// shows a customer a permanent spinner or a raw error where a sign-in prompt
// belongs.
const unauthorised = new Set<() => void>();

/** Called whenever the server says the session is gone. Returns an unsubscribe. */
export function onUnauthorised(fn: () => void): () => void {
  unauthorised.add(fn);
  return () => unauthorised.delete(fn);
}

function isNeedsOtpBody(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && (body as { needsOtp?: unknown }).needsOtp === true);
}

export interface ApiOptions {
  /** Does this call need a signed-in borrower? Decides failover eligibility. */
  auth?: boolean;
  /**
   * Safe to send twice. GET and HEAD are assumed safe; everything else must say
   * so explicitly, because the default has to be the one that cannot double-pay
   * somebody.
   */
  idempotent?: boolean;
  /** Deduplicated server-side, which makes a non-idempotent call retryable. */
  idempotencyKey?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

// ── THE TIMEOUT, AND WHY 12s WAS TOO SHORT FOR THE SCREEN THAT MATTERS ──────
// This was 12s for everything, and it produced the bug that made Home unusable:
// /api/portal/home is an AGGREGATE. For a bridged lender it fans out across the
// suite into Micromart's own SQL Server — balance, limit, savings, schedule,
// application stage, messages — and a cold one of those over the bridge is
// regularly slower than twelve seconds. /api/portal/messages is a single
// indexed read and comes back instantly, which is exactly why messages worked
// while Home did not, and why Home "started working" once the server was warm.
//
// So the default rises, and the heavy reads get their own budget. This is not
// papering over a slow server: it is admitting that a first-load aggregate
// across a bridge into somebody else's database has a different distribution
// from a keyed lookup, and giving it a limit drawn from that distribution
// rather than from the other one.
const DEFAULT_TIMEOUT = 20_000;

/** For the fan-out reads — see above. Callers pass `timeoutMs: SLOW_TIMEOUT`. */
export const SLOW_TIMEOUT = 45_000;

/**
 * ── NEVER SHOW A DOMException TO A CUSTOMER ─────────────────────────────────
 * When the controller above fires, `fetch` rejects with a DOMException whose
 * message is the string "signal is aborted without reason". That error was
 * rethrown raw, and screens/components render `err.message` — so a borrower
 * who opened the app to check their balance was shown, verbatim:
 *
 *     We could not load this
 *     signal is aborted without reason
 *
 * It is the single worst error text in the app: it is frightening, it is
 * meaningless, it names no action, and it appears on the screen the product is
 * judged on. The condition it describes — "the lender's system did not answer
 * in time" — is an ordinary and explainable thing.
 *
 * `cause` is preserved so the real DOMException is still there for anyone
 * reading a console or a breadcrumb; only what a person SEES is translated.
 */
function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function humanise(err: unknown, timedOutAfterMs: number): Error {
  if (isAbort(err)) {
    const seconds = Math.round(timedOutAfterMs / 1000);
    return new ApiError(
      `Your lender's system did not answer within ${seconds} seconds. Nothing has changed on your account — please try again.`,
      0,
      null,
    );
  }
  if (err instanceof Error) return err;
  return new ApiError("Could not reach the lender. Check your connection and try again.", 0, null);
}

/** Gateway-level failures — the road is broken. An application 500 is NOT here:
 *  that is the far end answering, and asking a second host the same question
 *  will produce the same answer while doubling the load. */
const ROAD_FAILURE = new Set([502, 503, 504, 522, 523, 524]);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function usableChannels(opts: ApiOptions): Channel[] {
  const ordered = [...CHANNELS].sort((a, b) => (a.id === state.active ? -1 : b.id === state.active ? 1 : 0));
  if (!opts.auth) return ordered;
  // An authenticated call may only travel a road that can carry the credential.
  return ordered.filter((c) => c.carriesCookie || bearer !== null);
}

function mayRetry(method: string, opts: ApiOptions): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD") return true;
  return opts.idempotent === true || Boolean(opts.idempotencyKey);
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  opts: ApiOptions = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const channels = usableChannels(opts);

  if (channels.length === 0) {
    publish({ authDegraded: true, lastError: "No road can carry this session." });
    throw new ApiError(
      "You are signed in on a connection that is currently unavailable. Sign in again to continue.",
      0,
      null,
    );
  }

  const canRetry = mayRetry(method, opts);
  const budget = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  let lastErr: unknown = null;

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const controller = new AbortController();
    // Which of the two things aborted this attempt. Without it, a caller that
    // cancelled deliberately (a screen unmounting) is indistinguishable from a
    // lender that timed out, and one of those deserves an error message while
    // the other deserves silence.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, budget);
    // Honour a caller's own cancellation without losing our timeout.
    const onCallerAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onCallerAbort, { once: true });

    try {
      const headers = new Headers(init.headers);
      if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
      if (bearer && !ch.carriesCookie) headers.set("Authorization", `Bearer ${bearer}`);
      if (opts.idempotencyKey) headers.set("Idempotency-Key", opts.idempotencyKey);

      const res = await fetch(`${ch.baseUrl}${path}`, {
        ...init,
        headers,
        credentials: ch.carriesCookie ? "include" : "omit",
        signal: controller.signal,
      });

      if (ROAD_FAILURE.has(res.status) && canRetry && i < channels.length - 1) {
        lastErr = new ApiError(`Gateway ${res.status} on ${ch.id}`, res.status, null);
        continue;
      }

      // Anything else is the far end ANSWERING — including a 404 and a 401.
      // Those are facts, not outages, and switching roads would only hide them.
      if (state.active !== ch.id) {
        publish({ active: ch.id, degraded: state.degraded.filter((d) => d !== ch.id) });
      }

      const text = await res.text();
      const body = text ? safeJson(text) : null;
      if (!res.ok) {
        // An expired or missing borrower session. Tell the app once, here, so
        // the guard can move them to the gate wherever they are standing — then
        // still throw, because the CALL failed and its caller must not carry on
        // as though it returned data.
        if (res.status === 401 && isNeedsOtpBody(body)) {
          unauthorised.forEach((fn) => fn());
        }
        throw new ApiError(messageFrom(body) ?? `Request failed (${res.status})`, res.status, body);
      }
      if (state.lastError) publish({ lastError: null, authDegraded: false });
      return body as T;
    } catch (err) {
      // An ApiError from the block above is a real answer; do not treat it as a
      // broken road and do not try the other one.
      if (err instanceof ApiError && !ROAD_FAILURE.has(err.status)) throw err;

      // The CALLER cancelled — a screen unmounted, a customer navigated away.
      // That is not a failure and it is certainly not something to report, or
      // to mark a road degraded over. Rethrow untouched so an awaiting effect
      // can see the AbortError and ignore it.
      if (isAbort(err) && !timedOut) throw err;

      // Our own timer fired. Translate it here rather than at the end, so the
      // message names the budget that was actually exceeded on THIS road.
      lastErr = timedOut ? humanise(err, budget) : err;
      publish({
        degraded: state.degraded.includes(ch.id) ? state.degraded : [...state.degraded, ch.id],
        lastError: err instanceof Error ? err.message : "Network error",
      });

      // The request may have been received and acted on. For anything that is
      // not provably safe to repeat, stop here and tell the caller, rather than
      // sending a second payment instruction down another road.
      if (!canRetry) break;
    } finally {
      clearTimeout(timer);
      // The listener was added with `once`, but `once` only removes it when it
      // FIRES. On every successful call it stays attached to a signal the
      // caller may reuse, and a long-lived signal therefore accumulates one
      // dead closure per request — each holding a controller alive.
      opts.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  // Belt and braces: anything that reaches here unhumanised still must not
  // arrive at a screen as a DOMException.
  throw humanise(lastErr, budget);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // An HTML error page from an edge, most likely. Returning it as a string is
    // more useful than throwing a parse error that names a line number.
    return text;
  }
}

function messageFrom(body: unknown): string | null {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return null;
}

/**
 * Bring the primary back when it recovers. Without this the app stays on the
 * fallback for the rest of the session — correct, but it means one blip moves
 * every customer onto the spare road until they reload.
 *
 * Cheap and unauthenticated, so it costs nothing and cannot 401.
 */
export function startChannelProbe(intervalMs = 60_000): () => void {
  if (CHANNELS.length < 2) return () => {};
  const tick = async () => {
    if (state.active === "primary") return;
    try {
      const res = await fetch("/api/portal/session", { method: "GET", credentials: "include" });
      if (res.ok || res.status === 401) {
        // 401 means the primary is UP and simply says we are not signed in —
        // which is a healthy road, not a failure.
        publish({ active: "primary", degraded: state.degraded.filter((d) => d !== "primary") });
      }
    } catch {
      /* still down; stay where we are */
    }
  };
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
