'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../klas-runtime.js');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    value: key => values.get(key)
  };
}

test('router accepts only known pages', () => {
  assert.equal(runtime.normalizePage('messages'), 'messages');
  assert.equal(runtime.normalizePage('#SETTINGS'), 'settings');
  assert.equal(runtime.pageFromHash('#events?source=test'), 'events');
  assert.equal(runtime.normalizePage('../admin'), 'feed');
  assert.equal(runtime.pageFromHash(''), 'feed');
});

test('event names use one stable namespace', () => {
  assert.equal(runtime.eventName('statechange'), 'klas:statechange');
  assert.equal(runtime.eventName('klas:pagechange'), 'klas:pagechange');
});

test('versioned store reads legacy state and writes an envelope', () => {
  const storage = memoryStorage({ state: JSON.stringify({ dark: true }) });
  const store = runtime.createStorage({ storage, key: 'state' });
  assert.deepEqual(store.read({}), { dark: true });
  assert.equal(store.write({ dark: false }), true);
  const persisted = JSON.parse(storage.value('state'));
  assert.equal(persisted.marker, 'klas-store');
  assert.equal(persisted.schema, runtime.SCHEMA_VERSION);
  assert.deepEqual(persisted.data, { dark: false });
});

test('versioned store returns an isolated fallback for corrupt JSON', () => {
  const storage = memoryStorage({ state: '{not-json' });
  const failures = [];
  const fallback = { posts: [] };
  const store = runtime.createStorage({ storage, key: 'state', onError: error => failures.push(error) });
  const restored = store.read(fallback);
  restored.posts.push('local');
  assert.deepEqual(fallback, { posts: [] });
  assert.equal(failures.length, 1);
  assert.equal(store.diagnostics().lastError.context, 'storage:read');
});

test('storage write failures are contained and observable', () => {
  const store = runtime.createStorage({
    storage: {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded'); },
      removeItem: () => {}
    },
    key: 'state'
  });
  assert.equal(store.write({ large: true }), false);
  assert.equal(store.diagnostics().lastError.message, 'quota exceeded');
});

test('error normalisation strips URLs and limits exposed detail', () => {
  const entry = runtime.normaliseError(
    new Error(`Request https://example.test/token?secret=1 failed ${'x'.repeat(400)}`),
    'network'
  );
  assert.equal(entry.context, 'network');
  assert.match(entry.message, /\[URL\]/);
  assert.doesNotMatch(entry.message, /secret=1/);
  assert.ok(entry.message.length <= 240);
});
