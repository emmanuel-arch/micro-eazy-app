// ─────────────────────────────────────────────────────────────────────────────
// TOMBSTONE. This file is not a service worker any more — it is the thing that
// removes the one that used to live here.
//
// WHAT WAS HERE, AND WHY IT WAS A TRAP
//
// The previous version of this file was inherited from the Micromart PWA. It
// did three things, and the combination of them made the app permanently
// un-updatable:
//
//   1. on install   → caches.open('app-cache') and cache.addAll(['/',
//                     '/index.html', …]). One fixed cache name, never versioned.
//   2. on activate  → nothing. The comment said "Currently no cache cleanup
//                     needed".
//   3. on fetch     → caches.match(request).then(r => r || fetch(request)).
//                     Cache-first, with no revalidation and no expiry.
//
// So the FIRST time any browser loaded the app, it froze '/' and '/index.html'
// into 'app-cache' forever. index.html is the document that names the hashed
// bundle for that build. Every later visit was served the frozen document, which
// asked for a bundle from that same old build. Deploying new code changed
// nothing that browser would ever see. Clearing the browser cache did not help
// either — a Cache Storage entry is not the HTTP cache.
//
// On top of that it was a SECOND worker at scope '/'. vite-plugin-pwa emits
// '/sw.js' and injects '/registerSW.js' to register it, and src/main.jsx also
// registered this file by hand. Two workers fought over the same navigations,
// which is why the app sometimes looked updated and mostly did not.
//
// WHY THIS FILE STILL EXISTS INSTEAD OF BEING DELETED
//
// Because deleting it does not reach the browsers that already have it. A
// browser with this worker registered re-fetches THIS PATH to check for an
// update. If the file were gone, vercel.json's SPA fallback would answer
// /service-worker.js with index.html and a text/html content type. The update
// check fails the script MIME check, the browser keeps the OLD worker installed,
// and the trap stays shut — permanently, on exactly the devices that already
// have the problem.
//
// So the file stays, serves a valid JavaScript worker, and that worker's only
// job is to dismantle itself. Once every install has picked this up it can be
// deleted for real; until then, leave it.
//
// Do not add caching to this file. The real worker is /sw.js.
// ─────────────────────────────────────────────────────────────────────────────

// Take over immediately rather than waiting for every tab to close. The whole
// point is to reach a user who has the app open right now.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Delete every Cache Storage entry this origin holds. 'app-cache' is
      //    the one that froze the app; the workbox caches are re-created by
      //    /sw.js on its next install, so clearing them costs one cold load.
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));

      // 2. Stop being the controller.
      await self.registration.unregister();

      // 3. Reload every open tab. Until a navigation happens the page is still
      //    controlled by this worker in memory and still holds the old bundle,
      //    so an unregister alone would look like nothing happened.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        if ('navigate' in client) client.navigate(client.url);
      }
    })(),
  );
});

// Pass everything straight to the network. Never answer from a cache — a single
// cache hit here is what the whole file exists to undo.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
