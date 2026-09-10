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
import { GlowTabs } from "./components/nav/GlowNav";
import { AppShell } from "./components/shell/AppShell";
import { Wallpaper } from "./components/shell/Wallpaper";
import { ThemeProvider } from "./lib/theme";
import { SessionProvider, useSession } from "./lib/session";
import SignIn from "./screens/SignIn";
import SignInPassword from "./screens/SignInPassword";
import { Splash, useSplashFloor } from "./components/shell/Splash";
import { Resource } from "./components/data/Resource";
import { exposure, home, ladder, track, whyThisDecision } from "./lib/api/portal";
import Home from "./screens/Home";
import Placeholder from "./screens/Placeholder";
import Onboarding from "./screens/onboarding/Onboarding";
import Welcome from "./screens/Welcome";
import Repay from "./screens/Repay";
import WhyThisDecision from "./screens/WhyThisDecision";
import Ladder from "./screens/Ladder";
import Exposure from "./screens/Exposure";
import Messages from "./screens/Messages";
import Thread from "./screens/Thread";
import Track from "./screens/Track";
import Identity from "./screens/Identity";
import You from "./screens/You";

/** The signed-in frame is AppShell now — the console's sidebar-to-the-top-edge
 *  layout, with the mark at the head of its own navigation. The old GlowRail and
 *  its inline wordmark are gone; components/shell/BrandMark.tsx owns how the mark
 *  is drawn, on every surface in the app. */

/** Routes that own the whole screen — no nav, no way out but forward or back.
 *
 *  The front door is here for the same reason onboarding is: a person who has
 *  not signed in yet has nothing to navigate TO, and four tabs under a sign-in
 *  form are four ways to leave before starting. */
// ── THE PUBLIC DOORS ────────────────────────────────────────────────────────
// Only these three. They cannot carry the shell: somebody who has not signed in
// has no destinations to navigate to and no account to open, so a sidebar there
// would be five links that all bounce straight back to this gate.
//
// /join USED to be listed here, on the argument that a nav bar during a
// verification flow is an invitation to abandon it. Overruled deliberately: the
// customer IS signed in by then, and a wizard with no way to reach your own
// account or sign out reads as a trap rather than as focus. The stepper still
// says how far through it they are.
const FOCUSED = ["/welcome", "/verify", "/signin"];

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

  // "unknown" never reaches here any more: Shell holds the boot splash over the
  // whole app until the session question has an answer, so a route element
  // cannot render before there is one. Kept as a guard rather than deleted —
  // if that ever changes, the honest thing is to render nothing for a frame
  // rather than to redirect somebody who may well be signed in.
  if (status === "unknown") return null;

  // `state` carries where they were going, so an expired session resumes at the
  // screen they wanted rather than dumping everyone on the home tab.
  if (status === "anonymous") return <Navigate to="/welcome" replace state={{ from: pathname }} />;

  return <>{children}</>;
}

/**
 * Which frame the routes render in.
 *
 * Signed in → the shell: sidebar, floating identity control, mobile drawer.
 * A public door → nothing but a width, because those screens bring their own
 * frame (AuthLayout) and a second one around them would nest two headers.
 */
function Frame({ chrome, bleed, children }: { chrome: boolean; bleed: boolean; children: ReactNode }) {
  if (chrome) return <AppShell>{children}</AppShell>;
  return <main className={`mx-auto w-full ${bleed ? "max-w-none" : "max-w-[1040px] pb-12"}`}>{children}</main>;
}

function Shell() {
  const { pathname } = useLocation();
  const { status } = useSession();

  // ── THE BOOT SPLASH ──────────────────────────────────────────────────────
  // Held over the whole app until TWO things are true: the session question has
  // an answer, and the mark has been up long enough to read as an arrival
  // rather than a flicker. Whichever is later.
  //
  // It is deliberately not a route. The app it replaces shows its loader on a
  // flat two-second timer that is not tied to anything, which taxes a customer
  // who is already signed in; and putting it on "/" alone would mean somebody
  // opening a deep link — or the /welcome the old bookmarks point at — watches
  // the app assemble itself instead. One gate, every entry.
  const holding = useSplashFloor();
  const booting = status === "unknown" || holding;

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

  // ── THE FRONT-OF-HOUSE SCREENS OWN THE VIEWPORT ──────────────────────────
  // Everything before a customer is inside the app — the front door, the
  // password door, the code gate and the ID capture — runs edge to edge and
  // carries its own frame (AuthLayout: mark top-left, content left, photography
  // sliding down the right). Holding those in a 1040px column put two feet of
  // empty page around the screens that are doing the persuading.
  //
  // Onboarding and everything behind the session still take the measured
  // column: they are reading surfaces, and a 1440px line of body text is
  // unreadable.
  const bleed = ["/welcome", "/signin", "/verify"].includes(pathname);

  return (
    <div className="min-h-full">
      {/* The floor. Fixed, behind everything, and painted in ONE place — see
          components/shell/Wallpaper.tsx. It renders on every screen including
          the public doors, because a customer who has dressed the app should
          find it dressed the next time they sign in, not only once they are
          past the gate. */}
      <Wallpaper />
      {booting && <Splash />}

      <Frame chrome={chrome} bleed={bleed}>
          <Routes>
            {/* ── The two public doors ────────────────────────────────────
                Everything else is behind RequireSession. These two cannot be,
                because they are how a session is obtained in the first place. */}
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/verify" element={<SignIn />} />
            {/* The third public door, and the one most of Micromart's existing
                book will use: the password already sitting in their SMS inbox.
                It mints the same cookie as the code, so everything behind it is
                identical — see screens/SignInPassword.tsx. */}
            <Route path="/signin" element={<SignInPassword />} />

            {/* Home reads ONE endpoint, not four. It asks what can I borrow,
                what do I owe, has anyone told me anything, and is anything of
                mine in flight — and four round trips on the screen the app is
                judged on in four seconds is the difference between instant and
                assembling itself while somebody watches. */}
            <Route
              path="/"
              element={
                <RequireSession>
                  <Resource
                    title="Home"
                    load={home}
                    emptyWhen={(d) =>
                      !d.found
                        ? "We have no account on file for this ID yet. Finish signing up and your limit appears here."
                        : null
                    }
                  >
                    {(d, reload) => <Home data={d} onRefresh={reload} />}
                  </Resource>
                </RequireSession>
              }
            />
            {/* Onboarding is gated too. A person reaches it only after a code
                has been verified AND the enrolment check has said they are not
                already a customer — walking somebody through KYC they finished
                last year is how you lose them, and doing it because a lookup
                failed is how you open a second account against a live one. */}
            <Route path="/join" element={<RequireSession><Onboarding /></RequireSession>} />
            {/* The SAME endpoint Home reads. One call, one truth — the two
                screens cannot disagree about what somebody owes. */}
            <Route
              path="/repay"
              element={
                <RequireSession>
                  <Resource
                    title="Repay"
                    load={home}
                    emptyWhen={(d) =>
                      !d.found ? "We have no account on file for this ID yet." : null
                    }
                  >
                    {(d) => <Repay data={d} />}
                  </Resource>
                </RequireSession>
              }
            />
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
            {/* ── The transparency pair ──────────────────────────────────
                /track is the customer's view of the SAME workflow chain the
                officer is working — resolved once on the server so the two
                cannot drift. /messages is the channel that makes it actionable:
                a stage bar showing "Sent back for review" with no way to ask
                what is needed names a wall without a door. */}
            <Route
              path="/track"
              element={
                <RequireSession>
                  <Resource
                    title="Your application"
                    load={track}
                    emptyWhen={(d) =>
                      !d.found
                        ? "We have no account on file for this ID yet. Once you apply, every stage your application passes through appears here."
                        : null
                    }
                  >
                    {(d) => <Track data={d} />}
                  </Resource>
                </RequireSession>
              }
            />
            {/* Both message routes are the same screen — see screens/Thread.tsx.
                "new" is a composer with no thread yet, and the first send
                creates one. */}
            <Route path="/messages" element={<RequireSession><Messages /></RequireSession>} />
            <Route path="/messages/:threadId" element={<RequireSession><Thread /></RequireSession>} />

            {/* The screen a REFERRED customer opens. It is the far end of every
                automated identity decision: what the machine was unsure about,
                in words about the photograph, and either a retake or a person —
                never both offered as equals, and never "try again" against a
                registry miss, which is a loop with no exit. */}
            <Route path="/identity" element={<RequireSession><Identity /></RequireSession>} />

            <Route path="/loans" element={<RequireSession><Placeholder title="Your loans" /></RequireSession>} />
            <Route path="/you" element={<RequireSession><You /></RequireSession>} />
            <Route path="*" element={<Placeholder title="Not found" />} />
          </Routes>
      </Frame>

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
