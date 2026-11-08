/* 启课 PWA：只缓存静态资源，绝不缓存 /api/ 动态数据 */
/* 每次改动静态资源都要 +1，否则 cache-first 会让用户一直用旧脚本 */
var CACHE = 'qike-static-v3';
var ASSETS = [
  '/static/styles.css', '/static/anim.css', '/static/app.js',
  '/static/ext-batch.js', '/static/ext-classes.js', '/static/ext-quiz.js',
  '/static/ext-scores.js', '/static/ext-notify.js', '/static/ext-ops.js',
  '/static/ext-submit.js', '/static/ext-polish.js',
  '/static/manifest.json', '/assets/favicon.svg', '/assets/logo.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) {
      return c.add(u).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/p/') === 0) return;
  if (url.pathname.indexOf('/static/') !== 0 && url.pathname.indexOf('/assets/') !== 0) return;
  // network-first：在线时始终拿最新脚本/样式，离线才回退缓存。
  // 之前用 cache-first，改了 CSS 用户仍看旧版（侧栏分组就因此没生效）。
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
