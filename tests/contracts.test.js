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
  assert.ok(html.indexOf('klas-auth-policy.js') < html.indexOf('klas-backend-bootstrap.js'));
  assert.ok(html.indexOf('klas-presence-policy.js') < html.indexOf('klas-backend-bootstrap.js'));
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
  const policy = read('klas-auth-policy.js');
  const rules = read('firestore.rules');
  assert.match(core, /GoogleAuthProvider/);
  assert.match(core, /signInWithPopup/);
  assert.doesNotMatch(core, /signInWithRedirect/);
  assert.match(core, /authBootstrap\.wait\(credential\.user\.uid\)/);
  assert.match(core, /runTransaction\(db, async transaction =>/);
  assert.match(policy, /'klas\/account-blocked'/);
  assert.match(rules, /sign_in_provider == 'google\.com'/);
});

test('first-login bootstrap provisions the account before reading its profile', () => {
  const core = read('klas-backend-core.js');
  const rules = read('firestore.rules');
  const accountRead = core.indexOf('const userSnapshot = await getDoc(userRef)');
  const accountCreate = core.indexOf('await setDoc(userRef, {', accountRead);
  const profileRead = core.indexOf('const profileSnapshot = await getDoc(profileRef)', accountCreate);
  assert.ok(accountRead >= 0 && accountRead < accountCreate);
  assert.ok(accountCreate < profileRead);
  assert.doesNotMatch(core, /Promise\.all\(\[getDoc\(userRef\), getDoc\(profileRef\)\]\)/);
  assert.match(rules, /function canReadOwnProfile\(uid\)/);
  assert.match(rules, /allow read: if isActiveMember\(\) \|\| canReadOwnProfile\(uid\)/);
});

test('Firebase chat owns every production conversation entry point', () => {
  const chat = read('klas-backend-chat.js');
  const ui = read('klas-backend-ui.js');
  const rules = read('firestore.rules');
  assert.match(chat, /const snapshot = await getDoc\(reference\)/);
  assert.match(ui, /\[data-message-person\],\[data-online-chat\],\[data-search-person\],\[data-chat-choice\]/);
  assert.match(rules, /allow get: if isActiveMember\(\)/);
  assert.match(rules, /!exists\(conversationPath\(conversationId\)\)/);
  assert.match(rules, /conversationId == 'direct_'/);
  assert.match(rules, /isActiveAccount\(request\.resource\.data\.participants\[1\]\)/);
});

test('active accounts use session-scoped realtime presence instead of profile flags', () => {
  const core = read('klas-backend-core.js');
  const chat = read('klas-backend-chat.js');
  const people = read('klas-v4-2.js');
  const policy = read('klas-presence-policy.js');
  const rules = read('firestore.rules');
  assert.match(core, /collection\(db, 'presenceSessions'\)/);
  assert.match(core, /orderBy\('updatedAt', 'desc'\)/);
  assert.match(core, /presenceConfig\.heartbeatMs/);
  assert.match(core, /presencePolicy\.aggregate\(runtime\.presenceSessions\.values\(\)/);
  assert.match(policy, /age <= staleMs/);
  assert.match(core, /existingStatuses\.get\(uid\) \|\| 'none'/);
  assert.match(core, /window\.dispatchEvent\(new CustomEvent\('klas-presence'/);
  assert.match(chat, /window\.addEventListener\('klas-presence'/);
  assert.match(people, /class="presence-badge"/);
  assert.match(rules, /match \/presenceSessions\/\{sessionId\}/);
  assert.match(rules, /request\.resource\.data\.uid == request\.auth\.uid/);
  assert.match(rules, /allow delete: if isActiveMember\(\) && resource\.data\.uid == request\.auth\.uid/);
});

test('service worker precaches the architecture runtime', () => {
  const worker = read('service-worker.js');
  assert.match(worker, /\.\/klas-runtime\.js/);
  assert.match(worker, /\.\/klas-presence-policy\.js/);
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
