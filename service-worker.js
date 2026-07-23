'use strict';

const CACHE_VERSION = 'klas-shell-v6.0.2';
const APP_BASE = new URL('./', self.registration.scope);
const appUrl = path => new URL(path, APP_BASE).href;
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './privacy.html',
  './manifest.webmanifest',
  './health.json',
  './klas-v4.css',
  './klas-backend.css',
  './klas-livechat.css',
  './klas-design-system.css',
  './klas-media-viewer.css',
  './klas-config.js',
  './klas-runtime.js',
  './klas-auth-policy.js',
  './klas-media-viewer.js',
  './klas-v4-1.js',
  './klas-v4-2.js',
  './klas-v4-3.js',
  './klas-v4-4.js',
  './klas-bridge.js',
  './klas-pwa.js',
  './klas-backend-bootstrap.js',
  './klas-backend-core.js',
  './klas-backend-ui.js',
  './klas-backend-chat.js',
  './klas-backend-community.js',
  './klas-backend-notifications.js',
  './klas-backend-video.js',
  './klas-backend-realtime.js',
  './assets/icons/klas-icon.svg',
  './assets/icons/klas-maskable.svg',
  './assets/icons/klas-180.png',
  './assets/icons/klas-192.png',
  './assets/icons/klas-512.png',
  './assets/icons/klas-maskable-192.png',
  './assets/icons/klas-maskable-512.png'
].map(appUrl);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key.startsWith('klas-shell-') && key !== CACHE_VERSION)
      .map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirstNavigation(request){
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(appUrl('./index.html'), response.clone());
    return response;
  } catch {
    return (await cache.match(appUrl('./index.html')))
      || (await cache.match(appUrl('./offline.html')))
      || Response.error();
  }
}

async function cacheFirstStatic(request){
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const url = new URL(request.url);
    await cache.put(`${url.origin}${url.pathname}`, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  event.respondWith(cacheFirstStatic(request));
});
