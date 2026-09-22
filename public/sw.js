const CACHE_NAME = 'novel-editor-v7';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // 1つの取得失敗で install 全体が失敗しないよう個別に追加する
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(url).catch((err) => console.warn('SW precache skip:', url, err))))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;               // POST 等はキャッシュしない
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // CDN・Supabase 等の外部通信には介入しない
  if (url.pathname.startsWith('/api/')) return;

  const isNavOrHtml = req.mode === 'navigate' ||
                      url.pathname === '/' ||
                      url.pathname === '/index.html' ||
                      (req.headers.get('accept') || '').includes('text/html');
  // アプリ本体のJS(/src/)も Network-First にして、更新後に古いモジュールが残らないようにする
  const isAppScript = url.pathname.startsWith('/src/') && url.pathname.endsWith('.js');

  if (isNavOrHtml || isAppScript) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || (isNavOrHtml ? caches.match('/index.html') : Response.error()))
        )
    );
    return;
  }

  // 静的ファイルは Cache-First。取得失敗時に例外で落ちないようにする
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => Response.error()))
  );
});
