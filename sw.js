// 앱 내용을 수정하고 반영이 안 되면 아래 숫자를 v2, v3... 으로 올리세요
const CACHE = 'banner-v8';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './favicon-light.png', './favicon-dark.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // 파이어베이스 통신은 캐시하지 않음 (항상 최신 데이터)
  if (e.request.method !== 'GET' || url.hostname.includes('googleapis.com') || url.hostname.includes('firebase')) return;

  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
