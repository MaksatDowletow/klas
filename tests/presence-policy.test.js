'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../klas-presence-policy.js');

test('one fresh session keeps a multi-tab account online', () => {
  const now = 1_000_000;
  const result = policy.aggregate([
    { uid: 'alice', state: 'offline', updatedAt: new Date(now - 1000) },
    { uid: 'alice', state: 'online', updatedAt: new Date(now - 3000) }
  ], { now, staleMs: 10000 });
  assert.equal(result.get('alice').online, true);
  assert.equal(result.get('alice').timestamp, now - 1000);
});

test('a crashed session expires without an explicit offline write', () => {
  const now = 2_000_000;
  const result = policy.aggregate([
    { uid: 'alice', state: 'online', updatedAt: new Date(now - 105001) }
  ], { now, staleMs: 105000 });
  assert.equal(result.get('alice').online, false);
  assert.equal(result.get('alice').timestamp, now - 105001);
});

test('invalid sessions do not enter the online set', () => {
  const result = policy.aggregate([
    { uid: '', state: 'online', updatedAt: new Date() },
    { uid: 'bob', state: 'online', updatedAt: null }
  ]);
  assert.equal(result.size, 0);
});
