// ─────────────────────────────────────────────────────────────────────────────
// THE MARK.
//
// One component, because the rule about how it is framed is a rule about
// SURFACES, and it was previously copied into four files that could each get it
// wrong independently.
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
// ── SIZE, AND WHY THE WORDMARK IS GONE ──────────────────────────────────────
// The mark used to appear at 40–54px with the words "Micro Eazy / Quick loans.
// Better living." set beside it. That arrangement lost twice: the mark was too
// small to read as a logo, and the strapline was 11px grey text nobody read.
// Two weak elements sharing 200px, where one strong one belongs.
//
// The words are gone from the chrome and the mark is large enough to do the job
// alone — which is what a logo is for. `size` is the box; the artwork is
// object-contain inside it, so it never distorts whatever the file's aspect
// ratio happens to be.
//
// ── `framed` ────────────────────────────────────────────────────────────────
// The plate treatment (see .brand-plate in styles/theme.css). Used where the
// mark has to HOLD a corner on its own rather than sit inside a band that is
// already carrying the brand: the sidebar's letterhead and the front door. It
// is a presentation of this component and not a separate one, so the two cannot
// drift apart the way the four hand-rolled copies did.
// ─────────────────────────────────────────────────────────────────────────────

export function BrandMark({
  size = 52,
  sizeLg,
  framed = false,
  className = "",
}: {
  /** The box the artwork is contained in. With `framed`, the plate's padding
   *  sits OUTSIDE this, so a framed 56 is a ~76px plate. */
  size?: number;
  /**
   * The box above `lg`, for the corners where the mark has a different job on a
   * laptop than on a handset.
   *
   * ── WHY THIS IS A PROP AND NOT A UTILITY CLASS ────────────────────────────
   * The box used to be an inline `width`/`height`, and an inline declaration
   * beats a stylesheet rule on the same element — so a caller writing
   * `lg:h-[72px]` was silently ignored, which is the worst kind of API: one
   * that looks like it worked. Both sizes now travel as CSS CUSTOM PROPERTIES,
   * which inline style may legally set, and `.brand-mark` in styles/theme.css
   * is what reads them at each breakpoint. The cascade does the work and
   * nothing in this file knows what a breakpoint is.
   */
  sizeLg?: number;
  /** Wear the plate — for the corners the mark has to hold by itself. */
  framed?: boolean;
  className?: string;
}) {
  const mark = (
    <span
      className={`brand-mark brand-chip grid shrink-0 place-items-center overflow-hidden ${framed ? "" : className}`}
      style={
        {
          "--mark": `${size}px`,
          "--mark-lg": `${sizeLg ?? size}px`,
        } as React.CSSProperties
      }
    >
      <img
        src="/brand/micro-eazy/logo-mark.png"
        alt=""
        // Intrinsic dimensions, so the box is reserved before the file lands.
        // The RENDERED size is h-full/w-full inside a parent the custom
        // properties above have already sized — which is what lets `sizeLg`
        // change the box without this attribute disagreeing with it.
        width={size}
        height={size}
        className="h-full w-full object-contain"
        // Decorative when a wordmark or an aria-label names the product. Every
        // caller that drops the visible name provides one — see AppShell's
        // BrandBlock and AuthLayout's header.
        aria-hidden="true"
      />
    </span>
  );

  if (!framed) return mark;
  return <span className={`brand-plate shrink-0 ${className}`}>{mark}</span>;
}

export default BrandMark;
