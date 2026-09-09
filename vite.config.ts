import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// The port is assigned in ecosystem/registry.json, once, for the whole
// ecosystem — 5174, beside the app it replaces on 5173 so the two can be run
// side by side and compared. Do not change it here; change it there.
// ── THE CONFIG DOES NOT SEE .env BY ITSELF ──────────────────────────────────
// This file read `process.env.VITE_SUITE_ORIGIN`, which is ALWAYS undefined
// here: Vite loads .env into `import.meta.env` for the BUNDLE, not into
// process.env for its own config. So the dev proxy silently fell through to the
// production origin no matter what .env said, and every call to a route that
// exists only on the local suite came back 404 — from a proxy that looked
// correctly configured. `loadEnv` is the supported way to read it here.
//
// The third argument is "" rather than the default "VITE_": it widens the
// prefix filter to every key. Not needed for VITE_SUITE_ORIGIN itself, but it
// stops the next person wondering why an unprefixed override is ignored.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  plugins: [
    react(),
    tailwindcss(),
    // ── THIS APP TAKES OVER AN ORIGIN THAT ALREADY HAS A SERVICE WORKER ──────
    // portal.servicesuitecloud.com is serving the previous PWA today, and that
    // build registers a workbox worker at scope '/' which PRECACHES the app
    // shell. A service worker is not replaced by deploying different files: it
    // is replaced by a new worker at the same scope. Ship this app without one
    // and every device that already opened the old app keeps being served the
    // old app from Cache Storage — permanently, and precisely for the customers
    // who use it most, the ones who installed it.
    //
    // So the worker below is not a feature. It is the mechanism by which the
    // replacement actually reaches a handset.
    VitePWA({
      // 'autoUpdate', NOT 'prompt' and NOT 'auto'. See pwa/vite.config.js for
      // the full account — 'prompt' installs the new worker into WAITING and
      // leaves it there until every tab closes, and this app has no update
      // prompt UI to activate it. A borrower must not repay against a build
      // from three deploys ago.
      registerType: "autoUpdate",
      manifest: {
        name: "Micro Eazy",
        short_name: "Micro Eazy",
        description: "Quick loans. Better living. Apply, track and repay from your phone.",
        // Three icons, and the reason is the difference between an app and a
        // white sticker: "any" is transparent, for the Start menu and the dock;
        // "maskable" is filled, because Android crops it to the launcher's own
        // shape and a transparent one crops to a transparent blob.
        icons: [
          { src: "/brand/micro-eazy/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/brand/micro-eazy/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/brand/micro-eazy/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Brand navy, matching the anti-flash script in index.html and --sky.
        theme_color: "#012863",
        // The SPLASH, not the icon. White because the app's light ground is
        // what paints first; a navy splash flashes dark and then blinks white.
        background_color: "#ffffff",
        display: "standalone",
        // IDENTICAL to the app it replaces, deliberately. A device that already
        // has Micro Eazy installed holds this start_url on its home screen;
        // changing it would strand the existing shortcut.
        start_url: "/?src=pwa",
        scope: "/",
        lang: "en",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // The three that make a deploy actually land: install the new worker,
        // activate it immediately, take over already-open pages, and delete the
        // precaches of previous builds so Cache Storage does not grow without
        // bound until the whole origin is evicted mid-session.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // The legacy Micromart worker is a tombstone that unregisters itself
        // (public/service-worker.js). Precaching it would let workbox serve a
        // stale COPY of the tombstone, so it is always fetched from network.
        globIgnores: ["**/service-worker.js", "**/firebase-messaging-sw.js"],
        // ── THE ONE THAT WOULD BITE IN PRODUCTION ───────────────────────────
        // navigateFallback serves the SPA shell for navigations that miss the
        // cache. Without this denylist the worker answers /api/portal/* with
        // index.html the moment the device goes offline — or intermittently
        // while online — and every API call fails by parsing an HTML document
        // as JSON. The API is not a navigation and must always reach network.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    port: 5174,
    // Same rule as the app it replaces: the borrower session cookie is
    // SameSite=Lax and will not travel on a cross-site XHR, so /api is PROXIED
    // rather than called directly. See pwa/DEPLOY.md — that file is the full
    // explanation and it was written after this cost several days.
    proxy: {
      "/api": {
        // `||` and .trim(), not `??` — the same trap the lender slug fell into
        // (see lib/api/portal.ts): a key that is SET BUT EMPTY is "", which `??`
        // happily passes through, and the fallback never fires.
        target: env.VITE_SUITE_ORIGIN?.trim() || "https://lms.servicesuitecloud.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
    build: { outDir: "dist", sourcemap: true, chunkSizeWarningLimit: 10000 },
  };
});
