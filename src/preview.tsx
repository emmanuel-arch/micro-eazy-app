// ─────────────────────────────────────────────────────────────────────────────
// A DEV-ONLY HARNESS FOR THE SIGNED-IN SHELL.
//
// The signed-in screens are behind a session, and getting one means sending a
// real verification code through Micromart's own SMS outbox to a real handset.
// That is not a thing to do in order to look at a layout.
//
// So this entry mounts the shell and a screen directly, on sample data, with no
// guard and no network. It is served by `vite dev` at /preview.html and is never
// part of a production build — nothing imports it, and the router does not know
// it exists.
//
//   /preview.html                     Home, light
//   /preview.html?theme=dark          Home, dark
//   /preview.html?wallpaper=none      Home, no floor
//
// Delete it freely. It holds no state anything else depends on.
// ─────────────────────────────────────────────────────────────────────────────
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { Wallpaper } from "./components/shell/Wallpaper";
import { GlowTabs } from "./components/nav/GlowNav";
import { ThemeProvider } from "./lib/theme";
import { SessionProvider } from "./lib/session";
import Home from "./screens/Home";
import { SAMPLE_HOME } from "./lib/api/samples";
import "./styles/theme.css";

/** `?screen=tall` — a screen that has NOT been cut into panes, to check the
 *  other half of the frame: it scrolls inside the content box, with no bar, a
 *  fade at the foot, and the rail and the legal bar staying put. */
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

const screen = new URLSearchParams(location.search).get("screen");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <SessionProvider>
          <div className="min-h-full">
            <Wallpaper />
            <AppShell>{screen === "tall" ? <Tall /> : <Home data={SAMPLE_HOME} />}</AppShell>
            <GlowTabs />
          </div>
        </SessionProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
