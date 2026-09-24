/* ============================================================
   小有计划 — Service Worker
   目标：可安装（PWA）+ 离线可打开。
   策略：
     - 导航请求（HTML）：network-first，失败回落缓存。保证内容永远最新，
       断网时仍能打开上次访问的页面。
     - 静态资源（css/js/图片/字体）：stale-while-revalidate，先给缓存求快，
       后台静默更新，下次访问即为新版。
     - 绝不缓存跨域的第三方请求失败结果，避免把错误响应钉死在缓存里。
   缓存版本号：每次发布新版务必 +1（与 HTML 中的 ?v= 版本号一起改），
   否则用户可能长期停留在旧文件上。
   ============================================================ */

var CACHE_VERSION = 'xyjh-v20260924c';
var CACHE_NAME = 'xyjh-static-' + CACHE_VERSION;

/* 预缓存：应用外壳。任一失败不影响安装，只记录告警。 */
var PRECACHE = [
  './',
  'index.html',
  'app.html',
  'help.html',
  'install.html',
  'about.html',
  'privacy.html',
  'terms.html',
  'css/style.css',
  'css/book.css',
  'js/app.js',
  'js/book.js',
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () {
            /* 单个文件缺失不阻断安装流程 */
            return null;
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          /* 清掉所有非当前版本的旧缓存 */
          if (key.indexOf('xyjh-') === 0 && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  /* 只处理 GET；POST / 跨域预检等直接放行 */
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  /* 第三方资源（字体 CDN 等）不进入缓存逻辑，交给浏览器默认行为 */
  if (url.origin !== self.location.origin) return;

  /* 导航请求：network-first，保证内容最新 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, copy).catch(function () {});
        });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('index.html');
        });
      })
    );
    return;
  }

  /* 静态资源：stale-while-revalidate */
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        /* 只缓存成功的同源响应，避免把 404/500 写进缓存 */
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy).catch(function () {});
          });
        }
        return res;
      }).catch(function () {
        return cached;
      });

      return cached || network;
    })
  );
});

/* 支持页面侧主动触发更新（预留） */
self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
