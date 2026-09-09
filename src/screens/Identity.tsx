// ─────────────────────────────────────────────────────────────────────────────
// YOUR ID CHECK — the screen a referred customer opens.
//
// ── THE STATE THIS SCREEN EXISTS FOR ────────────────────────────────────────
// A machine looked at a photograph of somebody's national ID and was not sure.
// That is the single most anxious moment in this whole product: the customer has
// handed over their identity, something has gone wrong, and until now the app's
// entire response was one word on a status field they could not see.
//
// So the screen has exactly three jobs, in this order:
//
//   1. SAY WHAT IS HAPPENING. "A person is looking at this" is a completely
//      different experience from silence, and it costs nothing to say.
//   2. SAY WHY, in words about the photograph rather than about the person.
//      Every reason comes from the lender's own policy document, so it cannot
//      drift from the decision that was actually made.
//   3. OFFER THE ONE USEFUL ACTION. Retake when a retake could help; message a
//      human when it could not. Never both with equal weight, and never "try
//      again" against a registry miss — that is a loop with no exit.
//
// ── WHAT IT NEVER SHOWS ─────────────────────────────────────────────────────
// The scores. A customer told their face matched at 79 against a floor of 80 has
// been handed the number to beat, and the next attempt is tuned rather than
// honest. The server does not send them; this screen could not show them if it
// wanted to.
//
// ── WHY IT FETCHES ITSELF ───────────────────────────────────────────────────
// Same reason as Messages: this is keyed on the SESSION, not on a national ID,
// and a customer whose ID check is stuck is precisely somebody who may not have
// a confirmed national ID to key on. Resource() takes `(nationalId) => Promise`
// and would exclude exactly the people this screen is for.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, ShieldAlert, Clock, Camera, MessageSquare, RefreshCw, ScanFace,
} from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { LiquidButton } from "../components/ui/LiquidButton";
import { Artwork } from "../components/media/Artwork";
import { sinceNow } from "../lib/format";
import { kycStatus, type KycStatusResponse } from "../lib/api/portal";
import { SAMPLE_KYC_REVIEW } from "../lib/api/samples";

export default function Identity({ initial }: { initial?: KycStatusResponse }) {
  const go = useNavigate();
  const [data, setData] = useState<KycStatusResponse>(initial ?? SAMPLE_KYC_REVIEW);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setData(await kycStatus());
      setStatus("ready");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error && e.message ? e.message : "We could not check your ID status.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verified = data.status === "VERIFIED";
  const reviewing = data.status === "PENDING_REVIEW";
  const refused = data.status === "FAILED";

  return (
    <>
      <Sky title="Your ID check">
        <p className="max-w-[38ch] text-[13px] leading-relaxed text-sky-ink-soft">
          {verified
            ? "Your identity is confirmed. Nothing here needs your attention."
            : reviewing
              ? "One of our team is looking at this personally."
              : refused
                ? "We could not confirm your ID automatically."
                : "Confirming who you are — this happens once."}
        </p>
      </Sky>

      <div className="relative z-10 -mt-12 px-4 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start xl:gap-4">
        <div className="space-y-3">
          {status === "error" && (
            <section className="card p-5">
              <p className="text-[13px] font-semibold">We could not check your ID status</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{error}</p>
              <LiquidButton size="sm" variant="metal" icon={RefreshCw} className="mt-4" onClick={() => void load()}>
                Try again
              </LiquidButton>
            </section>
          )}

          {status !== "error" && (
            <section className="card p-5">
              <div className="flex items-start gap-3.5">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                  style={
                    verified
                      ? { background: "color-mix(in oklab, var(--lime) 24%, transparent)", color: "var(--green-ink)" }
                      : refused
                        ? { background: "color-mix(in oklab, #dc2626 14%, transparent)", color: "#dc2626" }
                        : { background: "color-mix(in oklab, var(--navy) 11%, transparent)", color: "var(--navy-ink)" }
                  }
                >
                  {verified ? (
                    <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
                  ) : refused ? (
                    <ShieldAlert className="h-5 w-5" strokeWidth={2.2} />
                  ) : (
                    <Clock className="h-5 w-5" strokeWidth={2.2} />
                  )}
                </span>

                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">
                    {verified
                      ? "Verified"
                      : reviewing
                        ? "With our team"
                        : refused
                          ? "We need another look"
                          : data.started
                            ? "In progress"
                            : "Not started yet"}
                  </p>

                  {/* ── THE WAIT, NAMED ────────────────────────────────────
                      "A person is looking at this, and here is roughly how
                      long" is the whole difference between a queue and a void.
                      Where the lender has set no SLA we say that plainly rather
                      than inventing a number we would then be held to. */}
                  {reviewing && (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                      {data.expectedHours
                        ? `Usually within ${data.expectedHours < 24 ? `${data.expectedHours} hours` : `${Math.round(data.expectedHours / 24)} days`}.`
                        : "There is no fixed time on this, but it is usually quick."}
                      {data.submittedAt ? ` Sent ${sinceNow(data.submittedAt)}.` : ""}
                    </p>
                  )}

                  {verified && (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                      You will not be asked to do this again.
                    </p>
                  )}
                </div>
              </div>

              {/* ── WHY ────────────────────────────────────────────────────
                  About the photograph, never about the person. Each line comes
                  from the lender's own policy document, beside the outcome it
                  describes. */}
              {data.reasons.length > 0 && (
                <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                    What we found
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {data.reasons.map((r) => (
                      <li key={r.key} className="flex gap-2.5">
                        <span
                          className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: r.fixable ? "var(--navy-ink)" : "var(--ink-faint)" }}
                        />
                        <span className="text-[12.5px] leading-relaxed text-ink-soft">{r.says}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── THE ONE USEFUL ACTION ──────────────────────────────────
                  Retake is offered ONLY when every reason is one a better
                  photograph could fix. Otherwise the way forward is a person,
                  and pretending otherwise sends somebody round a loop that
                  cannot terminate. */}
              {!verified && (
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {data.retakeable && (
                    <LiquidButton
                      size="md"
                      icon={data.started ? Camera : ScanFace}
                      onClick={() => go("/join?step=kyc-id")}
                    >
                      {data.started ? "Take the photos again" : "Start the check"}
                    </LiquidButton>
                  )}
                  <LiquidButton
                    size="md"
                    variant={data.retakeable ? "metal" : "primary"}
                    icon={MessageSquare}
                    onClick={() =>
                      go(
                        data.conversation
                          ? `/messages/${data.conversation.id}`
                          : "/messages/new?kind=KYC_REVIEW&subject=About%20my%20ID%20check",
                      )
                    }
                  >
                    {data.conversation
                      ? data.conversation.unread > 0
                        ? `Read the reply (${data.conversation.unread} new)`
                        : "Open the conversation"
                      : "Ask someone about this"}
                  </LiquidButton>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="mt-3 space-y-3 xl:mt-0">
          {!verified && (
            <section className="card overflow-hidden">
              <Artwork slot="kyc-id-front" />
              <div className="p-5">
                <p className="text-[13px] font-semibold">Getting a clean photo</p>
                <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                  <li>Lay the card flat on a dark surface.</li>
                  <li>Daylight, but not direct sun — glare hides the print.</li>
                  <li>Fill the frame, all four corners inside it.</li>
                  <li>Hold still until the frame turns green.</li>
                </ul>
              </div>
            </section>
          )}

          <section className="card p-5">
            <p className="text-[13px] font-semibold">Why we check</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
              Lending to someone whose identity has not been confirmed is not allowed, so this step is not something we
              can skip for anyone. When a machine is unsure, a person decides — never the other way round.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
