// ─────────────────────────────────────────────────────────────────────────────
// HELP & FAQS — /help, its own screen.
//
// This was the second pane of Home. It moved out on 21 Sep 2026 for the reason
// Home exists at all: the first thing a customer sees after signing in must be
// their money and nothing else, and every pane stacked behind it was more for
// the screen to assemble on the one moment it is timed. Home keeps the three
// explainers as one-line rows ("Advice and tips"); "Read more" lands here, open
// at that topic (/help?topic=charges).
//
// The content is unchanged — lib/help/content.ts, the three questions a call
// centre hears most, and the questions people ring about.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, LifeBuoy } from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { Artwork } from "../components/media/Artwork";
import { FAQS, HELP_TOPICS, helpTopic, type HelpTopicId } from "../lib/help/content";

export default function Help() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("topic");
  const topic: HelpTopicId = HELP_TOPICS.some((t) => t.id === asked) ? (asked as HelpTopicId) : HELP_TOPICS[0].id;
  const t = helpTopic(topic);
  const [open, setOpen] = useState<string | null>(null);

  const choose = (id: HelpTopicId) => setParams({ topic: id }, { replace: true });

  return (
    <>
      <Sky title="Help & FAQs">
        <p className="max-w-[44ch] text-[13px] leading-relaxed text-sky-ink-soft lg:max-w-none">
          How your score, your limit and the charges work — and the questions people ask us most.
        </p>
      </Sky>

      <div className="relative z-10 -mt-12 grid grid-cols-1 items-start gap-3 px-4 pb-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b px-5 py-3" style={{ borderColor: "var(--line)" }} role="tablist" aria-label="Topics">
            {HELP_TOPICS.map((x) => {
              const on = x.id === t.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => choose(x.id)}
                  className="rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors"
                  style={{
                    borderColor: on ? "transparent" : "var(--line-strong)",
                    background: on ? "var(--brand-soft)" : "transparent",
                    color: on ? "var(--brand-ink)" : "var(--ink-soft)",
                  }}
                >
                  {x.title}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 p-5" role="tabpanel">
            <Artwork slot={t.slot} motif={t.motif} rounded="rounded-xl" className="hidden !h-[120px] !w-[120px] shrink-0 sm:block" />
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold tracking-[-0.015em]">{t.title}</h2>
              <div className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-ink-soft">
                {t.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
          {t.points && (
            <dl className="grid gap-px border-t sm:grid-cols-3" style={{ borderColor: "var(--line)", background: "var(--line)" }}>
              {t.points.map((p) => (
                <div key={p.label} className="px-4 py-3" style={{ background: "var(--surface)" }}>
                  <dt className="text-[12px] font-semibold">{p.label}</dt>
                  <dd className="mt-1 text-[11.5px] leading-snug text-ink-faint">{p.detail}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "var(--line)" }}>
            <LifeBuoy className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2.1} />
            <p className="flex-1 text-[13px] font-semibold">Questions people ask</p>
            <Link to="/messages/new" className="text-[12px] font-semibold" style={{ color: "var(--brand-ink)" }}>
              Ask us
            </Link>
          </div>
          {FAQS.map((g) => (
            <div key={g.title}>
              <p className="px-5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{g.title}</p>
              <ul>
                {g.items.map((f) => {
                  const on = open === f.q;
                  return (
                    <li key={f.q} className="border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
                      <button
                        type="button"
                        aria-expanded={on}
                        onClick={() => setOpen(on ? null : f.q)}
                        className="flex w-full items-center gap-2 px-5 py-2.5 text-left"
                      >
                        <span className="min-w-0 flex-1 text-[12.5px] font-medium leading-snug">{f.q}</span>
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200"
                          style={{ transform: on ? "rotate(180deg)" : undefined }}
                        />
                      </button>
                      {on && <p className="px-5 pb-3 text-[12px] leading-relaxed text-ink-soft">{f.a}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
