// Pamięć podręczna gry: drugi start nie pobiera nic z sieci.
// Pliki z hashem w nazwie (kod) nigdy się nie zmieniają → z pamięci. Tekstury, dźwięki i czcionki → z pamięci,
// a w tle sprawdzamy nowszą wersję. Sama strona (index.html) → najpierw sieć, żeby nowa wersja gry od razu działała.
const CACHE = 'project1-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!own && !fonts) return; // Supabase, czat, logowanie: zawsze prosto z sieci
  if (own && url.search.includes('test=')) return;
  if (own && url.pathname.endsWith('/version.json')) return; // numer wersji zawsze prosto z serwera (przycisk odświeżenia w menu)
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) { e.respondWith(networkFirst(req)); return; }
  if (own && url.pathname.includes('/assets/')) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch {
    return (await c.match(req)) ?? Response.error();
  }
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    c.put(req, res.clone());
    // stara wersja tego samego pliku (main-AAAA.js → main-BBBB.js, keep-AAAA.bin → keep-BBBB.bin) nie jest już potrzebna
    const name = new URL(req.url).pathname.split('/').pop() ?? '';
    const stem = name.replace(/-[\w-]{6,}\.(js|css|bin|json)$/, '');
    if (stem && stem !== name) for (const k of await c.keys()) { const n = new URL(k.url).pathname.split('/').pop() ?? ''; if (n !== name && n.startsWith(stem + '-') && /\/assets\//.test(k.url)) c.delete(k); }
  }
  return res;
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit ?? fresh;
}
