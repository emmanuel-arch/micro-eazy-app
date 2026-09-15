# Deploying Micro Eazy

## Where this app lives

**`microeazy.servicesuitecloud.com`** — the `micro-eazy-app` Vercel project.
Every road to the fintech app leads here: the console's Customer Portal link,
Riri's map of the app, the SMS and email the dormancy move sends, and the PWA's
"Create Account" link.

**`portal.servicesuitecloud.com` is not this app.** Since 15 Sep 2026 it is
Micromart's own customer PWA (`../pwa`, the `micro-eazy-pwa` Vercel project),
which signs in customers of both Micromart books through their public API. Only
one Vercel project can hold a hostname, so this project must NOT list
`portal.servicesuitecloud.com` among its domains — if it does, the PWA cannot
claim it.

---

## A service worker is replaced by a worker, never by files

Any origin this app has served from holds a **workbox precaching service
worker** at scope `/` on every device that opened it, and it answers
navigations from Cache Storage.

Deploying different files to that origin does not dislodge it. A device with
that worker installed keeps serving the **old app shell out of its own
precache** — indefinitely, and specifically for the customers who installed the
app, who are the ones who use it most.

What replaces a worker is **another worker at the same scope**. So
`vite.config.ts` wires `vite-plugin-pwa` with `registerType: 'autoUpdate'`,
`clientsClaim`, `skipWaiting` and `cleanupOutdatedCaches`. That combination
installs, activates immediately, claims already-open pages, and deletes the
previous build's precache. The PWA taking over `portal.` relies on exactly the
same mechanism in the other direction.

### `public/service-worker.js` must keep serving JavaScript

It is a **tombstone** — inherited from the Micromart PWA, and its only job is to
unregister itself and empty Cache Storage. Deleting it does not reach browsers
that already have it: a browser re-fetches that path to check for an update, and
if the file were gone the SPA fallback in `vercel.json` would answer with
`index.html` at `text/html`. The update check fails the MIME check, the browser
keeps the old worker, and the trap stays shut on exactly the devices that have
it.

It is excluded from the precache (`globIgnores`) so workbox cannot serve a stale
copy of it.

---

## `vercel.json`

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
6. Hard-reload `https://microeazy.servicesuitecloud.com` and confirm the build
   actually changed.
