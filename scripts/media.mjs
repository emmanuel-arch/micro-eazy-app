// ─────────────────────────────────────────────────────────────────────────────
// THE MEDIA PIPELINE — everything that arrives as a download becomes a web asset
// here, and nowhere else.
//
//   node scripts/media.mjs                     report only, writes nothing
//   node scripts/media.mjs --write              encode
//   node scripts/media.mjs --write --force      re-encode even if up to date
//   node scripts/media.mjs --check              exit 1 if anything is over budget
//   node scripts/media.mjs --write --archive    move the originals out of public/
//
// ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────────
// Art arrives from wherever art arrives from: a 5.9 MB JPEG off Unsplash, a PNG
// screenshot, a WebP somebody already converted once at the wrong size. Dropping
// those into public/ works — every one of them renders — and it is also how an
// app that loads in 1.2s on a laptop takes forty seconds on a handset in
// Kericho. public/wallpapers alone was 31 MB of JPEG the day this was written,
// for twelve pictures with a 300 KB budget each.
//
// So public/ is not where you put a picture. It is where this script puts one.
//
// ── WHAT IT GUARANTEES ───────────────────────────────────────────────────────
//   · ONE FORMAT. Everything ends up .webp, whatever it started as. No screen
//     has to know which slot happened to arrive as a PNG.
//   · ONE SIZE PER JOB. A wallpaper is 2560 wide because it is painted across a
//     desktop; its thumbnail is 480 because the picker draws it at 160. Nothing
//     is ever enlarged — a 1600px source stays 1600px rather than becoming a
//     soft 2560px lie that costs more bytes to be blurrier.
//   · A BUDGET, ENFORCED. Every recipe carries a byte budget and --check fails
//     on a breach, so "the app got slow again" is a build error rather than a
//     complaint six months later.
//   · AN LQIP FOR EVERY FILE. A ~20px WebP, base64'd into a generated module
//     (see LQIP_OUT). Inline, so it costs ZERO requests and paints on the first
//     frame — which is the whole trick behind a background that never flashes
//     white while its photograph is in flight. The other half of the trick is
//     components/media/ProgressiveImage.tsx.
//   · A DOMINANT COLOUR, sampled from the picture itself, so the surface behind
//     a still-loading image is that image's own colour and not a grey box.
//
// ── WHY THE ORIGINALS ARE ARCHIVED AND NOT DELETED ───────────────────────────
// --archive MOVES the source JPEG/PNG to media-src/ (outside public/, so it is
// never served) rather than removing it. Re-encoding at a different size later
// needs the original, and a WebP re-encoded from a WebP loses a little on every
// pass. Nothing is deleted by this script, ever.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const WRITE = process.argv.includes("--write");
const FORCE = process.argv.includes("--force");
const CHECK = process.argv.includes("--check");
const ARCHIVE = process.argv.includes("--archive");

/** Where the generated placeholder module lands. Imported by the app. */
const LQIP_OUT = "src/lib/media/media.generated.ts";
/** Where --archive puts the originals. Outside public/ on purpose. */
const ARCHIVE_DIR = "media-src";

const SOURCE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".jfif"];

// ─────────────────────────────────────────────────────────────────────────────
// THE RECIPES. One per folder, because the right size for a picture is a
// property of the JOB it does, not of the picture.
// ─────────────────────────────────────────────────────────────────────────────
const RECIPES = [
  {
    dir: "public/wallpapers",
    label: "Wallpapers",
    // 2560x1600 covers a desktop at 1x and a laptop at 2x. It is painted under a
    // scrim (white 82% in light, navy 88% in dark), which is also why q80 is
    // generous rather than tight: nobody inspects grain through an 18% window.
    width: 2560,
    height: 1600,
    quality: 80,
    budget: 300_000,
    // The picker draws twelve of these at once. Twelve full wallpapers is 3.6 MB
    // for a grid of 160px tiles — the single most expensive mistake available on
    // that screen.
    thumb: { suffix: "-thumb", width: 480, height: 300, quality: 66, budget: 40_000 },
    wanted: [
      "nairobi-dawn", "savannah", "market-warm", "coast", "tea-fields", "mount-kenya",
      "paper", "linen-dark", "mesh-navy", "mesh-lime", "boda-motion", "sunset-silhouette",
    ],
  },
  {
    dir: "public/art",
    label: "Illustration slots",
    // 1600 wide is a full-bleed card on a 2x phone and a wide tile on a laptop.
    // The height is left to the source's own aspect: these are cropped by CSS
    // into whatever ratio their slot declares (see lib/media/assets.ts), and
    // baking a crop in here would fight that.
    width: 1600,
    quality: 78,
    budget: 220_000,
    wanted: [
      "kyc-id-front", "kyc-face", "statement-howto", "tip-credit-score",
      "tip-what-moves-limit", "tip-charges", "ladder-climb", "score-explained",
      "exposure-interchange", "repay-done", "ratiba-setup", "empty-no-loans",
    ],
  },
  {
    dir: "public/images/login",
    label: "Front-door photography",
    // NO HEIGHT, DELIBERATELY — and this is the one recipe where that matters.
    //
    // The brief asked for 1600x2000 portrait. The component that renders these
    // (components/media/Voices.tsx) has TWO layouts off the same files: a
    // scattered deck cropped to 4:5 on a phone, and a full-bleed landscape
    // cover on a desktop. Both crops are done in CSS, from one landscape
    // original. Baking a portrait crop in here would hand the desktop hero a
    // tall picture to letterbox — which is the exact bug that layout was written
    // to fix — and it cannot be undone downstream, because the pixels are gone.
    //
    // So the pipeline resizes and never crops here: 1600 on the long edge, the
    // source's own aspect kept, and the two crops stay where they can still be
    // changed.
    width: 1600,
    quality: 78,
    budget: 260_000,
    wanted: [
      "ke-boda", "ke-duka", "ke-fundi", "ke-mama-mboga",
      "ke-tailor", "ke-farmer", "ke-salon", "ke-butcher",
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** `Kericho Tea Fields.JPG` becomes `kericho-tea-fields`. Filenames are
 *  addresses in this app; a space or a capital in one is a 404 waiting for a
 *  case-sensitive host to find it. */
const slug = (name) =>
  name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

/** The budget is the point of this script, so it is the loudest thing in here. */
const c = { ok: "\x1b[32m", warn: "\x1b[33m", bad: "\x1b[31m", dim: "\x1b[2m", off: "\x1b[0m" };

/**
 * Pick ONE source per output name.
 *
 * A folder routinely holds `empty-no-loans.jpg` AND `empty-no-loans.webp` —
 * somebody converted it once, then downloaded a better original. The bigger
 * PICTURE wins (not the bigger file), because that is the one with detail left
 * to give; a tie goes to the non-WebP, which is the one that has not already
 * been through a lossy pass.
 */
async function chooseSources(dir) {
  const entries = await fs.readdir(dir).catch(() => []);
  const byName = new Map();

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (!SOURCE_EXT.includes(ext)) continue;
    // Outputs of a previous run are not inputs to this one.
    if (/-thumb\.webp$/i.test(entry)) continue;

    const name = slug(entry);
    const file = path.join(dir, entry);
    let meta;
    try {
      meta = await sharp(file).metadata();
    } catch {
      console.log(`  ${c.bad}unreadable${c.off} ${entry}`);
      continue;
    }
    const area = (meta.width ?? 0) * (meta.height ?? 0);
    const prev = byName.get(name);
    const better =
      !prev || area > prev.area || (area === prev.area && prev.ext === ".webp" && ext !== ".webp");
    if (better) byName.set(name, { file, entry, ext, area, width: meta.width, height: meta.height });
  }
  return byName;
}

/** A 20px-wide WebP as a data URI, plus the picture's own dominant colour. Both
 *  are inlined into the generated module — no request, paints on frame one. */
async function placeholder(file) {
  const img = sharp(file);
  const [buf, stats, meta] = await Promise.all([
    img.clone().resize(20, null, { fit: "inside" }).blur(1.1).webp({ quality: 40 }).toBuffer(),
    img.clone().stats(),
    img.clone().metadata(),
  ]);
  const { r, g, b } = stats.dominant;
  return {
    lqip: `data:image/webp;base64,${buf.toString("base64")}`,
    dominant: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
    w: meta.width ?? 0,
    h: meta.height ?? 0,
  };
}

/**
 * ── THE BUDGET IS THE CONSTRAINT. QUALITY IS THE VARIABLE. ───────────────────
 *
 * A fixed quality is the wrong instrument, and the first run of this script
 * proved it in one screenful: at q80, `paper` came out at 39 KB and `tea-fields`
 * at 1301 KB. Same width, same encoder, same setting — the difference is
 * entirely the picture. A photograph of a thousand rows of tea has detail in
 * every block and WebP has to pay for all of it; a sheet of paper does not.
 *
 * Fixing that by lowering the recipe's quality would punish every simple picture
 * to rescue the busy ones. So the recipe declares the BUDGET, which is the thing
 * that actually matters to somebody on a handset, and this function solves for
 * the highest quality that fits inside it.
 *
 * WHY THIS IS SAFE HERE, SPECIFICALLY. These wallpapers are painted under a
 * scrim — white at 82% in the light theme, navy at 88% in dark. What lands on
 * screen is at most a fifth of the picture's own contrast. Compression artefacts
 * live in exactly the high-frequency detail that scrim is flattening, so a busy
 * photograph encoded at q56 to hit its budget is indistinguishable, in place,
 * from the same photograph at q80 that costs a megabyte more.
 *
 * If nothing fits even at the floor, the file is still written at the floor
 * quality and reported OVER — a wallpaper that is too heavy is a decision for a
 * person to make, not something to silently degrade into mush.
 */
/**
 * The ladder, in the order it is climbed down.
 *
 * QUALITY FIRST, THEN SIZE, and that order is the whole judgement in this
 * function. Dropping quality is free until it is not: somewhere around q50 the
 * blocking artefacts stop being invisible and start being the thing you look at.
 * Past that point the picture simply has more detail than the budget can carry,
 * and the honest fix is fewer pixels rather than worse ones — a 1792px wallpaper
 * stretched by CSS reads as slightly soft, while a 2560px one at q30 reads as
 * broken. Softness is a texture; blocking is a defect.
 *
 * Each rung is a full re-encode at effort 6 (a couple of seconds on a 9000px
 * source), so the steps are coarse on purpose. Nobody needs q61.
 */
function ladder({ width, quality }) {
  const w = (f) => Math.round(width * f);
  return [
    { width, quality },
    { width, quality: quality - 8 },
    { width, quality: quality - 16 },
    // Out of the quality range that is invisible under a scrim. Start taking
    // pixels instead, at a quality that is comfortably clean again.
    //
    // EVERY RUNG MUST COST STRICTLY LESS THAN THE ONE ABOVE IT. The first
    // version of this ladder ended on 0.55x at q70 — a HIGHER quality than the
    // rung above — so a picture that fell through to the bottom could come out
    // bigger than it had been three attempts earlier, and the loop would stop on
    // a worse answer than one it had already seen. Width and quality both only
    // ever go down from here.
    { width: w(0.85), quality: quality - 14 },
    { width: w(0.7), quality: quality - 18 },
    { width: w(0.55), quality: quality - 20 },
    { width: w(0.45), quality: quality - 22 },
    // ── THE LAST RESORT: TAKE THE DETAIL, NOT THE PIXELS ────────────────────
    // Two pictures in the shipped set reach here — a market-textile bokeh and a
    // tea plantation shot from above. Both are high-frequency noise edge to
    // edge, which is the one thing WebP cannot compress: at 1152px and q58 they
    // were still 360 KB and 437 KB against a 293 KB budget.
    //
    // Shrinking them further is the wrong lever, because the detail is what is
    // expensive and the detail is ALREADY INVISIBLE — a wallpaper is painted
    // under a scrim (white 82% in light, navy 88% in dark), and no one has ever
    // resolved an individual tea bush through an 18% window. A half-pixel blur
    // deletes exactly the information the scrim was going to destroy anyway, and
    // costs nothing that reaches a viewer's eye.
    //
    // It is LAST on purpose. Any picture that can make its budget honestly does
    // so above this line and is never touched.
    { width: w(0.45), quality: quality - 22, blur: 0.5 },
    { width: w(0.45), quality: quality - 24, blur: 1 },
  ];
}

async function encode(src, out, recipe) {
  const { height, quality, budget } = recipe;

  // READ THE SOURCE INTO MEMORY FIRST. sharp streams from a path, which on
  // Windows keeps a handle open on the file — and a same-path encode (a .webp
  // source producing a .webp output, which is routine here) then fails the
  // rename with EPERM. Buffering also means the quality ladder decodes the
  // original once instead of once per rung.
  const input = await fs.readFile(src);
  const tmp = `${out}.tmp`;

  const attempt = async ({ width, quality: q, blur }) => {
    const pipeline = sharp(input)
      .rotate() // honour EXIF before resizing, or a phone photo lands on its side
      .resize({
        width,
        height,
        fit: height ? "cover" : "inside",
        position: "attention", // crop toward the subject, not the geometric centre
        withoutEnlargement: true,
      });
    if (blur) pipeline.blur(blur);
    await pipeline
      .webp({ quality: q, effort: 6, smartSubsample: true })
      .toFile(tmp);
    await fs.rename(tmp, out);
    return (await fs.stat(out)).size;
  };

  const rungs = budget ? ladder(recipe) : [{ width: recipe.width, quality }];
  let last;
  for (const rung of rungs) {
    const size = await attempt(rung);
    last = { size, ...rung };
    if (!budget || size <= budget) break;
  }
  // Nothing fitted. The smallest attempt is on disk and it is reported OVER —
  // a wallpaper too heavy to ship is a decision for a person to make, not
  // something to quietly degrade into mush.
  return last;
}

/** Up to date = the output exists and is newer than its source. Cheap, and right
 *  often enough that re-running the whole pipeline costs nothing. */
async function fresh(src, out) {
  if (FORCE || !existsSync(out)) return false;
  const [a, b] = await Promise.all([fs.stat(src), fs.stat(out)]);
  return b.mtimeMs >= a.mtimeMs;
}

// ── The run ──────────────────────────────────────────────────────────────────

async function main() {
  const media = {};
  let breaches = 0;
  let before = 0;
  let after = 0;
  const owed = [];

  for (const recipe of RECIPES) {
    const dir = path.join(ROOT, recipe.dir);
    if (!existsSync(dir)) {
      console.log(`\n${recipe.label} — ${c.dim}${recipe.dir} does not exist${c.off}`);
      continue;
    }
    console.log(
      `\n${c.dim}--${c.off} ${recipe.label} ${c.dim}(${recipe.dir}, ${recipe.width}px, q${recipe.quality}, budget ${kb(recipe.budget)})${c.off}`,
    );

    const sources = await chooseSources(dir);
    const names = [...sources.keys()].sort();

    for (const name of names) {
      const s = sources.get(name);
      const out = path.join(dir, `${name}.webp`);
      const rel = `${recipe.dir.replace(/^public/, "")}/${name}.webp`;
      before += (await fs.stat(s.file)).size;

      let size = null;
      let usedQuality = recipe.quality;
      let usedWidth = recipe.width;
      if (WRITE) {
        if (await fresh(s.file, out)) {
          size = (await fs.stat(out)).size;
        } else {
          ({ size, quality: usedQuality, width: usedWidth } = await encode(s.file, out, recipe));
        }
      }

      if (recipe.thumb && WRITE) {
        const tOut = path.join(dir, `${name}${recipe.thumb.suffix}.webp`);
        let tSize;
        if (await fresh(s.file, tOut)) tSize = (await fs.stat(tOut)).size;
        else ({ size: tSize } = await encode(s.file, tOut, recipe.thumb));
        if (tSize > recipe.thumb.budget) {
          breaches++;
          console.log(`  ${c.warn}thumb over budget${c.off} ${name}${recipe.thumb.suffix}.webp ${kb(tSize)}`);
        }
      }

      // The placeholder is read from the ENCODED file when there is one, so its
      // colour and its crop match what actually ships rather than the original.
      media[rel] = await placeholder(WRITE && existsSync(out) ? out : s.file);

      const over = size !== null && size > recipe.budget;
      if (over) breaches++;
      if (size !== null) after += size;

      const from = s.ext === ".webp" ? "webp" : s.ext.slice(1);
      const dims = `${s.width}x${s.height}`;
      // Printed only when the encoder had to come DOWN off the recipe, so the
      // column is empty for the easy pictures and names the expensive ones —
      // which is the list somebody re-shooting the set actually wants.
      const spent = [
        usedQuality !== recipe.quality ? `q${usedQuality}` : null,
        usedWidth !== recipe.width ? `${usedWidth}px` : null,
      ].filter(Boolean);
      const q = size !== null && spent.length ? ` ${c.dim}${spent.join(" ")}${c.off}` : "";
      const verdict =
        size === null ? `${c.dim}would encode${c.off}` : over ? `${c.bad}${kb(size)} OVER${c.off}` : `${c.ok}${kb(size)}${c.off}${q}`;
      const flag = recipe.wanted?.includes(name) ? "" : ` ${c.warn}(not in any manifest)${c.off}`;
      console.log(`  ${name.padEnd(24)} ${c.dim}${from.padEnd(4)} ${dims.padStart(11)}${c.off} -> ${verdict}${flag}`);

      if (ARCHIVE && WRITE && s.ext !== ".webp") {
        const dest = path.join(ROOT, ARCHIVE_DIR, recipe.dir.replace(/^public\//, ""));
        await fs.mkdir(dest, { recursive: true });
        await fs.rename(s.file, path.join(dest, s.entry));
      }
    }

    for (const want of recipe.wanted ?? []) {
      if (!sources.has(want)) owed.push(`${recipe.dir}/${want}.webp`);
    }
  }

  if (owed.length) {
    console.log(`\n${c.warn}Still owed${c.off} — a manifest asks for these and no file answers:`);
    for (const o of owed) console.log(`  ${o}`);
    console.log(`  ${c.dim}(every one renders a designed fallback; nothing is broken)${c.off}`);
  }

  if (WRITE) {
    await writeManifest(media);
    console.log(
      `\n${c.ok}wrote${c.off} ${LQIP_OUT} ${c.dim}(${Object.keys(media).length} entries, ${kb(JSON.stringify(media).length)} inline)${c.off}`,
    );
    if (before) {
      console.log(
        `${c.ok}total${c.off} ${kb(before)} in -> ${kb(after)} out ${c.dim}(${(100 - (after / before) * 100).toFixed(0)}% smaller)${c.off}`,
      );
    }
  } else {
    console.log(`\n${c.dim}Dry run. Nothing written. Re-run with --write.${c.off}`);
  }

  if (CHECK && breaches) {
    console.error(`\n${c.bad}${breaches} file(s) over budget.${c.off}`);
    process.exit(1);
  }
}

async function writeManifest(media) {
  const entries = Object.keys(media)
    .sort()
    .map((k) => {
      const m = media[k];
      return `  "${k}": { lqip: "${m.lqip}", dominant: "${m.dominant}", w: ${m.w}, h: ${m.h} },`;
    })
    .join("\n");

  const body = `// GENERATED BY scripts/media.mjs - DO NOT EDIT BY HAND.
//
// One entry per shipped image: a ~20px blurred WebP as a data URI, the picture's
// own dominant colour, and its real dimensions.
//
// WHY THIS IS INLINE RATHER THAN FETCHED. The placeholder's whole job is to be
// on screen during the first frame, before the photograph it stands in for has
// even been requested. A placeholder that is itself a request cannot do that job
// - it arrives in the same round trip as the thing it was covering for.
//
// The cost is real and small: a few hundred bytes each, which gzip eats well,
// and it buys a background layer that never flashes white and an image grid that
// never reflows. Re-run \`npm run media\` after adding art.
export type MediaMeta = {
  /** A ~20px WebP, base64. Painted blurred and scaled up under the real one. */
  lqip: string;
  /** The picture's own dominant colour - the ground behind it while it loads. */
  dominant: string;
  w: number;
  h: number;
};

export const MEDIA: Record<string, MediaMeta> = {
${entries}
};

/** Never throws on an unknown path: a missing entry means "no placeholder", and
 *  every consumer already has to survive that (the file may simply not be drawn
 *  yet). A crash here would take out a screen for the sake of a blur. */
export const metaFor = (src: string | null | undefined): MediaMeta | null =>
  (src ? MEDIA[src] ?? null : null);
`;
  await fs.writeFile(path.join(ROOT, LQIP_OUT), body, "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
