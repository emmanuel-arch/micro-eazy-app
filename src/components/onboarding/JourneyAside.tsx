// ─────────────────────────────────────────────────────────────────────────────
// THE SECOND COLUMN OF THE JOURNEY — desktop only.
//
// ── WHY IT EXISTS ───────────────────────────────────────────────────────────
// Home splits into a primary and a secondary column at `xl`. Onboarding did
// not: every step rendered as one 620px column centred in a 1080px canvas, so
// on a laptop the whole verification flow sat in a portrait strip with a foot
// of empty page either side of it — while the screen the customer had just come
// from filled its width properly. Same product, two different answers to the
// same window.
//
// That is a real problem beyond tidiness. This app is demonstrated on a laptop
// to people deciding whether to buy it, and a funnel that renders like a phone
// emulator in a browser reads as unfinished no matter how good the phone
// version is.
//
// ── WHY THE COLUMN IS *THIS* AND NOT DECORATION ─────────────────────────────
// Filling the space with a picture would have been easier and worthless. The
// second column answers the two questions somebody halfway through a KYC flow
// actually has, and which the progress bar alone cannot:
//
//   WHERE AM I?      Named steps, not eight anonymous bars. A person who can
//                    see "M-PESA statement" three rows down knows what is
//                    coming and is measurably less likely to abandon than one
//                    watching a bar creep.
//   WHY THIS ONE?    `requiredWhy` is already written for the lender's own
//                    configuration screen — the honest reason a step cannot be
//                    switched off. It is just as good an answer for the person
//                    being asked to do it, and it is the difference between a
//                    form and an explanation.
//
// ── IT IS NOT NAVIGATION ────────────────────────────────────────────────────
// The rows are not links. The wizard is a presenter and every gate that matters
// is enforced on the server, but letting somebody click "Your loan agreement"
// from step one would present a screen assembled from a draft that does not
// exist yet. Showing the road is not the same as opening every gate on it.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, Info, Lock } from "lucide-react";
import type { StepDef } from "../../lib/journey/steps";

export function JourneyAside({ steps, index }: { steps: StepDef[]; index: number }) {
  const step = steps[index];

  return (
    // ── DESKTOP ONLY, AND THAT IS THE POINT ───────────────────────────────
    // The phone is the design target and its funnel is already right: the Sky
    // band carries the progress bar, and the step is the only thing on screen.
    // Stacking eight named rows and a rationale under every form would add a
    // screenful of scrolling to the surface that can least afford it, to solve
    // a problem — dead space beside the column — that only exists at xl.
    //
    // So this is not a responsive version of anything. It is a second column
    // that appears when there IS a second column.
    <aside className="hidden space-y-3 xl:block">
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
          <p className="text-[13px] font-semibold">Your application</p>
          <span className="tnum text-[11.5px] text-ink-faint">
            {Math.min(index + 1, steps.length)} of {steps.length}
          </span>
        </div>

        <ol className="px-2.5 py-2.5">
          {steps.map((s, i) => {
            const done = i < index;
            const now = i === index;
            return (
              <li key={s.id} className="flex items-start gap-2.5 rounded-lg px-2.5 py-[7px]">
                <span
                  aria-hidden
                  className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[10px] font-bold"
                  style={
                    done
                      ? { background: "var(--lime)", color: "var(--navy-deep)" }
                      : now
                        ? { background: "var(--navy)", color: "#fff" }
                        : { background: "var(--surface-sunk)", color: "var(--ink-faint)" }
                  }
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[12.5px] leading-snug ${
                      now ? "font-semibold text-ink" : done ? "text-ink-soft" : "text-ink-faint"
                    }`}
                  >
                    {s.title}
                  </span>
                  {/* The blurb only under the CURRENT step. All eight at once is
                      a wall of text nobody reads, and it would push the step
                      somebody is actually on off the bottom of the column. */}
                  {now && <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">{s.blurb}</span>}
                </span>
                {/* Marks the steps that exist for a licensing reason rather than
                    a product one — the same fact the lender's config screen
                    shows, told to the person being asked. */}
                {s.required && !done && !now && (
                  <Lock className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" strokeWidth={2.2} aria-label="Required" />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Why this step is here at all. Only when there is a real answer on file —
          an empty panel that says "this step is important" is worse than none. */}
      {step?.requiredWhy && (
        <section className="card p-5">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{ background: "color-mix(in oklab, var(--navy) 12%, transparent)", color: "var(--navy-ink)" }}
            >
              <Info className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <p className="text-[13px] font-semibold">Why we ask</p>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">{step.requiredWhy}</p>
        </section>
      )}
    </aside>
  );
}

export default JourneyAside;
