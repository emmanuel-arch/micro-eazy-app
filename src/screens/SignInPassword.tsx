// ─────────────────────────────────────────────────────────────────────────────
// THE EXISTING CUSTOMER'S DOOR — phone and the password Micromart already sent.
//
// ── WHY THIS SCREEN EXISTS AT ALL ───────────────────────────────────────────
// The front door asks for a phone number and sends a code. That is the right
// path for somebody NEW. It is the wrong one for the entire existing Micromart
// book — tens of thousands of people who already have a password in their SMS
// inbox, minted by Micromart's own `sp_restBorrowerPin` and sent under
// Micromart's own sender id. Making them wait for a second code to reach the
// same handset, when the credential is already there, is friction with nothing
// on the other side of it.
//
// So this is the door they already know: the same two fields, in the same
// order, as pwa.servicesuitecloud.com. What is different is what happens behind
// it — the check runs on OUR server and mints the standard borrower cookie, so
// this app's screens work identically whichever door was used. See
// lib/api/portal.ts → micromartSignIn.
//
// ── THE THREE FAILURES ARE THREE DIFFERENT SENTENCES ────────────────────────
// This screen's whole job, after the two inputs, is not collapsing them:
//
//   rejected     the password is wrong, or there is no such account. Micromart's
//                own words when they gave any — they know which.
//   ambiguous    the number is on more than one Micromart book. Not the
//                customer's fault and not fixable by retyping; it needs a human,
//                and the copy says so instead of pretending it is a typo.
//   unreachable  nobody could be asked. This is the one that MUST NOT read as a
//                refusal: telling a ten-year customer they are not registered
//                because a network hop failed is how a duplicate account gets
//                created, which is the mess this platform exists to clean up.
//
// ── THE PASSWORD FIELD ──────────────────────────────────────────────────────
// It has a reveal toggle, because the password in question is six random
// characters of mixed case that somebody is copying off an SMS ("9BD2eZ"), and
// a masked field turns that into a guessing game. `autoComplete="current-
// password"` so a manager can fill it, and `type` flips rather than the value
// being echoed anywhere.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, MessageSquare, Phone, TriangleAlert, UserPlus } from "lucide-react";
import { LiquidButton } from "../components/ui/LiquidButton";
import { AuthLayout } from "../components/shell/AuthLayout";
import { useSession } from "../lib/session";

/** Loose on purpose — a courtesy check before a round trip, not a validation.
 *  The server owns the real rule; a client rule strict enough to be
 *  authoritative is one that eventually rejects a real customer on a new prefix. */
const looksLikeAPhone = (v: string) => v.replace(/\D/g, "").length >= 9;

export default function SignInPassword() {
  const navigate = useNavigate();
  const { status, signInWithPassword, resetPassword, requestCode } = useSession();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  /** The code is the default door; the password is opened by asking for it. */
  const [usePassword, setUsePassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A failure that retyping cannot fix — ambiguous, or nobody reachable. It
   *  gets a panel rather than a red line, because the instruction is different. */
  const [held, setHeld] = useState<{ title: string; body: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  // A session that lands while this screen is open — this sign-in succeeding, or
  // a resume finishing — moves the customer on rather than leaving them looking
  // at a form they have already passed.
  useEffect(() => {
    if (status === "verified") navigate("/", { replace: true });
  }, [status, navigate]);

  const ok = looksLikeAPhone(phone) && password.trim().length > 0;

  /**
   * Send a verification code to this number and hand off to the gate.
   *
   * ── IT GOES THROUGH MICROMART'S OWN OUTBOX ────────────────────────────────
   * `requestCode` posts to /api/portal/otp, and for a bridged lender the server
   * dispatches through `Notifications.dbo.sp_InsertsmsAndEmails` on the
   * lender's own database — the same procedure their `RepaymentTrigger` calls
   * after every repayment. Their drainer then sends it under the sender id
   * registered to the entity.
   *
   * That is the whole point of routing it that way rather than through a
   * provider of ours: a verification code arriving from a name the customer has
   * never dealt with is indistinguishable from a phishing attempt, and it
   * trains people to trust exactly the message they should not.
   *
   * ── IT GRANTS NOTHING ─────────────────────────────────────────────────────
   * Sending a code is not a session. The gate at /verify verifies it against
   * the server and mints the cookie; nothing typed on this screen opens a
   * single screen behind it.
   */
  async function onSendCode() {
    if (sending || busy) return;
    setTouched(true);
    if (!looksLikeAPhone(phone)) {
      setError("Enter the phone number your Micromart account is on.");
      phoneRef.current?.focus();
      return;
    }
    setSending(true);
    setError(null);
    setHeld(null);
    setNotice(null);
    const r = await requestCode(phone);
    setSending(false);

    if (!r.ok) {
      setError(r.message);
      return;
    }

    // `delivered: false` still arrives as success — the request was accepted and
    // no provider could send it. Moving on silently would park somebody on a
    // code screen waiting for an SMS that is not coming, so this stops and says
    // so, and points at the door that still works.
    if (!r.delivered && !r.devCode) {
      setHeld({
        title: "We could not send the code",
        body:
          "Your number is fine — the SMS channel did not accept it just now. Try again in a moment, or sign in with the Micromart password below if you have it.",
      });
      setUsePassword(true);
      return;
    }

    // The phone travels in route state, not in the URL: a number in an address
    // bar ends up in history, in screenshots and in shared links.
    navigate("/verify", { state: { phone, intent: "continue" } });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    setHeld(null);
    setNotice(null);

    const r = await signInWithPassword(phone, password);
    setBusy(false);

    if (r.ok) {
      // The effect above navigates once `status` flips. Nothing to do here —
      // and deliberately no navigate() call, so there is exactly one place that
      // decides where a verified customer lands.
      return;
    }

    if (!r.reachable) {
      setHeld({
        title: "We could not reach Micromart",
        body: "Your phone number and password are almost certainly fine — we simply could not ask. Please try again in a moment. Nothing has changed on your account.",
      });
      return;
    }

    if (r.reason === "ambiguous") {
      setHeld({
        title: "Your number is on more than one account",
        body: r.message,
      });
      return;
    }

    setError(r.message);
    setPassword("");
  }

  async function onReset() {
    if (resetting) return;
    if (!looksLikeAPhone(phone)) {
      setTouched(true);
      setError("Enter your phone number first, and we will send a new password to it.");
      phoneRef.current?.focus();
      return;
    }
    setResetting(true);
    setError(null);
    setHeld(null);
    const r = await resetPassword(phone);
    setResetting(false);
    setNotice(
      r.ok
        ? r.message || "If that number has a Micromart account, a new password is on its way by SMS."
        : r.message,
    );
  }

  return (
    // The SAME frame as the front door — mark top-left, content left of centre,
    // photography sliding down the right. This screen used to build its own
    // narrow column on a plain background, which is exactly why it read as a
    // generic form bolted onto a designed product. The sign-in page is the one
    // carrying the claim that this is a real financial institution; it cannot
    // be the least considered screen in the flow.
    <AuthLayout>
      <div>
        <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">Welcome back.</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          Enter the number your Micromart account is on. We send a code to it — or use the password they SMS'd you, if
          you still have it.
        </p>

        <form onSubmit={submit} className="mt-6">
          {/* ── Phone ─────────────────────────────────────────────────────── */}
          <label htmlFor="signin-phone" className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Phone number
          </label>
          <div
            className="mt-2 flex items-center gap-2.5 rounded-2xl border px-4 transition-colors focus-within:border-[var(--green-ink)]"
            style={{
              background: "var(--surface)",
              borderColor: touched && !looksLikeAPhone(phone) ? "var(--line-strong)" : "var(--line)",
            }}
          >
            <Phone className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
            <span className="shrink-0 text-[15px] font-medium text-ink-soft">+254</span>
            <input
              id="signin-phone"
              ref={phoneRef}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="7XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="tnum min-w-0 flex-1 bg-transparent py-4 text-[16px] text-ink outline-none placeholder:text-ink-faint"
            />
          </div>

          {/* ── THE CODE, FIRST ─────────────────────────────────────────────
              This screen used to open with a password field and nothing else.
              That was right for the credential Micromart's book already holds —
              and wrong for the person actually standing in front of it, who as
              often as not deleted that SMS months ago, or never received one,
              or is looking at a thread of forty messages trying to find it.

              A code is the door that always works: it goes to the handset they
              are holding, through Micromart's own outbox, under Micromart's own
              sender id — so it arrives from the name they already trust rather
              than from a stranger. Nothing about the password door is removed;
              it moves below, for the customer who has the password in hand and
              is faster with it.

              The code path lands on the SAME gate the front door uses, so there
              is one screen in this app where a six-digit code is entered and
              one place that decides what happens after it. */}
          <div className="mt-5">
            <button
              type="button"
              onClick={onSendCode}
              disabled={sending || busy}
              className="glass-option glass-option--primary px-4 py-3.5"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ background: "color-mix(in oklab, var(--green) 22%, transparent)", color: "var(--green-ink)" }}
              >
                {sending ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.4} />
                ) : (
                  <MessageSquare className="h-[18px] w-[18px]" strokeWidth={2.3} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-tight text-ink">
                  {sending ? "Sending your code" : "Send me a code"}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">
                  {sending ? "One moment." : "Arrives by SMS from Micromart."}
                </span>
              </span>
              {!sending && <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />}
            </button>
          </div>

          {/* ── OR, THE PASSWORD ────────────────────────────────────────────
              Collapsed by default. Present and one tap away for the customer
              who has it — hiding it entirely would throw away the faster path
              for the book that already holds the credential. */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: "var(--line)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">or</span>
            <span className="h-px flex-1" style={{ background: "var(--line)" }} />
          </div>

          {!usePassword && (
            <button
              type="button"
              onClick={() => setUsePassword(true)}
              className="glass-option px-4 py-3.5"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ background: "color-mix(in oklab, var(--navy) 14%, transparent)", color: "var(--navy-ink)" }}
              >
                <KeyRound className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold leading-tight text-ink">Use my Micromart password</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">
                  The one they sent you by SMS.
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </button>
          )}

          {/* ── Password ──────────────────────────────────────────────────── */}
          <div hidden={!usePassword}>
          <label
            htmlFor="signin-password"
            className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
          >
            Password
          </label>
          <div
            className="mt-2 flex items-center gap-2.5 rounded-2xl border px-4 transition-colors focus-within:border-[var(--green-ink)]"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <KeyRound className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
            <input
              id="signin-password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              placeholder="The password in your SMS"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-4 text-[16px] text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide password" : "Show password"}
              aria-pressed={reveal}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-sunk hover:text-ink"
            >
              {reveal ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-end">
            <button
              type="button"
              onClick={onReset}
              disabled={resetting}
              className="text-[12.5px] font-semibold underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
              style={{ color: "var(--green-ink)" }}
            >
              {resetting ? "Asking Micromart…" : "Send me a new password"}
            </button>
          </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
              {error}
            </p>
          )}

          {notice && !error && (
            <p className="mt-3 rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft" style={{ background: "var(--surface-sunk)" }}>
              {notice}
            </p>
          )}

          {/* A panel, not a red line: neither of these is fixed by retyping. */}
          {held && (
            <section
              role="alert"
              className="mt-3 rounded-xl border p-3.5"
              style={{ borderColor: "var(--line-strong)", background: "var(--surface-sunk)" }}
            >
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <TriangleAlert className="h-4 w-4 shrink-0" style={{ color: "#e11d48" }} strokeWidth={2.2} />
                {held.title}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{held.body}</p>
            </section>
          )}

          {usePassword && (
            <LiquidButton type="submit" size="lg" block trailingIcon={ArrowRight} className="mt-5" loading={busy} disabled={busy}>
              {busy ? "Signing you in" : "Sign in"}
            </LiquidButton>
          )}
        </form>

        {/* ── The other door ─────────────────────────────────────────────────
            Not a footnote. Somebody who lands here and is NOT a customer has to
            be able to leave for the right screen without going back and
            guessing — and the front door's own copy sends people here, so the
            return path has to be as visible as the way in. */}
        <div className="mt-7 border-t pt-5" style={{ borderColor: "var(--line)" }}>
          <p className="text-[12.5px] text-ink-faint">New to Micro Eazy?</p>
          <button
            type="button"
            onClick={() => navigate("/welcome")}
            className="mt-2.5 flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors hover:bg-surface-sunk active:scale-[0.99]"
            style={{ borderColor: "var(--line-strong)" }}
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: "color-mix(in oklab, var(--navy) 12%, transparent)", color: "var(--navy-ink)" }}
            >
              <UserPlus className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold leading-tight">Create an account</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                Photograph your ID and we will do the rest.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
