// ─────────────────────────────────────────────────────────────────────────────
// YOU — and the only screen in the app whose entire purpose is preference.
//
// ── WHY A LENDING APP HAS AN APPEARANCE SCREEN AT ALL ────────────────────────
// It is not decoration and it is not a feature list. Micro Eazy asks a person
// for a photograph of their national ID, a selfie, and permission to read their
// M-PESA statement, and then tells them what they may borrow. Every one of those
// is the app taking something. This screen is the one place it gives something
// back, and it is deliberately the most generous thing in the product: twelve
// photographs, both themes, no upsell, no account tier, nothing withheld.
//
// The commercial argument, since there is one: an app somebody has dressed is an
// app they have made theirs, and a customer who has made a lending app theirs
// opens it to check a balance rather than only when they need money. That is the
// whole of it.
//
// ── TWO CONTROLS, TWO QUESTIONS ──────────────────────────────────────────────
// Brightness and picture are separate, and the picker never prevents a
// combination — the scrim guarantees all 24 are legible (see the note in
// lib/media/wallpapers.ts). A picker that argues with you is worse than no
// picker.
//
// ── THE GRID IS THUMBNAILS AND THAT IS LOAD-BEARING ──────────────────────────
// Twelve full wallpapers is 2.1 MB for a grid of 160px tiles. The pipeline
// generates a 480x300 `-thumb` for exactly this screen, so opening it costs
// ~150 KB total and the full 2560px file is fetched only for the one that gets
// chosen. Rendering `srcFor` here instead of `thumbFor` would be invisible on a
// laptop and would make this the most expensive screen in the app on a phone.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, Image as ImageIcon, Monitor, Moon, Sun } from "lucide-react";
import { Sky } from "../components/shell/Sky";
import { metaFor } from "../lib/media/media.generated";
import { NO_WALLPAPER, SCRIM, orderedFor, thumbFor } from "../lib/media/wallpapers";
import { useTheme, type ThemeChoice } from "../lib/theme";
import { useWallpaper } from "../lib/wallpaper";

const THEMES: { id: ThemeChoice; label: string; hint: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", hint: "Paper and navy", Icon: Sun },
  { id: "dark", label: "Dark", hint: "Near-black", Icon: Moon },
  { id: "system", label: "Auto", hint: "Match my phone", Icon: Monitor },
];

/**
 * One tile in the grid, drawn the same way the real floor is drawn: the picture
 * with the theme's scrim over it. So the tile is a genuine preview of the
 * decision it makes rather than a swatch of the photograph — which would look
 * better here and would be a lie about what the app is going to look like.
 */
function WallpaperTile({
  id,
  name,
  blurb,
  selected,
  scrim,
  onPick,
}: {
  id: string;
  name: string;
  blurb: string;
  selected: boolean;
  scrim: string;
  onPick: () => void;
}) {
  const thumb = id === NO_WALLPAPER ? null : thumbFor(id);
  const meta = metaFor(thumb);

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`group relative overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.98] ${
        selected ? "ring-2 ring-[color:var(--lime)] ring-offset-2 ring-offset-[color:var(--bg)]" : ""
      }`}
    >
      <div
        className="relative aspect-[16/10] w-full"
        style={{ backgroundColor: meta?.dominant ?? "var(--surface-sunk)" }}
      >
        {thumb && (
          <img
            src={thumb}
            alt=""
            aria-hidden
            // Lazy, because twelve of these are below the fold on a handset and
            // the browser is better at deciding when than we are.
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* The same scrim the floor gets. This is the preview. */}
        <div className="absolute inset-0" style={{ background: thumb ? scrim : "transparent" }} />
        {!thumb && (
          <div className="absolute inset-0 grid place-items-center text-ink-faint">
            <ImageIcon className="h-5 w-5" strokeWidth={1.6} />
          </div>
        )}
        {selected && (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[color:var(--lime)] text-[color:var(--navy-deep)]">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="px-1 pb-1 pt-2">
        <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
        <p className="truncate text-[11.5px] text-ink-faint">{blurb}</p>
      </div>
    </button>
  );
}

export default function You() {
  const { choice, resolved, setChoice } = useTheme();
  const { id, setWallpaper } = useWallpaper();
  const scrim = SCRIM[resolved];

  return (
    <>
      <Sky title="You" />

      <div className="-mt-10 space-y-4 px-4 pb-8">
        {/* ── BRIGHTNESS ────────────────────────────────────────────────── */}
        <section className="card rounded-[20px] p-4">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">Appearance</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            How bright the app is. Separate from the picture behind it — pick either, in any
            combination.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {THEMES.map(({ id: t, label, hint, Icon }) => {
              const on = choice === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChoice(t)}
                  aria-pressed={on}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    on
                      ? "border-[color:var(--lime)] bg-[color:var(--surface-sunk)]"
                      : "border-[color:var(--line)] hover:bg-[color:var(--surface-sunk)]"
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] ${on ? "text-[color:var(--green-ink)]" : "text-ink-faint"}`}
                    strokeWidth={2}
                  />
                  <p className="mt-2 text-[13px] font-semibold text-ink">{label}</p>
                  <p className="truncate text-[11px] text-ink-faint">{hint}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── THE PICTURE ───────────────────────────────────────────────── */}
        <section className="card rounded-[20px] p-4">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">Wallpaper</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            Every one works in both light and dark — the app lays a veil over the picture so
            nothing you need to read ever sits on it.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* "None" first, and it is no longer the default — Nairobi dawn is.
                It stays at the head of the grid because it is the row somebody
                comes here looking for: the one way to turn the floor off. See
                DEFAULT_WALLPAPER in lib/media/wallpapers.ts. */}
            <WallpaperTile
              id={NO_WALLPAPER}
              name="None"
              blurb="No picture at all."
              selected={id === NO_WALLPAPER}
              scrim={scrim}
              onPick={() => setWallpaper(NO_WALLPAPER)}
            />
            {/* Ordered by which theme each was chosen for, so a dark-mode
                customer does not scroll past four beaches to find the
                charcoal. */}
            {orderedFor(resolved).map((w) => (
              <WallpaperTile
                key={w.id}
                id={w.id}
                name={w.name}
                blurb={w.blurb}
                selected={id === w.id}
                scrim={scrim}
                onPick={() => setWallpaper(w.id)}
              />
            ))}
          </div>

          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
            Pictures load only when you choose one, and not at all if your phone is set to save
            data.
          </p>
        </section>
      </div>
    </>
  );
}
