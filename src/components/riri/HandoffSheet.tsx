// ─────────────────────────────────────────────────────────────────────────────
// THE HAND-OFF SHEET — "raise this with the team", with nothing hidden.
//
// The customer sees exactly what will be sent before it is: their own questions,
// and a plain statement that Riri adds what she checked on their account. They can
// add anything the officer should know. What they cannot do is edit what Riri
// checked — that is re-read on the server at the moment of sending, so an officer
// never reads a figure the customer's browser supplied.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Send, UserRound, X, Wallet } from "lucide-react";
import type { RiriLang } from "../../lib/riri/api";

export function HandoffSheet({
  lender, questions, lang, busy, onCancel, onSend,
}: {
  lender: string;
  questions: string[];
  lang: RiriLang;
  busy: boolean;
  onCancel: () => void;
  onSend: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const sw = lang === "sw";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex flex-col justify-end" role="dialog" aria-label="Hand this to the team">
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 backdrop-blur-[2px]" style={{ background: "rgb(4 6 14 / 0.32)" }} />
      <motion.div
        initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="relative rounded-t-[26px] border-t border-line px-4 pb-4 pt-3 shadow-2xl"
        style={{ background: "var(--os-paper)" }}
      >
        <div className="mx-auto mb-2.5 h-1 w-10 rounded-full" style={{ background: "var(--line-strong)" }} />
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: "var(--brand)" }}>
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-tight text-ink">{sw ? `Peleka kwa timu ${lender}` : `Hand this to the team at ${lender}`}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
              {sw ? "Hutalazimika kueleza mara mbili." : "You won't have to explain it twice."}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-[var(--line)]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 space-y-1.5 rounded-xl border border-line px-3 py-2.5" style={{ background: "var(--os-bubble)" }}>
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{sw ? "Kitakachotumwa" : "What they'll see"}</p>
          {questions.slice(-3).map((q, i) => (
            <p key={i} className="truncate text-[12px] text-ink">“{q}”</p>
          ))}
          <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <Wallet className="h-3 w-3 shrink-0" />
            {sw ? "Pamoja na nilichoangalia kwenye akaunti yako, kinachosomwa upya sasa hivi." : "Plus what I checked on your account, read fresh as it's sent."}
          </p>
        </div>

        <label className="mt-3 block text-[11px] font-semibold text-ink-soft" htmlFor="riri-note">
          {sw ? "Ongeza chochote kitakachosaidia (si lazima)" : "Add anything that would help (optional)"}
        </label>
        <textarea
          id="riri-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder={sw ? "Mfano: nililipa Ijumaa saa tisa, M-PESA ref …" : "e.g. I paid on Friday at 3pm, M-PESA ref …"}
          className="mt-1 w-full resize-none rounded-xl border border-line-strong px-3 py-2 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-[color:var(--brand)]"
          style={{ background: "var(--os-paper)" }}
        />

        <button
          type="button"
          disabled={busy}
          onClick={() => onSend(note)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-2) 100%)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sw ? "Tuma kwa timu" : "Send to the team"}
        </button>
      </motion.div>
    </motion.div>
  );
}
