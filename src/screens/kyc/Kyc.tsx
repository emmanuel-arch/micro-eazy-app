// ─────────────────────────────────────────────────────────────────────────────
// KYC VERIFICATION — the lender's onboarding rules, to the letter, one pane at a time.
//
// ── THE SCREEN HOLDS NO RULES OF ITS OWN ────────────────────────────────────
// Every step here is derived from the ONBOARDING CONTRACT the server builds for
// the "portal" channel — the same derivation the console's counter renders
// (connected-suite/src/lib/config/onboarding-contract.ts). Which identity rail
// opens (card read, national registry, typed), whether the back of the card is
// asked for, whether a selfie and live gestures run, which fields are required,
// the lender's own questions, referees, location — all of it comes from there.
// A step the lender has not switched on is not in the list: it is never shown
// and never counted. A step they have switched on cannot be walked past.
//
// ── NOTHING HERE DECIDES ANYTHING ───────────────────────────────────────────
// The server re-checks every rule on register and decides the outcome on
// finalize, against the session it holds. This screen is the road; the gates
// are on the server.
//
// Order, and why: consent before any check runs · identity (it is what the face
// and the registry are compared against) · the back of the card · the selfie ·
// the gestures (they are compared with the selfie) · your details (prefilled
// from what was just verified) · location · review and submit · the outcome.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Camera as CameraIcon, CheckCircle2, Clock, FileSpreadsheet, IdCard, Loader2,
  MapPin, MessageSquare, RefreshCw, ScanFace, ShieldCheck, TriangleAlert, UserRound, Users,
} from "lucide-react";
import { FlowScreen, Notice, StepCard, type FlowStep } from "../../components/flow/FlowScreen";
import { Field, TextInput, Tick, inputClass } from "../../components/flow/Fields";
import { LiquidButton } from "../../components/ui/LiquidButton";
import { IdCapture, IdReadout, prepare, type IdCaptureResult } from "../../components/kyc/IdCapture";
import { Camera, type CameraHandle, type Frame } from "../../components/kyc/Camera";
import { Liveness } from "../../components/kyc/Liveness";
import { LocationPins } from "../../components/kyc/LocationPins";
import { Sky } from "../../components/shell/Sky";
import {
  finalizeKyc, journey, matchSelfie, readIdBack, register, registryLookup,
  type DetailItem, type FaceMatchResult, type GeoPin, type JourneyResponse, type KycFieldKey, type KycFinal,
} from "../../lib/api/portal";
import { useLender } from "../../lib/lender";

// ── LOADING ────────────────────────────────────────────────────────────────────

export default function Kyc() {
  const [state, setState] = useState<{ s: "loading" } | { s: "error"; message: string } | { s: "ready"; j: JourneyResponse }>({ s: "loading" });

  const load = useCallback(() => {
    setState({ s: "loading" });
    journey()
      .then((j) => setState({ s: "ready", j }))
      .catch((e: unknown) => setState({ s: "error", message: e instanceof Error ? e.message : "We could not load your verification." }));
  }, []);
  useEffect(load, [load]);

  if (state.s === "loading") return <Holding title="KYC verification" line="Reading your lender's onboarding rules…" />;
  if (state.s === "error") return <Holding title="KYC verification" line={state.message} onRetry={load} />;

  const { j } = state;
  const b = j.status.borrower;
  // Settled means an ACCOUNT exists with a finished check. A session that was
  // verified by the old funnel but never registered still has to open one.
  const settled = j.existingCustomer || b?.kycStatus === "VERIFIED" || b?.kycStatus === "PENDING_REVIEW";
  if (settled) return <Settled j={j} />;
  return <KycFlow j={j} onReload={load} />;
}

export function Holding({ title, line, onRetry }: { title: string; line: string; onRetry?: () => void }) {
  return (
    <>
      <Sky title={title} />
      <div className="relative z-10 -mt-12 px-4">
        <section className="card mx-auto flex max-w-[620px] flex-col items-center gap-3 px-5 py-10 text-center">
          {onRetry ? <TriangleAlert className="h-6 w-6" style={{ color: "#b45309" }} /> : <Loader2 className="h-6 w-6 animate-spin text-ink-faint" />}
          <p className="max-w-[40ch] text-[13px] leading-relaxed text-ink-soft">{line}</p>
          {onRetry && (
            <LiquidButton size="md" icon={RefreshCw} onClick={onRetry}>
              Try again
            </LiquidButton>
          )}
        </section>
      </div>
    </>
  );
}

/** Already through — verified, with our team, or verified by the lender at a branch. */
function Settled({ j }: { j: JourneyResponse }) {
  const go = useNavigate();
  const lender = useLender();
  const b = j.status.borrower;
  const pending = b?.kycStatus === "PENDING_REVIEW" || j.status.kyc?.status === "PENDING_REVIEW";
  const onlySignOff = pending && (j.status.kyc?.flags ?? []).every((f) => f === "manualReview");
  const next = j.status.next;

  const title = j.existingCustomer && !b ? `Verified by ${lender.short}` : pending ? "Your ID is with our team" : "You are verified";
  const line = j.existingCustomer && !b
    ? `Your identity was verified when you opened your ${lender.short} account. There is nothing more to do here.`
    : pending
      ? onlySignOff
        ? "Every check passed. A member of our team signs off every new customer before money moves — you can carry on meanwhile."
        : "A person is looking at your ID. We will message you the moment it clears."
      : "Your identity checks are complete.";

  const steps: FlowStep[] = [
    {
      id: "done",
      label: "Verification",
      title: "KYC verification",
      blurb: title,
      node: (
        <div className="grid gap-3 lg:grid-cols-2">
          <StepCard
            icon={pending ? <Clock className="h-[18px] w-[18px]" style={{ color: "#b45309" }} /> : <BadgeCheck className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />}
            title={title}
          >
            <p className="text-[13px] leading-relaxed text-ink-soft">{line}</p>
            {j.status.kyc && (
              <dl className="mt-4 space-y-2 text-[12.5px]">
                {j.status.kyc.nationalId && <Row k="ID number" v={j.status.kyc.nationalId} />}
                <Row k="Card read" v={j.status.kyc.idRead ? "Done" : "Not needed"} />
                <Row k="National registry" v={j.status.kyc.registry == null ? "Not run" : j.status.kyc.registry ? "Confirmed" : "No match"} />
                <Row k="Selfie" v={j.status.kyc.selfie ? "Matched" : "Not needed"} />
              </dl>
            )}
          </StepCard>
          <StepCard icon={<ArrowRight className="h-[18px] w-[18px] text-ink-faint" />} title="What comes next">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              {next === "crunch"
                ? "Read your M-PESA statement. It sets your starting limit, and takes about a minute."
                : next === "track"
                  ? "Your application is moving. Follow it through every stage."
                  : "You are ready to choose a loan."}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <LiquidButton
                size="lg"
                block
                icon={next === "crunch" ? FileSpreadsheet : undefined}
                trailingIcon={ArrowRight}
                onClick={() => go(next === "crunch" ? "/crunch" : next === "track" ? "/track" : "/apply")}
              >
                {next === "crunch" ? "Read my statement" : next === "track" ? "Track my application" : "Apply now"}
              </LiquidButton>
              {pending && (
                <LiquidButton size="lg" variant="metal" icon={MessageSquare} onClick={() => go("/messages")}>
                  Messages
                </LiquidButton>
              )}
            </div>
          </StepCard>
        </div>
      ),
    },
  ];
  return <FlowScreen label="KYC verification" steps={steps} at={0} reachable={0} onAt={() => {}} />;
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-b-0" style={{ borderColor: "var(--line)" }}>
    <dt className="text-ink-faint">{k}</dt>
    <dd className="tnum font-semibold">{v}</dd>
  </div>
);

// ── THE FLOW ───────────────────────────────────────────────────────────────────

type StepId = "consent" | "identity" | "id-back" | "selfie" | "liveness" | "details" | "location" | "review" | "result";

const FIELD_LABEL: Partial<Record<KycFieldKey, string>> = {
  firstName: "First name",
  otherName: "Other names",
  dob: "Date of birth",
  gender: "Gender",
  email: "Email address",
  postalAddress: "Postal address",
  physicalAddress: "Where you live",
  occupation: "What you do for a living",
  businessName: "Business name",
};

/** "12.03.1990", "12/03/1990" or "1990-03-12" → "1990-03-12" for a date input. */
function isoDob(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

function ageOn(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

/** "JULIA CHEBET KOECH" → "J•••• C••••• K••••" — enough to recognise, not enough to learn. */
const maskName = (n: string) =>
  n.split(/\s+/).filter(Boolean).map((w) => `${w[0]}${"•".repeat(Math.max(2, w.length - 1))}`).join(" ");

function KycFlow({ j, onReload }: { j: JourneyResponse; onReload: () => void }) {
  const go = useNavigate();
  const lender = useLender();
  const c = j.contract;
  const held = j.status.kyc;

  // ── WHICH RAIL ───────────────────────────────────────────────────────────
  // The contract has already chosen a reachable primary. The bureau rail has no
  // self-serve identity step (a bureau pull needs an account), so it runs as a
  // typed ID confirmed by the card photograph.
  const rail: "ocr" | "iprs" | "manual" = c.primary === "iprs" ? "iprs" : c.primary === "ocr" ? "ocr" : "manual";
  // A lender with no national-registry integration: nothing on these screens may
  // say a number was, or will be, checked against the registry.
  const registryOn = c.capabilities?.registry !== "off";
  const needsCardPhoto =
    rail === "ocr" || c.flags.idPhotoRequired || c.documents.some((d) => d.code === "ID_FRONT") || c.ocr.capture === "both";
  const wantsSelfie = c.selfie.required || c.flags.faceMatch;
  const wantsLiveness = c.flags.liveness;
  const places = c.geo.places.length ? c.geo.places : (["business"] as ("business" | "home")[]);
  const geoRequired = c.geo.required || c.flags.requireGeoPin;
  const wantsGeo = c.geo.ask || geoRequired;

  // ── WHAT HAS BEEN DONE ───────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | undefined>(held?.sessionId);
  const [consent, setConsent] = useState(false);
  const [idNumber, setIdNumber] = useState(held?.nationalId ?? j.status.borrower?.nationalId ?? "");
  const [registry, setRegistry] = useState<{ matched: boolean; name: string | null; dob: string | null; gender: string | null; engine: string; note: string } | null>(null);
  const [cardRead, setCardRead] = useState<IdCaptureResult | null>(null);
  const [backStored, setBackStored] = useState(false);
  const [face, setFace] = useState<FaceMatchResult["faceMatch"] | null>(null);
  const [livePassed, setLivePassed] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [nok, setNok] = useState({ name: "", phone: "", relationship: "" });
  const [referees, setReferees] = useState(() =>
    Array.from({ length: Math.max(1, c.flags.referees?.min ?? 0) }, () => ({ name: "", phone: "", relationship: "" })),
  );
  const [details, setDetails] = useState<Record<string, string | number | boolean | string[] | null>>({});
  const [geoConsent, setGeoConsent] = useState(false);
  const [pins, setPins] = useState<Partial<Record<"business" | "home", GeoPin | null>>>({});
  const [final, setFinal] = useState<KycFinal | null>(null);

  // ── THE STEPS THIS LENDER ASKS FOR ───────────────────────────────────────
  const order = useMemo<StepId[]>(() => {
    const s: StepId[] = ["consent", "identity"];
    if (c.ocr.capture === "both") s.push("id-back");
    if (wantsSelfie) s.push("selfie");
    if (wantsLiveness) s.push("liveness");
    s.push("details");
    if (wantsGeo) s.push("location");
    s.push("review", "result");
    return s;
  }, [c.ocr.capture, wantsSelfie, wantsLiveness, wantsGeo]);

  const [at, setAt] = useState(0);
  const [reachable, setReachable] = useState(0);
  const idx = (id: StepId) => order.indexOf(id);
  const advance = (from: StepId) => {
    const next = idx(from) + 1;
    setReachable((r) => Math.max(r, next));
    setAt(next);
  };

  // Prefill details from what was verified, the moment it is known.
  const verifiedName = registry?.matched ? registry.name : cardRead?.ocr.fullName ?? held?.name ?? null;
  const verifiedDob = isoDob(registry?.dob ?? cardRead?.ocr.dob);
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || (!verifiedName && !verifiedDob)) return;
    prefilled.current = true;
    const [first, ...rest] = (verifiedName ?? "").split(/\s+/).filter(Boolean);
    const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    setForm((f) => ({
      ...f,
      ...(first && !f.firstName ? { firstName: cap(first) } : {}),
      ...(rest.length && !f.otherName ? { otherName: rest.map(cap).join(" ") } : {}),
      ...(verifiedDob && !f.dob ? { dob: verifiedDob } : {}),
      ...(registry?.gender && !f.gender ? { gender: /^f/i.test(registry.gender) ? "F" : "M" } : {}),
    }));
  }, [verifiedName, verifiedDob, registry?.gender]);

  const nameLocked = Boolean(registry?.matched && registry.engine === "live") || (Boolean(cardRead) && !c.ocr.allowEdit);

  // ── SUBMIT ───────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; step?: StepId } | null>(null);

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await register({
        firstName: form.firstName, otherName: form.otherName, nationalId: idNumber, dob: form.dob, gender: form.gender,
        email: form.email, occupation: form.occupation, businessName: form.businessName,
        postalAddress: form.postalAddress, physicalAddress: form.physicalAddress,
        nextOfKin: nok.name.trim() ? nok : null,
        referees: referees.filter((x) => x.name.trim() || x.phone.trim()),
        details,
        geo: { consent: geoConsent, business: pins.business ?? null, home: pins.home ?? null },
        onboardingMethod: rail,
        consent: { identityChecks: consent, location: geoConsent },
      });
      if (!r.success) throw Object.assign(new Error(r.message ?? "We could not open your account."), { body: r });
      const f = await finalizeKyc(sessionId, idNumber);
      setFinal(f);
      advance("review");
    } catch (e) {
      const body = (e as { body?: { field?: string; message?: string; missing?: string[]; issues?: unknown[] } }).body;
      const field = body?.field;
      const step: StepId | undefined =
        field === "geo" ? "location" : field === "nationalId" ? "identity" : field || body?.missing || body?.issues ? "details" : undefined;
      setSubmitError({ message: body?.message ?? (e instanceof Error ? e.message : "We could not open your account."), step });
    } finally {
      setSubmitting(false);
    }
  }

  // ── THE PANES ────────────────────────────────────────────────────────────
  const checks = [
    rail === "ocr" && "We read the front of your ID card.",
    (rail === "iprs" || rail === "ocr") && registryOn && "We confirm your ID number and name with the national registry (IPRS).",
    needsCardPhoto && rail !== "ocr" && "You photograph the front of your ID card.",
    c.ocr.capture === "both" && "You photograph the back of your ID card.",
    wantsSelfie && "You take a selfie, which we match to the photo on your ID.",
    wantsLiveness && "You make two quick gestures on camera, to show a real person is present.",
    wantsGeo && `You share your location at your ${places.join(" and ")}.`,
    c.flags.requireReview && `A member of the ${lender.short} team signs off your identity before any money moves.`,
  ].filter(Boolean) as string[];

  const panes: Record<StepId, Omit<FlowStep, "id">> = {
    consent: {
      label: "Your permission",
      title: "Your permission",
      blurb: "What we check, who we ask, and what happens to the answer.",
      required: true,
      why: "A licensed lender must know who it lends to. The same checks run for every customer, at a branch or on this app.",
      node: (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <StepCard icon={<ShieldCheck className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />} title={`What ${lender.short} checks`}>
            <ul className="space-y-2.5">
              {checks.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[13px] leading-snug">
                  <CheckCircle2 className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--green-ink)" }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-faint">
              Every check is recorded on your file with the date and the reason. Photographs are kept in a private vault and
              are never shared outside {lender.name}.
            </p>
          </StepCard>
          <StepCard icon={<BadgeCheck className="h-[18px] w-[18px] text-ink-faint" />} title="Your permission">
            <Tick checked={consent} onChange={setConsent}>
              I permit {lender.name} to verify my identity using the checks listed, including a lookup against the national
              registry, and to keep the photographs I take for its records.
            </Tick>
            <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} disabled={!consent} onClick={() => advance("consent")}>
              {consent ? "Start" : "Tick the box to start"}
            </LiquidButton>
          </StepCard>
        </div>
      ),
    },

    identity: {
      label: "Your ID",
      title: rail === "ocr" ? "Scan your ID" : "Your ID number",
      blurb: rail === "ocr" ? "The front of the card. Lay it flat and fill the frame." : "The number on the front of your card.",
      required: true,
      why: "The document is what the registry check and the face match are both compared against.",
      node: (
        <IdentityStep
          rail={rail}
          registryOn={registryOn}
          needsCardPhoto={needsCardPhoto}
          allowOverride={c.allowManualOverride}
          idNumber={idNumber}
          setIdNumber={setIdNumber}
          consent={consent}
          sessionId={sessionId}
          setSessionId={setSessionId}
          registry={registry}
          setRegistry={setRegistry}
          cardRead={cardRead}
          setCardRead={setCardRead}
          onDone={() => advance("identity")}
        />
      ),
    },

    "id-back": {
      label: "Back of ID",
      title: "The back of your ID",
      blurb: "Turn the card over. Same again — flat, and all four corners in.",
      required: true,
      why: `${lender.short} keeps both sides of the card on file.`,
      node: <BackStep sessionId={sessionId} stored={backStored} onStored={() => { setBackStored(true); advance("id-back"); }} />,
    },

    selfie: {
      label: "Selfie",
      title: "Take a selfie",
      blurb: "Front on, eyes open, in good light — matched to the photo on your ID.",
      required: true,
      why: "Without it, the ID proves a document exists, not that you are the person holding it.",
      node: <SelfieStep sessionId={sessionId} result={face} onResult={setFace} onDone={() => advance("selfie")} />,
    },

    liveness: {
      label: "Live check",
      title: "Two quick gestures",
      blurb: "Follow each instruction on camera. It takes about ten seconds.",
      required: true,
      why: "A printed photo can match a face. It cannot turn its head when asked.",
      node: (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <StepCard icon={<ScanFace className="h-[18px] w-[18px]" style={{ color: "var(--brand-ink)" }} />} title="Live check">
            <Liveness sessionId={sessionId} onPassed={() => setLivePassed(true)} />
          </StepCard>
          <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px] text-ink-faint" />} title="When it passes">
            <p className="text-[12.5px] leading-relaxed text-ink-soft">Both gestures are checked against your selfie, so the face that moves is the face that matched your ID.</p>
            <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} disabled={!livePassed} onClick={() => advance("liveness")}>
              {livePassed ? "Continue" : "Complete both gestures"}
            </LiquidButton>
          </StepCard>
        </div>
      ),
    },

    details: {
      label: "Your details",
      title: "Your details",
      blurb: "Only what your lender needs that we do not already hold.",
      required: true,
      why: `These are the fields ${lender.short} requires to open an account — the same form an officer fills at the counter.`,
      node: (
        <DetailsStep
          j={j}
          form={form}
          setForm={setForm}
          nameLocked={nameLocked}
          nok={nok}
          setNok={setNok}
          referees={referees}
          setReferees={setReferees}
          details={details}
          setDetails={setDetails}
          onDone={() => advance("details")}
        />
      ),
    },

    location: {
      label: "Location",
      title: "Your location",
      blurb: `Pin your ${places.join(" and ")} from where you are standing.`,
      required: geoRequired,
      why: "A loan is visited where the customer works. A pin taken on the spot is one an officer can actually find.",
      node: (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <StepCard icon={<MapPin className="h-[18px] w-[18px]" style={{ color: "var(--brand-ink)" }} />} title="Pin your location">
            <Tick checked={geoConsent} onChange={setGeoConsent}>
              I permit {lender.name} to record my location for my account.
            </Tick>
            {geoConsent && (
              <div className="mt-3">
                <LocationPins places={places} value={pins} onChange={(p, pin) => setPins((x) => ({ ...x, [p]: pin }))} />
              </div>
            )}
          </StepCard>
          <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px] text-ink-faint" />} title="Continue">
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              {geoRequired
                ? `${lender.short} needs at least one pin before your account can open.`
                : "You can share it now, or an officer will ask when they visit."}
            </p>
            <LiquidButton
              size="lg"
              block
              className="mt-4"
              trailingIcon={ArrowRight}
              disabled={geoRequired && !(geoConsent && (pins.business || pins.home))}
              onClick={() => advance("location")}
            >
              {geoRequired && !(geoConsent && (pins.business || pins.home)) ? "Pin a location first" : "Continue"}
            </LiquidButton>
          </StepCard>
        </div>
      ),
    },

    review: {
      label: "Review",
      title: "Check and submit",
      blurb: "One look before we open your account.",
      required: true,
      node: (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <StepCard icon={<UserRound className="h-[18px] w-[18px] text-ink-faint" />} title="What you are submitting">
            <dl className="space-y-2 text-[12.5px]">
              <Row k="ID number" v={idNumber || "—"} />
              <Row k="Name" v={[form.firstName, form.otherName].filter(Boolean).join(" ") || verifiedName || "—"} />
              {form.dob && <Row k="Date of birth" v={form.dob} />}
              {rail !== "manual" && registryOn && <Row k="Registry" v={registry ? (registry.matched ? "Confirmed" : "No match") : cardRead?.step.registryFound ? "Confirmed" : cardRead ? "No match" : "—"} />}
              {needsCardPhoto && <Row k="ID photo" v={cardRead ? "Taken" : "—"} />}
              {c.ocr.capture === "both" && <Row k="Back of ID" v={backStored ? "Taken" : "—"} />}
              {wantsSelfie && <Row k="Selfie" v={face ? (face.band === "match" ? "Matched" : face.band === "review" ? "For review" : "Did not match") : "—"} />}
              {wantsLiveness && <Row k="Live check" v={livePassed ? "Passed" : "—"} />}
              {wantsGeo && <Row k="Location" v={pins.business || pins.home ? "Pinned" : "Not shared"} />}
            </dl>
          </StepCard>
          <StepCard icon={<ShieldCheck className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} />} title="Submit">
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              We open your account with {lender.name} and run the final identity decision. {c.flags.requireReview ? "A member of the team then signs it off." : ""}
            </p>
            {submitError && (
              <div className="mt-3">
                <Notice tone="bad" icon={<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#e11d48" }} />}>
                  {submitError.message}
                  {submitError.step && (
                    <button type="button" onClick={() => setAt(idx(submitError.step!))} className="ml-1 font-semibold underline">
                      Fix it
                    </button>
                  )}
                </Notice>
              </div>
            )}
            <LiquidButton size="lg" block className="mt-4" loading={submitting} disabled={submitting} onClick={submit}>
              {submitting ? "Submitting" : "Submit my verification"}
            </LiquidButton>
          </StepCard>
        </div>
      ),
    },

    result: {
      label: "Outcome",
      title: final?.status === "VERIFIED" ? "You are verified" : final?.status === "FAILED" ? "We could not verify you" : "With our team",
      blurb: "What happened, and what comes next.",
      node: (
        <ResultStep
          final={final}
          onRetake={() => {
            setFace(null);
            setCardRead(null);
            setFinal(null);
            setReachable(idx("identity"));
            setAt(idx("identity"));
          }}
          onNext={() => go("/crunch")}
          onReload={onReload}
        />
      ),
    },
  };

  const steps: FlowStep[] = order.map((id) => ({ id, ...panes[id] }));
  return (
    <FlowScreen
      label="KYC verification"
      steps={steps}
      at={at}
      reachable={order[at] === "result" ? at : Math.min(reachable, idx("review"))}
      onAt={(n) => order[at] !== "result" && setAt(Math.min(n, reachable))}
    />
  );
}

// ── IDENTITY ───────────────────────────────────────────────────────────────────

function IdentityStep(props: {
  rail: "ocr" | "iprs" | "manual";
  registryOn: boolean;
  needsCardPhoto: boolean;
  allowOverride: boolean;
  idNumber: string;
  setIdNumber: (v: string) => void;
  consent: boolean;
  sessionId?: string;
  setSessionId: (v: string) => void;
  registry: { matched: boolean; name: string | null; engine: string; note: string } | null;
  setRegistry: (r: { matched: boolean; name: string | null; dob: string | null; gender: string | null; engine: string; note: string } | null) => void;
  cardRead: IdCaptureResult | null;
  setCardRead: (r: IdCaptureResult | null) => void;
  onDone: () => void;
}) {
  const { rail, registryOn, needsCardPhoto, allowOverride, idNumber, setIdNumber, consent, sessionId, setSessionId, registry, setRegistry, cardRead, setCardRead, onDone } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [capturing, setCapturing] = useState(rail === "ocr");
  const idOk = /^\d{6,10}$/.test(idNumber.trim());

  async function lookup() {
    setBusy(true);
    setError(null);
    try {
      const r = await registryLookup(idNumber.trim(), sessionId, consent);
      if (r.sessionId) setSessionId(r.sessionId);
      if (r.iprs) setRegistry(r.iprs);
      if (!r.iprs?.matched) setError(r.message ?? "We could not find that ID number in the national registry. Check the number on your card.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The registry check did not complete.");
    } finally {
      setBusy(false);
    }
  }

  // The typed-number part of the registry and manual rails.
  const numberCard = rail !== "ocr" && (
    <StepCard icon={<IdCard className="h-[18px] w-[18px]" style={{ color: "var(--brand-ink)" }} />} title="Your National ID number">
      <Field label="ID number" required hint="The number on the front of your card.">
        <TextInput
          inputMode="numeric"
          autoComplete="off"
          value={idNumber}
          onChange={(e) => {
            setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
            setRegistry(null);
            setConfirmed(false);
          }}
          placeholder="12345678"
          className="tnum text-[17px] tracking-[0.02em]"
        />
      </Field>

      {rail === "iprs" && !registry?.matched && (
        <LiquidButton size="lg" block className="mt-4" loading={busy} disabled={!idOk || busy} onClick={lookup}>
          {busy ? "Checking the registry" : "Check with the registry"}
        </LiquidButton>
      )}

      {rail === "iprs" && registry?.matched && (
        <div className="mt-4 space-y-3">
          <Notice tone="good" icon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--green-ink)" }} />}>
            The registry holds this number for <span className="font-semibold text-ink">{registry.name ? maskName(registry.name) : "a registered person"}</span>.
            {registry.engine !== "live" && <span className="block text-[11px] text-ink-faint">Checked in simulation on this server.</span>}
          </Notice>
          <Tick checked={confirmed} onChange={setConfirmed}>
            This is my ID and my name.
          </Tick>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] font-medium" style={{ color: "#e11d48" }}>
          {error}
        </p>
      )}
    </StepCard>
  );

  const numberDone = rail === "manual" ? idOk : rail === "iprs" ? Boolean(registry?.matched && confirmed) : true;
  const photoDone = !needsCardPhoto || Boolean(cardRead);
  const gateFailed = Boolean(cardRead && cardRead.step.gatePassed === false);
  const simulated = Boolean(cardRead && cardRead.ocr.engine !== "google-vision");
  const canContinue = numberDone && photoDone && (!gateFailed || allowOverride) && (rail !== "ocr" || idOk);

  const photoCard = needsCardPhoto && (rail === "ocr" || numberDone) && (
    <div className="space-y-3">
      {capturing || !cardRead ? (
        <IdCapture
          nationalId={idNumber || undefined}
          sessionId={sessionId}
          onRead={(r) => {
            if (r.sessionId) setSessionId(r.sessionId);
            setCardRead(r);
            setCapturing(false);
            if (r.ocr.idNumber && (rail === "ocr" || !idNumber)) setIdNumber(r.ocr.idNumber.replace(/\D/g, "").slice(0, 10));
          }}
        />
      ) : (
        <>
          <IdReadout ocr={cardRead.ocr} onRetake={() => { setCardRead(null); setCapturing(true); }} />
          {cardRead.step.idMismatch && (
            <Notice tone="warn" icon={<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#b45309" }} />}>
              The number on the card is not the number you typed. Check which is right before you continue.
            </Notice>
          )}
          {gateFailed && (
            <Notice tone="bad" icon={<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#e11d48" }} />}>
              {cardRead.step.message ?? "The registry did not confirm the name on this card."}{" "}
              {allowOverride ? "You can continue, and a person will review it." : "Retake the photo of your own ID card."}
            </Notice>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {numberCard}
        {photoCard}
      </div>
      <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px] text-ink-faint" />} title="Continue">
        {rail === "ocr" && simulated && (
          <div className="mb-3 space-y-2">
            <Field label="Type the ID number on your card" required>
              <TextInput inputMode="numeric" value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} className="tnum" />
            </Field>
          </div>
        )}
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          {rail === "ocr"
            ? registryOn ? "We read the card, then confirm the number and name with the national registry." : "We read the number and name straight off the card."
            : rail === "iprs"
              ? needsCardPhoto
                ? "Once the registry confirms your number, photograph the front of the card."
                : "The registry confirms that the number belongs to you."
              : needsCardPhoto
                ? "Type your number, then photograph the front of the card."
                : "Type the number exactly as it appears on your card."}
        </p>
        <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} disabled={!canContinue} onClick={onDone}>
          {canContinue ? (gateFailed ? "Continue to review" : "Continue") : "Finish this step first"}
        </LiquidButton>
      </StepCard>
    </div>
  );
}

// ── THE BACK OF THE CARD ───────────────────────────────────────────────────────

function BackStep({ sessionId, stored, onStored }: { sessionId?: string; stored: boolean; onStored: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const p = await prepare(file);
      setPreview(p.dataUrl);
      const r = await readIdBack(p.dataUrl, sessionId, { bytes: p.bytes, brightness: p.brightness, blurVar: p.blurVar });
      if (r.retake) setMsg("That photo came out unclear. Lay the card flat in good light and take it again.");
      else onStored();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "We could not send that photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <StepCard icon={<CameraIcon className="h-[18px] w-[18px]" style={{ color: "var(--brand-ink)" }} />} title="Back of your ID">
        <div className="relative w-full overflow-hidden rounded-xl border-2 border-dashed" style={{ aspectRatio: "1.585", borderColor: "var(--line-strong)", background: "var(--surface-sunk)" }}>
          {preview ? <img src={preview} alt="The back of your ID" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[12px] text-ink-faint">The back of your card goes here</div>}
          {busy && <div className="absolute inset-0 grid place-items-center bg-black/40 text-[12.5px] font-semibold text-white">Checking the photo…</div>}
        </div>
        {msg && <p role="alert" className="mt-3 text-[12.5px] font-medium" style={{ color: "#e11d48" }}>{msg}</p>}
        <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ""; }} />
        <LiquidButton size="lg" block className="mt-4" icon={CameraIcon} disabled={busy} onClick={() => input.current?.click()}>
          {preview ? "Take it again" : "Photograph the back"}
        </LiquidButton>
      </StepCard>
      <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px] text-ink-faint" />} title="Continue">
        <p className="text-[12.5px] leading-relaxed text-ink-soft">{stored ? "Stored. You can continue." : "The step completes as soon as a clear photo is stored."}</p>
        <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} disabled={!stored} onClick={onStored}>
          {stored ? "Continue" : "Photograph the back first"}
        </LiquidButton>
      </StepCard>
    </div>
  );
}

// ── THE SELFIE ─────────────────────────────────────────────────────────────────

function SelfieStep({
  sessionId, result, onResult, onDone,
}: {
  sessionId?: string;
  result: FaceMatchResult["faceMatch"] | null;
  onResult: (r: FaceMatchResult["faceMatch"] | null) => void;
  onDone: () => void;
}) {
  const cam = useRef<CameraHandle>(null);
  const [shot, setShot] = useState<Frame | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(f: Frame) {
    setShot(f);
    setBusy(true);
    setMsg(null);
    onResult(null);
    try {
      const r = await matchSelfie(f.dataUrl, sessionId, f.bytes);
      if (r.retake) {
        setMsg(r.message ?? "We could not see your face clearly. Face the camera in good light and try again.");
        setShot(null);
      } else if (r.faceMatch) {
        onResult(r.faceMatch);
      } else {
        setMsg(r.message ?? "We could not check that photo.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "We could not check that photo.");
      setShot(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <StepCard icon={<ScanFace className="h-[18px] w-[18px]" style={{ color: "var(--brand-ink)" }} />} title="Your selfie">
        {shot ? (
          <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: "4 / 3" }}>
            <img src={shot.dataUrl} alt="Your selfie" className="h-full w-full object-cover" />
            {busy && <div className="absolute inset-0 grid place-items-center bg-black/45 text-[12.5px] font-semibold text-white">Matching your face to your ID…</div>}
          </div>
        ) : (
          <Camera ref={cam} prompt="Fit your face inside the oval" onFile={(f) => void send(f)} />
        )}
        {msg && <p role="alert" className="mt-3 text-[12.5px] font-medium" style={{ color: "#e11d48" }}>{msg}</p>}
        <div className="mt-4">
          {shot && !busy ? (
            <button type="button" onClick={() => { setShot(null); onResult(null); }} className="w-full rounded-xl border py-3 text-[13px] font-semibold" style={{ borderColor: "var(--line-strong)" }}>
              Take it again
            </button>
          ) : (
            <LiquidButton size="lg" block icon={CameraIcon} disabled={busy} onClick={() => { const f = cam.current?.grab(); if (f) void send(f); else setMsg("The camera is not ready yet."); }}>
              Take my selfie
            </LiquidButton>
          )}
        </div>
      </StepCard>
      <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px] text-ink-faint" />} title="Continue">
        {result ? (
          <Notice
            tone={result.band === "match" ? "good" : result.band === "review" ? "warn" : "bad"}
            icon={result.band === "match" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--green-ink)" }} /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#b45309" }} />}
          >
            {result.band === "match"
              ? "Your face matches the photo on your ID."
              : result.band === "review"
                ? "It was not a clear match. You can retake it, or continue and a person will compare them."
                : "It did not match the photo on your ID. Retake it in good light, facing the camera."}
            {result.engine !== "aws-rekognition" && <span className="block text-[11px] text-ink-faint">Checked in simulation on this server.</span>}
          </Notice>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-ink-soft">No hat, no sunglasses, and nobody else in the picture.</p>
        )}
        <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} disabled={!result || busy} onClick={onDone}>
          {result ? "Continue" : "Take your selfie first"}
        </LiquidButton>
      </StepCard>
    </div>
  );
}

// ── DETAILS ────────────────────────────────────────────────────────────────────

function DetailsStep(props: {
  j: JourneyResponse;
  form: Record<string, string>;
  setForm: (f: (x: Record<string, string>) => Record<string, string>) => void;
  nameLocked: boolean;
  nok: { name: string; phone: string; relationship: string };
  setNok: (n: { name: string; phone: string; relationship: string }) => void;
  referees: { name: string; phone: string; relationship: string }[];
  setReferees: (r: { name: string; phone: string; relationship: string }[]) => void;
  details: Record<string, string | number | boolean | string[] | null>;
  setDetails: (f: (x: Record<string, string | number | boolean | string[] | null>) => Record<string, string | number | boolean | string[] | null>) => void;
  onDone: () => void;
}) {
  const { j, form, setForm, nameLocked, nok, setNok, referees, setReferees, details, setDetails, onDone } = props;
  const c = j.contract;
  const fields = c.fields.filter((f) => f.key !== "nationalId" && f.key !== "phone");
  const [touched, setTouched] = useState(false);

  const missing: string[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    if (f.key === "nextOfKin") {
      if (!nok.name.trim() || !nok.phone.trim()) missing.push(f.label);
    } else if (!(form[f.key] ?? "").trim()) missing.push(f.label);
  }
  const age = form.dob ? ageOn(form.dob) : null;
  const ageBad = c.age && age != null && (age < c.age.min || age > c.age.max);
  const emailBad = form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
  const refMin = c.flags.referees?.min ?? 0;
  const refComplete = referees.filter((r) => r.name.trim() && r.phone.replace(/\D/g, "").length >= 9).length;
  const detailMissing = c.detailGroups.flatMap((g) => g.items).filter((i) => {
    const v = details[i.code];
    return i.required && (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
  });
  const ok = missing.length === 0 && !ageBad && !emailBad && refComplete >= refMin && detailMissing.length === 0;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const input = (key: KycFieldKey, required: boolean, label: string, help?: string) => {
    const locked = nameLocked && (key === "firstName" || key === "otherName");
    const err = touched && required && !(form[key] ?? "").trim() ? "Required" : null;
    if (key === "gender") {
      return (
        <Field key={key} label={label} required={required} error={err}>
          <select className={inputClass} style={{ borderColor: "var(--line-strong)" }} value={form.gender ?? ""} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Choose</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </Field>
      );
    }
    return (
      <Field
        key={key}
        label={label}
        required={required}
        hint={locked ? "As the national registry holds it." : help}
        error={key === "dob" && ageBad ? `${j.lender} lends to customers aged ${c.age!.min} to ${c.age!.max}.` : key === "email" && emailBad ? "That email address does not look right." : err}
      >
        <TextInput
          type={key === "dob" ? "date" : key === "email" ? "email" : "text"}
          value={form[key] ?? ""}
          disabled={locked}
          onChange={(e) => set(key, e.target.value)}
        />
      </Field>
    );
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <StepCard icon={<UserRound className="h-[18px] w-[18px]" style={{ color: "var(--brand-ink)" }} />} title="About you">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.filter((f) => f.key !== "nextOfKin").map((f) => input(f.key, f.required, FIELD_LABEL[f.key] ?? f.label, f.help))}
          </div>
        </StepCard>

        {fields.some((f) => f.key === "nextOfKin") && (
          <StepCard icon={<Users className="h-[18px] w-[18px] text-ink-faint" />} title="Next of kin">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name" required={fields.find((f) => f.key === "nextOfKin")!.required}>
                <TextInput value={nok.name} onChange={(e) => setNok({ ...nok, name: e.target.value })} />
              </Field>
              <Field label="Phone" required={fields.find((f) => f.key === "nextOfKin")!.required}>
                <TextInput inputMode="tel" value={nok.phone} onChange={(e) => setNok({ ...nok, phone: e.target.value })} />
              </Field>
              <Field label="Relationship">
                <TextInput value={nok.relationship} onChange={(e) => setNok({ ...nok, relationship: e.target.value })} />
              </Field>
            </div>
          </StepCard>
        )}

        {c.flags.referees && (
          <StepCard icon={<Users className="h-[18px] w-[18px] text-ink-faint" />} title={`Referee${c.flags.referees.max === 1 ? "" : "s"}`} meta={<span className="text-[11.5px] text-ink-faint">{refComplete} of {refMin} needed</span>}>
            <div className="space-y-3">
              {referees.map((r, n) => (
                <div key={n} className="grid gap-3 sm:grid-cols-3">
                  <Field label="Name" required={n < refMin}>
                    <TextInput value={r.name} onChange={(e) => setReferees(referees.map((x, m) => (m === n ? { ...x, name: e.target.value } : x)))} />
                  </Field>
                  <Field label="Phone" required={n < refMin}>
                    <TextInput inputMode="tel" value={r.phone} onChange={(e) => setReferees(referees.map((x, m) => (m === n ? { ...x, phone: e.target.value } : x)))} />
                  </Field>
                  <Field label="Relationship">
                    <TextInput value={r.relationship} onChange={(e) => setReferees(referees.map((x, m) => (m === n ? { ...x, relationship: e.target.value } : x)))} />
                  </Field>
                </div>
              ))}
              {referees.length < c.flags.referees.max && (
                <button type="button" onClick={() => setReferees([...referees, { name: "", phone: "", relationship: "" }])} className="text-[12.5px] font-semibold" style={{ color: "var(--brand-ink)" }}>
                  Add another referee
                </button>
              )}
            </div>
          </StepCard>
        )}

        {c.detailGroups.map((g) => (
          <StepCard key={g.code} icon={<FileSpreadsheet className="h-[18px] w-[18px] text-ink-faint" />} title={g.title}>
            {g.description && <p className="mb-3 text-[12px] leading-snug text-ink-faint">{g.description}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {g.items.map((i) => (
                <DetailInput key={i.code} item={i} value={details[i.code]} touched={touched} onChange={(v) => setDetails((d) => ({ ...d, [i.code]: v }))} />
              ))}
            </div>
          </StepCard>
        ))}
      </div>

      <StepCard icon={<CheckCircle2 className="h-[18px] w-[18px] text-ink-faint" />} title="Continue">
        {touched && !ok ? (
          <Notice tone="warn" icon={<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#b45309" }} />}>
            {missing.length ? `Still needed: ${missing.join(", ")}.` : detailMissing.length ? `Still needed: ${detailMissing.map((d) => d.title).join(", ")}.` : refComplete < refMin ? `Add ${refMin} referee${refMin === 1 ? "" : "s"} with a phone number.` : "Check the fields marked in red."}
          </Notice>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-ink-soft">Fields marked * are required by {j.lender}. Everything else you may leave.</p>
        )}
        <LiquidButton size="lg" block className="mt-4" trailingIcon={ArrowRight} onClick={() => (ok ? onDone() : setTouched(true))}>
          Continue
        </LiquidButton>
      </StepCard>
    </div>
  );
}

function DetailInput({
  item, value, touched, onChange,
}: {
  item: DetailItem;
  value: string | number | boolean | string[] | null | undefined;
  touched: boolean;
  onChange: (v: string | number | boolean | string[] | null) => void;
}) {
  const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  const err = touched && item.required && empty ? "Required" : null;
  const common = { className: inputClass, style: { borderColor: "var(--line-strong)" } };

  let control;
  if (item.type === "dropdown") {
    control = (
      <select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Choose</option>
        {item.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (item.type === "radio") {
    control = (
      <div className="flex flex-wrap gap-2">
        {item.options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)} className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: value === o ? "var(--brand-ink)" : "var(--line-strong)", color: value === o ? "var(--brand-ink)" : undefined }}>
            {o}
          </button>
        ))}
      </div>
    );
  } else if (item.type === "checkbox") {
    const picked = Array.isArray(value) ? value : [];
    control = (
      <div className="flex flex-wrap gap-2">
        {item.options.map((o) => {
          const on = picked.includes(o);
          return (
            <button key={o} type="button" onClick={() => onChange(on ? picked.filter((x) => x !== o) : [...picked, o])} className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: on ? "var(--brand-ink)" : "var(--line-strong)", color: on ? "var(--brand-ink)" : undefined }}>
              {o}
            </button>
          );
        })}
      </div>
    );
  } else if (item.type === "boolean") {
    control = (
      <div className="flex gap-2">
        {[true, false].map((b) => (
          <button key={String(b)} type="button" onClick={() => onChange(b)} className="rounded-full border px-4 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: value === b ? "var(--brand-ink)" : "var(--line-strong)", color: value === b ? "var(--brand-ink)" : undefined }}>
            {b ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  } else if (item.type === "textarea") {
    control = <textarea {...common} rows={3} placeholder={item.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  } else {
    const type = item.type === "numeric" || item.type === "currency" ? "number" : item.type === "tel" ? "tel" : item.type === "email" ? "email" : ["date", "time", "month"].includes(item.type) ? item.type : "text";
    control = (
      <input
        {...common}
        type={type}
        placeholder={item.placeholder}
        min={item.min ?? undefined}
        max={item.max ?? undefined}
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
      />
    );
  }

  return (
    <Field label={item.title} required={item.required} hint={item.description} error={err}>
      {control}
    </Field>
  );
}

// ── THE OUTCOME ────────────────────────────────────────────────────────────────

function ResultStep({ final, onRetake, onNext, onReload }: { final: KycFinal | null; onRetake: () => void; onNext: () => void; onReload: () => void }) {
  const go = useNavigate();
  if (!final) return null;
  const s = final.status;
  const onlySignOff = s === "PENDING_REVIEW" && (final.flags ?? []).every((f) => f === "manualReview");

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <StepCard
        icon={s === "VERIFIED" ? <BadgeCheck className="h-[18px] w-[18px]" style={{ color: "var(--green-ink)" }} /> : s === "FAILED" ? <TriangleAlert className="h-[18px] w-[18px]" style={{ color: "#e11d48" }} /> : <Clock className="h-[18px] w-[18px]" style={{ color: "#b45309" }} />}
        title={s === "VERIFIED" ? "Your identity is verified" : s === "FAILED" ? "We could not verify your ID" : onlySignOff ? "Every check passed" : "A person is looking at your ID"}
      >
        <p className="text-[13px] leading-relaxed text-ink-soft">
          {s === "VERIFIED"
            ? "Your account is open. Next, read your M-PESA statement — it sets your starting limit."
            : s === "FAILED"
              ? "Here is what stopped it."
              : onlySignOff
                ? "Your account is open. A member of our team signs off every new customer before money moves, and you can read your statement meanwhile."
                : "We will message you the moment it clears. You can read your statement meanwhile."}
        </p>
        {(final.reasons ?? []).length > 0 && (
          <ul className="mt-3 space-y-2">
            {final.reasons!.map((r) => (
              <li key={r.key} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-soft">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--ink-faint)" }} />
                {r.says}
              </li>
            ))}
          </ul>
        )}
      </StepCard>
      <StepCard icon={<ArrowRight className="h-[18px] w-[18px] text-ink-faint" />} title="What next">
        <div className="flex flex-col gap-2">
          {s !== "FAILED" && (
            <LiquidButton size="lg" block icon={FileSpreadsheet} trailingIcon={ArrowRight} onClick={onNext}>
              Read my statement
            </LiquidButton>
          )}
          {s === "FAILED" && final.retakeable && (
            <LiquidButton size="lg" block icon={RefreshCw} onClick={onRetake}>
              Retake my photos
            </LiquidButton>
          )}
          {(s !== "VERIFIED" || final.conversationId) && (
            <LiquidButton size="lg" block variant="metal" icon={MessageSquare} onClick={() => go(final.conversationId ? `/messages/${final.conversationId}` : "/messages/new")}>
              Talk to our team
            </LiquidButton>
          )}
          {s === "FAILED" && !final.retakeable && (
            <button type="button" onClick={onReload} className="text-[12.5px] font-semibold underline" style={{ color: "var(--brand-ink)" }}>
              Start again
            </button>
          )}
        </div>
      </StepCard>
    </div>
  );
}
