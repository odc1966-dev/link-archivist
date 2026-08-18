/* 링크보관함 서비스워커 — 오프라인에서도 앱이 열리도록 셸을 캐시한다 */
const CACHE = 'linkarchive-v8';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 앱이 "지금 실행 중인 서비스워커 버전"을 물어볼 수 있게 한다 (오래된 버전 자동 감지용) */
self.addEventListener('message', e => {
  if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: CACHE });
});

/* 네트워크 우선, 실패하면 캐시 (앱 파일 수정이 바로 반영되도록)
   ★ 이 앱의 파일(같은 출처)만 처리한다.
   예전에는 GitHub API 요청까지 가로채는 바람에
   (1) 통신이 흔들리면 캐시에 없는 응답이 undefined가 되어 'Failed to fetch'가 났고
   (2) 인증된 API 응답이 캐시에 저장되는 문제가 있었다. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return; // 외부 요청은 건드리지 않음

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(async () => {
        // 캐시에도 없으면 undefined 대신 명확한 응답을 돌려준다
        const hit = await caches.match(e.request);
        return hit || new Response('오프라인 상태예요', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      })
  );
});
