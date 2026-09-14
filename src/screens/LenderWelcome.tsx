// ─────────────────────────────────────────────────────────────────────────────
// THE LENDER'S CREATE-ACCOUNT DOOR — /<slug>/welcome.
//
// The twin of the lender's sign-in page, for somebody who does not have an
// account with this lender yet. Same livery, same frame, same corner — the
// sign-in page's top-right "Create account" link lands here, and this page's
// top-right "Sign in" link goes back, so the two read as two sides of one door.
//
// ── IT ASKS WHERE THE NUMBER BELONGS BEFORE IT SENDS A CODE ─────────────────
// For Micromart a phone number can be on either of two books, and the answer
// decides which APP the customer belongs in. So "Create account" first calls
// /api/portal/precheck and routes on the answer instead of rendering an error:
//
//   new / local       send the code under the lender's sender id → onboarding
//   fintech           an account already exists → the sign-in page, number filled
//                     in, asking only for the password (or a new one)
//   africa-active     their loan is on the field book → the lender's own loading
//   africa-portal     screen, then Micromart's main customer portal
//   africa-pipeline   settled, crossing soon → a countdown to the day, and a text
//   both              two accounts → a case already raised, and who to call
//   unreachable       we could not ask → retry, never "you are new"
//
// It grants nothing. Onboarding is still behind the session, the KYC endpoint
// still demands one, and the lender's rules still run on the server.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Info, LogIn } from "lucide-react";
import { AuthLayout } from "../components/shell/AuthLayout";
import { PhoneField, looksLikeAPhone } from "../components/auth/PhoneField";
import { DoorOutcome } from "../components/auth/DoorOutcome";
import { Splash } from "../components/shell/Splash";
import { LiquidButton } from "../components/ui/LiquidButton";
import { precheck, type PrecheckAnswer } from "../lib/api/portal";
import { useLender } from "../lib/lender";
import { useSession } from "../lib/session";

type Panel = Extract<PrecheckAnswer, { route: "africa-pipeline" | "both" | "unreachable" }>;

/** How long the lender's loading screen stays up before the hand-off — long
 *  enough to read "Taking you to your Micromart account", short enough not to wait. */
const HANDOFF_MS = 1800;

function localLabel(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^254/, "").replace(/^0/, "");
  return d.length === 9 ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : "This number";
}

export default function LenderWelcome() {
  const navigate = useNavigate();
  const lender = useLender();
  const { requestCode } = useSession();

  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<null | "checking" | "sending">(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);

  const ok = looksLikeAPhone(phone);

  // ── THE HAND-OFF TO THE OTHER PORTAL ───────────────────────────────────────
  // The lender's own loading screen, then the navigation — so the customer is
  // carried, not dropped onto somebody else's URL mid-sentence.
  useEffect(() => {
    if (!handoff) return;
    const t = setTimeout(() => window.location.assign(handoff), HANDOFF_MS);
    return () => clearTimeout(t);
  }, [handoff]);

  async function sendCode() {
    setBusy("sending");
    const r = await requestCode(phone);
    setBusy(null);
    if (!r.ok) {
      setError(r.message || "We could not send the code just now. Please try again shortly.");
      return;
    }
    if (!r.delivered && !r.devCode) {
      setError(r.message || "We could not send the code just now. Please try again shortly.");
      return;
    }
    navigate(`/${lender.slug}/verify`, { state: { phone, intent: "join", devCode: r.devCode } });
  }

  async function check() {
    setBusy("checking");
    setError(null);
    let answer: PrecheckAnswer;
    try {
      answer = await precheck(phone);
    } catch (e) {
      setBusy(null);
      const body = (e as { body?: { field?: string; message?: string } })?.body;
      if (body?.field === "phone") {
        setError(body.message ?? "Enter the number your M-Pesa is on.");
        return;
      }
      // A failed check is "we could not ask", never "you are new".
      setPanel({
        success: true,
        route: "unreachable",
        lender: lender.name,
        message: e instanceof Error ? e.message : "",
      });
      return;
    }

    switch (answer.route) {
      case "new":
      case "local":
        await sendCode();
        return;
      case "fintech":
        setBusy(null);
        navigate(`/${lender.slug}/signin`, { state: { phone, precheck: "fintech" } });
        return;
      case "africa-active":
      case "africa-portal":
        setBusy(null);
        setHandoff(answer.portalUrl);
        return;
      default:
        setBusy(null);
        setPanel(answer);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!ok || busy) return;
    await check();
  }

  if (handoff) {
    return <Splash livery="lender" label={`Taking you to your ${lender.short} account…`} />;
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
      <AnimatePresence mode="wait">
        {panel ? (
          <DoorOutcome
            key="panel"
            outcome={panel}
            lenderShort={lender.short}
            phoneLabel={localLabel(phone)}
            retrying={busy === "checking"}
            onRetry={() => void check()}
            onBack={() => {
              setPanel(null);
              setError(null);
            }}
          />
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
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
                loading={busy !== null}
                disabled={busy !== null}
                tone={{ fill: "var(--brand)", rim: "var(--brand-2)", ink: "var(--brand-on)" }}
                className="mt-6"
              >
                {busy === "checking" ? "Checking your number" : busy === "sending" ? "Sending your code" : "Create account"}
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
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
