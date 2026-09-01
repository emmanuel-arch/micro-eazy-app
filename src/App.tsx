// ─────────────────────────────────────────────────────────────────────────────
// THE SHELL.
//
// One column, thumb-first, chrome at the edges. The rail appears at `lg` because
// the app is also opened on a laptop by staff walking a customer through it —
// but the phone is the design target and the desktop is the adaptation, not the
// other way round. That order is the whole difference between this and the app
// it replaces.
//
// Onboarding renders WITHOUT the tab bar. Somebody halfway through proving who
// they are should not be offered four other places to go: a nav bar during a
// verification flow is an invitation to abandon it, and an abandoned KYC session
// is a customer who has handed over a photograph of their ID for nothing.
// ─────────────────────────────────────────────────────────────────────────────
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { GlowRail, GlowTabs } from "./components/nav/GlowNav";
import { ThemeProvider } from "./lib/theme";
import { SessionProvider, useSession } from "./lib/session";
import SignIn from "./screens/SignIn";
import { Resource } from "./components/data/Resource";
import { exposure, ladder, whyThisDecision } from "./lib/api/portal";
import Home from "./screens/Home";
import Placeholder from "./screens/Placeholder";
import Onboarding from "./screens/onboarding/Onboarding";
import Welcome from "./screens/Welcome";
import Repay from "./screens/Repay";
import WhyThisDecision from "./screens/WhyThisDecision";
import Ladder from "./screens/Ladder";
import Exposure from "./screens/Exposure";

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      {/* ── THE REAL MARK, not a letter in a box ─────────────────────────
          The same file the manifest installs to the home screen and the same
          one the app it replaces uses, so the icon a customer taps and the
          mark at the top of the app are one image rather than two things that
          merely resemble each other.

          ON A WHITE CHIP, which is the rule the previous app already settled
          (see pwa/src/components/eco/EazyLoader.jsx — "the app icon, on the
          white chip"). The mark is navy and green on transparency, so in dark
          mode its navy half would sink into a near-black rail and the logo
          would read as a green smear. The chip is also how the icon actually
          appears on a launcher, so this is what the customer already knows. */}
      <span
        className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white"
        style={{ boxShadow: "0 6px 18px -8px var(--navy)" }}
      >
        <img
          src="/brand/micro-eazy/icon-192.png"
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
          // Decorative: the wordmark beside it already says "Micro Eazy", and a
          // screen reader announcing the name twice is noise.
          aria-hidden="true"
        />
      </span>
      <span className="leading-none">
        <span className="block text-[15px] font-bold tracking-[-0.02em]">Micro Eazy</span>
        <span className="block text-[11px] text-ink-faint">Quick loans. Better living.</span>
      </span>
    </div>
  );
}

/** Routes that own the whole screen — no nav, no way out but forward or back.
 *
 *  The front door is here for the same reason onboarding is: a person who has
 *  not signed in yet has nothing to navigate TO, and four tabs under a sign-in
 *  form are four ways to leave before starting. */
const FOCUSED = ["/join", "/welcome", "/verify"];

/**
 * ── THE GUARD ───────────────────────────────────────────────────────────────
 * It is a ROUTER, not a lock. Nothing here protects data: every gated route on
 * the server re-checks the borrower cookie and answers 401 regardless of what
 * this component decides. What it does is stop the app rendering screens that
 * have nothing to render — and stop it asking the customer to sign in when they
 * already have.
 *
 * `unknown` is why this is a component and not a boolean. On first paint the app
 * has not yet asked the server anything, and treating that as "signed out" is
 * the bug that flashes a sign-in screen at somebody with a perfectly good
 * session, one frame before replacing it. So it holds — briefly, on a surface
 * that is not a form.
 */
function RequireSession({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { pathname } = useLocation();

  if (status === "unknown") {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white"
            style={{ boxShadow: "0 10px 28px -12px var(--navy)" }}
          >
            <img src="/brand/micro-eazy/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 object-contain" aria-hidden="true" />
          </span>
          <p className="text-[12.5px] text-ink-faint">Checking your session…</p>
        </div>
      </div>
    );
  }

  // `state` carries where they were going, so an expired session resumes at the
  // screen they wanted rather than dumping everyone on the home tab.
  if (status === "anonymous") return <Navigate to="/welcome" replace state={{ from: pathname }} />;

  return <>{children}</>;
}

function Shell() {
  const { pathname } = useLocation();
  const { status } = useSession();

  // ── THE NAV IS NOT JUST A ROUTE QUESTION ─────────────────────────────────
  // A route being "focused" hides the chrome for onboarding and the front door.
  // But the tab bar was also rendering underneath the session check and on the
  // frame before an anonymous visitor is redirected — four tabs to places that
  // will bounce straight back to the gate, under a screen that is still working
  // out who is holding the phone.
  //
  // So the chrome needs BOTH: a route that wants it, and a session that can use
  // it. `unknown` counts as cannot — it is not yet a no, but offering navigation
  // on the strength of a question that has not been answered is how an app shows
  // somebody a door that is locked.
  const focused = FOCUSED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const chrome = !focused && status === "verified";

  return (
    <div className="min-h-full">
      {chrome && (
        <GlowRail>
          <Wordmark />
        </GlowRail>
      )}

      <div className={chrome ? "lg:pl-[248px]" : ""}>
        {/* ── WIDTH IS A DESIGN DECISION, NOT A BREAKPOINT ─────────────────
            The phone is the design target, so the column is 560px — the width
            at which a line of body text is comfortable and a card is a card.

            But this app is also opened on a laptop: by a customer who prefers a
            keyboard, and by staff walking somebody through it. Holding a 560px
            column in the middle of a 1440px screen is not "mobile-first", it is
            a phone in a window with two feet of empty page around it, and it
            reads as an app that was never finished.

            So above `xl` the column opens to a real canvas and the SCREENS
            decide what to do with it — Home splits into a primary and a
            secondary column; onboarding deliberately does not, because a
            verification flow with a sidebar of distractions is a verification
            flow people abandon. */}
        <main
          className={`mx-auto w-full ${
            chrome ? "max-w-[560px] pb-32 lg:max-w-[720px] xl:max-w-[1180px] lg:pb-12" : "max-w-[1040px] pb-12"
          }`}
        >
          <Routes>
            {/* ── The two public doors ────────────────────────────────────
                Everything else is behind RequireSession. These two cannot be,
                because they are how a session is obtained in the first place. */}
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/verify" element={<SignIn />} />

            <Route path="/" element={<RequireSession><Home /></RequireSession>} />
            {/* Onboarding is gated too. A person reaches it only after a code
                has been verified AND the enrolment check has said they are not
                already a customer — walking somebody through KYC they finished
                last year is how you lose them, and doing it because a lookup
                failed is how you open a second account against a live one. */}
            <Route path="/join" element={<RequireSession><Onboarding /></RequireSession>} />
            <Route path="/repay" element={<RequireSession><Repay /></RequireSession>} />
            {/* The Score tab opens on the DECISION, not on a dial. A number
                without its reasons is the thing customers ring up about, and
                the ladder and the credit file hang off it as the two questions
                that follow: how did it get here, and who else can see it. */}
            <Route
              path="/score"
              element={
                <RequireSession>
                  <Resource
                    title="Your score"
                    load={whyThisDecision}
                    // `found: false` and `decision: null` are two different true
                    // answers, and neither is an error. The first is "we have no
                    // application from you"; the second is "yours has not been
                    // decided yet". Telling somebody waiting on a decision that
                    // we have never heard of them is the worse of the two.
                    emptyWhen={(d) =>
                      !d.found
                        ? "We have no application on file for this ID yet. Once you apply, the decision and the reasons behind it appear here."
                        : !d.decision
                          ? "Your application has not been decided yet. As soon as it is, the reasons will be here in full."
                          : null
                    }
                  >
                    {(d) => <WhyThisDecision data={d} />}
                  </Resource>
                </RequireSession>
              }
            />
            <Route
              path="/ladder"
              element={
                <RequireSession>
                  <Resource
                    title="Your limit ladder"
                    load={ladder}
                    emptyWhen={(d) =>
                      !d.found
                        ? "There is no limit history for this ID yet. Your ladder starts with your first cleared loan."
                        : null
                    }
                  >
                    {(d) => <Ladder data={d} />}
                  </Resource>
                </RequireSession>
              }
            />
            <Route
              path="/exposure"
              element={
                <RequireSession>
                  {/* No `emptyWhen`: this route always has something true to
                      say. "Nothing has been pulled yet" and "you have not
                      consented" are answers the screen renders itself, and they
                      are the two most useful things on it — collapsing either
                      into a blank panel would hide the fact that a lender has
                      not checked, which is information the customer wants. */}
                  <Resource title="Your credit file" load={exposure}>
                    {(d) => <Exposure data={d} />}
                  </Resource>
                </RequireSession>
              }
            />
            <Route path="/loans" element={<RequireSession><Placeholder title="Your loans" /></RequireSession>} />
            <Route path="/you" element={<RequireSession><Placeholder title="You" /></RequireSession>} />
            <Route path="*" element={<Placeholder title="Not found" />} />
          </Routes>
        </main>
      </div>

      {chrome && <GlowTabs />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        {/* Inside the router on purpose: the session needs to be readable by the
            guard, and the guard is a route element. Outside it, the provider
            would still work but nothing could navigate on a session change. */}
        <SessionProvider>
          <Shell />
        </SessionProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
