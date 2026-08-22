// ── 3반 알리미 서비스워커 (캐시 + 푸시 알림) ──
// 앱을 수정하면 아래 숫자를 v11, v12... 로 올리세요
const CACHE = 'banner-v12';
const ASSETS = ['./', './index.html', './manifest.json',
                './icon-192.png', './icon-512.png',
                './favicon-light.png', './favicon-dark.png'];

/* ── 푸시 알림 ── */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAtEAosGkDJwkLrI5Vurcw5UgTWpIzyAl0",
  authDomain: "class3-6cf01.firebaseapp.com",
  projectId: "class3-6cf01",
  storageBucket: "class3-6cf01.firebasestorage.app",
  messagingSenderId: "536241412318",
  appId: "1:536241412318:web:de6f6080a6a525f3124a4f"
});

const messaging = firebase.messaging();

// 앱이 꺼져 있을 때 오는 알림
messaging.onBackgroundMessage(payload => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || '3반 알리미', {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || 'notice',
    data: { url: d.url || './' }
  });
});

// 알림 누르면 앱 열기 (이미 열려 있으면 그 창으로)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for(const c of list){ if('focus' in c) return c.focus(); }
      if(clients.openWindow) return clients.openWindow(target);
    })
  );
});

/* ── 캐시 ── */
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
  if (e.request.method !== 'GET' ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('firebase')) return;

  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
