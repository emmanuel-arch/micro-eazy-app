// ─────────────────────────────────────────────────────────────────────────────
// PROVE THERE IS A PERSON HERE — two gestures, one frame each.
//
// Runs only for a lender who switched active liveness on. A photograph of a
// photograph can match a face; it cannot turn its head when asked. The server
// hands out the gestures (seeded by the session, so a refresh does not re-roll
// them until one comes up easy), judges each frame for the pose AND compares it
// with the selfie already in the vault — so the face that turns is the face that
// was matched to the ID.
//
// What comes back is which gesture did not land and why, in words. Never a score.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Camera, type CameraHandle, type Frame } from "./Camera";
import { livenessChallenges, submitLiveness } from "../../lib/api/portal";
import { LiquidButton } from "../ui/LiquidButton";

type Challenge = { key: string; say: string; hint: string };
type Verdict = { passed: boolean; engine: string; frames: { challenge: string; passed: boolean; says: string | null }[] };

export function Liveness({ sessionId, onPassed }: { sessionId?: string; onPassed: () => void }) {
  const cam = useRef<CameraHandle>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const [frames, setFrames] = useState<(Frame & { challenge: string })[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  useEffect(() => {
    let live = true;
    livenessChallenges(sessionId)
      .then((r) => live && setChallenges(r.challenges ?? []))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "We could not start the check."));
    return () => {
      live = false;
    };
  }, [sessionId]);

  const current = challenges?.[n] ?? null;

  // A three-second count, so the gesture is held when the frame is taken rather
  // than half-made.
  useEffect(() => {
    if (count == null) return;
    if (count === 0) {
      const f = cam.current?.grab();
      setCount(null);
      if (!f || !current) {
        setError("We could not take the photo. Allow the camera and try again.");
        return;
      }
      setFrames((fs) => [...fs, { ...f, challenge: current.key }]);
      setN((i) => i + 1);
      return;
    }
    const t = setTimeout(() => setCount((c) => (c == null ? null : c - 1)), 900);
    return () => clearTimeout(t);
  }, [count, current]);

  const allTaken = challenges != null && challenges.length > 0 && frames.length >= challenges.length;

  async function send() {
    if (!challenges) return;
    setBusy(true);
    setError(null);
    try {
      const r = await submitLiveness(
        sessionId,
        frames.map((f) => ({ challenge: f.challenge, image: f.dataUrl, bytes: f.bytes })),
      );
      if (r.liveness) {
        setVerdict(r.liveness);
        if (r.liveness.passed) onPassed();
      } else {
        setError(r.message ?? "We could not check those photos.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not check those photos.");
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setFrames([]);
    setN(0);
    setVerdict(null);
    setError(null);
  };

  if (!challenges && !error) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing your check…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!allTaken && current && (
        <>
          <Camera ref={cam} prompt={count != null ? `${current.say} · ${count}` : current.say} />
          <p className="text-[12px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">
              Gesture {n + 1} of {challenges!.length}:
            </span>{" "}
            {current.hint}
          </p>
          <LiquidButton size="lg" block disabled={count != null} onClick={() => setCount(3)}>
            {count != null ? `Hold it… ${count}` : `I'm ready — ${current.say.toLowerCase()}`}
          </LiquidButton>
        </>
      )}

      {allTaken && !verdict && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {frames.map((f, i) => (
              <figure key={i} className="overflow-hidden rounded-xl" style={{ background: "var(--surface-sunk)" }}>
                <img src={f.dataUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-2.5 py-1.5 text-[11px] text-ink-faint">
                  {challenges!.find((c) => c.key === f.challenge)?.say}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 rounded-xl border py-3 text-[13px] font-semibold"
              style={{ borderColor: "var(--line-strong)" }}
            >
              Take them again
            </button>
            <LiquidButton size="lg" className="flex-1" loading={busy} disabled={busy} onClick={send}>
              {busy ? "Checking" : "Send for checking"}
            </LiquidButton>
          </div>
        </>
      )}

      {verdict && (
        <div className="space-y-2">
          {verdict.frames.map((f) => (
            <p key={f.challenge} className="flex items-start gap-2 text-[12.5px] leading-snug">
              {f.passed ? (
                <CheckCircle2 className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--green-ink)" }} />
              ) : (
                <TriangleAlert className="mt-px h-4 w-4 shrink-0" style={{ color: "#e11d48" }} />
              )}
              <span>
                <span className="font-semibold">{challenges?.find((c) => c.key === f.challenge)?.say ?? f.challenge}.</span>{" "}
                <span className="text-ink-soft">{f.passed ? "That worked." : f.says ?? "That did not come through clearly."}</span>
              </span>
            </p>
          ))}
          {!verdict.passed && (
            <button
              type="button"
              onClick={reset}
              className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-[13px] font-semibold"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <RefreshCw className="h-4 w-4" /> Try the gestures again
            </button>
          )}
          {verdict.engine !== "aws-rekognition" && (
            <p className="text-[11px] text-ink-faint">Checked in simulation on this server.</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-[12.5px] font-medium" style={{ color: "#e11d48" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default Liveness;
