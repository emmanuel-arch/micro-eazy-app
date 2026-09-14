// ─────────────────────────────────────────────────────────────────────────────
// RIRI'S DOCK — the customer's first contact, bottom-right, on every signed-in screen.
//
// The console's ServiceSuite OS, ported to the borrower app so the customer and the
// officer who answers them are holding the same object (connected-suite/src/
// components/os/ServiceSuiteOS.tsx). A floating Riri you can drag to either corner;
// a phone that opens out of her with a real back button and a real home button; the
// apps a borrower actually reaches for.
//
// ── WHAT CHANGED ON THE WAY OVER, AND WHY ───────────────────────────────────
//
// 1. IT OPENS ON THE CONVERSATION, NOT A LOCK SCREEN. The officer's device opens
//    locked on a morning briefing because the briefing is the product for staff. A
//    customer came to ask something. Riri is the first contact — so she is already
//    listening, with her opening line on the glass: what she can do, and that a
//    person is one message away if she can't.
//
// 2. SHE HANDS OVER, SHE DOES NOT DEFLECT. Every answer that is not fully resolved
//    carries the offer; a money dispute carries it as the next step; "let me talk to
//    a person" is done before the reply renders. Plan §07: an assistant that argues
//    about being replaced is the thing everyone hates about assistants.
//
// 3. IT CLEARS THE APP'S OWN CHROME. On a phone the thumb bar owns the bottom 88px;
//    above `lg` the lender's legal bar owns the foot of the frame. The launcher sits
//    above whichever is there, so it never covers the disclosure a regulator reads.
//
// WHAT DID NOT CHANGE: Autopilot is opt-in, navigation only, and stops at the door.
// Riri can take a customer to Repay; she cannot press Pay now.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Navigation, PenLine, UserRound, X } from "lucide-react";
import { useSession } from "../../lib/session";
import { useLender } from "../../lib/lender";
import { home as readHome, myThreads, type HomeResponse, type ThreadSummary } from "../../lib/api/portal";
import { askRiri, escalateRiri, ririFeedback, ririHello, type RiriAction, type RiriHello, type RiriLang } from "../../lib/riri/api";
import { setWhyHere } from "../../lib/riri/whyHere";
import { useVoice } from "../../lib/riri/voice";
import { PhoneShell } from "./PhoneShell";
import { RiriAvatar } from "./RiriAvatar";
import { useOsNav, ROUTE_TITLES } from "./nav";
import { appByRoute, type DeviceApp } from "./apps";
import { AskScreen, AskComposer, type Turn } from "./screens/Ask";
import { HomeScreen } from "./screens/Home";
import { AccountScreen, HelpScreen, InboxScreen, SettingsScreen } from "./screens/Panels";
import { HandoffSheet } from "./HandoffSheet";

const SIZE = 60;
const GAP = 12;
const SIDE = 16;

// ── The browser, read as an external store ──────────────────────────────────
const subscribeNothing = () => () => {};
let vpCache = { w: 1280, h: 800 };
function subscribeViewport(onChange: () => void) {
  const onResize = () => {
    if (vpCache.w !== window.innerWidth || vpCache.h !== window.innerHeight) {
      vpCache = { w: window.innerWidth, h: window.innerHeight };
      onChange();
    }
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}
function viewportSnapshot() {
  if (vpCache.w !== window.innerWidth || vpCache.h !== window.innerHeight) vpCache = { w: window.innerWidth, h: window.innerHeight };
  return vpCache;
}

const PREF = "me.riri.";
function pref(key: string): string | null {
  try {
    return localStorage.getItem(PREF + key);
  } catch {
    return null;
  }
}
function setPref(key: string, v: string) {
  try {
    localStorage.setItem(PREF + key, v);
  } catch {
    /* private mode */
  }
}

/** Used when the server cannot be asked who she is — she still opens, honestly. */
const FALLBACK = (lender: string): RiriHello => ({
  success: true,
  enabled: true,
  name: "Riri",
  lender,
  opener: {
    en: `I'm Riri. I can help with your loan, your repayments, your limit, M-PESA Ratiba, and how Micro Eazy works — straight from your own account. If I find something I can't solve, I'll pass it to a person at ${lender} with everything I've already checked.`,
    sw: `Mimi ni Riri. Naweza kukusaidia na mkopo wako, malipo yako, kiwango chako, M-PESA Ratiba, na jinsi Micro Eazy inavyofanya kazi. Nikikutana na jambo nisiloweza kulitatua, nitalipeleka kwa mtu ${lender} pamoja na yote niliyokwisha kuangalia.`,
  },
  prompts: {
    en: ["What do I owe?", "When is my next payment?", "Do I need to dial *334# for Ratiba?", "How much can I borrow?", "Where is my application?", "I want to talk to a person"],
    sw: ["Nadaiwa kiasi gani?", "Nilipe lini?", "Ratiba ni nini?", "Naweza kukopa kiasi gani?", "Ombi langu liko wapi?", "Nataka kuongea na mtu"],
  },
});

export function RiriDock() {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const vp = useSyncExternalStore(subscribeViewport, viewportSnapshot, () => vpCache);
  const session = useSession();
  const lender = useLender();
  const go = useNavigate();
  const { pathname } = useLocation();

  const [open, setOpen] = useState(() => pref("open") === "1");
  const [corner, setCorner] = useState<"br" | "bl">(() => (pref("corner") === "bl" ? "bl" : "br"));
  const [greet, setGreet] = useState(() => pref("greeted") !== "1");
  const [voiceOn, setVoiceOn] = useState(() => pref("voice") === "1");
  const [autoGo, setAutoGo] = useState(() => pref("autogo") === "1");
  const [lang, setLang] = useState<RiriLang>(() => (pref("lang") === "sw" ? "sw" : "en"));
  const [langForced, setLangForced] = useState(() => pref("langForced") === "1");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const [hello, setHello] = useState<RiriHello | null>(null);
  // Opens on the conversation. `start` is only ever written by the dev preview harness.
  const nav = useOsNav(pref("start") === "home" ? { name: "home" } : { name: "ask" });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [flight, setFlight] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Turn | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  const [homeData, setHomeData] = useState<HomeResponse | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const who = hello ?? FALLBACK(lender.name);
  const name = who.name;

  useEffect(() => setPref("open", open ? "1" : "0"), [open]);
  useEffect(() => setPref("corner", corner), [corner]);
  useEffect(() => setPref("voice", voiceOn ? "1" : "0"), [voiceOn]);
  useEffect(() => setPref("autogo", autoGo ? "1" : "0"), [autoGo]);
  useEffect(() => setPref("lang", lang), [lang]);
  useEffect(() => setPref("langForced", langForced ? "1" : "0"), [langForced]);

  useEffect(() => {
    if (!flight) return;
    const t = window.setTimeout(() => setFlight(null), 2400);
    return () => window.clearTimeout(t);
  }, [flight]);

  // ── Who she is here — once, a beat after the page the customer asked for. ──
  useEffect(() => {
    let live = true;
    const t = window.setTimeout(() => {
      ririHello()
        .then((h) => live && setHello(h))
        .catch(() => live && setHello(null));
    }, 600);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [lender.slug]);

  // ── The badge: unread replies, from our own conversation table only. ───────
  // Never the lender's book on a timer — that read belongs to screens a customer
  // opened, not to a bubble sitting in the corner of every page.
  const loadThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const r = await myThreads();
      setThreads(r.threads);
    } catch {
      /* the badge simply stays as it was */
    } finally {
      setThreadsLoading(false);
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void loadThreads(), 1500);
    return () => window.clearTimeout(t);
  }, [loadThreads]);
  const unread = threads.reduce((n, t) => n + t.unread, 0);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      setHomeData(await readHome(session.nationalId ?? ""));
    } catch (e) {
      setHomeError(e instanceof Error ? e.message : "Could not read your account.");
    } finally {
      setHomeLoading(false);
    }
  }, [session.nationalId]);

  const onRoute = nav.route.name;
  useEffect(() => {
    if (!open) return;
    if ((onRoute === "home" || onRoute === "account") && !homeData && !homeLoading) {
      const t = window.setTimeout(() => void loadHome(), 0);
      return () => window.clearTimeout(t);
    }
    if (onRoute === "inbox") {
      const t = window.setTimeout(() => void loadThreads(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open, onRoute, homeData, homeLoading, loadHome, loadThreads]);

  const narrow = vp.w < 1024;
  const dismissGreet = () => {
    setGreet(false);
    setPref("greeted", "1");
  };

  // ── Moving the page — navigation only, and always with the reason. ────────
  const navigateTo = useCallback(
    (href: string, label: string, question: string) => {
      const to = href === "/" ? `/${lender.slug}` : href;
      setWhyHere({ question, from: name, path: to });
      setFlight(label.replace(/^(Open|Fungua)\s+/, ""));
      go(to);
      if (narrow) window.setTimeout(() => setOpen(false), 450);
    },
    [go, lender.slug, name, narrow],
  );

  const voiceRef = useRef<(q: string) => void>(() => {});
  const voice = useVoice({ onTranscript: (text) => voiceRef.current(text) });

  // ── Asking ────────────────────────────────────────────────────────────────
  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      if (nav.route.name !== "ask") nav.launch({ name: "ask" });

      const id = crypto.randomUUID();
      setTurns((t) => [...t, { id, question, loading: true }]);
      setInput("");
      setBusy(true);
      const patch = (fn: (x: Turn) => Turn) => setTurns((t) => t.map((x) => (x.id === id ? fn(x) : x)));

      try {
        const history = turns.flatMap((t) => [
          { role: "user" as const, text: t.question },
          ...(t.data?.answer ? [{ role: "model" as const, text: t.data.answer }] : []),
        ]);
        const data = await askRiri({ question, route: pathname, history, lang: langForced ? lang : undefined, nationalId: session.nationalId });
        patch((x) => ({ ...x, loading: false, data }));
        if (!langForced && data.lang !== lang) setLang(data.lang);
        if (voiceOn) voice.speak(data.answer);
        if (data.escalation) void loadThreads();

        // AUTOPILOT — opt-in, navigation only, and only for an answer that IS a
        // destination. Moving somebody to Repay because they asked about a fee
        // would be the rudest thing this dock does.
        const first = data.actions[0];
        if (autoGo && first && (data.intent === "navigate" || data.intent === "screen")) navigateTo(first.href, first.label, question);
      } catch (e) {
        patch((x) => ({ ...x, loading: false, error: e instanceof Error && e.message ? e.message : "I couldn't reach the server. Try again." }));
      } finally {
        setBusy(false);
      }
    },
    [busy, nav, turns, pathname, lang, langForced, session.nationalId, voiceOn, voice, autoGo, navigateTo, loadThreads],
  );
  useEffect(() => {
    voiceRef.current = (q: string) => void ask(q);
  });

  const newConversation = () => {
    setTurns([]);
    setInput("");
    nav.launch({ name: "ask" });
  };

  const feedback = (t: Turn, helpful: boolean) => {
    setTurns((all) => all.map((x) => (x.id === t.id ? { ...x, feedback: helpful ? "up" : "down" } : x)));
    void ririFeedback({ question: t.question, helpful, source: t.data?.sources[0]?.id, intent: t.data?.intent }).catch(() => {});
  };

  const sendHandoff = async (note: string) => {
    if (!sheet) return;
    setSheetBusy(true);
    const target = sheet.id;
    const upTo = turns.slice(0, turns.findIndex((x) => x.id === target) + 1).map((x) => x.question);
    try {
      const r = await escalateRiri({ questions: upTo, route: pathname, note, nationalId: session.nationalId });
      setTurns((all) => all.map((x) => (x.id === target ? { ...x, handoff: r.success && r.threadId && r.caseRef ? { caseRef: r.caseRef, threadId: r.threadId, message: r.message } : { error: r.message } } : x)));
      if (r.success) void loadThreads();
      setSheet(null);
    } catch (e) {
      setTurns((all) => all.map((x) => (x.id === target ? { ...x, handoff: { error: e instanceof Error ? e.message : "That did not send. Try again." } } : x)));
      setSheet(null);
    } finally {
      setSheetBusy(false);
    }
  };

  const openThread = (threadId: string) => {
    go(`/messages/${threadId}`);
    if (narrow) setOpen(false);
  };

  const openApp = (app: DeviceApp) => {
    if (app.route) nav.launch({ name: app.route });
    else if (app.href) navigateTo(app.href, app.name, app.name);
  };

  // ── Opening from anywhere: [data-riri-open], or a `riri:open` event ────────
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
  });
  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = ((e as CustomEvent).detail ?? {}) as { prompt?: string; draft?: string };
      setOpen(true);
      setGreet(false);
      setPref("greeted", "1");
      navRef.current.launch({ name: "ask" });
      if (typeof detail.draft === "string") setInput(detail.draft);
      if (typeof detail.prompt === "string" && detail.prompt.trim()) {
        const p = detail.prompt.trim();
        window.setTimeout(() => void askRef.current(p), 320);
      }
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-riri-open]");
      if (!el) return;
      e.preventDefault();
      onEvent(new CustomEvent("riri:open", { detail: { prompt: el.getAttribute("data-riri-open") || undefined } }));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("riri:open", onEvent);
    document.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("riri:open", onEvent);
      document.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // ── The launcher, draggable to either corner ─────────────────────────────
  // At rest it is anchored with CSS `bottom` and `right`/`left`, never with a top
  // computed from innerHeight: a phone's URL bar changes the viewport height under
  // the page, and a launcher positioned from a stale height ends up sitting on the
  // composer it is meant to open. Only a drag in progress uses coordinates.
  const bottom = narrow ? 92 : 58;
  const pos = drag
    ? { left: drag.x, top: drag.y }
    : corner === "br"
      ? { right: SIDE, bottom }
      : { left: SIDE, bottom };
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const onDown = (e: ReactPointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    down.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!down.current) return;
    if (!down.current.moved && Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 6) return;
    down.current.moved = true;
    setDrag({ x: Math.min(vp.w - SIZE, Math.max(0, e.clientX - SIZE / 2)), y: Math.min(vp.h - SIZE, Math.max(0, e.clientY - SIZE / 2)) });
  };
  const onUp = (e: ReactPointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    if (!d.moved) {
      setOpen((o) => !o);
      dismissGreet();
      return;
    }
    setCorner(e.clientX < vp.w / 2 ? "bl" : "br");
    setDrag(null);
  };

  if (!mounted) return null;
  // The lender switched first response off: no dock — and every "Ask Riri" in the
  // app must still reach a person, so the open event becomes the direct composer.
  if (hello && !hello.enabled) return <DirectFallback />;

  const sideStyle = corner === "br" ? { right: SIDE } : { left: SIDE };
  const panelBottom = bottom + SIZE + GAP;
  const route = nav.route.name;
  const sw = lang === "sw";
  const title = route === "home" ? name : route === "ask" ? name : appByRoute(route)?.name ?? ROUTE_TITLES[route];
  const subtitle =
    route === "home" ? lender.name
      : route === "ask" ? (turns.length ? (sw ? "Kwenye mazungumzo" : "In conversation") : sw ? "Niko tayari · jibu la kwanza" : "Here first · a person if you need one")
        : route === "inbox" ? `${threads.length} ${sw ? "mazungumzo" : threads.length === 1 ? "conversation" : "conversations"}`
          : appByRoute(route)?.blurb ?? "";
  const questions = turns.map((t) => t.question);

  return (
    <>
      {/* First-run nudge — her line, and the escape hatch. */}
      <AnimatePresence>
        {greet && !open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={() => {
              setOpen(true);
              dismissGreet();
            }}
            style={{ ...sideStyle, bottom: panelBottom }}
            className="fixed z-[45] max-w-[262px] rounded-2xl border border-line px-3.5 py-2.5 text-left shadow-xl backdrop-blur"
            aria-label={`Open ${name}`}
          >
            <span className="absolute inset-0 -z-10 rounded-2xl" style={{ background: "var(--os-paper-soft)" }} />
            <p className="text-[13px] font-semibold text-ink">
              {sw ? "Niaje" : "Hi"}{session.firstName ? ` ${session.firstName.split(" ")[0]}` : ""} 👋 {sw ? `Mimi ni ${name}` : `I'm ${name}`}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
              {sw
                ? `Niulize chochote kuhusu mkopo wako ${lender.short}. Nisipoweza kulitatua, nitakuunganisha na mtu.`
                : `Ask me anything about your ${lender.short} loan. If I can't sort it out, I'll get you to a person.`}
            </p>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                dismissGreet();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  dismissGreet();
                }
              }}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* THE DEVICE */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="riri-device"
            initial={{ opacity: 0, scale: 0.9, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            role="dialog"
            aria-label={name}
            style={{
              ...sideStyle,
              bottom: panelBottom,
              transformOrigin: corner === "br" ? "bottom right" : "bottom left",
              width: `min(400px, calc(100vw - ${SIDE * 2}px))`,
              height: `min(708px, calc(100dvh - ${panelBottom + 12}px))`,
            }}
            className="fixed z-[45]"
          >
            <PhoneShell
              title={title}
              subtitle={subtitle}
              atHome={nav.atHome}
              onBack={nav.atHome ? null : nav.pop}
              backLabel={nav.backLabel}
              onHome={nav.home}
              onClose={() => setOpen(false)}
              busy={busy && route === "ask"}
              leading={
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full shadow ring-2 ring-white">
                  <RiriAvatar size={36} state={busy ? "thinking" : "listening"} name={name} />
                </div>
              }
              action={
                route === "ask" ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAutoGo((v) => !v)}
                      title={autoGo ? "Autopilot on — I move the screen when I answer" : "Autopilot off — I offer a button, you tap it"}
                      aria-pressed={autoGo}
                      className={`flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-bold transition-colors ${autoGo ? "text-white shadow-sm" : "text-ink-soft hover:text-ink"}`}
                      style={autoGo ? { backgroundColor: "var(--brand)" } : { background: "var(--line)" }}
                    >
                      <Navigation className={`h-3 w-3 ${autoGo ? "dock-pulse" : ""}`} /> AUTO
                    </button>
                    {turns.length > 0 && (
                      <button type="button" onClick={newConversation} title="Start again" aria-label="Start a new conversation" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint hover:bg-[var(--line)] hover:text-ink">
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ) : route === "home" ? (
                  <button type="button" onClick={() => nav.push({ name: "settings" })} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-[var(--line)] hover:text-ink" aria-label="Settings">
                    <UserRound className="h-4 w-4" />
                  </button>
                ) : null
              }
              footer={
                route === "ask" ? (
                  <AskComposer
                    input={input}
                    busy={busy}
                    lang={lang}
                    autoGo={autoGo}
                    voice={{ supported: voice.supported, listening: voice.listening, speaking: voice.speaking, listen: voice.listen }}
                    onInput={setInput}
                    onAsk={(q) => void ask(q)}
                  />
                ) : null
              }
              overlay={
                <AnimatePresence>
                  {sheet && (
                    <HandoffSheet
                      lender={lender.name}
                      questions={questions.slice(0, turns.findIndex((x) => x.id === sheet.id) + 1)}
                      lang={lang}
                      busy={sheetBusy}
                      onCancel={() => setSheet(null)}
                      onSend={(note) => void sendHandoff(note)}
                    />
                  )}
                </AnimatePresence>
              }
            >
              {/* Not mode="wait" — see Screen in kit.tsx for why screens layer instead. */}
              <AnimatePresence initial={false}>
                {route === "home" && (
                  <HomeScreen key="home" lender={lender.name} firstName={session.firstName ?? homeData?.firstName ?? null} lang={lang} data={homeData ? { ...homeData, unreadMessages: Math.max(homeData.unreadMessages, unread) } : null} onOpen={openApp} />
                )}
                {route === "ask" && (
                  <AskScreen
                    key="ask"
                    name={name}
                    opener={who.opener[lang]}
                    prompts={who.prompts[lang]}
                    lang={lang}
                    turns={turns}
                    flight={flight}
                    onAsk={(q) => void ask(q)}
                    onNavigate={(a: RiriAction, q: string) => navigateTo(a.href, a.label, q)}
                    onFeedback={feedback}
                    onHandoff={(t) => setSheet(t)}
                    onOpenThread={openThread}
                  />
                )}
                {route === "account" && (
                  <AccountScreen
                    key="account"
                    data={homeData}
                    loading={homeLoading}
                    error={homeError}
                    lang={lang}
                    onAsk={(q) => void ask(q)}
                    onRefresh={() => void loadHome()}
                    onGo={(href, label) => navigateTo(href, label, label)}
                  />
                )}
                {route === "inbox" && <InboxScreen key="inbox" threads={threads} loading={threadsLoading} lang={lang} onOpen={(t) => openThread(t.id)} />}
                {route === "help" && <HelpScreen key="help" lang={lang} onAsk={(q) => void ask(q)} />}
                {route === "settings" && (
                  <SettingsScreen
                    key="settings"
                    lang={lang}
                    onLang={() => {
                      setLang((l) => (l === "en" ? "sw" : "en"));
                      setLangForced(true);
                      voice.setLang(lang === "en" ? "sw-KE" : "en-KE");
                    }}
                    voiceOn={voiceOn}
                    onVoice={() => {
                      if (voice.speaking) voice.stopSpeaking();
                      setVoiceOn((v) => !v);
                    }}
                    voiceSupported={voice.supported}
                    autoGo={autoGo}
                    onAutoGo={() => setAutoGo((v) => !v)}
                    corner={corner}
                    onCorner={() => setCorner((c) => (c === "br" ? "bl" : "br"))}
                  />
                )}
              </AnimatePresence>
            </PhoneShell>
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE LAUNCHER */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{ ...pos, width: SIZE, height: SIZE, touchAction: "none" }}
        className="fixed z-[46] cursor-grab select-none active:cursor-grabbing"
        title={open ? `Close ${name}` : `Ask ${name}`}
        role="button"
        aria-label={open ? `Close ${name}` : `Ask ${name}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
            dismissGreet();
          }
        }}
      >
        {!open && <span className="riri-halo pointer-events-none absolute inset-0 rounded-full" style={{ background: "var(--brand)", opacity: 0.28 }} />}
        <div className={`relative h-full w-full rounded-full ring-2 ring-white ${open ? "" : "riri-float"}`} style={{ boxShadow: "0 12px 32px rgb(0 0 0 / 0.26)" }}>
          <div className="h-full w-full overflow-hidden rounded-full">
            <RiriAvatar size={SIZE} state={busy ? "thinking" : "idle"} name={name} />
          </div>
          {open ? (
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white ring-2 ring-white">
              <X className="h-3.5 w-3.5" />
            </span>
          ) : unread > 0 ? (
            <span className="os-badge absolute -right-1 -top-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : (
            <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          )}
          {busy && !open && <span className="riri-orbit-dot pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: "var(--brand)" }} />}
        </div>
      </div>
    </>
  );
}

/**
 * When a lender has turned Riri's first response off, nothing in the app may become
 * a dead button. Every place that would open Riri opens the direct composer instead.
 */
function DirectFallback() {
  const go = useNavigate();
  useEffect(() => {
    const onOpen = () => go("/messages/new?direct=1");
    window.addEventListener("riri:open", onOpen);
    return () => window.removeEventListener("riri:open", onOpen);
  }, [go]);
  return null;
}

export default RiriDock;
