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
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { GlowTabs } from "./components/nav/GlowNav";
import { AppShell } from "./components/shell/AppShell";
import { Wallpaper } from "./components/shell/Wallpaper";
import { ThemeProvider } from "./lib/theme";
import { SessionProvider, useSession } from "./lib/session";
import { LenderThemeProvider, hasChosenLender, setLenderSlug, useLender } from "./lib/lender";
import { isLenderSlug, lenderBySlug } from "./lib/lenders";
import LenderChoice from "./screens/LenderChoice";
import LenderVerify from "./screens/LenderVerify";
import LenderWelcome from "./screens/LenderWelcome";
import SignIn from "./screens/SignIn";
import SignInPassword from "./screens/SignInPassword";
import { Splash, useSplashFloor, type SplashLivery } from "./components/shell/Splash";
import { Resource } from "./components/data/Resource";
import { useEffect, useState } from "react";
import { exposure, home, journey, ladder, track, whyThisDecision } from "./lib/api/portal";
import Home from "./screens/Home";
import Placeholder from "./screens/Placeholder";
import Kyc from "./screens/kyc/Kyc";
import Cruncher from "./screens/crunch/Cruncher";
import ApplyNow from "./screens/apply/ApplyNow";
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
import Help from "./screens/Help";

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
const FOCUSED = ["/welcome", "/verify", "/signin", "/lenders"];

/**
 * The lender's own public doors — /micromart/signin, /axe/welcome and so on.
 * Matched by shape rather than listed, so a lender added to lib/lenders.ts gets
 * its doors without a line changing here.
 */
const LENDER_DOOR = /^\/([a-z0-9-]+)\/(signin|welcome|verify)\/?$/;

const isPublicDoor = (pathname: string): boolean => {
  if (FOCUSED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  const m = LENDER_DOOR.exec(pathname);
  return Boolean(m && isLenderSlug(m[1]));
};

/**
 * ── WHOSE SPLASH ────────────────────────────────────────────────────────────
 * Micro Eazy's on its own front door and chooser, where no lender has been
 * picked and it would be false to show one — and anywhere at all for a browser
 * that has never been handed to a lender, which is a first-time visitor about
 * to be sent to /welcome. Everywhere else the lender's: their branded doors, and
 * the whole signed-in app.
 */
function splashLivery(pathname: string): SplashLivery {
  if (pathname === "/welcome" || pathname === "/lenders") return "platform";
  if (LENDER_DOOR.test(pathname)) return "lender";
  // The lender's home, /micromart, on a browser that has never been here: the
  // URL itself names the lender, so it is their splash that checks the session
  // and sends the customer on to /micromart or /micromart/signin.
  const home = /^\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (home && isLenderSlug(home[1])) return "lender";
  return hasChosenLender() ? "lender" : "platform";
}

/**
 * ── A BRANDED URL SETS THE BRAND ────────────────────────────────────────────
 * The first path segment of /micromart/signin names the lender. This element is
 * where that becomes true for the rest of the app: the store, the API slug and
 * the palette are all set from it, BEFORE the screen under it renders.
 *
 * A segment that is not a lender is not a lender page. It renders the not-found
 * screen rather than painting some default brand onto a mistyped URL.
 */
function LenderRoute({ children }: { children: ReactNode }) {
  const { slug = "" } = useParams();
  if (!isLenderSlug(slug)) return <Placeholder title="Not found" />;
  // A lender on the LMS that is NOT open to borrowers yet — shown on the chooser,
  // locked. Its URLs exist in shape (/axe/signin) but must not render a working-
  // looking door: the sign-in behind it talks to a bridge that lender does not
  // have, so a customer would type a password into a page that can only fail.
  // Back to the front door, which is where their choices are.
  if (!lenderBySlug(slug)?.available) return <Navigate to="/welcome" replace />;
  // During render, not in an effect — see the note on LenderThemeProvider in
  // lib/lender.tsx about the one frame of wrong colour an effect costs. It is
  // idempotent, and only notifies subscribers when the slug actually changes.
  setLenderSlug(slug);
  return <>{children}</>;
}

/** `/` for somebody signed in is their lender's home, `/<slug>`. */
function RootRedirect() {
  const lender = useLender();
  return <Navigate to={`/${lender.slug}`} replace />;
}

/**
 * ── /join IS A SIGNPOST NOW, NOT A WIZARD ────────────────────────────────────
 * The single onboarding wizard became three screens a customer can find in the
 * rail: KYC verification, the statement cruncher, Apply now. Old links (an SMS,
 * a bookmark, "New loan" from an older build) still say /join, so it asks the
 * server where this customer actually is and sends them there. `?step=statement`
 * — the old deep link to the statement step — goes straight to the cruncher.
 */
function JoinRedirect() {
  const location = useLocation();
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("step") === "statement") {
      setTo("/crunch");
      return;
    }
    let live = true;
    journey()
      .then((j) => live && setTo({ kyc: "/kyc", crunch: "/crunch", apply: "/apply", track: "/track" }[j.status.next]))
      .catch(() => live && setTo("/kyc"));
    return () => {
      live = false;
    };
  }, [location.search]);
  return to ? <Navigate to={to} replace /> : null;
}

/** Sends the retired unbranded /signin to the current lender's own door,
 *  carrying any route state (a prefilled phone) along with it. */
function LegacySignIn() {
  const lender = useLender();
  const location = useLocation();
  return <Navigate to={`/${lender.slug}/signin`} replace state={location.state} />;
}

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
  const lender = useLender();

  // "unknown" never reaches here any more: Shell holds the boot splash over the
  // whole app until the session question has an answer, so a route element
  // cannot render before there is one. Kept as a guard rather than deleted —
  // if that ever changes, the honest thing is to render nothing for a frame
  // rather than to redirect somebody who may well be signed in.
  if (status === "unknown") return null;

  // `state` carries where they were going, so an expired session resumes at the
  // screen they wanted rather than dumping everyone on the home tab.
  //
  // WHOSE door. A browser that has been handed to a lender — it signed in there,
  // or picked them — goes back to THAT lender's sign-in page, in their colours.
  // Only a browser that never has goes to Micro Eazy's front door. Sending a
  // Micromart customer whose hour ran out to a generic "Welcome." with a lender
  // chooser on it would be asking them who they borrow from all over again.
  if (status === "anonymous") {
    const door = hasChosenLender() ? `/${lender.slug}/signin` : "/welcome";
    return <Navigate to={door} replace state={{ from: pathname }} />;
  }

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
  const focused = isPublicDoor(pathname);
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
  const bleed = isPublicDoor(pathname);

  return (
    <div className="min-h-full">
      {/* The floor. Fixed, behind everything, and painted in ONE place — see
          components/shell/Wallpaper.tsx. It renders on every screen including
          the public doors, because a customer who has dressed the app should
          find it dressed the next time they sign in, not only once they are
          past the gate. */}
      <Wallpaper />
      {booting && <Splash livery={splashLivery(pathname)} />}

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
            {/* The old unbranded password door. Anything still pointing at it —
                a bookmark, an SMS from before the lender doors existed — lands on
                the lender's own sign-in instead. */}
            <Route path="/signin" element={<LegacySignIn />} />

            {/* ── THE HANDOVER ───────────────────────────────────────────────
                /welcome → /lenders → /<slug>/verify → /<slug>/signin → /<slug>.
                The chooser is the last Micro Eazy screen; everything after it
                wears the lender. */}
            <Route path="/lenders" element={<LenderChoice />} />
            <Route path="/:slug/verify" element={<LenderRoute><LenderVerify /></LenderRoute>} />
            <Route path="/:slug/signin" element={<LenderRoute><SignInPassword /></LenderRoute>} />
            <Route path="/:slug/welcome" element={<LenderRoute><LenderWelcome /></LenderRoute>} />

            {/* Home reads ONE endpoint, not four. It asks what can I borrow,
                what do I owe, has anyone told me anything, and is anything of
                mine in flight — and four round trips on the screen the app is
                judged on in four seconds is the difference between instant and
                assembling itself while somebody watches. */}
            <Route path="/" element={<RequireSession><RootRedirect /></RequireSession>} />
            {/* THE LENDER'S HOME — /micromart. Static routes like /messages and
                /track rank above this dynamic one, so it only ever catches a
                single segment nothing else claimed, and LenderRoute renders
                not-found for one that is not a lender.

                `splash` holds the lender's full-screen loader until the account
                has actually arrived, rather than a spinner in an empty card —
                this is the first thing a customer sees straight out of signing
                in, and on a cold server the aggregate behind it takes a while. */}
            <Route
              path="/:slug"
              element={
                <LenderRoute>
                <RequireSession>
                  <Resource
                    title="Home"
                    splash
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
                </LenderRoute>
              }
            />
            {/* Onboarding is gated too. A person reaches it only after a code
                has been verified AND the enrolment check has said they are not
                already a customer — walking somebody through KYC they finished
                last year is how you lose them, and doing it because a lookup
                failed is how you open a second account against a live one. */}
            <Route path="/join" element={<RequireSession><JoinRedirect /></RequireSession>} />
            {/* ── The borrowing road, one screen per step ─────────────────────
                Each is a controlled deck of panes driven by the lender's own
                rules from the server — see components/flow/FlowScreen.tsx. */}
            <Route path="/kyc" element={<RequireSession><Kyc /></RequireSession>} />
            <Route path="/crunch" element={<RequireSession><Cruncher /></RequireSession>} />
            <Route path="/apply" element={<RequireSession><ApplyNow /></RequireSession>} />
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
            {/* Help & FAQs — Home's second pane until 21 Sep 2026. Static, so
                it reads no endpoint and opens instantly; ?topic= picks the
                explainer ("Read more" on Home links straight to one). */}
            <Route path="/help" element={<RequireSession><Help /></RequireSession>} />
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
      {/* Outside the router: the lender's palette has to be on <html> before the
          boot splash paints, and the splash renders before any route does. */}
      <LenderThemeProvider>
      <BrowserRouter>
        {/* Inside the router on purpose: the session needs to be readable by the
            guard, and the guard is a route element. Outside it, the provider
            would still work but nothing could navigate on a session change. */}
        <SessionProvider>
          <Shell />
        </SessionProvider>
      </BrowserRouter>
      </LenderThemeProvider>
    </ThemeProvider>
  );
}
