// ─────────────────────────────────────────────────────────────────────────────
// PHOTOGRAPH THE CARD.
//
// The other door to the ID number. Typing it is fast for somebody who knows it
// by heart and a wall for somebody standing in a shop with the card in their
// hand — so this runs the SAME OCR the console uses at the counter and fills
// the field. Neither door is the "lite" path; they arrive at the same place.
//
// ── WHAT THIS COMPONENT IS RESPONSIBLE FOR ──────────────────────────────────
// Getting one readable photograph to the server and reporting honestly what
// came back. It decides nothing: the gate, the registry lookup and the name
// match all happen in /api/portal/kyc, against a session this component cannot
// forge. It hands its caller the parsed fields and gets out of the way.
//
// ── THE THREE THINGS THAT GO WRONG, AND WHY THEY READ DIFFERENTLY ───────────
//   retake      the photograph is too dark, too blurry or too small. Not a
//               failure — an instruction, with the specific reason named. "Try
//               again" without saying what was wrong is how somebody takes the
//               same bad picture four times.
//   no fields   the card was read and nothing came off it. Usually a photograph
//               of the WRONG SIDE, which is worth saying out loud.
//   simulation  the read never happened. See the banner below — this is the one
//               that must never be dressed up as success.
//
// ── ON DOWNSCALING BEFORE UPLOAD ────────────────────────────────────────────
// A modern handset camera produces 4-6MB, and the route rejects bodies over
// roughly 1.4x MAX_IMAGE_BYTES before it will even parse them. More to the
// point, this funnel runs on a prepaid bundle at the side of a road: uploading
// six megabytes to read eight digits is somebody's airtime. 1600px on the long
// edge at q0.85 is comfortably more than Vision needs to read a card and lands
// around 300KB.
//
// The floor is deliberate too. The server's quality gate treats anything under
// 40KB as "resolution-too-low" and refuses it, so compressing harder to save
// bandwidth would start failing legitimate photographs.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useRef, useState } from "react";
import { Camera, CheckCircle2, Image as ImageIcon, Loader2, RefreshCw, TriangleAlert, X } from "lucide-react";
import { readIdFront, type IdOcr, type IdStepResult } from "../../lib/api/portal";

/** The long edge we downscale to. Ample for OCR, kind to a prepaid bundle. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export type IdCaptureResult = {
  ocr: IdOcr;
  sessionId?: string;
  /** The server's own verdict, passed through untouched. */
  step: IdStepResult;
};

/**
 * Read a File into a downscaled JPEG data URL, and measure it while we have the
 * pixels anyway.
 *
 * `brightness` and `blurVar` are sent to the quality gate. Measuring them here
 * rather than server-side is not an optimisation — the server only has the
 * compressed bytes, and a JPEG's size tells you almost nothing about whether
 * the photograph is legible.
 */
async function prepare(file: File): Promise<{ dataUrl: string; bytes: number; brightness: number; blurVar: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Your browser could not process that image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // ── The two signals ──────────────────────────────────────────────────────
  // Mean luminance catches a card photographed into a window (glare) or in the
  // dark. The Laplacian-style variance catches camera shake: a sharp edge in a
  // blurred photograph is a gentle ramp, so the second difference collapses
  // towards zero and the variance with it. Sampled on a grid rather than every
  // pixel — this runs on a mid-range Android and the answer is a threshold, not
  // a measurement.
  const { data } = ctx.getImageData(0, 0, w, h);
  const lum = (i: number) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

  let sum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      sum += lum((y * w + x) * 4);
      count++;
    }
  }
  const brightness = count ? sum / count : 128;

  let lapSum = 0;
  let lapSq = 0;
  let lapN = 0;
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const c = lum((y * w + x) * 4);
      const l = lum((y * w + (x - step)) * 4);
      const r = lum((y * w + (x + step)) * 4);
      const u = lum(((y - step) * w + x) * 4);
      const d = lum(((y + step) * w + x) * 4);
      const v = l + r + u + d - 4 * c;
      lapSum += v;
      lapSq += v * v;
      lapN++;
    }
  }
  const mean = lapN ? lapSum / lapN : 0;
  const blurVar = lapN ? lapSq / lapN - mean * mean : 0;

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  // The data URL is base64: 4 characters per 3 bytes, after the header.
  const bytes = Math.round(((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 3) / 4);

  return { dataUrl, bytes, brightness, blurVar };
}

export function IdCapture({
  nationalId,
  onRead,
  onCancel,
}: {
  /** The typed number, if there is one. The server compares it with what it
   *  reads and reports `idMismatch` — it does not silently prefer either. */
  nationalId?: string;
  onRead: (r: IdCaptureResult) => void;
  onCancel?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string | undefined>(undefined);

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retake, setRetake] = useState<string | null>(null);

  const handle = useCallback(
    async (file: File | undefined) => {
      if (!file || busy) return;
      setBusy(true);
      setError(null);
      setRetake(null);

      try {
        const { dataUrl, bytes, brightness, blurVar } = await prepare(file);
        setPreview(dataUrl);

        const r = await readIdFront(dataUrl, {
          nationalId,
          sessionId: sessionRef.current,
          bytes,
          brightness,
          blurVar,
        });
        // Resuming our own session across retakes keeps every attempt on one
        // audit trail rather than opening a new record per photograph.
        if (r.sessionId) sessionRef.current = r.sessionId;

        if (r.retake) {
          // Name the actual problem. "Try again" without a reason is how the
          // same bad photograph gets taken four times.
          const issues = r.quality?.issues ?? [];
          setRetake(
            issues.includes("glare-detected")
              ? "There is glare on the card. Move out of direct light and take it again."
              : issues.includes("too-dark")
                ? "That came out too dark. Find better light and take it again."
                : issues.includes("image-blurry")
                  ? "That came out blurry. Hold steady, let the camera focus, and take it again."
                  : issues.includes("resolution-too-low")
                    ? "That image is too small to read. Take the photograph with your camera rather than sending a screenshot."
                    : "We could not read that clearly. Lay the card flat, fill the frame, and take it again.",
          );
          return;
        }

        if (!r.ocr || (!r.ocr.idNumber && !r.ocr.fullName)) {
          setError(
            "We could not find any details on that image. Make sure it is the FRONT of the card — the side with your photograph and ID number — and that all four corners are in the frame.",
          );
          return;
        }

        onRead({ ocr: r.ocr, sessionId: r.sessionId, step: r });
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "We could not read that image. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, nationalId, onRead],
  );

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
        <Camera className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--navy-ink)" }} strokeWidth={2.2} />
        <p className="flex-1 text-[13px] font-semibold">Photograph your ID</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-sunk hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          The <strong className="font-semibold text-ink">front</strong> of your national ID — the side with your
          photograph and the ID number. Lay it flat, fill the frame, and keep all four corners in the picture.
        </p>

        {/* ── The frame ──────────────────────────────────────────────────────
            A 1.585 box, which is a real ID-1 card. A guide that is the wrong
            shape teaches people to frame the photograph wrongly. */}
        <div
          className="relative mt-3.5 w-full overflow-hidden rounded-xl border-2 border-dashed"
          style={{ aspectRatio: "1.585", borderColor: "var(--line-strong)", background: "var(--surface-sunk)" }}
        >
          {preview ? (
            <img src={preview} alt="The photograph you took of your ID" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center px-6 text-center">
              <span className="text-[12px] leading-relaxed text-ink-faint">
                Your card goes here
              </span>
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 grid place-items-center backdrop-blur-[2px]" style={{ background: "rgb(0 4 58 / 0.45)" }}>
              <span className="flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-[12.5px] font-semibold text-[color:var(--navy)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                Reading your card…
              </span>
            </div>
          )}
        </div>

        {retake && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed"
            style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}
          >
            <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#e11d48" }} strokeWidth={2.2} />
            <span>{retake}</span>
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-[12.5px] font-medium leading-snug" style={{ color: "#e11d48" }}>
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            <span>{error}</span>
          </p>
        )}

        {/* Two inputs, not one. `capture` opens the camera directly on a
            handset, which is what somebody holding the card wants; without it a
            laptop user gets a camera prompt and no way to pick the file they
            already have. Both are hidden and driven by the buttons. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-opacity disabled:opacity-60"
            style={{ background: "var(--lime)", color: "var(--navy-deep)" }}
          >
            <Camera className="h-4 w-4" strokeWidth={2.4} />
            {preview ? "Retake" : "Take photo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border py-3 text-[13px] font-semibold transition-colors hover:bg-surface-sunk disabled:opacity-60"
            style={{ borderColor: "var(--line-strong)" }}
          >
            <ImageIcon className="h-4 w-4" strokeWidth={2.2} />
            Choose a file
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          The photograph is sent to your lender over an encrypted connection and stored in a private vault. It is kept
          only if it passes — a rejected, blurry picture of your ID is not something anyone should be holding.
        </p>
      </div>
    </section>
  );
}

/**
 * What the read found, shown back before anything is done with it.
 *
 * ── THE SIMULATION BANNER IS NOT A DEBUG AFFORDANCE ─────────────────────────
 * It is the most important thing on this component. With no Vision key
 * configured the server returns invented fields at 88-99 "confidence", and
 * every pixel of the rest of this panel would otherwise present them as having
 * been read off the customer's card. Showing a fabricated name to a borrower as
 * though we had read their ID is worse than showing them an error.
 */
export function IdReadout({ ocr, onUse, onRetake }: { ocr: IdOcr; onUse?: () => void; onRetake?: () => void }) {
  const simulated = ocr.engine !== "google-vision";

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
        <CheckCircle2
          className="h-[18px] w-[18px] shrink-0"
          style={{ color: simulated ? "var(--ink-faint)" : "var(--green-ink)" }}
          strokeWidth={2.2}
        />
        <p className="flex-1 text-[13px] font-semibold">{simulated ? "Nothing was read" : "What we read"}</p>
        {!simulated && (
          <span className="tnum rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}>
            {ocr.confidence}%
          </span>
        )}
      </div>

      {simulated && (
        <p
          role="alert"
          className="flex items-start gap-2 border-b px-5 py-3 text-[12px] leading-relaxed"
          style={{ borderColor: "var(--line)", background: "color-mix(in oklab, #e11d48 8%, transparent)" }}
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#e11d48" }} strokeWidth={2.4} />
          <span>
            <strong className="font-semibold text-ink">These details are not from your card.</strong> No text-recognition
            key is configured on this server, so the fields below were generated as placeholders and your photograph was
            never actually read. Do not treat them as your details.
          </span>
        </p>
      )}

      <dl className="divide-y" style={{ borderColor: "var(--line)" }}>
        {[
          ["Name", ocr.fullName],
          ["ID number", ocr.idNumber],
          ["Date of birth", ocr.dob],
          ["Serial number", ocr.serial],
        ].map(([label, value]) => (
          <div key={label as string} className="flex items-baseline gap-4 px-5 py-2.5" style={{ borderColor: "var(--line)" }}>
            <dt className="w-[110px] shrink-0 text-[11.5px] text-ink-faint">{label}</dt>
            <dd className={`flex-1 text-[13.5px] font-semibold ${value ? "text-ink" : "text-ink-faint"} ${label === "ID number" || label === "Serial number" ? "tnum" : ""}`}>
              {value || "not found"}
            </dd>
          </div>
        ))}
      </dl>

      {(onUse || onRetake) && (
        <div className="flex gap-2.5 border-t px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
          {onRetake && (
            <button
              type="button"
              onClick={onRetake}
              className="flex-1 rounded-xl border py-2.5 text-[13px] font-semibold transition-colors hover:bg-surface-sunk"
              style={{ borderColor: "var(--line-strong)" }}
            >
              Take it again
            </button>
          )}
          {onUse && (
            <button
              type="button"
              onClick={onUse}
              disabled={!ocr.idNumber}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-opacity disabled:opacity-50"
              style={{ background: "var(--lime)", color: "var(--navy-deep)" }}
            >
              Use this number
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default IdCapture;
