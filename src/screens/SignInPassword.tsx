// ─────────────────────────────────────────────────────────────────────────────
// THE LENDER'S SIGN-IN — /<slug>/signin, in the lender's own livery.
//
// ── WHY THIS SCREEN EXISTS AT ALL ───────────────────────────────────────────
// A lender's existing book already holds a credential. For Micromart that is
// tens of thousands of people with a password in their SMS inbox, minted by
// Micromart's own `sp_restBorrowerPin` and sent under Micromart's own sender id.
// Making them wait for a second code to reach the same handset, when the
// credential is already there, is friction with nothing on the other side of it.
//
// So this is the door they already know — phone, then password, in that order,
// as on their existing app. What is different is what happens behind it: the
// check runs on OUR server and mints the standard borrower cookie, so every
// screen after this works identically whichever door was used. See
// lib/api/portal.ts → micromartSignIn.
//
// ── IT IS THE LENDER'S PAGE, NOT OURS WITH THEIR LOGO ON ────────────────────
// Their transparent mark top-left, their accent on the commit button, their
// name in the sentence under the heading — interpolated from lib/lenders.ts,
// never typed into this file. The same component serves /axe/signin the day
// Axe opens, with no change here.
//
// ── WHAT IS DELIBERATELY NOT ON IT ANY MORE ─────────────────────────────────
// "Send me a code", "Use password" and "Create account" were three tiles above
// the fields. The code door moved to the front of the flow (the chooser sends
// it), the password field is now simply open — it IS the door — and "Create
// account" moved to the top-right corner beside the appearance switch, which is
// where somebody on the wrong door looks for the right one.
//
// ── THE THREE FAILURES ARE THREE DIFFERENT SENTENCES ────────────────────────
//   rejected     the password is wrong, or there is no such account. The
//                lender's own words when they gave any — they know which.
//   ambiguous    the number is on more than one book. Not the customer's fault
//                and not fixable by retyping; it needs a human, and the copy
//                says so instead of pretending it is a typo.
//   unreachable  nobody could be asked. This is the one that MUST NOT read as a
//                refusal: telling a ten-year customer they are not registered
//                because a network hop failed is how a duplicate account gets
//                created, which is the mess this platform exists to clean up.
//
// ── A SIGNED-IN CUSTOMER NEVER SEES THE FORM ────────────────────────────────
// A session that is already verified — a customer who has just entered their
// code, or who reloads with a live cookie — is forwarded to /<slug>, their
// account. Asking somebody who is signed in to sign in is a bug, not security.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, KeyRound, TriangleAlert, UserPlus } from "lucide-react";
import { LiquidButton } from "../components/ui/LiquidButton";
import { AuthLayout } from "../components/shell/AuthLayout";
import { PhoneField, looksLikeAPhone } from "../components/auth/PhoneField";
import { useLender } from "../lib/lender";
import { useSession } from "../lib/session";

export default function SignInPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const lender = useLender();
  const { status, signInWithPassword, resetPassword } = useSession();

  // The front door hands the number over if the customer typed one there.
  const handed = (location.state as { phone?: string } | null)?.phone ?? "";

  const [phone, setPhone] = useState(handed);
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A failure that retyping cannot fix — ambiguous, or nobody reachable. It
   *  gets a panel rather than a red line, because the instruction is different. */
  const [held, setHeld] = useState<{ title: string; body: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const phoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Straight to the field that is still empty.
    (handed ? passwordRef : phoneRef).current?.focus();
  }, [handed]);

  // One place decides where a verified customer lands, and it is here.
  useEffect(() => {
    if (status === "verified") navigate(`/${lender.slug}`, { replace: true });
  }, [status, navigate, lender.slug]);

  const ok = looksLikeAPhone(phone) && password.trim().length > 0;

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

    if (r.ok) return; // the effect above navigates once `status` flips

    if (!r.reachable) {
      setHeld({
        title: `We could not reach ${lender.short}`,
        body: "Your phone number and password are almost certainly fine — we simply could not ask. Please try again in a moment. Nothing has changed on your account.",
      });
      return;
    }

    if (r.reason === "ambiguous") {
      setHeld({ title: "Your number is on more than one account", body: r.message });
      return;
    }

    setError(r.message);
    setPassword("");
    passwordRef.current?.focus();
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
        ? r.message || `If that number has a ${lender.short} account, a new password is on its way by SMS.`
        : r.message,
    );
  }

  return (
    <AuthLayout
      lender={lender}
      headerAction={
        // ── CREATE ACCOUNT, TOP RIGHT ─────────────────────────────────────
        // Text, not a button-shaped button: it is a way OUT of this page for
        // somebody on the wrong door, and it must not compete with Sign in for
        // the eye. On the brand band on a phone it takes the band's white ink.
        <Link
          to={`/${lender.slug}/welcome`}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-sky-ink transition-colors hover:bg-white/10 lg:text-ink lg:hover:bg-surface-sunk"
        >
          <UserPlus className="h-4 w-4" strokeWidth={2.3} />
          Create account
        </Link>
      }
    >
      <div>
        <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink lg:text-[30px]">
          Welcome back.
        </h1>
        {/* More air under the heading than the other doors have: this sentence is
            the one that tells a customer they are on the right lender's page. */}
        <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed text-ink-soft">
          Enter the number your {lender.name} account is on. We take you through the rest.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <PhoneField
            ref={phoneRef}
            id="signin-phone"
            value={phone}
            onChange={setPhone}
            showError={touched}
            accent="var(--brand)"
          />

          {/* ── THE PASSWORD ────────────────────────────────────────────────
              A reveal toggle, because the password is six random characters of
              mixed case copied off an SMS ("9BD2eZ"), and a masked field turns
              that into a guessing game. `type` flips; the value is never echoed
              anywhere else. */}
          <div>
            <label
              htmlFor="signin-password"
              className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
            >
              Password
            </label>
            <div
              data-accent-field=""
              className="mt-2 flex items-center gap-2.5 rounded-2xl border px-4 transition-[border-color,box-shadow]"
              style={{ background: "var(--surface)", borderColor: "var(--line)", "--field-accent": "var(--brand)" } as React.CSSProperties}
            >
              <KeyRound className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
              <input
                ref={passwordRef}
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
          </div>

          {error && (
            <p role="alert" className="text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
              {error}
            </p>
          )}

          {notice && !error && (
            <p
              className="rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft"
              style={{ background: "var(--surface-sunk)" }}
            >
              {notice}
            </p>
          )}

          {/* A panel, not a red line: neither of these is fixed by retyping. */}
          {held && (
            <section
              role="alert"
              className="rounded-xl border p-3.5"
              style={{ borderColor: "var(--line-strong)", background: "var(--surface-sunk)" }}
            >
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <TriangleAlert className="h-4 w-4 shrink-0" style={{ color: "#e11d48" }} strokeWidth={2.2} />
                {held.title}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{held.body}</p>
            </section>
          )}

          {/* The lender's accent — `var(--brand)` is painted onto <html> from
              lib/lenders.ts, the LMS Org row's own colour. */}
          <LiquidButton
            type="submit"
            variant="solid"
            size="lg"
            block
            trailingIcon={ArrowRight}
            loading={busy}
            disabled={busy}
            tone={{ fill: "var(--brand)", rim: "var(--brand-2)", ink: "var(--brand-on)" }}
            className="!mt-6"
          >
            {busy ? "Signing you in" : "Sign in"}
          </LiquidButton>

          <div className="text-center">
            <button
              type="button"
              onClick={onReset}
              disabled={resetting}
              className="text-[12.5px] font-semibold underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
              style={{ color: "var(--brand-ink)" }}
            >
              {resetting ? `Asking ${lender.short}…` : "Forgot your password? Send me a new one"}
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
