// ─────────────────────────────────────────────────────────────────────────────
// WHO LENDS TO YOU — the chooser between the front door and the code.
//
// This is the point at which Micro Eazy hands the customer over. Before it, the
// product is ours; after it, everything the customer sees — the code screen,
// the sign-in, the splash, the whole signed-in app — wears the lender they pick
// here. So this is the last Micro Eazy-branded screen in the flow, and it is
// built to make the choice feel like choosing an institution, not ticking a box.
//
// ── THE ROW ─────────────────────────────────────────────────────────────────
//     ┌──────────┬──────────────────────────────────────┬─────┐
//     │  LOGO,   │  Micromart Africa                     │  ◉  │
//     │  whole   │  Business, school-fees & personal …   │     │
//     │  plate   │  (on the lender's own accent)         │     │
//     └──────────┴──────────────────────────────────────┴─────┘
//
// Every plate is the same size with the logo given all of it — the sidebar
// letterhead's rule — because four lenders' logos are four different shapes,
// and rendered naturally they read as four different qualities of company. The
// name sits on a band of the lender's own LMS accent, so each row carries its
// colour in the one place type has been checked against it (white on every
// accent in the registry clears 5:1). See .lender-row in styles/theme.css.
//
// ── WHY ONLY ONE IS SELECTABLE, AND WHY THE OTHERS ARE STILL HERE ───────────
// Micromart is pioneering this ecosystem and is the only lender open to
// borrowers today. The other three are real organisations on the LMS and are
// shown, visibly closed, because a marketplace with one name in it looks like a
// bug — and a customer who can see who is coming understands what this is. A
// closed row does not accept a click; it never selects and then fails.
//
// ── THE CODE GOES OUT FROM HERE ─────────────────────────────────────────────
// Not from the front door. For a bridged lender the code is dispatched through
// that lender's own SMS outbox under their own sender id, so it cannot be sent
// until there IS a lender. The number was collected on the front door and rides
// in route state; nobody is asked for it twice.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { AuthLayout } from "../components/shell/AuthLayout";
import { LiquidButton } from "../components/ui/LiquidButton";
import { LENDERS, type Lender } from "../lib/lenders";
import { setLenderSlug } from "../lib/lender";
import { useSession } from "../lib/session";

/** "0758 517 032" — the number as a Kenyan reads it back. */
function formatLocal(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^254/, "").replace(/^0/, "");
  if (d.length !== 9) return raw;
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function LenderRow({ lender, on, onPick }: { lender: Lender; on: boolean; onPick: () => void }) {
  const closed = !lender.available;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-disabled={closed}
      // A closed lender is announced as such, rather than as a radio that
      // silently does nothing when chosen.
      aria-label={closed ? `${lender.name} — not open to borrowers yet` : lender.name}
      onClick={closed ? undefined : onPick}
      tabIndex={closed ? -1 : 0}
      className={`lender-row h-[84px] ${on ? "lender-row--on" : ""} ${closed ? "lender-row--closed" : ""}`}
      style={{ "--row-accent": lender.accent } as React.CSSProperties}
    >
      {/* THE PLATE. Identical for all four, logo given the whole of it.

          `lender.mark` — the same file the sidebar letterhead and the LMS console
          show — rather than the full lockup. Micromart's lockup is a small mark
          over two lines of 12px capitals in a square of whitespace; in a 68px
          plate the capitals are unreadable and the mark is tiny. The mark fills
          the plate, which is what "the logo touches the edges" asks for.

          An explicit height, not `h-full`: the plate is a grid with an auto row,
          so a percentage height has nothing to resolve against and the image
          falls back to its intrinsic size and is clipped. */}
      <span className="lender-row__plate">
        <img src={lender.mark} alt="" aria-hidden="true" draggable={false} className="h-[68px] w-full object-contain" />
      </span>

      {/* THE NAME, on their own colour. */}
      <span
        className="flex min-w-0 flex-1 flex-col justify-center px-4"
        style={{ background: `linear-gradient(120deg, ${lender.accent} 0%, ${lender.accent2} 100%)`, color: "#ffffff" }}
      >
        <span className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em]">{lender.name}</span>
        <span className="mt-0.5 truncate text-[11.5px] leading-snug" style={{ color: "rgb(255 255 255 / 0.78)" }}>
          {closed ? "Coming soon" : lender.tagline}
        </span>
      </span>

      {/* THE RADIO. On the surface rather than the band, so "chosen" is read in
          one consistent place down the whole list. */}
      <span className="grid w-14 shrink-0 place-items-center" style={{ background: "var(--surface)" }}>
        {closed ? (
          <Lock className="h-4 w-4 text-ink-faint" strokeWidth={2.2} aria-hidden />
        ) : (
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-full border-2 transition-all duration-200"
            style={{
              borderColor: on ? lender.accent : "var(--line-strong)",
              background: on ? lender.accent : "transparent",
            }}
          >
            {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
          </span>
        )}
      </span>
    </button>
  );
}

export default function LenderChoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestCode } = useSession();
  const phone = (location.state as { phone?: string } | null)?.phone ?? "";

  const [chosen, setChosen] = useState<Lender | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Somebody who deep-links here has no number for the code to go to. Back to
  // the door that asks for one, rather than a Continue that cannot work.
  useEffect(() => {
    if (!phone) navigate("/welcome", { replace: true });
  }, [phone, navigate]);

  async function onContinue() {
    if (!chosen || busy) return;
    setBusy(true);
    setError(null);

    // The handover happens HERE, before the call — so the request goes out
    // with this lender's slug and the code is sent under their sender id.
    setLenderSlug(chosen.slug);

    const r = await requestCode(phone);
    setBusy(false);

    if (!r.ok) {
      // The server's own words. It knows about rate limits ("too many codes for
      // this number"), and a generic failure would hide the one instruction the
      // customer can act on.
      setError(r.message);
      return;
    }
    // `delivered: false` still answers 200 — accepted, but no provider could
    // send it. Moving on silently parks somebody on a code screen waiting for an
    // SMS that is not coming. Outside production the route hands the code back
    // so the flow stays walkable, and it rides to the next screen.
    if (!r.delivered && !r.devCode) {
      setError(r.message || "We could not send the code just now. Please try again shortly.");
      return;
    }

    navigate(`/${chosen.slug}/verify`, { state: { phone, intent: "continue", devCode: r.devCode } });
  }

  return (
    <AuthLayout>
      <div className="w-full">
        <button
          type="button"
          onClick={() => navigate("/welcome")}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
          Back
        </button>

        <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink lg:text-[30px]">
          Where would you like to borrow?
        </h1>
        <p className="mt-3 max-w-[38ch] text-[14px] leading-relaxed text-ink-soft">
          Choose a licensed lender. Your account, your limit and your loans are held by them.
        </p>

        <div role="radiogroup" aria-label="Lenders" className="mt-6 space-y-2.5">
          {LENDERS.map((l) => (
            <LenderRow key={l.slug} lender={l} on={chosen?.slug === l.slug} onPick={() => setChosen(l)} />
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
            {error}
          </p>
        )}

        {/* ── THE COMMIT, ONLY ONCE THERE IS SOMETHING TO COMMIT TO ──────────
            Black, not a lender's colour and not ours: at this instant the
            customer has chosen but not yet been handed over, and a neutral
            button is the honest colour for the moment in between. It appears
            rather than sitting disabled, because a greyed-out Continue under a
            list reads as "something is broken" before anyone has touched it. */}
        {chosen && (
          <div className="mt-5">
            <LiquidButton
              type="button"
              variant="solid"
              size="lg"
              block
              trailingIcon={ArrowRight}
              loading={busy}
              disabled={busy}
              tone={{ fill: "#0b0b0f", rim: "#2b2e37", ink: "#ffffff" }}
              onClick={onContinue}
            >
              {busy ? "Sending your code" : "Continue"}
            </LiquidButton>
            <p className="mt-3 text-center text-[12px] text-ink-faint">
              We will text a code to <span className="tnum font-semibold text-ink-soft">{formatLocal(phone)}</span> to
              confirm it is you.
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
