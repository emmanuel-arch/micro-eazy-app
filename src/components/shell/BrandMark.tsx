// ─────────────────────────────────────────────────────────────────────────────
// THE MARK.
//
// One component, because the rule about when it wears a white chip is a rule
// about SURFACES, and it was previously copied into four files that could each
// get it wrong independently.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
// The mark is navy-and-green artwork on transparency. On paper it needs
// nothing: a chip around it there is a white square on a white page, which is
// the boxed-in look that made it read as a favicon rather than a logo. On a
// DARK surface its navy half sinks into the ground and the whole thing reads as
// a green smear, so there it gets the chip.
//
// "Dark surface" is not the same as "dark theme" — the .sky band is navy in
// BOTH themes and is the header on every handset. So the chip is driven from
// CSS by what it is sitting on (see .brand-chip in styles/theme.css), not from
// a prop each caller has to remember to pass.
//
// ── SIZE ────────────────────────────────────────────────────────────────────
// Bigger than it was, everywhere. At 36-40px inside a chip the mark was a
// favicon; the logo is the one element on the front door doing the work of
// saying whose money this is, and it should be read as a logo at a glance.
// `size` is the box; the artwork is object-contain inside it, so it never
// distorts whatever the file's aspect ratio happens to be.
// ─────────────────────────────────────────────────────────────────────────────

export function BrandMark({
  size = 52,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`brand-chip grid shrink-0 place-items-center overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/brand/micro-eazy/logo-mark.png"
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain"
        // Decorative: the wordmark beside it already says "Micro Eazy", and a
        // screen reader announcing the name twice is noise.
        aria-hidden="true"
      />
    </span>
  );
}

export default BrandMark;
