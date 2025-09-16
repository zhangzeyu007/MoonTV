/* eslint-env serviceworker */
/* eslint no-undef: off, no-unused-vars: off, no-redeclare: off */

if (!self.define) {
  let e,
    s = {};
  const n = (n, a) => (
    (n = new URL(n + '.js', a).href),
    s[n] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script');
          (e.src = n), (e.onload = s), document.head.appendChild(e);
        } else (e = n), importScripts(n), s();
      }).then(() => {
        let e = s[n];
        if (!e) throw new Error(`Module ${n} didn't register its module`);
        return e;
      })
  );
  self.define = (a, t) => {
    const i =
      e ||
      ('document' in self ? document.currentScript.src : '') ||
      location.href;
    if (s[i]) return;
    let c = {};
    const r = (e) => n(e, i),
      o = { module: { uri: i }, exports: c, require: r };
    s[i] = Promise.all(a.map((e) => o[e] || r(e))).then((e) => (t(...e), c));
  };
}
define(['./workbox-e9849328'], function (e) {
  'use strict';
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: '/_next/app-build-manifest.json',
          revision: 'd76acc4992ce96c22e2fe6563b5f15aa',
        },
        {
          url: '/_next/static/NSpZjqrS3nU3sNAtBv_wa/_buildManifest.js',
          revision: '85aecd8a55db42fc901f52386fd2a680',
        },
        {
          url: '/_next/static/NSpZjqrS3nU3sNAtBv_wa/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        {
          url: '/_next/static/chunks/180-9f7b03cf3105da2f.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/242-3804d87f50553b94.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/348-637558541eb689b6.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/385-265b85dcb2eadb84.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/481-6efe4dc7aacbadc5.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/501-0a13873286897e6b.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/78-7afa84af29b2577e.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/866-d2269a3038f10b5a.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-d6cb5fee19b812f4.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/app/admin/page-4958acff0392674c.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/app/douban/page-b556105e0bbdd409.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/app/layout-a07c83d70369ab79.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/app/login/page-fdc58211b8206eba.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/app/page-96c9633cf606e8fd.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/app/play/page-6bb597cf58b6b35d.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/app/search/page-4ab69a615b5cec9b.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/b145b63a-b7e49c063d2fa255.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/c72274ce-909438a8a5dd87a5.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/da9543df-c2ce5269243dd748.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/framework-6e06c675866dc992.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/main-1cb0a9780700dc53.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/main-app-a86726066027ae5b.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/pages/_app-3fcac1a2c632f1ef.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/pages/_error-d3fe151bf402c134.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-4a57793b45c0f940.js',
          revision: 'NSpZjqrS3nU3sNAtBv_wa',
        },
        {
          url: '/_next/static/css/23100062f5d4aac0.css',
          revision: '23100062f5d4aac0',
        },
        {
          url: '/_next/static/css/659d29df73f2b7b0.css',
          revision: '659d29df73f2b7b0',
        },
        {
          url: '/_next/static/media/19cfc7226ec3afaa-s.woff2',
          revision: '9dda5cfc9a46f256d0e131bb535e46f8',
        },
        {
          url: '/_next/static/media/21350d82a1f187e9-s.woff2',
          revision: '4e2553027f1d60eff32898367dd4d541',
        },
        {
          url: '/_next/static/media/8e9860b6e62d6359-s.woff2',
          revision: '01ba6c2a184b8cba08b0d57167664d75',
        },
        {
          url: '/_next/static/media/ba9851c3c22cd980-s.woff2',
          revision: '9e494903d6b0ffec1a1e14d34427d44d',
        },
        {
          url: '/_next/static/media/c5fe6dc8356a8c31-s.woff2',
          revision: '027a89e9ab733a145db70f09b8a18b42',
        },
        {
          url: '/_next/static/media/df0a9ae256c0569c-s.woff2',
          revision: 'd54db44de5ccb18886ece2fda72bdfe0',
        },
        {
          url: '/_next/static/media/e4af272ccee01ff0-s.p.woff2',
          revision: '65850a373e258f1c897a2b3d75eb74de',
        },
        { url: '/favicon.ico', revision: '2a440afb7f13a0c990049fc7c383bdd4' },
        {
          url: '/icons/icon-192x192.png',
          revision: 'e214d3db80d2eb6ef7a911b3f9433b81',
        },
        {
          url: '/icons/icon-256x256.png',
          revision: 'a5cd7490191373b684033f1b33c9d9da',
        },
        {
          url: '/icons/icon-384x384.png',
          revision: '8540e29a41812989d2d5bf8f61e1e755',
        },
        {
          url: '/icons/icon-512x512.png',
          revision: '3e5597604f2c5d99d7ab62b02f6863d3',
        },
        { url: '/logo.png', revision: '5c1047adbe59b9a91cc7f8d3d2f95ef4' },
        { url: '/manifest.json', revision: 'f8a4f2b082d6396d3b1a84ce0e267dfe' },
        { url: '/robots.txt', revision: '0483b37fb6cf7455cefe516197e39241' },
        {
          url: '/screenshot.png',
          revision: '05a86e8d4faae6b384d19f02173ea87f',
        },
      ],
      { ignoreURLParametersMatching: [] }
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({
              request: _e,
              response: s,
              event: _n,
              state: _a,
            }) =>
              s && 'opaqueredirect' === s.type
                ? new Response(s.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: s.headers,
                  })
                : s,
          },
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-font-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: 'static-audio-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:mp4)$/i,
      new e.CacheFirst({
        cacheName: 'static-video-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-js-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-style-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-data',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({
        cacheName: 'static-data-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      ({ url: _e }) => {
        if (!(self.origin === _e.origin)) return !1;
        const s = _e.pathname;
        return !s.startsWith('/api/auth/') && !!s.startsWith('/api/');
      },
      new e.NetworkFirst({
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      ({ url: _e }) => {
        if (!(self.origin === _e.origin)) return !1;
        return !_e.pathname.startsWith('/api/');
      },
      new e.NetworkFirst({
        cacheName: 'others',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      ({ url: _e }) => !(self.origin === _e.origin),
      new e.NetworkFirst({
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 }),
        ],
      }),
      'GET'
    );
});
