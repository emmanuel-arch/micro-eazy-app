// ─────────────────────────────────────────────────────────────────────────────
// THE FRONT DOOR — Micro Eazy's, before any lender has been chosen.
//
// The first screen a new, signed-out customer sees. It asks for exactly one
// thing — the number their M-Pesa is on — and offers exactly two ways forward:
//
//   CONTINUE          Micro Eazy green. "I am new here, or I do not know which
//                     lender I am with." Goes to the lender chooser, where the
//                     number typed here is carried along and the code is sent
//                     only once somebody has picked who they are borrowing from.
//   <LENDER> LOGIN    The pioneering lender's own colour. "I already have an
//                     account with them." Goes straight to that lender's branded
//                     sign-in page. Today that is Micromart, whose existing book
//                     is tens of thousands of people already holding a password.
//
// ── WHY THE CODE IS NO LONGER SENT FROM HERE ────────────────────────────────
// It was: the front door posted to /api/portal/otp and went straight to the code
// gate. That sent a verification SMS BEFORE the customer had said which lender
// they were with — and for a bridged lender the code is dispatched through that
// lender's own SMS outbox, under their own sender id. A code sent before the
// choice is a code sent under the wrong name, or under a guess. So the number
// is collected here and the code goes out from the chooser, once there is a
// lender to send it as.
//
// ── WHY TWO BUTTONS, NOT THREE ──────────────────────────────────────────────
// The third, "Create account", used to live here too. It now lives where it
// belongs — on the lender's own create-account door — because an account is
// always an account WITH somebody. See screens/LenderSignIn.tsx.
//
// ── WHY THE PILL BUTTONS, NOT THE GLASS TILES ───────────────────────────────
// The tiles were one shape in three tints, which read as a menu of equal
// options. These two are commitments, and they use the same machined control as
// every other commit button in the app ("Sign in", "Apply for a loan") — solid
// fills, their colour carrying the meaning before the word is read.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Info, KeyRound } from "lucide-react";
import { AuthLayout } from "../components/shell/AuthLayout";
import { PhoneField, looksLikeAPhone } from "../components/auth/PhoneField";
import { LiquidButton } from "../components/ui/LiquidButton";
import { LENDERS } from "../lib/lenders";
import { setLenderSlug } from "../lib/lender";

/**
 * The lender whose login gets the second button. The first one open to
 * borrowers, in registry order — so when a second lender opens, this screen does
 * not have to change, only lib/lenders.ts does. Nothing below names Micromart.
 */
const PIONEER = LENDERS.find((l) => l.available) ?? LENDERS[0];

export default function Welcome() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  const ok = looksLikeAPhone(phone);

  const onContinue = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!ok) return;
    // Route state, never the URL: a number in an address bar ends up in history,
    // in screenshots, and in links shared with a friend.
    navigate("/lenders", { state: { phone } });
  };

  const onLenderLogin = () => {
    // The handover. From here on the app wears this lender — the splash, the
    // sign-in page and, once signed in, the whole shell.
    setLenderSlug(PIONEER.slug);
    // The number rides along if they typed one, so the lender's sign-in does not
    // ask for it twice. If they did not, the sign-in simply opens empty.
    navigate(`/${PIONEER.slug}/signin`, { state: looksLikeAPhone(phone) ? { phone } : undefined });
  };

  return (
    <AuthLayout deckOnMobile>
      <div className="w-full">
        <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink lg:text-[30px]">Welcome.</h1>
        <p className="mt-3 max-w-[36ch] text-[14px] leading-relaxed text-ink-soft">
          Enter the number your M-Pesa is on. That is the whole of it — we will take you through the rest one step at a
          time.
        </p>

        <form onSubmit={onContinue} className="mt-6">
          <PhoneField id="phone" value={phone} onChange={setPhone} showError={touched} />

          <div className="mt-5 space-y-3">
            {/* Micro Eazy green — the `primary` fill is the lime-to-green of the
                mark itself. */}
            <LiquidButton type="submit" size="lg" block trailingIcon={ArrowRight}>
              Continue
            </LiquidButton>

            {/* The lender's own accent, straight from the LMS Org row — the same
                colour their staff see on the console. White type on it is
                checked for every lender in lib/lenders.ts. */}
            <LiquidButton
              type="button"
              variant="solid"
              size="lg"
              block
              icon={KeyRound}
              tone={{ fill: PIONEER.accent, rim: PIONEER.accent2, ink: "#ffffff" }}
              onClick={onLenderLogin}
              aria-label={`${PIONEER.short} login — sign in with the password ${PIONEER.short} sent you`}
            >
              {PIONEER.short} login
            </LiquidButton>
          </div>
        </form>

        {/* ── THE ASSURANCE ─────────────────────────────────────────────────
            On a solid ground of its own — not glass, because this is the one
            sentence on the screen that must be believed before somebody types a
            national ID number, and it cannot be at the mercy of whatever frame of
            photography happens to be behind it. */}
        <div className="assurance mt-6 flex items-start gap-3 p-3.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ background: "color-mix(in oklab, var(--navy) 14%, transparent)", color: "var(--navy-ink)" }}
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
