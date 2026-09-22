// ─────────────────────────────────────────────────────────────────────────────
// M-PESA RATIBA FOR YOUR APPLICATION — the customer starts the mandate here.
//
// The Finance stage of the lender's workflow asks for a standing order before
// money moves. This is the customer's side of that step: the amount, the rhythm
// and the first and LAST dates on screen before the button; the prompt sent to
// their own handset; and the answer — approved with their PIN or not — shown
// the moment Safaricom confirms it, on this screen and on the officer's Finance
// stage at the same time (they read one row).
//
// Copy follows onboarding/Ratiba.tsx: who debits (Safaricom, on your
// instruction), exactly what and when, how to stop it — and that an empty
// wallet does not overdraw you, but the instalment is still late.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check, Loader2, Radio, ShieldCheck, Smartphone } from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { LiquidButton } from "../components/ui/LiquidButton";
import { applicationRatiba, startApplicationRatiba, type ApplicationRatiba } from "../lib/api/portal";
import { longDate, money } from "../lib/format";

const RHYTHM: Record<string, string> = { WEEKLY: "every week", DAILY: "every day", MONTHLY: "every month", ONCE: "once" };

export default function AutoRepay() {
  const go = useNavigate();
  const [d, setD] = useState<ApplicationRatiba | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await applicationRatiba());
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not load your auto-repay.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const status = d?.mandate?.status ?? null;
  // While the prompt is on the handset, watch for Safaricom's answer.
  useEffect(() => {
    if (status !== "PENDING") return;
    poll.current = setInterval(() => void load(), 3000);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [status, load]);

  const start = async () => {
    setSending(true);
    setError(null);
    try {
      const r = await startApplicationRatiba();
      setD(r);
      if (!r.success) setError(r.message ?? "The request could not be sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const lender = d?.lender ?? "your lender";
  const plan = d?.plan;
  const m = d?.mandate ?? null;

  return (
    <>
      <Sky title="Auto-repay with M-PESA Ratiba" onBack={() => go("/track")}>
        <p className="max-w-[40ch] text-[13px] leading-relaxed text-sky-ink-soft">
          Safaricom pays each instalment from your M-PESA on the due date — on an instruction you approve on your own phone.
        </p>
      </Sky>

      <div className="relative z-10 -mt-12 px-4 pb-10">
        <div className="mx-auto max-w-5xl xl:grid xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:gap-4">
          <section className="card p-5 sm:p-6">
            {!d ? (
              <p className="flex items-center gap-2 text-[13px] text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> Reading your application…</p>
            ) : !d.available || !plan ? (
              <div className="py-6 text-center">
                <p className="text-[15px] font-semibold">Nothing to set up yet</p>
                <p className="mx-auto mt-2 max-w-[36ch] text-[12.5px] leading-relaxed text-ink-faint">
                  Auto-repay is set up for a loan application in progress. Apply first, and it appears here.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  {d.application?.product ?? "Your loan"} · {d.application?.stage ?? d.application?.status}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <Fig k="Each debit" v={money(m?.amount ?? plan.amount)} strong />
                  <Fig k="How often" v={`${RHYTHM[plan.frequency] ?? plan.frequency.toLowerCase()} · ${plan.instalments}×`} />
                  <Fig k="First debit" v={longDate(m?.startDate ?? plan.startDate)} />
                  <Fig k="Last debit" v={longDate(m?.endDate ?? plan.endDate)} />
                </dl>

                {status === "ACTIVE" ? (
                  <div className="mt-5 rounded-2xl p-4" style={{ background: "color-mix(in srgb, #059669 10%, transparent)" }}>
                    <p className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: "#047857" }}>
                      <Check className="h-5 w-5" strokeWidth={2.4} /> Auto-repay is on
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                      You approved it with your M-PESA PIN. {lender} has been told, and your application carries on from Finance.
                      Safaricom will pay {money(m!.amount)} {RHYTHM[m!.frequency] ?? ""} into paybill {d.paybill ?? "—"}.
                    </p>
                  </div>
                ) : status === "PENDING" ? (
                  <div className="mt-5 rounded-2xl p-4" style={{ background: "color-mix(in srgb, #0284c7 10%, transparent)" }}>
                    <p className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: "#0369a1" }}>
                      <Smartphone className="h-5 w-5" /> Check your phone
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                      M-PESA has sent a standing-order request to {m!.phone}. Enter your M-PESA PIN to approve it. This screen
                      updates by itself.
                    </p>
                    <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-faint"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for Safaricom to confirm…</p>
                  </div>
                ) : null}

                {status === "FAILED" && (
                  <p className="mt-4 flex items-start gap-2 text-[12.5px] text-[#b91c1c]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m?.message ?? "The last request was not approved."} You can send it again.
                  </p>
                )}
                {error && (
                  <p className="mt-4 flex items-start gap-2 text-[12.5px] text-[#b91c1c]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                  </p>
                )}

                {status !== "ACTIVE" && (
                  <LiquidButton size="lg" block className="mt-5" icon={Radio} loading={sending} disabled={!d.configured} onClick={start}>
                    {status === "PENDING" ? "Send the request again" : `Set up auto-repay of ${money(plan.amount)}`}
                  </LiquidButton>
                )}
                {status === "ACTIVE" && (
                  <LiquidButton size="lg" block className="mt-5" trailingIcon={ArrowRight} onClick={() => go("/track")}>
                    Back to my application
                  </LiquidButton>
                )}
              </>
            )}
          </section>

          <aside className="mt-3 space-y-3 xl:mt-0">
            <section className="card p-5">
              <p className="flex items-center gap-2 text-[13px] font-semibold"><ShieldCheck className="h-4 w-4" /> Before you agree</p>
              <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                <li><strong className="font-semibold text-ink">Safaricom</strong> moves the money from your own M-PESA, on the instruction you approve. {lender} never reaches into your wallet.</li>
                <li>It has a <strong className="font-semibold text-ink">last date</strong> and never takes more than the instalment.</li>
                <li>You can <strong className="font-semibold text-ink">stop it yourself</strong> from your M-PESA menu, any time, without asking anyone.</li>
                <li>If your wallet is empty on the day, the debit simply fails — no overdraft, no charge. But the instalment is still late, and a late instalment still reaches the credit bureau.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function Fig({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: "var(--surface-sunk)" }}>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{k}</dt>
      <dd className={`tnum mt-1 ${strong ? "text-[20px] font-bold tracking-[-0.02em]" : "text-[14px] font-semibold"}`}>{v}</dd>
    </div>
  );
}
