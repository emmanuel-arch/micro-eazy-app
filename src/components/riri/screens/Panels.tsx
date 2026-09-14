// ─────────────────────────────────────────────────────────────────────────────
// THE SMALLER APPS — My account, Messages, Help, Settings.
//
// Each is a glance and a door, never a second copy of a full screen. My account
// reads the SAME /api/portal/home the Home screen renders, so the phone and the page
// behind it cannot disagree about a balance; every row can be handed to Riri as a
// question. Messages lists real conversations and opens them in the page. Help is
// the app's own FAQ, and tapping a question asks Riri rather than showing a static
// paragraph — so the answer comes stamped and followed up like any other.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Wallet, Gauge, PiggyBank, TrendingUp, Route as RouteIcon, AlertTriangle, RefreshCw, Inbox, MessageSquare,
  Mic, Languages, Navigation, MoveHorizontal, Volume2, HelpCircle,
} from "lucide-react";
import { Screen, SectionLabel, Row, EmptyState } from "../kit";
import type { HomeResponse, ThreadSummary } from "../../../lib/api/portal";
import { money, sinceNow } from "../../../lib/format";
import { FAQS } from "../../../lib/help/content";
import type { RiriLang } from "../../../lib/riri/api";

export function AccountScreen({
  data, loading, error, lang, onAsk, onRefresh, onGo,
}: {
  data: HomeResponse | null;
  loading: boolean;
  error: string | null;
  lang: RiriLang;
  onAsk: (q: string) => void;
  onRefresh: () => void;
  onGo: (href: string, label: string) => void;
}) {
  const sw = lang === "sw";
  if (loading && !data) return <Screen><EmptyState icon={<RefreshCw className="h-6 w-6 animate-spin" />} title={sw ? "Nasoma akaunti yako…" : "Reading your account…"} detail={sw ? "Moja kwa moja kutoka kwa mkopeshaji wako." : "Straight from your lender's book."} /></Screen>;
  if (error || !data) {
    return (
      <Screen>
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title={sw ? "Sikuweza kusoma akaunti yako" : "I couldn't read your account"}
          detail={error ?? (sw ? "Jaribu tena baada ya muda." : "Try again in a moment.")}
          action={<button type="button" onClick={onRefresh} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: "var(--brand)" }}>{sw ? "Jaribu tena" : "Try again"}</button>}
        />
      </Screen>
    );
  }
  const unavailable = data.bookSource === "unavailable";
  return (
    <Screen className="os-scroll overflow-y-auto py-3">
      <div className="space-y-2">
        {unavailable && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-400/40 px-3 py-2.5 text-[11.5px] leading-snug text-ink" style={{ background: "color-mix(in oklab, #f59e0b 10%, transparent)" }}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            {sw ? `Sikuweza kufikia ${data.lender} sasa hivi. Hii si salio la sifuri.` : `I couldn't reach ${data.lender} just now. That is not a zero balance.`}
          </div>
        )}
        <SectionLabel>{sw ? "Pesa" : "Money"}</SectionLabel>
        <Row
          icon={<Wallet className="h-4 w-4" />}
          title={unavailable ? "—" : money(data.outstanding)}
          detail={data.activeLoan ? `${sw ? "Unadaiwa" : "Owed"} · ${data.activeLoan.product ?? (sw ? "mkopo" : "loan")}` : sw ? "Unadaiwa" : "Owed"}
          onClick={() => onAsk(sw ? "Nadaiwa kiasi gani?" : "What do I owe?")}
        />
        <Row
          icon={<TrendingUp className="h-4 w-4" />}
          title={data.limit > 0 ? money(data.available) : "—"}
          detail={data.limit > 0 ? `${sw ? "Inapatikana kati ya" : "Available of"} ${money(data.limit)}` : sw ? "Bado huna kiwango" : "No limit yet"}
          onClick={() => onAsk(sw ? "Naweza kukopa kiasi gani?" : "How much can I borrow?")}
        />
        <Row
          icon={<PiggyBank className="h-4 w-4" />}
          title={data.savings ? money(data.savings.balance) : "—"}
          detail={sw ? "Akiba" : "Savings"}
          onClick={() => onAsk(sw ? "Akiba yangu ni kiasi gani?" : "What are my savings?")}
        />
        <SectionLabel className="pt-1.5">{sw ? "Hali" : "Standing"}</SectionLabel>
        <Row
          icon={<Gauge className="h-4 w-4" />}
          title={data.score != null ? `${data.score} / ${data.scoreMax}` : "—"}
          detail={data.band ?? (sw ? "Alama" : "Score")}
          onClick={() => onAsk(sw ? "Alama yangu ni ngapi?" : "What is my score?")}
        />
        <Row
          icon={<RouteIcon className="h-4 w-4" />}
          title={data.application ? data.application.stageTitle ?? data.application.status : sw ? "Hakuna ombi" : "No application"}
          detail={data.application ? `${money(data.application.amount)} · ${data.application.product ?? ""}` : sw ? "Omba ukiwa tayari" : "Apply when you're ready"}
          onClick={() => (data.application ? onGo("/track", sw ? "Ombi" : "Application") : onGo("/apply", "Apply now"))}
        />
        <p className="px-1 pt-1 text-center text-[9.5px] leading-snug text-ink-faint">
          {sw ? "Gusa safu yoyote ili kumuuliza Riri kuihusu." : "Tap any row to ask Riri about it."}
        </p>
      </div>
    </Screen>
  );
}

export function InboxScreen({
  threads, loading, lang, onOpen,
}: {
  threads: ThreadSummary[];
  loading: boolean;
  lang: RiriLang;
  onOpen: (t: ThreadSummary) => void;
}) {
  const sw = lang === "sw";
  if (loading && threads.length === 0) return <Screen><EmptyState icon={<RefreshCw className="h-6 w-6 animate-spin" />} title={sw ? "Inapakia…" : "Loading…"} detail="" /></Screen>;
  if (threads.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title={sw ? "Bado huna mazungumzo" : "No conversations yet"}
          detail={sw ? "Niulize kwanza — nisipoweza kulitatua, nitalipeleka kwa timu na litaonekana hapa." : "Ask me first — if I can't sort it, I'll pass it to the team and it will appear here."}
        />
      </Screen>
    );
  }
  return (
    <Screen className="os-scroll overflow-y-auto py-3">
      <div className="space-y-2">
        {threads.map((t) => (
          <Row
            key={t.id}
            icon={<MessageSquare className="h-4 w-4" />}
            title={t.subject}
            detail={`${t.lastAuthor === "borrower" ? (sw ? "Wewe: " : "You: ") : ""}${t.preview ?? ""} · ${sinceNow(t.lastAt)}`}
            badge={t.unread}
            onClick={() => onOpen(t)}
          />
        ))}
      </div>
    </Screen>
  );
}

export function HelpScreen({ lang, onAsk }: { lang: RiriLang; onAsk: (q: string) => void }) {
  const sw = lang === "sw";
  const extra = { title: "M-PESA Ratiba", items: [{ q: "Do I need to dial *334# to use Ratiba?", a: "" }, { q: "How do I stop or change my Ratiba standing order?", a: "" }, { q: "Does Ratiba cost me anything?", a: "" }] };
  return (
    <Screen className="os-scroll overflow-y-auto py-3">
      <div className="space-y-3">
        <p className="px-0.5 text-[11px] leading-snug text-ink-soft">
          {sw ? "Gusa swali na Riri atalijibu kutoka kwa akaunti yako." : "Tap a question and Riri answers it — from your own account where it matters."}
        </p>
        {[...FAQS, extra].map((g) => (
          <div key={g.title} className="space-y-1.5">
            <SectionLabel>{g.title}</SectionLabel>
            {g.items.map((it) => (
              <Row key={it.q} icon={<HelpCircle className="h-4 w-4" />} title={it.q} onClick={() => onAsk(it.q)} />
            ))}
          </div>
        ))}
      </div>
    </Screen>
  );
}

export function SettingsScreen({
  lang, onLang, voiceOn, onVoice, voiceSupported, autoGo, onAutoGo, corner, onCorner,
}: {
  lang: RiriLang;
  onLang: () => void;
  voiceOn: boolean;
  onVoice: () => void;
  voiceSupported: boolean;
  autoGo: boolean;
  onAutoGo: () => void;
  corner: "br" | "bl";
  onCorner: () => void;
}) {
  const sw = lang === "sw";
  const Toggle = ({ on }: { on: boolean }) => (
    <span className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: on ? "var(--brand)" : "var(--line-strong)" }}>
      <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" style={{ left: on ? 18 : 2 }} />
    </span>
  );
  return (
    <Screen className="os-scroll overflow-y-auto py-3">
      <div className="space-y-2">
        <SectionLabel>{sw ? "Mazungumzo" : "Conversation"}</SectionLabel>
        <Row icon={<Languages className="h-4 w-4" />} title={sw ? "Lugha" : "Language"} detail={lang === "sw" ? "Kiswahili" : "English"} right={<span className="text-[11px] font-semibold text-ink-soft">{lang === "sw" ? "SW" : "EN"}</span>} onClick={onLang} />
        {voiceSupported && <Row icon={<Volume2 className="h-4 w-4" />} title={sw ? "Riri azungumze majibu" : "Read answers aloud"} detail={sw ? "Sauti ya kivinjari chako" : "Your browser's own voice"} right={<Toggle on={voiceOn} />} onClick={onVoice} />}
        {voiceSupported && <Row icon={<Mic className="h-4 w-4" />} title={sw ? "Ongea na Riri" : "Talk to Riri"} detail={sw ? "Bonyeza maikrofoni kwenye kisanduku" : "Press the microphone in the composer"} />}
        <SectionLabel className="pt-1.5">Autopilot</SectionLabel>
        <Row
          icon={<Navigation className="h-4 w-4" />}
          title={sw ? "Riri asogeze skrini" : "Let Riri move the screen"}
          detail={sw ? "Hupeleka tu — kamwe habonyezi kitufe" : "It only takes you there — it never presses a button"}
          right={<Toggle on={autoGo} />}
          onClick={onAutoGo}
        />
        <SectionLabel className="pt-1.5">{sw ? "Mwonekano" : "Placement"}</SectionLabel>
        <Row icon={<MoveHorizontal className="h-4 w-4" />} title={sw ? "Kona" : "Corner"} detail={corner === "br" ? (sw ? "Chini kulia" : "Bottom right") : sw ? "Chini kushoto" : "Bottom left"} onClick={onCorner} />
      </div>
    </Screen>
  );
}
