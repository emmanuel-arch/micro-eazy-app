// ─────────────────────────────────────────────────────────────────────────────
// THE FRONT CAMERA — a live preview, a face guide, and one frame on demand.
//
// Used by the selfie and by the liveness gestures. A live preview rather than a
// file picker because both steps are about the PERSON in front of the phone at
// this moment: a gallery upload is how yesterday's photograph of somebody else
// becomes today's selfie.
//
// ── WHEN THE CAMERA WILL NOT OPEN ───────────────────────────────────────────
// Permission refused, an in-app browser with no getUserMedia, a laptop with no
// webcam. The step must still be completable — it is required — so the fallback
// is the handset's own camera through `capture="user"`, which on a phone opens
// the front camera directly and never offers the gallery.
//
// Frames are downscaled to 1280px on the long edge at q0.85: plenty for face
// comparison, and a few hundred kilobytes on a prepaid bundle.
// ─────────────────────────────────────────────────────────────────────────────
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera as CameraIcon, RefreshCw, VideoOff } from "lucide-react";

export type Frame = { dataUrl: string; bytes: number };

export interface CameraHandle {
  /** Grab the frame currently on screen. Null if the preview is not live. */
  grab: () => Frame | null;
  live: boolean;
}

const MAX_EDGE = 1280;

function toFrame(source: CanvasImageSource, w: number, h: number, mirror: boolean): Frame {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not process the photo.");
  if (mirror) {
    // The preview is mirrored so it behaves like a mirror; the frame sent must
    // not be, or a turn to the left arrives as a turn to the right.
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, cw, ch);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const bytes = Math.round(((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 3) / 4);
  return { dataUrl, bytes };
}

export async function fileToFrame(file: File): Promise<Frame> {
  const bitmap = await createImageBitmap(file);
  const f = toFrame(bitmap, bitmap.width, bitmap.height, false);
  bitmap.close?.();
  return f;
}

export const Camera = forwardRef<
  CameraHandle,
  {
    /** Shown over the preview — the instruction for this frame. */
    prompt?: string;
    /** For the fallback: a photo taken with the handset's own camera. */
    onFile?: (f: Frame) => void;
    className?: string;
  }
>(function Camera({ prompt, onFile, className = "" }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"starting" | "live" | "blocked">("starting");

  const start = useCallback(async () => {
    setState("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera api");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      setState("live");
    } catch {
      setState("blocked");
    }
  }, []);

  useEffect(() => {
    void start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [start]);

  useImperativeHandle(
    ref,
    () => ({
      live: state === "live",
      grab: () => {
        const v = videoRef.current;
        if (!v || state !== "live" || !v.videoWidth) return null;
        return toFrame(v, v.videoWidth, v.videoHeight, true);
      },
    }),
    [state],
  );

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`} style={{ aspectRatio: "4 / 3" }}>
      <video
        ref={videoRef}
        playsInline
        muted
        className="h-full w-full object-cover"
        style={{ transform: "scaleX(-1)", opacity: state === "live" ? 1 : 0 }}
      />

      {/* The face guide. An oval the size a comparison engine wants the face. */}
      {state === "live" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            className="rounded-[50%] border-[3px] border-dashed"
            style={{ width: "46%", height: "76%", borderColor: "rgb(255 255 255 / 0.75)", boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.32)" }}
          />
        </div>
      )}

      {prompt && state === "live" && (
        <p className="absolute inset-x-3 top-3 rounded-full bg-black/60 px-3.5 py-2 text-center text-[13px] font-semibold text-white backdrop-blur">
          {prompt}
        </p>
      )}

      {state === "starting" && (
        <div className="absolute inset-0 grid place-items-center text-[12.5px] text-white/70">Opening your camera…</div>
      )}

      {state === "blocked" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: "var(--surface-sunk)" }}>
          <VideoOff className="h-6 w-6 text-ink-faint" strokeWidth={2} />
          <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-ink-soft">
            We could not open your camera here. Allow camera access and try again, or take the photo with your phone's own
            camera.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void start()}
              className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
            {onFile && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold"
                style={{ background: "var(--brand)", color: "var(--brand-on)" }}
              >
                <CameraIcon className="h-3.5 w-3.5" /> Use my phone's camera
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file && onFile) onFile(await fileToFrame(file));
            }}
          />
        </div>
      )}
    </div>
  );
});

export default Camera;
