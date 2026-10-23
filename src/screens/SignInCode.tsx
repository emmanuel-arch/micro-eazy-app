// ─────────────────────────────────────────────────────────────────────────────
// THE LENDER'S SIGN-IN, FOR A LENDER WITH NO PASSWORD BRIDGE — /<slug>/signin.
//
// SignInPassword is Micromart's door: the password in a Micromart customer's SMS
// was minted by Micromart's own `sp_restBorrowerPin`, and our server checks it by
// asking Micromart (lib/api/portal.ts → micromartSignIn). No other lender has that
// bridge. Rendering the password form at /axe/signin would send an Axe customer's
// password to Micromart's login — at best a refusal for a customer who did nothing
// wrong, at worst a Micromart account opened in Axe's colours.
//
// So a lender without `passwordDoor` gets the code door here instead, at the same
// address and in the same livery: the number, then a code sent through THIS
// lender's org and SMS outbox, then /<slug>/verify — exactly the road the lender
// chooser takes. The verify screen hands back to /<slug>/signin, which forwards a
// signed-in customer to their account, as it does for Micromart.
//
// No "Create account" here: onboarding has only ever been walked on Micromart's
// book, and a door that opens onto a registration that cannot complete is worse
// than one that is not there.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LiquidButton } from "../components/ui/LiquidButton";
import { AuthLayout } from "../components/shell/AuthLayout";
import { PhoneField, looksLikeAPhone } from "../components/auth/PhoneField";
import { useLender } from "../lib/lender";
import { useSession } from "../lib/session";

export default function SignInCode() {
  const navigate = useNavigate();
  const location = useLocation();
  const lender = useLender();
  const { status, requestCode } = useSession();

  const handed = (location.state as { phone?: string } | null)?.phone ?? "";
  const [phone, setPhone] = useState(handed);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  // A signed-in customer never sees the form — same rule as SignInPassword.
  useEffect(() => {
    if (status === "verified") navigate(`/${lender.slug}`, { replace: true });
  }, [status, navigate, lender.slug]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!looksLikeAPhone(phone) || busy) return;
    setBusy(true);
    setError(null);

    // LenderRoute has already set this lender, so the request carries its slug
    // and the code goes out under its own sender id.
    const r = await requestCode(phone);
    setBusy(false);

    if (!r.ok) {
      setError(r.message);
      return;
    }
    // Accepted but undeliverable — see LenderChoice. Moving on would park the
    // customer on a code screen waiting for an SMS that is not coming.
    if (!r.delivered && !r.devCode) {
      setError(r.message || "We could not send the code just now. Please try again shortly.");
      return;
    }
    navigate(`/${lender.slug}/verify`, { state: { phone, intent: "continue", devCode: r.devCode } });
  }

  return (
    <AuthLayout lender={lender}>
      <div>
        <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink lg:text-[30px]">
          Welcome back.
        </h1>
        <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed text-ink-soft">
          {`Enter the number your ${lender.name} account is on. We send a code to it by SMS.`}
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

          {error && (
            <p role="alert" className="text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
              {error}
            </p>
          )}

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
            {busy ? `Asking ${lender.short}` : "Send me a code"}
          </LiquidButton>
        </form>
      </div>
    </AuthLayout>
  );
}
