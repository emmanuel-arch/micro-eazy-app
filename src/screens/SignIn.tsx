// ─────────────────────────────────────────────────────────────────────────────
// THE GATE — two panels, one screen.
//
//   CODE      Prove you hold the phone. Six digits from an SMS.
//   IDENTIFY  Prove you know the ID that goes with it, and — the part that
//             decides what the app becomes — find out whether this person is
//             already a customer.
//
// ── WHY THE SECOND PANEL IS NOT "JUST ANOTHER FIELD" ────────────────────────
// The national ID is a second factor: possession of the phone AND knowledge of
// the number. A SIM swap alone does not open somebody's loan book, which is the
// property that makes the whole portal safe to expose. But it is also the key
// the enrolment check needs, and that check is what routes the customer:
//
//   returning → the app proper. They have a balance, a ladder, a history.
//   new       → onboarding, immediately, without ever landing on a dashboard
//               that has nothing to show them.
//
// ── THE STATE THAT IS NEITHER ───────────────────────────────────────────────
// `undetermined` is the state this screen exists to handle honestly. A bridged
// lender's book lives in their own SQL Server; when that cannot be read, the
// answer is NOT "you are new". Onboarding somebody on a network failure walks a
// ten-year customer through KYC and opens a SECOND account against a phone that
// already has one — a mess that lands on a branch, not on us. So the screen
// stops and offers a retry. It never guesses, and it never guesses in the
// direction that creates a duplicate.
//
// The same applies to `ambiguous`: several people on one number is a case for a
// human, and the copy says so rather than pretending it is a validation error.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, IdCard, MessageSquare, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { AuthLayout } from "../components/shell/AuthLayout";
import { IdCapture, IdReadout, type IdCaptureResult } from "../components/kyc/IdCapture";
import { LiquidButton } from "../components/ui/LiquidButton";
import { useSession } from "../lib/session";

/** Kenyan national ID numbers run 7–8 digits. Saying so now is kinder than a
 *  registry miss ninety seconds later. */
const idLooksValid = (v: string) => /^\d{7,8}$/.test(v.trim());

type Panel = "code" | "identify";

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, submitCode, requestCode, identify } = useSession();

  // The phone arrives from the front door. Somebody who deep-links here has no
  // number to verify against, so they go back rather than see a dead form.
  const phone = (location.state as { phone?: string } | null)?.phone ?? "";

  const [panel, setPanel] = useState<Panel>(status === "verified" ? "identify" : "code");
  const [code, setCode] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Set when the check could not reach a book, or found several people. */
  const [held, setHeld] = useState<{ title: string; body: string } | null>(null);
  // ── THE SECOND DOOR TO THE SAME FIELD ────────────────────────────────────
  // Typing the number is fast for somebody who knows it; photographing the card
  // is the door for somebody who does not have it memorised and is standing in
  // a shop holding it. Both fill the SAME field and run the SAME enrolment
  // check afterwards — the camera is not a shortcut past anything.
  const [capturing, setCapturing] = useState(false);
  const [read, setRead] = useState<IdCaptureResult | null>(null);

  useEffect(() => {
    if (!phone && status !== "verified") navigate("/welcome", { replace: true });
  }, [phone, status, navigate]);

  // A verified session that arrives while this screen is open (a resume, or the
  // code panel succeeding) moves the customer on rather than leaving them on a
  // form they have already passed.
  useEffect(() => {
    if (status === "verified" && panel === "code") setPanel("identify");
  }, [status, panel]);

  const codeRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    (panel === "code" ? codeRef : idRef).current?.focus();
  }, [panel]);

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const r = await submitCode(phone, code);
    setBusy(false);
    if (!r.ok) {
      // Three different reasons, three different instructions. "Expired" told as
      // "wrong" sends somebody to re-read an SMS that will never work.
      setError(
        r.reason === "expired"
          ? "That code has expired. Ask for a new one."
          : r.reason === "locked"
            ? "Too many wrong attempts. Ask for a new code."
            : r.message || "That code is not right.",
      );
      setCode("");
      codeRef.current?.focus();
      return;
    }
    setPanel("identify");
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
    // `delivered: false` is a 200. Saying "we sent it" here would point somebody
    // at a phone that is never going to buzz.
    setNotice(
      r.delivered
        ? "A new code is on its way."
        : r.devCode
          ? `SMS is not configured here — your code is ${r.devCode}.`
          : r.message || "We could not send the code just now.",
    );
  }

  async function onSubmitId(e: FormEvent) {
    e.preventDefault();
    if (!idLooksValid(nationalId) || busy) return;
    setBusy(true);
    setError(null);
    setHeld(null);
    try {
      const r = await identify(nationalId.trim());

      if (r.enrolled) {
        navigate("/", { replace: true });
        return;
      }

      if (r.ambiguous) {
        setHeld({
          title: "We need a person to check this",
          body:
            r.message ??
            "More than one record is registered against this phone number, so we cannot tell which is yours. " +
              "Please contact your lender — signing you up again would create a second account.",
        });
        return;
      }

      if (!r.reachable) {
        setHeld({
          title: "We could not check your records",
          body:
            r.message ??
            `We could not reach ${r.lender ?? "your lender"}'s system just now. We would rather wait than sign you up twice — please try again in a moment.`,
        });
        return;
      }

      // Positively not a customer anywhere. Straight into onboarding — never a
      // dashboard, which for a new person is a screen of empty states.
      navigate("/join", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // The read fills the field and closes the camera. It deliberately does NOT
  // submit: the customer sees what came off the card and confirms it, because
  // an OCR that is wrong and self-submitting sends somebody's application off
  // under a stranger's ID number.
  function onRead(r: IdCaptureResult) {
    setRead(r);
    setCapturing(false);
    if (r.ocr.idNumber) {
      setNationalId(r.ocr.idNumber.replace(/D/g, "").slice(0, 8));
      setError(null);
    }
  }

  return (
    // The same frame as the two doors before it. The code gate and the ID
    // capture used to sit under a Sky band in the app's ordinary content
    // column, so the photography and the credibility stopped at exactly the
    // point the customer was asked to photograph their national ID — the step
    // that needs them most. See components/shell/AuthLayout.tsx.
    <AuthLayout>
      <div>
        {/* The title lives in the column now rather than in a header band, so
            the left side reads as one continuous surface from the front door
            through to the capture. */}
        <button
          type="button"
          onClick={() => navigate("/welcome")}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
          Back
        </button>
        <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">
          {panel === "code" ? "Check your messages" : "One more thing"}
        </h1>
        <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-soft">
          {panel === "code"
            ? `We sent a 6-digit code to ${formatLocal(phone)}. It is good for a few minutes.`
            : "Your ID number, so we can find your records and check this number belongs to you."}
        </p>

        <div className="mt-6 space-y-3">
          {held ? (
            <HeldPanel
              title={held.title}
              body={held.body}
              onRetry={() => {
                setHeld(null);
                idRef.current?.focus();
              }}
            />
          ) : panel === "code" ? (
            <section className="card p-5">
              <form onSubmit={onSubmitCode}>
                <label htmlFor="code" className="block text-[13px] font-semibold">
                  Your 6-digit code
                </label>
                <div
                  className="mt-3 flex items-center gap-2.5 rounded-xl border px-3.5"
                  style={{ borderColor: error ? "#e11d48" : "var(--line-strong)", background: "var(--surface-sunk)" }}
                >
                  <MessageSquare className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
                  <input
                    id="code"
                    ref={codeRef}
                    inputMode="numeric"
                    // Lets a phone offer the code straight from the SMS instead
                    // of making somebody memorise six digits and switch apps.
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setError(null);
                    }}
                    placeholder="000000"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "code-error" : undefined}
                    className="tnum w-full bg-transparent py-3.5 text-[22px] font-semibold tracking-[0.28em] outline-none placeholder:font-normal placeholder:tracking-[0.2em] placeholder:text-ink-faint"
                  />
                </div>

                {error && (
                  <p id="code-error" className="mt-2 text-[12px] font-medium" style={{ color: "#e11d48" }}>
                    {error}
                  </p>
                )}
                {notice && !error && <p className="mt-2 text-[12px] text-ink-soft">{notice}</p>}

                <LiquidButton
                  type="submit"
                  size="lg"
                  block
                  trailingIcon={ArrowRight}
                  className="mt-4"
                  disabled={code.length !== 6}
                  loading={busy}
                >
                  Continue
                </LiquidButton>
              </form>

              <button
                type="button"
                onClick={onResend}
                disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12.5px] font-semibold disabled:opacity-50"
                style={{ color: "var(--green-ink)" }}
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} />
                Send it again
              </button>
            </section>
          ) : (
            <section className="card p-5">
              <form onSubmit={onSubmitId}>
                <label htmlFor="nid" className="block text-[13px] font-semibold">
                  Your National ID number
                </label>
                <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
                  The number on the front of your card — 7 or 8 digits.
                </p>

                <div
                  className="mt-3 flex items-center gap-2.5 rounded-xl border px-3.5"
                  style={{ borderColor: error ? "#e11d48" : "var(--line-strong)", background: "var(--surface-sunk)" }}
                >
                  <IdCard className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
                  <input
                    id="nid"
                    ref={idRef}
                    inputMode="numeric"
                    autoComplete="off"
                    value={nationalId}
                    onChange={(e) => {
                      setNationalId(e.target.value.replace(/\D/g, "").slice(0, 8));
                      setError(null);
                    }}
                    placeholder="12345678"
                    aria-invalid={Boolean(error)}
                    className="tnum w-full bg-transparent py-3.5 text-[17px] font-semibold tracking-[0.02em] outline-none placeholder:font-normal placeholder:text-ink-faint"
                  />
                </div>

                {error && (
                  <p className="mt-2 text-[12px] font-medium" style={{ color: "#e11d48" }}>
                    {error}
                  </p>
                )}

                <LiquidButton
                  type="submit"
                  size="lg"
                  block
                  trailingIcon={ArrowRight}
                  className="mt-4"
                  disabled={!idLooksValid(nationalId)}
                  loading={busy}
                >
                  {busy ? "Checking your records" : "Continue"}
                </LiquidButton>
              </form>

              {/* ── The camera door ───────────────────────────────────────── */}
              {!capturing && !read && (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="h-px flex-1" style={{ background: "var(--line)" }} />
                    <span className="text-[11px] font-medium text-ink-faint">or</span>
                    <span className="h-px flex-1" style={{ background: "var(--line)" }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => setCapturing(true)}
                    className="mt-3 flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors hover:bg-surface-sunk active:scale-[0.99]"
                    style={{ borderColor: "var(--line-strong)" }}
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                      style={{ background: "color-mix(in oklab, var(--navy) 12%, transparent)", color: "var(--navy-ink)" }}
                    >
                      <Camera className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold leading-tight">Photograph your ID instead</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                        We read the number off the card — the same way a branch officer does.
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                  </button>
                </>
              )}

              {capturing && (
                <div className="mt-4">
                  <IdCapture nationalId={nationalId || undefined} onRead={onRead} onCancel={() => setCapturing(false)} />
                </div>
              )}

              {read && !capturing && (
                <div className="mt-4">
                  <IdReadout
                    ocr={read.ocr}
                    onRetake={() => {
                      setRead(null);
                      setCapturing(true);
                    }}
                  />
                  {/* The mismatch is the server's finding, not ours, and it is
                      worth surfacing rather than silently preferring either
                      number: one of the two is wrong and only the customer can
                      say which. */}
                  {read.step.idMismatch && (
                    <p className="mt-2 text-[12px] font-medium leading-snug" style={{ color: "#e11d48" }}>
                      The number on the card is not the one you typed. Check which is right before you continue.
                    </p>
                  )}
                </div>
              )}

              <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-faint">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: "var(--green-ink)" }} />
                <span>
                  We check this against the number you just verified. It is how we make sure nobody else can open your
                  loan from a swapped SIM.
                </span>
              </p>
            </section>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}

/**
 * The stop. Used for both "we could not reach the lender" and "several people
 * share this number" — two different causes with the same correct behaviour:
 * do not proceed, do not onboard, say plainly what happened.
 */
function HeldPanel({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: "color-mix(in oklab, #f59e0b 16%, transparent)", color: "#b45309" }}
        >
          <TriangleAlert className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-tight">{title}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{body}</p>
        </div>
      </div>
      <LiquidButton size="lg" block variant="metal" className="mt-4" onClick={onRetry}>
        Try again
      </LiquidButton>
    </section>
  );
}

/** 254712345678 / 0712345678 → "0712 345 678", for the "we sent it to…" line. */
function formatLocal(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-9);
  return d.length === 9 ? `0${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : phone;
}
