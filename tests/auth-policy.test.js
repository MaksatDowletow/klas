'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../klas-auth-policy.js');

test('Google is the only accepted authentication provider', () => {
  assert.equal(policy.isGoogleUser({
    uid: 'google-user',
    providerData: [{ providerId: 'google.com' }]
  }), true);
  assert.equal(policy.isGoogleUser({
    uid: 'password-user',
    providerData: [{ providerId: 'password' }]
  }), false);
  assert.equal(policy.isGoogleUser(null), false);
});

test('legacy accounts recover safely without changing blocked accounts', () => {
  assert.deepEqual(policy.normalizeAccount({}, { profileExists: false }), {
    role: 'user', status: 'active', onboardingComplete: false
  });
  assert.deepEqual(policy.normalizeAccount({
    role: 'legacy-owner', status: 'pending'
  }, { profileExists: true }), {
    role: 'user', status: 'active', onboardingComplete: true
  });
  assert.deepEqual(policy.normalizeAccount({
    role: 'admin', status: 'blocked', onboardingComplete: true
  }), {
    role: 'admin', status: 'blocked', onboardingComplete: true
  });
  assert.throws(
    () => policy.assertActiveAccount({ status: 'blocked' }),
    error => error.code === 'klas/account-blocked'
  );
  assert.throws(
    () => policy.assertActiveAccount({ status: 'review' }),
    error => error.code === 'klas/account-inactive'
  );
});

test('profile input is trimmed, bounded, and URL/year validated', () => {
  assert.deepEqual(policy.normalizeProfile({
    fullName: '  Maksat Döwle­tow  ',
    shortName: '  Maksat ',
    city: '  Aşgabat ',
    profession: ' Programmist ',
    bio: ' Salam ',
    school: ' Mekdep ',
    graduationYear: '2000',
    avatarURL: 'https://example.com/avatar.png'
  }), {
    fullName: 'Maksat Döwle­tow',
    shortName: 'Maksat',
    city: 'Aşgabat',
    profession: 'Programmist',
    bio: 'Salam',
    school: 'Mekdep',
    graduationYear: 2000,
    avatarURL: 'https://example.com/avatar.png'
  });
  assert.throws(
    () => policy.normalizeProfile({ fullName: '', shortName: 'M' }),
    error => error.code === 'klas/invalid-profile'
  );
  assert.throws(
    () => policy.normalizeProfile({
      fullName: 'Maksat', shortName: 'M', graduationYear: 2200
    }),
    error => error.code === 'klas/invalid-profile'
  );
  assert.throws(
    () => policy.normalizeProfile({
      fullName: 'Maksat', shortName: 'M', avatarURL: 'http://example.com/a.png'
    }),
    error => error.code === 'klas/invalid-profile'
  );
});

test('popup login can await account bootstrap even when auth finishes first', async () => {
  const registry = policy.createBootstrapRegistry({ timeoutMs: 100, retentionMs: 100 });
  const result = { needsOnboarding: true };
  registry.resolve('uid-ready', result);
  assert.equal(await registry.wait('uid-ready'), result);

  const waiting = registry.wait('uid-failed');
  registry.reject('uid-failed', policy.createError('klas/account-blocked'));
  await assert.rejects(waiting, error => error.code === 'klas/account-blocked');
});

test('account bootstrap timeout is explicit', async () => {
  const registry = policy.createBootstrapRegistry({ timeoutMs: 5, retentionMs: 5 });
  await assert.rejects(
    registry.wait('uid-timeout'),
    error => error.code === 'klas/auth-timeout'
  );
});
