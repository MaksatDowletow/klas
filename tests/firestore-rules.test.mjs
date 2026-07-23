import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore';

const projectId = 'demo-klas-auth';
let environment;

function googleContext(uid = 'google-user') {
  return environment.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' }
  });
}

function passwordContext(uid = 'password-user') {
  return environment.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    firebase: { sign_in_provider: 'password' }
  });
}

function newAccount(uid, overrides = {}) {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: 'Täze ulanyjy',
    photoURL: 'https://example.com/avatar.png',
    authProvider: 'google.com',
    role: 'user',
    status: 'active',
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

function newProfile(uid, overrides = {}) {
  return {
    uid,
    fullName: 'Täze Ulanyjy',
    shortName: 'Täze',
    avatarURL: 'https://example.com/avatar.png',
    city: 'Aşgabat',
    profession: 'Programmist',
    bio: '',
    school: 'Öde Abdullaýew adyndaky mekdep',
    graduationYear: 2000,
    online: true,
    lastSeen: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

async function seedAccount(uid, overrides = {}) {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users', uid), {
      uid,
      email: `${uid}@example.com`,
      displayName: uid,
      photoURL: '',
      authProvider: 'google.com',
      role: 'user',
      status: 'active',
      onboardingComplete: false,
      createdAt: new Date(),
      lastLogin: new Date(),
      updatedAt: new Date(),
      ...overrides
    });
  });
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') }
  });
});

beforeEach(async () => environment.clearFirestore());
after(async () => environment.cleanup());

test('only Google users can create a least-privilege account', async () => {
  const googleDb = googleContext('new-google').firestore();
  const passwordDb = passwordContext('new-password').firestore();

  await assertSucceeds(setDoc(doc(googleDb, 'users', 'new-google'), newAccount('new-google')));
  await assertFails(setDoc(doc(passwordDb, 'users', 'new-password'), newAccount('new-password')));
  await assertFails(setDoc(
    doc(googleContext('attacker').firestore(), 'users', 'attacker'),
    newAccount('attacker', { role: 'admin' })
  ));
});

test('first login can inspect its own profile only after account provisioning', async () => {
  const uid = 'first-login-user';
  const db = googleContext(uid).firestore();
  const ownProfile = doc(db, 'profiles', uid);

  await assertFails(getDoc(ownProfile));
  await assertSucceeds(setDoc(doc(db, 'users', uid), newAccount(uid)));
  const emptyProfile = await assertSucceeds(getDoc(ownProfile));
  assert.equal(emptyProfile.exists(), false);
  await assertSucceeds(setDoc(ownProfile, newProfile(uid)));
  await assertSucceeds(getDoc(ownProfile));
  await assertFails(getDocs(collection(db, 'profiles')));
});

test('onboarding profile and consent become visible in one atomic commit', async () => {
  const uid = 'onboarding-user';
  const db = googleContext(uid).firestore();
  await assertSucceeds(setDoc(doc(db, 'users', uid), newAccount(uid)));
  await assertSucceeds(setDoc(doc(db, 'profiles', uid), newProfile(uid)));
  await assertFails(getDocs(collection(db, 'profiles')));

  const batch = writeBatch(db);
  batch.set(doc(db, 'profiles', uid), {
    fullName: 'Onboarding User',
    shortName: 'Onboarding',
    updatedAt: serverTimestamp()
  }, { merge: true });
  batch.set(doc(db, 'users', uid), {
    onboardingComplete: true,
    acceptedCommunityRulesAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDocs(collection(db, 'profiles')));
});

test('members cannot elevate role, change status, or undo onboarding', async () => {
  const uid = 'ordinary-user';
  await seedAccount(uid, { onboardingComplete: true });
  const db = googleContext(uid).firestore();
  const accountRef = doc(db, 'users', uid);

  await assertFails(setDoc(accountRef, {
    role: 'admin', updatedAt: serverTimestamp()
  }, { merge: true }));
  await assertFails(setDoc(accountRef, {
    status: 'blocked', updatedAt: serverTimestamp()
  }, { merge: true }));
  await assertFails(setDoc(accountRef, {
    onboardingComplete: false, updatedAt: serverTimestamp()
  }, { merge: true }));
});

test('onboarding cannot be completed without a profile and recorded consent', async () => {
  const uid = 'incomplete-user';
  await seedAccount(uid);
  const db = googleContext(uid).firestore();
  await assertFails(setDoc(doc(db, 'users', uid), {
    onboardingComplete: true,
    updatedAt: serverTimestamp()
  }, { merge: true }));
  await assertFails(setDoc(doc(db, 'users', uid), {
    onboardingComplete: true,
    acceptedCommunityRulesAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true }));
});

test('safe legacy recovery allows pending to active but never blocked to active', async () => {
  await seedAccount('legacy-user', { role: 'legacy-owner', status: 'pending' });
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'profiles', 'legacy-user'), {
      ...newProfile('legacy-user'),
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });
  const legacyDb = googleContext('legacy-user').firestore();
  await assertSucceeds(getDoc(doc(legacyDb, 'profiles', 'legacy-user')));
  await assertSucceeds(setDoc(doc(legacyDb, 'users', 'legacy-user'), {
    role: 'user',
    status: 'active',
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true }));

  await seedAccount('blocked-user', { status: 'blocked' });
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'profiles', 'blocked-user'), {
      ...newProfile('blocked-user'),
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });
  const blockedDb = googleContext('blocked-user').firestore();
  await assertFails(setDoc(doc(blockedDb, 'users', 'blocked-user'), {
    status: 'active',
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true }));
  await assertFails(getDoc(doc(blockedDb, 'profiles', 'blocked-user')));
  await assertFails(getDocs(collection(blockedDb, 'profiles')));
});

test('profile schema rejects invalid years and unexpected fields', async () => {
  const uid = 'profile-user';
  await seedAccount(uid);
  const db = googleContext(uid).firestore();

  await assertFails(setDoc(doc(db, 'profiles', uid), newProfile(uid, {
    graduationYear: 2200
  })));
  await assertFails(setDoc(doc(db, 'profiles', uid), newProfile(uid, {
    email: 'leak@example.com'
  })));
  await assertFails(setDoc(doc(db, 'profiles', uid), newProfile(uid, {
    unexpectedAdminFlag: true
  })));
  await assertSucceeds(setDoc(doc(db, 'profiles', uid), newProfile(uid)));
  assert.ok(true);
});
