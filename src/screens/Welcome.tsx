// ─────────────────────────────────────────────────────────────────────────────
// THE FRONT DOOR.
//
// The first screen a customer sees, and the only one on which this app has to
// earn the right to ask for a national ID number. Two halves and they do
// different jobs:
//
//   · THE DECK — four photographs of the people who actually borrow here, with
//     a promise beside each one. It is the whole argument for the product, made
//     in pictures, before a single field is asked for. See components/media/
//     Voices, and the note there about why these are promises and not
//     testimonials.
//   · THE FORM — a phone number and nothing else. Every extra field on a sign-in
//     screen is a percentage of people who do not finish, and this funnel is
//     opened on a prepaid bundle at the side of a road.
//
// ── THE ORDER IS DIFFERENT ON A PHONE, ON PURPOSE ────────────────────────────
// On a laptop the deck is the left column and the form is the right, read left
// to right. On a handset the deck comes FIRST and the form underneath, because
// the phone is the design target and the argument has to arrive before the ask.
// The one thing that never moves below the fold on a 360×640 screen is the
// continue button — hence the deck's aspect ratio dropping on small screens.
//
// ── WHAT THIS SCREEN DOES AND DOES NOT DO ────────────────────────────────────
// It asks the server to send a code to the number typed here, and then hands
// off to the gate (/verify), which is where identity is actually proved. It
// does NOT decide anything: a code being sent is not a session, and nothing
// typed here grants access to a single screen — the same rule every other
// screen in this app follows.
//
// It used to navigate straight to /join on nine digits, sending nothing. That
// meant onboarding opened for anyone who typed a number, and the first time the
// app asked the server who they were would have been much later, on a screen
// that assumed it already knew.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Info, KeyRound, Loader2, Phone, UserPlus } from "lucide-react";
import { AuthLayout } from "../components/shell/AuthLayout";
import { useSession } from "../lib/session";

/**
 * Kenyan mobile numbers, loosely. Deliberately loose: this is a courtesy check
 * that stops an obvious typo before a round trip, NOT a validation — the server
 * owns that, and a client-side rule strict enough to be authoritative is a rule
 * that eventually rejects a real customer on a new prefix.
 */
const looksLikeAPhone = (v: string) => v.replace(/\D/g, "").length >= 9;

export default function Welcome() {
  const navigate = useNavigate();
  const { requestCode } = useSession();
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  /** Which button submitted the form. A ref and not state on purpose: it is
   *  read once inside the submit handler that the click itself triggers, and as
   *  state it would need a render to land before submit could see it. */
  const intentRef = useRef<"continue" | "join">("continue");

  const ok = looksLikeAPhone(phone);

  // ── THIS IS WHERE THE FUNNEL USED TO LEAK ──────────────────────────────────
  // The button navigated straight to /join. Nothing was sent, nothing was
  // verified, and onboarding opened for anybody who typed nine digits. Now the
  // number has to receive a code before the app will go anywhere.
  const submit = async (e: FormEvent) => {
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

    // `delivered: false` still comes back 200 with success:true — the request was
    // accepted, no provider could send it. Moving on silently would park somebody
    // on a code screen waiting for an SMS that is not coming. Outside production
    // the route hands back the code itself so the flow stays walkable.
    if (!r.delivered) {
      if (r.devCode) {
        setDevCode(r.devCode);
      } else {
        setError(r.message || "We could not send the code just now. Please try again shortly.");
        return;
      }
    }

    // The phone travels in route state, not in the URL: a number in an address
    // bar ends up in history, in screenshots, and in shared links.
    // The phone travels in route state, not in the URL. `intent` rides with it
    // so somebody who pressed "Create an account" goes straight to onboarding
    // once the code is in, rather than through the returning-or-new branch.
    navigate("/verify", { state: { phone, intent: intentRef.current } });
  };

  // ── The form column ────────────────────────────────────────────────────────
  // Extracted because it is rendered once but LAID OUT twice: under the deck on
  // a phone, beside a full-bleed photograph on a laptop. Duplicating the markup
  // to achieve that is how the two copies drift apart, and a sign-in form that
  // is subtly different at one breakpoint is a bug nobody notices until it is in
  // somebody's hands.
  const form = (
    <div className="w-full">
      <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink lg:text-[30px]">Welcome.</h1>
      <p className="mt-2 max-w-[36ch] text-[14px] leading-relaxed text-ink-soft">
        Enter the number your M-Pesa is on. That is the whole of it — we will take you through the rest one step at a
        time.
      </p>

      <form onSubmit={submit} className="mt-6">
        <label htmlFor="phone" className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Phone number
        </label>
        <div
          className="mt-2 flex items-center gap-2.5 rounded-2xl border px-4 transition-colors focus-within:border-[var(--green-ink)]"
          style={{ background: "var(--surface)", borderColor: touched && !ok ? "var(--line-strong)" : "var(--line)" }}
        >
          <Phone className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
          <span className="shrink-0 text-[15px] font-medium text-ink-soft">+254</span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="7XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={touched && !ok}
            aria-describedby={touched && !ok ? "phone-error" : undefined}
            className="tnum min-w-0 flex-1 bg-transparent py-4 text-[16px] text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
        {/* Only after a submit. Marking a field wrong while somebody is still
            typing the first digit of it is how a form tells people they are
            failing at something they have not finished. */}
        {touched && !ok && (
          <p id="phone-error" className="mt-2 text-[12.5px] text-ink-soft">
            That does not look like a full number yet — nine digits after the +254.
          </p>
        )}

        {/* The server's own words, not a generic failure. It is the thing that
            knows about rate limits ("too many codes for this number"), and
            rewriting that as "something went wrong" would hide the one
            instruction the customer can act on. */}
        {error && (
          <p role="alert" className="mt-3 text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
            {error}
          </p>
        )}
        {devCode && !error && (
          <p
            className="mt-3 rounded-lg px-3 py-2 text-[12.5px] leading-snug text-ink-soft"
            style={{ background: "var(--surface-sunk)" }}
          >
            SMS is not configured here, so no message will arrive — your code is{" "}
            <strong className="tnum font-semibold text-ink">{devCode}</strong>.
          </p>
        )}

        {/* ── THE THREE DOORS, AS ONE FAMILY ────────────────────────────────
            They used to be three different species: a saturated green pill, a
            hairline outlined button, and a bordered row with an icon. The
            hierarchy that created was wrong — it read as one real option and
            two afterthoughts, when "Already with Micromart?" is the door MOST
            people need on day one. Micromart's existing book is tens of
            thousands of people who already hold a password sent from
            Micromart's own outbox.

            Now they are one material at one weight, separated by ACCENT: the
            first carries the brand light, the other two do not. Emphasis within
            a set, rather than three different classes of thing. See
            .glass-option in styles/theme.css. */}
        <div className="mt-5 space-y-2.5">
          <button
            type="submit"
            onClick={() => {
              intentRef.current = "continue";
            }}
            disabled={busy}
            className="glass-option glass-option--primary px-4 py-3.5"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: "color-mix(in oklab, var(--green) 22%, transparent)", color: "var(--green-ink)" }}
            >
              {busy ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.4} />
              ) : (
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold leading-tight text-ink">
                {busy ? "Sending your code" : "Continue"}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">
                {busy ? "One moment." : "We send a code to this number."}
              </span>
            </span>
          </button>

          {/* Same code, same gate, different destination. It submits the form
              like the card above it — the code still has to reach the handset
              first — and only sets where the customer lands afterwards.

              It grants nothing. Onboarding is still behind the session, the KYC
              endpoint still demands one, and the enrolment check still runs. So
              somebody who presses this and IS already a customer is told so and
              sent to sign in, which is exactly what should happen. */}
          <button
            type="submit"
            onClick={() => {
              intentRef.current = "join";
            }}
            disabled={busy}
            className="glass-option px-4 py-3.5"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: "color-mix(in oklab, var(--lime) 20%, transparent)", color: "var(--green-ink)" }}
            >
              <UserPlus className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold leading-tight text-ink">Create an account</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">
                New here? It takes about two minutes.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>

          {/* Not a footnote. On day one this is the door most people need. */}
          <button
            type="button"
            onClick={() => navigate("/signin")}
            disabled={busy}
            className="glass-option px-4 py-3.5"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: "color-mix(in oklab, var(--navy) 14%, transparent)", color: "var(--navy-ink)" }}
            >
              <KeyRound className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold leading-tight text-ink">Already with Micromart?</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">
                Sign in with the password they sent you.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>
        </div>
      </form>

      {/* ── THE ASSURANCE ───────────────────────────────────────────────────
          This was 12px grey text set directly on the page. On a laptop that
          page is a photograph, and the one sentence on the screen whose entire
          job is to be BELIEVED before somebody types a national ID number was
          the least legible thing on it.

          It now sits on a solid ground of its own — not glass, because this is
          the sentence that must never be at the mercy of what is behind it —
          and leads with a notice mark rather than a shield, because it is
          telling the customer something they need to take in, not decorating
          the claim with a security motif. */}
      <div className="assurance mt-5 flex items-start gap-3 p-3.5">
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
  );

  // The frame — mark top-left, content left of centre, photography sliding down
  // the right — belongs to the whole front-of-house flow, not to this screen.
  // See components/shell/AuthLayout.tsx.
  return <AuthLayout deckOnMobile>{form}</AuthLayout>;
}
