# Deploying Micro Eazy (the rebuild)

This app is intended to replace the borrower PWA currently serving
`portal.servicesuitecloud.com`. That is a **takeover of a live origin**, not a
fresh deploy, and the two are not the same operation.

---

## ⚠ READ FIRST — this app is not yet a replacement

The deployment scaffolding in this repo is complete and correct. **The app is
not**, and pushing it onto `portal.servicesuitecloud.com` today would take real
borrowers off a working product. As of 2026-09-01:

| | State |
|---|---|
| Sign-in / OTP | **Absent.** No screen calls `sendOtp`, `verifyOtp`, `signInWithPin` or `getSession`. There is no way for a customer to identify themselves. |
| Loan data | **Sample.** `Repay`, `Ladder`, `Exposure`, `WhyThisDecision`, `LoanAgreement` and `Ratiba` all render `src/lib/api/samples.ts` — one fictional customer, "Emmanuel Kiptoo, ID 32145678". |
| Repayment | **Not wired.** `Repay.tsx` has the STK button; `pay()` is never called (see the `WIRING:` note at `src/screens/Repay.tsx:256`). |
| Live calls | **One.** `listProducts()` in `ProductChoice.tsx`. Nothing else in `src/lib/api/portal.ts` has a caller. |

Every borrower would see a stranger's balance presented as their own, and could
neither sign in nor repay. `src/lib/api/samples.ts` says as much in its own
header — it was written as a review surface, not as a shipping state.

**The cutover is gated on wiring those calls, not on anything in this file.**

---

## The one thing that is different from the old app's deploy

### A service worker is replaced by a worker, never by files

`portal.servicesuitecloud.com` serves a **workbox precaching service worker**
today, at scope `/`. Every device that has opened the app holds that
registration, and it answers navigations from Cache Storage.

Deploying different files to that origin does not dislodge it. A device with
that worker installed keeps serving the **old app shell out of its own
precache** — indefinitely, and specifically for the customers who installed the
app, who are the ones who use it most. The domain would answer, the deploy would
be green, and nothing would change on the handsets that matter.

What replaces a worker is **another worker at the same scope**. So
`vite.config.ts` wires `vite-plugin-pwa` with `registerType: 'autoUpdate'`,
`clientsClaim`, `skipWaiting` and `cleanupOutdatedCaches`. That combination
installs, activates immediately, claims already-open pages, and deletes the
previous build's precache.

This is the reason the plugin is wired at all. It was in `devDependencies` and
absent from the config, which builds a perfectly good app that can never
replace the one it is replacing.

### `public/service-worker.js` must keep serving JavaScript

It is a **tombstone** — inherited from the Micromart PWA, and its only job is to
unregister itself and empty Cache Storage. It is carried into this repo
unchanged because deleting it does not reach browsers that already have it: a
browser re-fetches that path to check for an update, and if the file were gone
the SPA fallback in `vercel.json` would answer with `index.html` at
`text/html`. The update check fails the MIME check, the browser keeps the old
worker, and the trap stays shut on exactly the devices that have it.

It is excluded from the precache (`globIgnores`) so workbox cannot serve a stale
copy of it.

---

## `vercel.json`

Identical in intent to the app it replaces. Read `../pwa/DEPLOY.md` for the full
history; the two rules in short:

1. **`/api/*` is PROXIED, not redirected.** The borrower session is an httpOnly
   `SameSite=Lax` cookie, which is not sent on a cross-site XHR. A rewrite
   proxies server-side so the browser only ever sees this origin. A redirect
   puts the other host in the address bar and the cookie problem returns.
   `src/lib/net/transport.ts` is built on this being true.
2. **Everything else falls back to the SPA shell**, so `/repay` survives a hard
   reload. Rewrites run after the filesystem check, so real assets are served
   first.

`/sw.js`, `/registerSW.js`, `/service-worker.js` and `/index.html` are all
`max-age=0, must-revalidate`. The workers must revalidate or a browser can hold
a registration for up to 24 hours; `index.html` must revalidate because it names
the current hashed bundles and a cached copy pins the app to a deleted build.

**No key outside Vercel's schema.** A `$comment` array in `vercel.json` fails
schema validation and the build never completes — which leaves the *previous*
deployment live and looking healthy. That is why this prose is in a `.md`.

---

## Release checklist

1. `npm run build` — runs `tsc --noEmit` first; a failure here fails on Vercel.
2. `npm test` — the schedule and quote invariants.
3. Confirm `dist/sw.js`, `dist/manifest.webmanifest` and `dist/registerSW.js`
   were emitted. No worker means no takeover.
4. Confirm `dist/sw.js` contains `denylist:[/^\/api\//]`. Without it the worker
   answers `/api/*` with `index.html` when the device drops offline, and every
   call fails parsing HTML as JSON.
5. Push, **then open the Vercel deployment and confirm it says Ready, not
   Error.** A green `git push` says nothing about whether the build succeeded.
6. Hard-reload the live URL and confirm the build actually changed.

## Cutover, when the app is ready

1. Deploy this repo as its own Vercel project and verify it on its
   `*.vercel.app` URL first — with the API proxy exercised end to end.
2. Move `portal.servicesuitecloud.com` off the `micro-eazy-pwa` project and onto
   this one. **Only one Vercel project can hold a hostname**, so this is a move,
   not an addition; the old project must release it.
3. Keep the old project deployed and reachable on its `.vercel.app` URL until
   the new worker has demonstrably taken over. It is the rollback.
4. Verify on a device that had the OLD app installed — not just a clean browser.
   A clean browser cannot show you the failure this document is about.
