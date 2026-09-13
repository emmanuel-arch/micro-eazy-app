// ─────────────────────────────────────────────────────────────────────────────
// THE LENDER'S CREATE-ACCOUNT DOOR — /<slug>/welcome.
//
// The twin of the lender's sign-in page, for somebody who does not have an
// account with this lender yet. Same livery, same frame, same corner — the
// sign-in page's top-right "Create account" link lands here, and this page's
// top-right "Sign in" link goes back, so the two read as two sides of one door
// rather than as two different products.
//
// It asks for the number, sends the code under the lender's own sender id, and
// the code gate then goes straight to onboarding (`intent: "join"`) rather than
// to the sign-in page — a person who pressed "Create account" has told us which
// branch they are on, and walking them back through a password field they do
// not have would be asking a question they already answered.
//
// It grants nothing. Onboarding is still behind the session, the KYC endpoint
// still demands one, and the enrolment check still runs — so somebody who IS
// already a customer and presses this is told so and sent to sign in.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Info, LogIn } from "lucide-react";
import { AuthLayout } from "../components/shell/AuthLayout";
import { PhoneField, looksLikeAPhone } from "../components/auth/PhoneField";
import { LiquidButton } from "../components/ui/LiquidButton";
import { useLender } from "../lib/lender";
import { useSession } from "../lib/session";

export default function LenderWelcome() {
  const navigate = useNavigate();
  const lender = useLender();
  const { requestCode } = useSession();

  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ok = looksLikeAPhone(phone);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    const r = await requestCode(phone);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    if (!r.delivered && !r.devCode) {
      setError(r.message || "We could not send the code just now. Please try again shortly.");
      return;
    }
    navigate(`/${lender.slug}/verify`, { state: { phone, intent: "join", devCode: r.devCode } });
  }

  return (
    <AuthLayout
      lender={lender}
      headerAction={
        <Link
          to={`/${lender.slug}/signin`}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-sky-ink transition-colors hover:bg-white/10 lg:text-ink lg:hover:bg-surface-sunk"
        >
          <LogIn className="h-4 w-4" strokeWidth={2.3} />
          Sign in
        </Link>
      }
    >
      <div>
        <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink lg:text-[30px]">
          Create your account.
        </h1>
        <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed text-ink-soft">
          Enter the number your M-Pesa is on. {lender.short} will text you a code, and we take you through the rest.
        </p>

        <form onSubmit={submit} className="mt-7">
          <PhoneField id="join-phone" value={phone} onChange={setPhone} showError={touched} accent="var(--brand)" />

          {error && (
            <p role="alert" className="mt-3 text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
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
            className="mt-6"
          >
            {busy ? "Sending your code" : "Create account"}
          </LiquidButton>
        </form>

        <div className="assurance mt-6 flex items-start gap-3 p-3.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}
          >
            <Info className="h-[17px] w-[17px]" strokeWidth={2.4} />
          </span>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            We check your number against your national ID before any money moves. Nothing is shared with anyone who is
            not lending to you.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
