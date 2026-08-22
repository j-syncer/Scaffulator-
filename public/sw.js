/* ===========================================================================
   Scaffulator service worker
   ---------------------------------------------------------------------------
   The calculator is a single self-contained HTML file: the markup, the utility
   CSS and the whole geometric engine live inside index.html, and the SVG plan,
   section, 3D and stair views are drawn by that same inline script. So caching
   the document caches the app — engine, renderers and all. Everything else here
   is chrome: icons, the manifest, and the Google Fonts that make it look right.

   Cache strategy:
     * navigations  — cache first, revalidated in the background. A scaffolder
                      standing in a lift well with one bar gets the app instantly
                      and offline gets it at all; the fresh copy lands in the
                      cache for the next launch.
     * same-origin  — cache first, network filled. Static assets, all of them.
     * fonts        — cache first, never revalidated (Google's font URLs are
                      immutable and versioned).
     * everything else falls through to the network untouched.

   Bump CACHE_VERSION whenever index.html changes, or clients keep serving the
   old document from the cache until the background revalidate catches up.
   =========================================================================== */

const CACHE_VERSION = 'v10';
const SHELL_CACHE = `scaffulator-shell-${CACHE_VERSION}`;
const FONT_CACHE = `scaffulator-fonts-${CACHE_VERSION}`;
const KEEP = new Set([SHELL_CACHE, FONT_CACHE]);

// The app shell. index.html is the app; the rest is what the browser and the
// home screen ask for around it.
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

/* ------------------------------------------------------------------ install */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 (say og-image.jpg on a stripped deploy) cannot
      // fail the whole install and leave the app with no offline copy at all.
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {}),
        ),
      );
      await cache
        .add(new Request('/og-image.jpg', { cache: 'reload' }))
        .catch(() => {});
    })(),
  );
});

/* ----------------------------------------------------------------- activate */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => (KEEP.has(n) ? null : caches.delete(n))));
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }
      await self.clients.claim();
    })(),
  );
});

/* -------------------------------------------------------------------- fetch */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(navigationResponse(req));
    return;
  }

  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
  }
});

// Cache first, then network, and whatever the network gives back is kept for
// next time. On a miss with no network the caller gets the failure, which for
// an asset request is what it should get.
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: cacheName === SHELL_CACHE });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
    cache.put(req, res.clone()).catch(() => {});
  }
  return res;
}

// Every route serves the same document (the Worker is configured
// single-page-application), so a navigation to any path answers from the one
// cached index.html. The background revalidate keeps that copy current without
// ever making the user wait on the network.
async function navigationResponse(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = (await cache.match('/index.html')) || (await cache.match('/'));

  const fresh = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put('/index.html', res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);

  if (cached) {
    // Don't hold the response open on the network — but do finish the update.
    fresh.catch(() => {});
    return cached;
  }
  const res = await fresh;
  return res || new Response('Offline and nothing cached yet.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/* ============================================================================
   BACKGROUND SYNC — saved project files
   ----------------------------------------------------------------------------
   Saving a job on site writes a file and, when an upload endpoint is
   configured, queues the same JSON in IndexedDB. The queue is drained by the
   Background Sync event the browser fires once the device has a connection
   again; browsers without Background Sync (Safari, Firefox) get the same drain
   driven from the page's `online` event instead. Either way the take-off is on
   the phone the moment it is saved — the upload is the part that waits.
   ========================================================================== */

const DB_NAME = 'scaffulator-sync';
const DB_STORE = 'outbox';
const SYNC_TAG = 'scaffulator-project-sync';

function openDB() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(DB_STORE, mode);
    const out = fn(t.objectStore(DB_STORE));
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function pending() {
  const db = await openDB();
  const rq = await tx(db, 'readonly', (store) => store.getAll());
  db.close();
  return rq || [];
}

async function drop(id) {
  const db = await openDB();
  await tx(db, 'readwrite', (store) => store.delete(id));
  db.close();
}

// Sends what is queued. A record whose endpoint rejects it outright (4xx that
// is not 408/429) is dropped — retrying a malformed upload forever would keep
// the sync registration alive and the battery awake. Anything else is left in
// the queue and the sync is retried by the browser.
async function flushOutbox() {
  const items = await pending();
  let sent = 0;
  let retry = false;
  for (const item of items) {
    if (!item || !item.endpoint) {
      await drop(item.id);
      continue;
    }
    try {
      const res = await fetch(item.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        await drop(item.id);
        sent++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        await drop(item.id);
      } else {
        retry = true;
      }
    } catch {
      retry = true;
    }
  }
  if (sent) await announce({ type: 'sync-uploaded', count: sent });
  if (retry) throw new Error('uploads still pending');
  return sent;
}

async function announce(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushOutbox());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'skip-waiting') self.skipWaiting();
  // The page asks for a drain directly when Background Sync is unavailable.
  if (data.type === 'flush-outbox') {
    event.waitUntil(flushOutbox().catch(() => {}));
  }
});
