// ─────────────────────────────────────────────────────────────────────────────
// PAY NOW — the customer raises the M-PESA prompt themselves.
//
// Until now every shilling on this book arrived because somebody was CHASED for
// it: a reminder SMS, a collections call, a walk to an agent. The customer who
// wanted to pay early, or pay a bit, or put something aside, had no way to do it
// from the app. That is the whole feature.
//
// ── THE THREE DECISIONS THIS SHEET MAKES ────────────────────────────────────
//
//  1. HOW MUCH. Pre-filled with the sensible figure for the purpose, and always
//     editable. Quick chips because the commonest payment is "the whole thing"
//     and typing 4,850 on a phone keypad at the side of a road is friction.
//
//  2. WHAT FOR. Five purposes, because that is how customers talk about money
//     they owe — "I'm paying my CRB", "that's my penalty". It is captured and
//     it shapes the confirmation.
//
//  3. WHERE IT WILL ACTUALLY LAND — and this is the one that matters.
//
// ── WHY THE ALLOCATION IS ON SCREEN BEFORE THE PROMPT ───────────────────────
// A purpose picker that pretends to route money is a lie on a money screen. The
// lender's `RepaymentTrigger` — an AFTER INSERT trigger on their `INCOMINGC2B`
// table — is what actually allocates: it settles the open loan first and only
// the REMAINDER becomes savings. Their `Repayment` endpoint accepts an amount, a
// phone and an entity, and nothing else. There is no destination to send.
//
// So the sheet shows the split, computed from that trigger's own rule, BEFORE
// the customer confirms. A customer choosing "Save" while a loan is open is told
// in plain words that the loan is settled first — before the prompt, not after
// the money has moved. Being upfront about a rule the customer did not choose is
// the difference between a bank and an app that took their money and surprised
// them.
//
// `previewAllocation` mirrors connected-suite/src/lib/portal/pay-purpose.ts,
// which OWNS the rule. It exists here so the split updates as the amount is
// typed rather than after a round trip; the server's answer, returned with the
// push, is the record. If the two ever disagree, the server is right and this
// file is stale — re-read the trigger, fix both.
//
// ── WHAT "SENT" MEANS ───────────────────────────────────────────────────────
// The success state says a PROMPT was raised, never that money arrived. The
// payment is confirmed by Safaricom's callback into the lender's own pipeline,
// which is seconds to minutes later and entirely outside this screen. Claiming
// otherwise would have customers closing the app before entering their PIN.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Banknote, CheckCircle2, Info, Landmark, PiggyBank,
  ReceiptText, ShieldAlert, Smartphone, TriangleAlert, X,
} from "lucide-react";
import { LiquidButton } from "../ui/LiquidButton";
import { pay, type PayAllocation, type PayPurpose } from "../../lib/api/portal";

const kes = (n: number) => `KSh ${Math.round(n).toLocaleString("en-KE")}`;

/** The route's own sentence, which is the one worth showing. See submit(). */
const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const PURPOSES: { key: PayPurpose; label: string; note: string; icon: typeof Banknote; tint: string }[] = [
  { key: "repayment", label: "Repay my loan", note: "Pay down what you owe", icon: Landmark, tint: "#5b8cff" },
  { key: "savings", label: "Save", note: "Put money aside", icon: PiggyBank, tint: "#25950c" },
  { key: "penalty", label: "Late penalty", note: "Settle a penalty", icon: ShieldAlert, tint: "#f0a92b" },
  { key: "processing-fee", label: "Processing fee", note: "The fee on your loan", icon: ReceiptText, tint: "#a78bfa" },
  { key: "crb", label: "CRB fee", note: "Credit bureau charge", icon: Info, tint: "#f472b6" },
];

/**
 * RepaymentTrigger's rule, mirrored for live feedback. See the header — the
 * server owns this; anything here that disagrees with it is a bug here.
 */
function previewAllocation(purpose: PayPurpose, amount: number, outstanding: number): PayAllocation {
  const amt = Math.max(0, Math.round(amount));
  const owed = Math.max(0, Math.round(outstanding));

  if (owed <= 0) {
    return {
      purpose, toLoan: 0, toSavings: amt, clearsLoan: false, divergent: false,
      explanation:
        purpose === "savings"
          ? `${kes(amt)} goes into your savings.`
          : `You have no running loan, so ${kes(amt)} goes into your savings and waits there.`,
    };
  }

  const toLoan = Math.min(amt, owed);
  const toSavings = amt - toLoan;
  const clearsLoan = toLoan >= owed;

  if (purpose === "savings") {
    return {
      purpose, toLoan, toSavings, clearsLoan, divergent: true,
      explanation:
        toSavings > 0
          ? `Your lender settles the loan first. ${kes(toLoan)} clears what you owe and the remaining ${kes(toSavings)} goes into savings.`
          : `Your lender settles the loan first, so this ${kes(amt)} goes against your balance of ${kes(owed)} rather than into savings.`,
    };
  }

  const head =
    purpose === "penalty" ? "Penalties are carried in your loan balance"
    : purpose === "processing-fee" ? "Your processing fee is already inside your loan balance"
    : purpose === "crb" ? "Your CRB fee is already inside your loan balance"
    : null;

  return {
    purpose, toLoan, toSavings, clearsLoan, divergent: false,
    explanation: head
      ? `${head}, so ${kes(toLoan)} goes against it${clearsLoan ? " and clears the loan" : ""}${toSavings > 0 ? `, and ${kes(toSavings)} lands in savings` : ""}.`
      : clearsLoan
        ? `${kes(toLoan)} clears your loan${toSavings > 0 ? `, and ${kes(toSavings)} goes into savings` : ""}.`
        : `${kes(toLoan)} comes off your balance, leaving ${kes(owed - toLoan)}.`,
  };
}

export function PayNow({
  open,
  onClose,
  nationalId,
  outstanding,
  phone,
  /** Fired after a prompt is raised, so the caller can refresh the balance. */
  onPushed,
}: {
  open: boolean;
  onClose: () => void;
  nationalId: string;
  /** The loan balance as the lender holds it. 0 = nothing owed. */
  outstanding: number;
  /** For "check your phone" — the number the prompt goes to. Display only. */
  phone?: string | null;
  onPushed?: () => void;
}) {
  const [purpose, setPurpose] = useState<PayPurpose>(outstanding > 0 ? "repayment" : "savings");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; allocation: PayAllocation | null } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // A fresh sheet every time it opens. Leaving the last attempt's amount and
  // success banner standing is how somebody pays twice.
  useEffect(() => {
    if (!open) return;
    setPurpose(outstanding > 0 ? "repayment" : "savings");
    setAmount(outstanding > 0 ? String(Math.round(outstanding)) : "");
    setBusy(false);
    setError(null);
    setDone(null);
    const t = setTimeout(() => amountRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open, outstanding]);

  // Escape closes it — a sheet with no keyboard exit traps anyone on a laptop,
  // which on this app includes the staff walking customers through it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, busy, onClose]);

  const value = Number(amount.replace(/[^\d]/g, "")) || 0;
  const preview = useMemo(
    () => (value > 0 ? previewAllocation(purpose, value, outstanding) : null),
    [purpose, value, outstanding],
  );

  // Chips worth offering, deduplicated and only where they make sense. "Clear
  // it" against a zero balance is a button that does nothing.
  const chips = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    if (outstanding > 0) {
      out.push({ label: "Clear it", value: Math.round(outstanding) });
      const half = Math.round(outstanding / 2);
      if (half >= 50) out.push({ label: "Half", value: half });
    }
    for (const v of [500, 1000, 2000]) {
      if (!out.some((c) => c.value === v)) out.push({ label: kes(v), value: v });
    }
    return out.slice(0, 4);
  }, [outstanding]);

  if (!open) return null;

  async function submit() {
    if (value <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await pay(nationalId, value, purpose);
      if (!r.success) {
        setError(r.message || "We could not raise the prompt just now. Please try again.");
        return;
      }
      setDone({
        message: r.message || "Check your phone for the M-PESA prompt.",
        // The server's split is the record; the live preview is the fallback
        // for the case where the balance could not be read at request time.
        allocation: r.allocation ?? preview,
      });
      onPushed?.();
    } catch (e) {
      // A refusal arrives as an ApiError carrying the ROUTE'S OWN MESSAGE, and
      // that message is the whole value: "too many payment attempts", "sign in
      // with your Micromart password to pay from the app", "paying from the app
      // is not switched on for this lender yet". Each is a different
      // instruction, and collapsing them into "something went wrong" throws
      // away the only sentence the customer can act on.
      //
      // NOT RETRIED, ever. A timeout is not evidence the prompt was not raised;
      // a second attempt is a second PIN request on a real handset for real
      // money, and the customer cannot tell which one is which.
      setError(messageOf(e, "We could not raise the prompt just now. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Pay now">
      <div
        aria-hidden
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "rgb(4 6 14 / 0.5)" }}
        onClick={() => !busy && onClose()}
      />

      {/* Bottom sheet on a phone, centred panel on a laptop. The phone is the
          design target: a sheet rising from the bottom edge puts the amount
          field and the commit button under the thumb, which is where the hand
          already is. */}
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[460px]">
        <div
          className="card rounded-b-none rounded-t-[28px] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:rounded-[24px] sm:pb-5"
          style={{ boxShadow: "var(--shadow-lift)" }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-bold tracking-[-0.02em]">Pay now</h2>
              <p className="mt-0.5 text-[12px] text-ink-soft">
                {outstanding > 0 ? `You owe ${kes(outstanding)}` : "You have no running loan"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-surface-sunk hover:text-ink disabled:opacity-50"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>

          {done ? (
            // ── THE PROMPT IS ON ITS WAY, WHICH IS NOT "PAID" ──────────────
            <div className="py-2">
              <div className="flex items-start gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                  style={{ background: "color-mix(in oklab, var(--green) 18%, transparent)", color: "var(--green-ink)" }}
                >
                  <Smartphone className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-tight">Check your phone</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                    {done.message}
                    {phone ? ` We sent it to ${phone}.` : ""}
                  </p>
                </div>
              </div>

              {done.allocation && (
                <div className="assurance mt-4 flex items-start gap-3 p-3.5">
                  <CheckCircle2
                    className="mt-px h-4 w-4 shrink-0"
                    strokeWidth={2.3}
                    style={{ color: "var(--green-ink)" }}
                  />
                  <p className="text-[12px] leading-relaxed text-ink-soft">{done.allocation.explanation}</p>
                </div>
              )}

              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
                Enter your M-PESA PIN on the prompt. Your balance here updates once your lender confirms the payment —
                usually within a minute.
              </p>

              <LiquidButton size="lg" block className="mt-4" onClick={onClose}>
                Done
              </LiquidButton>
            </div>
          ) : (
            <>
              {/* ── HOW MUCH ─────────────────────────────────────────────── */}
              <label htmlFor="pay-amount" className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                Amount
              </label>
              <div
                className="mt-2 flex items-center gap-2.5 rounded-2xl border px-4 transition-colors focus-within:border-[var(--green-ink)]"
                style={{ background: "var(--surface-sunk)", borderColor: "var(--line)" }}
              >
                <span className="shrink-0 text-[15px] font-semibold text-ink-soft">KSh</span>
                <input
                  id="pay-amount"
                  ref={amountRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount ? Number(amount.replace(/[^\d]/g, "") || 0).toLocaleString("en-KE") : ""}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  className="tnum min-w-0 flex-1 bg-transparent py-3.5 text-[20px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-faint"
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setAmount(String(c.value))}
                    className="rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-surface-sunk"
                    style={{
                      borderColor: value === c.value ? "var(--green-ink)" : "var(--line-strong)",
                      color: value === c.value ? "var(--green-ink)" : "var(--ink-soft)",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* ── WHAT FOR ─────────────────────────────────────────────── */}
              <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                What is this for?
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {PURPOSES.map((p) => {
                  const on = purpose === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPurpose(p.key)}
                      aria-pressed={on}
                      className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
                      style={{
                        borderColor: on ? "var(--green-ink)" : "var(--line)",
                        background: on ? "color-mix(in oklab, var(--lime) 10%, transparent)" : "transparent",
                      }}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{ background: `color-mix(in oklab, ${p.tint} 16%, transparent)`, color: p.tint }}
                      >
                        <p.icon className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold leading-tight">{p.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{p.note}</span>
                      </span>
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 rounded-full border-[5px] transition-colors"
                        style={{
                          borderColor: on ? "var(--green-ink)" : "var(--line-strong)",
                          background: "var(--surface)",
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* ── WHERE IT LANDS. The point of the whole sheet. ────────── */}
              {preview && (
                <div
                  className="mt-4 flex items-start gap-3 rounded-xl p-3.5"
                  style={{
                    background: preview.divergent
                      ? "color-mix(in oklab, #f59e0b 12%, transparent)"
                      : "var(--surface-sunk)",
                    border: `1px solid ${preview.divergent ? "color-mix(in oklab, #f59e0b 40%, transparent)" : "var(--line)"}`,
                  }}
                >
                  {preview.divergent ? (
                    <TriangleAlert className="mt-px h-4 w-4 shrink-0" strokeWidth={2.3} style={{ color: "#b45309" }} />
                  ) : (
                    <Info className="mt-px h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2.3} />
                  )}
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-relaxed text-ink-soft">{preview.explanation}</p>
                    {preview.toLoan > 0 && preview.toSavings > 0 && (
                      <p className="tnum mt-1.5 text-[11.5px] font-semibold text-ink-faint">
                        {kes(preview.toLoan)} to your loan · {kes(preview.toSavings)} to savings
                      </p>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="mt-3 text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
                  {error}
                </p>
              )}

              <LiquidButton
                size="lg"
                block
                className="mt-4"
                trailingIcon={ArrowRight}
                loading={busy}
                disabled={busy || value <= 0}
                onClick={submit}
              >
                {busy ? "Raising the prompt" : value > 0 ? `Pay ${kes(value)}` : "Enter an amount"}
              </LiquidButton>

              <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ink-faint">
                The prompt goes to your registered M-PESA number. Nobody can raise it on a number that is not yours.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PayNow;
