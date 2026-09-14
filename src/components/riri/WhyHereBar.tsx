// ─────────────────────────────────────────────────────────────────────────────
// THE "WHY YOU ARE HERE" BAR — Autopilot's third rule, drawn.
//
// Riri Ecosystem AI plan §06: "A hand-off is a signed deep link with a reason. It
// carries the question that produced it and lands with a dismissible bar." Anybody
// who does not recognise where they are must always be able to read why, and get
// back. So the bar names who moved them and quotes their own words, and it has a
// Back as well as a dismiss.
//
// Two sources, one bar:
//   · Riri moved the page inside the app — set directly by the dock.
//   · Another system sent them here with ?riri=<token> — verified by the server
//     first; a token that fails verification shows nothing at all, because an
//     unverified "Riri sent you here" is exactly the sentence a phishing link wants.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { RiriAvatar } from "./RiriAvatar";
import { setWhyHere, useWhyHere } from "../../lib/riri/whyHere";
import { verifyRiriHandoff } from "../../lib/riri/api";

export function WhyHereBar() {
  const why = useWhyHere();
  const { pathname, search } = useLocation();
  const go = useNavigate();

  // A signed hand-off from another system. Verified, then the token is removed
  // from the address bar so a refresh or a shared URL cannot replay the sentence.
  useEffect(() => {
    const token = new URLSearchParams(search).get("riri");
    if (!token) return;
    let live = true;
    verifyRiriHandoff(token)
      .then((r) => {
        if (live && r.success && r.question) setWhyHere({ question: r.question, from: "Riri", via: r.fromTitle ?? "another system", path: pathname });
      })
      .catch(() => {})
      .finally(() => {
        const next = new URLSearchParams(search);
        next.delete("riri");
        go({ pathname, search: next.toString() ? `?${next}` : "" }, { replace: true });
      });
    return () => {
      live = false;
    };
  }, [search, pathname, go]);

  // Moving anywhere else retires it — the reason belonged to that one arrival.
  useEffect(() => {
    if (why && why.path !== pathname) setWhyHere(null);
  }, [pathname, why]);

  const show = why && why.path === pathname;

  return (
    <AnimatePresence>
      {show && (
        // It FLOATS over the top of the content rather than sitting in the flow:
        // above `lg` every screen is a fixed frame with a height budget, and a bar
        // that pushed a deck down 56px would cut its last row off the bottom.
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-2"
          role="status"
        >
          <div className="why-here pointer-events-auto flex w-full max-w-[760px] items-center gap-2.5 rounded-2xl px-3 py-2 shadow-lg backdrop-blur">

            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white">
              <RiriAvatar size={28} animated={false} />
            </span>
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug">
              <span className="font-semibold">{why.from} brought you here{why.via ? ` from ${why.via}` : ""}</span>{" "}
              <span className="text-ink-soft">because you asked “{why.question}”.</span>
            </p>
            <button type="button" onClick={() => { setWhyHere(null); go(-1); }} className="hidden items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-ink-soft hover:bg-[var(--line)] hover:text-ink sm:inline-flex">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => setWhyHere(null)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-[var(--line)] hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
