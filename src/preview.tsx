// ─────────────────────────────────────────────────────────────────────────────
// A DEV-ONLY HARNESS FOR SCREENS THAT ARE HARD TO REACH.
//
// The signed-in screens are behind a session, and getting one means sending a
// real verification code through the lender's own SMS outbox to a real handset.
// Several of the public doors need ROUTE STATE (the phone number carried from
// the front door) that no URL can supply. Neither is a thing to do, or fake in
// the real router, in order to look at a layout.
//
// So this entry mounts a screen directly, on sample data, with no guard and no
// network. It is served by `vite dev` at /preview.html and is never part of a
// production build — Vite builds index.html alone, and nothing imports this.
//
//   /preview.html                         Home, in the shell
//   /preview.html?screen=tall             a screen not yet cut into panes
//   /preview.html?screen=lenders          the lender chooser, phone carried
//   /preview.html?screen=lenders&pick=1   …with Micromart already chosen
//   /preview.html?screen=verify           the lender's code screen
//   /preview.html?screen=signin           the lender's sign-in
//   /preview.html?screen=join             the lender's create-account door
//   /preview.html?screen=splash           the lender's loading screen
//   /preview.html?screen=splash-platform  Micro Eazy's loading screen
//   /preview.html?screen=kyc              KYC verification, on canned answers
//   /preview.html?screen=crunch           the statement cruncher
//   /preview.html?screen=apply            Apply now
//
//   &drive=<script>  clicks through to a later pane — see preview-mocks.ts
//   &theme=dark   &wallpaper=none   &pane=1
//
// Delete it freely. It holds no state anything else depends on.
// ─────────────────────────────────────────────────────────────────────────────
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { Wallpaper } from "./components/shell/Wallpaper";
import { Splash } from "./components/shell/Splash";
import { GlowTabs } from "./components/nav/GlowNav";
import { ThemeProvider } from "./lib/theme";
import { LenderThemeProvider, setLenderSlug } from "./lib/lender";
import { SessionProvider } from "./lib/session";
import Home from "./screens/Home";
import LenderChoice from "./screens/LenderChoice";
import LenderVerify from "./screens/LenderVerify";
import LenderWelcome from "./screens/LenderWelcome";
import SignInPassword from "./screens/SignInPassword";
import Kyc from "./screens/kyc/Kyc";
import Cruncher from "./screens/crunch/Cruncher";
import ApplyNow from "./screens/apply/ApplyNow";
import { SAMPLE_HOME } from "./lib/api/samples";
import { drive, installMocks } from "./preview-mocks";
import "./styles/theme.css";

function Tall() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 12 }, (_, i) => (
        <section key={i} className="card p-6">
          <p className="text-[15px] font-semibold">Section {i + 1}</p>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            A screen with more rows than the frame is tall. It scrolls here, inside the content box.
          </p>
        </section>
      ))}
    </div>
  );
}

/** Clicks the first lender row after mount, so the chooser can be captured with
 *  its Continue showing. */
function AutoPick() {
  useEffect(() => {
    const t = setTimeout(() => {
      (document.querySelector('[role="radio"]:not([aria-disabled="true"])') as HTMLElement | null)?.click();
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}

const params = new URLSearchParams(location.search);
const screen = params.get("screen");
installMocks(screen ?? "home");
const script = params.get("drive");
if (script) void drive(script);

// ── Riri's dock ───────────────────────────────────────────────────────────────
//   &riri=open                     the device open on the conversation
//   &riri=open&ask=What%20do%20I%20owe%3F   …with a question already asked
//   &riri=nudge                    the first-run greeting beside the bubble
//   &riri=home                     the device's home screen
{
  const riri = params.get("riri");
  try {
    localStorage.setItem("me.riri.greeted", riri === "nudge" ? "0" : "1");
    localStorage.setItem("me.riri.open", riri === "open" || riri === "home" ? "1" : "0");
    localStorage.setItem("me.riri.start", riri === "home" ? "home" : "ask");
  } catch {
    /* private mode */
  }
  // &why=1 — the "Riri brought you here because you asked…" bar, as a hand-off lands.
  if (params.get("why")) {
    void import("./lib/riri/whyHere").then(({ setWhyHere }) =>
      setWhyHere({ question: "Where do customers repay?", from: "Riri", via: params.get("why") === "console" ? "the lending console" : undefined, path: location.pathname }),
    );
  }
  // &riri=open&press=home — press the device's home button, the way a person would.
  if (params.get("press") === "home") {
    window.setTimeout(() => (document.querySelectorAll('button[aria-label="Home"]')[1] as HTMLButtonElement | undefined)?.click(), 2500);
  }
  const asks = params.getAll("ask");
  if (asks.length) {
    let delay = 1400;
    for (const q of asks) {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("riri:open", { detail: { prompt: q } })), delay);
      delay += 1400;
    }
  }
}
const PHONE = { phone: "0758517032" };

const DOORS: Record<string, { path: string; entry: string; element: React.ReactNode; state?: unknown }> = {
  lenders: { path: "/lenders", entry: "/lenders", element: <LenderChoice />, state: PHONE },
  verify: { path: "/:slug/verify", entry: "/micromart/verify", element: <LenderVerify />, state: PHONE },
  signin: { path: "/:slug/signin", entry: "/micromart/signin", element: <SignInPassword />, state: PHONE },
  join: { path: "/:slug/welcome", entry: "/micromart/welcome", element: <LenderWelcome /> },
};

function Body() {
  if (screen === "splash") return <Splash livery="lender" />;
  if (screen === "splash-platform") return <Splash livery="platform" />;

  const door = screen ? DOORS[screen] : undefined;
  if (door) {
    // The branded doors wear the lender; the chooser is still Micro Eazy's.
    if (screen !== "lenders") setLenderSlug("micromart");
    return (
      <MemoryRouter initialEntries={[{ pathname: door.entry, state: door.state }]}>
        <SessionProvider>
          <Wallpaper />
          {screen === "lenders" && params.get("pick") && <AutoPick />}
          <main className="mx-auto w-full max-w-none">
            <Routes>
              <Route path={door.path} element={door.element} />
              <Route path="*" element={<p className="p-8">navigated away</p>} />
            </Routes>
          </main>
        </SessionProvider>
      </MemoryRouter>
    );
  }

  setLenderSlug("micromart");
  const flow = screen === "kyc" ? <Kyc /> : screen === "crunch" ? <Cruncher /> : screen === "apply" ? <ApplyNow /> : null;
  return (
    <BrowserRouter>
      <SessionProvider>
        <div className="min-h-full">
          <Wallpaper />
          <AppShell>{flow ?? (screen === "tall" ? <Tall /> : <Home data={SAMPLE_HOME} />)}</AppShell>
          <GlowTabs />
        </div>
      </SessionProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LenderThemeProvider>
        <Body />
      </LenderThemeProvider>
    </ThemeProvider>
  </StrictMode>,
);
