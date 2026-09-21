// ─────────────────────────────────────────────────────────────────────────────
// THE CODE — the first screen that belongs to the lender, not to Micro Eazy.
//
// The customer has chosen who lends to them, and the code went out through that
// lender's own SMS outbox under their own sender id. So this screen wears their
// livery: their mark, centred, at the top, and their accent on the boxes. What
// the SMS says and what the screen says now agree about whose it is.
//
// ── SIX BOXES, ONE INPUT ────────────────────────────────────────────────────
// A six-digit code read off an SMS is typed in glances — look at the message,
// type two, look back — and a single field gives no landmark for where you
// were. The boxes are the landmark.
//
// Underneath there is still exactly ONE <input>, transparent and laid over the
// row. Six real inputs means hand-rolling focus movement, paste splitting,
// backspace across boundaries — and `autocomplete="one-time-code"`, which a
// phone will only ever fill into a single field. Four things to get wrong in
// exchange for nothing a customer can see.
//
// ── THE DIGITS DO NOT STAY ON SCREEN ────────────────────────────────────────
// Each digit shows for a moment as it is typed and then becomes a dot, the way
// a banking app treats a PIN. A verification code is a credential for about
// five minutes, and this screen is used at a shop counter and on a matatu with
// somebody reading over a shoulder. The eye toggle turns the digits back on for
// anyone who needs to check what they typed.
//
// ── WHERE IT GOES NEXT ──────────────────────────────────────────────────────
// A verified code mints the borrower cookie. Then:
//   intent "join"      → onboarding, which is what the lender's create-account
//                        door promised.
//   anything else      → the lender's sign-in page, /<slug>/signin. That page
//                        forwards a signed-in customer to their account, so the
//                        URL passes through the lender's own door on the way in.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { LiquidButton } from "../components/ui/LiquidButton";
import { useLender } from "../lib/lender";
import { useSession } from "../lib/session";
import { ThemeToggle } from "../components/shell/ThemeToggle";

const LENGTH = 6;
/** How long a freshly typed digit stays readable before it becomes a dot. */
const REVEAL_MS = 700;

function formatLocal(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^254/, "").replace(/^0/, "");
  if (d.length !== 9) return raw;
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export default function LenderVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const lender = useLender();
  const { submitCode, requestCode } = useSession();

  const routeState = (location.state as { phone?: string; intent?: string; devCode?: string } | null) ?? {};
  const phone = routeState.phone ?? "";
  const intent = routeState.intent ?? "continue";

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    routeState.devCode ? `SMS is not configured here — your code is ${routeState.devCode}.` : null,
  );
  const [reveal, setReveal] = useState(false);
  /** The box whose digit is still showing, briefly, after being typed. */
  const [fresh, setFresh] = useState<number | null>(null);
  const [focused, setFocused] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // No number, nothing to verify against. Back to the front door.
  useEffect(() => {
    if (!phone) navigate("/welcome", { replace: true });
  }, [phone, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (fresh === null) return;
    const t = setTimeout(() => setFresh(null), REVEAL_MS);
    return () => clearTimeout(t);
  }, [fresh, code]);

  async function verify(value: string) {
    if (value.length !== LENGTH || busy) return;
    setBusy(true);
    setError(null);
    setBad(false);
    const r = await submitCode(phone, value);
    setBusy(false);
    if (!r.ok) {
      // Three reasons, three instructions. "Expired" told as "wrong" sends
      // somebody to re-read an SMS that will never work.
      setError(
        r.reason === "expired"
          ? "That code has expired. Ask for a new one below."
          : r.reason === "locked"
            ? "Too many wrong attempts. Ask for a new code below."
            : r.message || "That code is not right. Check the SMS and try again.",
      );
      setBad(true);
      setCode("");
      inputRef.current?.focus();
      return;
    }
    navigate(intent === "join" ? "/join" : `/${lender.slug}/signin`, { replace: true });
  }

  function onChange(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, LENGTH);
    setBad(false);
    setError(null);
    if (next.length > code.length) setFresh(next.length - 1);
    setCode(next);
    // Submit on the sixth digit. Making somebody find and press a button after
    // typing a complete code is a step that only exists to be forgotten.
    if (next.length === LENGTH) void verify(next);
  }

  async function onResend() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await requestCode(phone);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    // `delivered: false` is a 200. Saying "we sent it" would point somebody at a
    // phone that is never going to buzz.
    setNotice(
      r.delivered
        ? "A new code is on its way."
        : r.devCode
          ? `SMS is not configured here — your code is ${r.devCode}.`
          : r.message || "We could not send the code just now.",
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void verify(code);
  };

  return (
    <div className="relative flex min-h-screen flex-col px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),1rem)]">
      {/* A wash of the lender's accent from the top — enough that the screen is
          visibly theirs, not enough to compete with the boxes for attention. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46vh]"
        style={{ background: "linear-gradient(to bottom, var(--brand-soft) 0%, transparent 100%)" }}
      />

      <header className="flex items-center justify-between py-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
          Back
        </button>
        <ThemeToggle variant="panel" />
      </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center py-8 text-center">
        {/* ── THE LENDER'S MARK, CENTRED ─────────────────────────────────────
            On a white plate in both themes: their mark carries dark tones that
            sink into the dark ground, and this is the one place on the screen
            that has to say whose code this is. */}
        <span
          className="grid place-items-center rounded-[22px] bg-white p-3.5"
          style={{ boxShadow: "0 18px 40px -22px rgb(0 0 0 / 0.4), 0 0 0 1px var(--line)" }}
        >
          <img src={lender.mark} alt={lender.name} className="h-[76px] w-[76px] object-contain" draggable={false} />
        </span>

        <h1 className="mt-6 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">Enter your code</h1>
        <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-ink-soft">
          {lender.short} sent a 6-digit code to{" "}
          {/* Never broken across a line — "0758 517 / 032" reads as two numbers. */}
          <span className="tnum whitespace-nowrap font-semibold text-ink">{formatLocal(phone)}</span>.
        </p>

        <form onSubmit={submit} className="mt-8 w-full">
          <div className="relative">
            {/* The boxes. Drawn, not interactive — the input on top takes every
                keystroke, paste and SMS autofill. */}
            <div aria-hidden className="grid grid-cols-6 gap-2 sm:gap-2.5">
              {Array.from({ length: LENGTH }, (_, i) => {
                const digit = code[i];
                const at = focused && !busy && i === Math.min(code.length, LENGTH - 1) && code.length < LENGTH;
                return (
                  <span
                    key={i}
                    className={`otp-box ${digit ? "otp-box--set" : ""} ${at ? "otp-box--at" : ""} ${bad ? "otp-box--bad" : ""}`}
                  >
                    {digit ? (
                      reveal || fresh === i ? (
                        digit
                      ) : (
                        <span className="block h-3 w-3 rounded-full" style={{ background: "var(--ink)" }} />
                      )
                    ) : at ? (
                      <span className="otp-caret" />
                    ) : null}
                  </span>
                );
              })}
            </div>

            <input
              ref={inputRef}
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              // Masked on screen (see above) but a real numeric field underneath,
              // so the phone's SMS autofill and a password manager both work.
              aria-label={`${LENGTH}-digit code from ${lender.short}`}
              value={code}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={busy}
              maxLength={LENGTH}
              className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
              style={{ letterSpacing: "2.5rem" }}
            />
          </div>

          <div className="mt-4 flex min-h-[24px] items-center justify-center gap-4">
            {busy ? (
              <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ink-soft">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--brand-ink)" }} />
                Checking the code
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-pressed={reveal}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-faint transition-colors hover:text-ink"
              >
                {reveal ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
                {reveal ? "Hide code" : "Show code"}
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="mt-3 rounded-lg px-3 py-2 text-[12.5px] leading-snug text-ink-soft" style={{ background: "var(--surface-sunk)" }}>
              {notice}
            </p>
          )}

          {/* The code submits itself on the sixth digit; this is the same
              commit as a button, in the lender's glass, for anybody who pasted
              a code and looked for somewhere to press — and so the three
              sign-ins Micromart is shown end on the same object. Inert until
              the code is whole. */}
          <LiquidButton
            type="submit"
            variant="solid"
            size="lg"
            block
            trailingIcon={ArrowRight}
            loading={busy}
            disabled={busy || code.length !== LENGTH}
            tone={{ fill: "var(--brand)", rim: "var(--brand-2)", ink: "var(--brand-on)" }}
            className="mt-6"
          >
            {busy ? "Checking the code" : "Verify & sign in"}
          </LiquidButton>
        </form>

        <p className="mt-8 text-[12.5px] text-ink-faint">
          No code?{" "}
          <button
            type="button"
            onClick={onResend}
            disabled={busy}
            className="font-semibold underline decoration-[var(--line-strong)] underline-offset-4 disabled:opacity-60"
            style={{ color: "var(--brand-ink)" }}
          >
            Send a new one
          </button>
        </p>
      </main>

      <footer className="text-center">
        <Link to="/welcome" className="text-[11.5px] font-medium tracking-[0.01em] text-ink-faint">
          Powered by <span className="font-semibold text-ink-soft">Micro Eazy</span>
        </Link>
      </footer>
    </div>
  );
}
