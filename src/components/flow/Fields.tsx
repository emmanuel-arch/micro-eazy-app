// Small form pieces shared by the step-by-step screens. One look for a field,
// one for a tick-box, so KYC and Apply read as the same product.
import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-1.5 text-[12px] font-semibold text-ink-soft">
        {label}
        {required ? (
          <span aria-hidden style={{ color: "#e11d48" }}>
            *
          </span>
        ) : (
          <span className="text-[11px] font-normal text-ink-faint">optional</span>
        )}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {error ? (
        <span className="mt-1 block text-[11.5px] font-medium" style={{ color: "#e11d48" }}>
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] leading-snug text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border bg-[var(--surface-sunk)] px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-ink-faint focus:border-[var(--brand-ink)] disabled:opacity-70";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} style={{ borderColor: "var(--line-strong)", ...props.style }} />;
}

export function Tick({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5" style={{ borderColor: checked ? "var(--brand-ink)" : "var(--line-strong)" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0"
        style={{ accentColor: "var(--brand-ink)" }}
      />
      <span className="text-[12.5px] leading-snug">{children}</span>
    </label>
  );
}
