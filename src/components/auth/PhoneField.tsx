// ─────────────────────────────────────────────────────────────────────────────
// THE PHONE NUMBER FIELD — one component, because it is on four screens.
//
// The front door, the lender's sign-in, the lender's create-account door, and
// (as the prefill) the code gate. Four hand-typed copies of a +254 prefix, a
// tel input and a courtesy check is how one of them ends up accepting a number
// the others reject — and a customer who can type their number on one screen
// and not on the next concludes the app is broken, not that a regex differs.
//
// The focus ring takes the ambient brand: Micro Eazy green on the front door,
// the lender's accent on a lender's own screens. Callers pass `accent` rather
// than this component guessing which surface it is on.
// ─────────────────────────────────────────────────────────────────────────────
import { forwardRef } from "react";
import { Phone } from "lucide-react";

/**
 * Kenyan mobile numbers, loosely. Deliberately loose: this is a courtesy check
 * that stops an obvious typo before a round trip, NOT a validation — the server
 * owns that, and a client-side rule strict enough to be authoritative is a rule
 * that eventually rejects a real customer on a new prefix.
 */
export const looksLikeAPhone = (v: string) => v.replace(/\D/g, "").length >= 9;

/**
 * The field already SHOWS +254, so a full international number arriving in it —
 * a browser's autofill of the saved "254758517032", or a paste of "+254 758…" —
 * rendered as "+254 254758517032": the country code twice, on the screen that
 * is meant to look finished. It is trimmed to the national part as it arrives.
 * Typing is untouched; only a value that starts with the code AND is long
 * enough to be a whole number is rewritten.
 */
function withoutCountryCode(raw: string): string {
  const compact = raw.replace(/[\s()-]/g, "");
  const digits = compact.replace(/\D/g, "");
  if (/^\+?254/.test(compact) && digits.length >= 12) return digits.slice(3);
  return raw;
}

export const PhoneField = forwardRef<
  HTMLInputElement,
  {
    id: string;
    value: string;
    onChange: (v: string) => void;
    /** Show the "not a full number yet" hint. Only after a submit — marking a
     *  field wrong while somebody is typing the first digit is how a form tells
     *  people they are failing at something they have not finished. */
    showError?: boolean;
    /** The focus ring. `var(--green-ink)` on the front door, `var(--brand)` on
     *  a lender's screen. */
    accent?: string;
    label?: string;
  }
>(function PhoneField({ id, value, onChange, showError = false, accent = "var(--green-ink)", label = "Phone number" }, ref) {
  const bad = showError && !looksLikeAPhone(value);
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </label>
      <div
        className="mt-2 flex items-center gap-2.5 rounded-2xl border px-4 transition-[border-color,box-shadow]"
        style={
          {
            background: "var(--surface)",
            borderColor: bad ? "#e11d48" : "var(--line)",
            "--field-accent": accent,
          } as React.CSSProperties
        }
        // Focus ring from the accent — done with a data attribute and a style
        // rule rather than a Tailwind arbitrary value, because the accent is a
        // runtime custom property and `focus-within:border-[var(...)]` would be
        // compiled against whichever value was in the source.
        data-accent-field=""
      >
        <Phone className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={2} />
        <span className="shrink-0 text-[15px] font-medium text-ink-soft">+254</span>
        <input
          ref={ref}
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="7XX XXX XXX"
          value={value}
          onChange={(e) => onChange(withoutCountryCode(e.target.value))}
          aria-invalid={bad}
          aria-describedby={bad ? `${id}-error` : undefined}
          className="tnum min-w-0 flex-1 bg-transparent py-4 text-[16px] text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
      {bad && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[12.5px] font-medium" style={{ color: "#e11d48" }}>
          That does not look like a full number yet — nine digits after the +254.
        </p>
      )}
    </div>
  );
});

export default PhoneField;
