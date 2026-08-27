// ── 3반 알리미 서비스워커 (캐시 + 푸시 알림) ──
// 앱을 수정하면 아래 숫자를 v11, v12... 로 올리세요
const CACHE = 'banner-v99';
const ASSETS = ['./', './index.html', './manifest.json',
                './icon-192.png', './icon-512.png', './icon-splash.png',
                './favicon-light.png', './favicon-dark.png', './badge.png'];

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
    badge: './badge.png',              // 상태표시줄용 단색 아이콘
    tag: d.tag || 'notice',            // 같은 종류는 하나로 합쳐짐
    renotify: false,
    vibrate: [0],                      // 조용한 진동 (기기 설정 우선)
    silent: false,
    requireInteraction: false,
    data: { url: d.url || './' },
    actions: [{ action: 'open', title: '확인하기' }]
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

// 앱에서 '새 버전 적용' 신호가 오면 곧바로 교체
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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

  // 우리 파일은 브라우저 저장본을 건너뛰고 항상 서버에서 최신인지 확인
  const fresh = url.origin === self.location.origin
    ? new Request(e.request, { cache: 'no-cache' })
    : e.request;

  e.respondWith(
    fetch(fresh).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
