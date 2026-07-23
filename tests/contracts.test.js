'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('HTML loads the runtime before feature scripts and design system last', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('klas-runtime.js') < html.indexOf('klas-v4-1.js'));
  assert.ok(html.indexOf('klas-media-viewer.js') < html.indexOf('klas-v4-1.js'));
  assert.ok(html.indexOf('klas-design-system.css') > html.indexOf('klas-livechat.css'));
  assert.ok(html.indexOf('klas-media-viewer.css') > html.indexOf('klas-design-system.css'));
  assert.match(html, /id="appErrorBanner"[^>]*role="alert"[^>]*hidden/);
  assert.match(html, /id="appRuntimeStatus"[^>]*role="status"/);
});

test('HTML IDs remain unique', () => {
  const html = read('index.html');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('release and offline shell versions stay aligned', () => {
  const runtime = require('../klas-runtime.js');
  const config = read('klas-config.js');
  const health = JSON.parse(read('health.json'));
  const serviceWorker = read('service-worker.js');
  const deployment = read('DEPLOYMENT_VERSION');
  assert.match(config, new RegExp(`version: '${health.version.replaceAll('.', '\\.')}'`));
  assert.match(serviceWorker, new RegExp(`klas-shell-v${health.version.replaceAll('.', '\\.')}`));
  assert.match(deployment, new RegExp(`Klas v${health.version.replaceAll('.', '\\.')}`));
  assert.equal(runtime.APP_VERSION, health.version);
});

test('authentication remains Google popup only', () => {
  const core = read('klas-backend-core.js');
  const rules = read('firestore.rules');
  assert.match(core, /GoogleAuthProvider/);
  assert.match(core, /signInWithPopup/);
  assert.doesNotMatch(core, /signInWithRedirect/);
  assert.match(rules, /sign_in_provider == 'google\.com'/);
});

test('service worker precaches the architecture runtime', () => {
  const worker = read('service-worker.js');
  assert.match(worker, /\.\/klas-runtime\.js/);
  assert.match(worker, /\.\/klas-design-system\.css/);
  assert.match(worker, /\.\/klas-media-viewer\.js/);
  assert.match(worker, /\.\/klas-media-viewer\.css/);
});

test('media grid and post media use the shared viewer', () => {
  const media = read('klas-v4-3.js');
  const posts = read('klas-v4-2.js');
  assert.match(media, /KlasMediaViewer\?\.open/);
  assert.match(media, /cloudinaryThumbnail/);
  assert.match(posts, /data-post-media/);
  assert.match(posts, /KlasMediaViewer\?\.open/);
});

test('Cloudinary configuration is central and requires no member setup', () => {
  const html = read('index.html');
  const config = read('klas-config.js');
  const core = read('klas-backend-core.js');
  const ui = read('klas-backend-ui.js');
  assert.doesNotMatch(html, /configureCloudinaryBtn|cloudinaryState/);
  assert.match(html, /Media ýüklemesi/);
  assert.match(html, /Awto sazlanan/);
  assert.match(config, /cloudName: 'fitojlfl'/);
  assert.match(config, /uploadPreset: 'klas_unsigned'/);
  assert.match(core, /return config\.cloudinary \|\| \{\}/);
  assert.doesNotMatch(core, /klas-cloudinary-public-config|cloudStore|saveCloudConfig/);
  assert.doesNotMatch(ui, /cloudSettings|configureCloudinaryBtn|saveCloudConfig/);
});
