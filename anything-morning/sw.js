/* 애니띵 모닝 — 오프라인 지원.
   앱 파일은 네트워크를 먼저 쓰고(수정이 바로 보이게), 끊기면 저장해 둔 사본을 쓴다.
   글꼴은 한 번 받으면 사본을 쓴다. 파일 목록을 바꾸면 CACHE 이름을 올린다. */
const CACHE = 'anything-morning-v7';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'data-uri.js', 'data-hum.js', 'data-ja.js', 'data-en.js', 'data-kana.js', 'data-strokes.js', 'data-soccer-ja.js', 'data-soccer-en.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('anything-morning-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const keep = (request, response) => {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => keep(request, response))
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then(hit => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => keep(request, response))));
  }
});
