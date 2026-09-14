// ─────────────────────────────────────────────────────────────────────────────
// TALKING TO RIRI — the console's voice hook, trimmed for a phone.
//
// Ported from connected-suite/src/lib/hooks/useVoice.ts. LISTENING is the
// browser's own Web Speech API: free, on-device, and it already speaks Kiswahili,
// which matters more on a customer's phone than on an officer's desk. SPEAKING is
// the browser's own synthesis only — the console's neural voice sits behind a
// staff route, and a customer surface does not borrow a staff credential.
//
// What is spoken is not what is shown: bold markers and numbered steps are for the
// eye, and `speakable()` turns them into a sentence for the ear.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type VoiceLang = "en-KE" | "sw-KE";

type SpeechRecLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognizer(): SpeechRecLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecLike; webkitSpeechRecognition?: new () => SpeechRecLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function speakable(markdown: string, maxChars = 600): string {
  let t = markdown
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^\s*(\d+)\.\s+/gm, (_, n) => `Step ${n}. `)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[👋🙂]/gu, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (t.length > maxChars) t = `${t.slice(0, maxChars).replace(/[^.?!]*$/, "")} There's more on the screen.`;
  return t;
}

const noop = () => () => {};

export function useVoice(opts: { onTranscript: (text: string) => void }) {
  // Capability is an external fact about the browser, read once, not copied into state.
  const supported = useSyncExternalStore(noop, () => Boolean(recognizer()), () => false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [lang, setLang] = useState<VoiceLang>("en-KE");
  const rec = useRef<SpeechRecLike | null>(null);
  const onTranscript = useRef(opts.onTranscript);
  useEffect(() => {
    onTranscript.current = opts.onTranscript;
  }, [opts.onTranscript]);

  const stopListening = useCallback(() => {
    try {
      rec.current?.stop();
    } catch {
      /* already stopped */
    }
    rec.current = null;
    setListening(false);
  }, []);

  const listen = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }
    const r = recognizer();
    if (!r) return;
    r.lang = lang;
    r.continuous = false;
    r.interimResults = false;
    let heard = "";
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
    };
    r.onerror = () => setListening(false);
    r.onend = () => {
      setListening(false);
      rec.current = null;
      const said = heard.trim();
      if (said) onTranscript.current(said);
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, [listening, lang, stopListening]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (markdown: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const text = speakable(markdown);
      if (!text) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "sw-KE" ? "sw" : "en-GB";
      u.rate = 1.02;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [lang],
  );

  useEffect(
    () => () => {
      stopListening();
      stopSpeaking();
    },
    [stopListening, stopSpeaking],
  );

  return { supported, listening, speaking, lang, setLang, listen, speak, stopSpeaking };
}
