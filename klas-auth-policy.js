(function attachAuthPolicy(root, factory) {
  const policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  if (root) root.KlasAuthPolicy = policy;
})(typeof window !== 'undefined' ? window : globalThis, function createAuthPolicy() {
  'use strict';

  const ACTIVE_STATUS = 'active';
  const ALLOWED_ROLES = Object.freeze(['user', 'moderator', 'admin']);
  const PROFILE_LIMITS = Object.freeze({
    fullName: 100,
    shortName: 30,
    city: 80,
    profession: 80,
    bio: 500,
    school: 120
  });

  const AUTH_MESSAGES = Object.freeze({
    'auth/popup-closed-by-user': 'Google giriş penjiresi tamamlanmazdan ýapyldy.',
    'auth/cancelled-popup-request': 'Öňki Google giriş synanyşygy bes edildi. Täzeden synanyşyň.',
    'auth/popup-blocked': 'Brauzer Google giriş penjiresini bloklady. Popup rugsadyny açyp täzeden synanyşyň.',
    'auth/operation-not-supported-in-this-environment': 'Bu brauzer Google giriş penjiresini açyp bilmedi. Adaty Chrome, Edge ýa-da Safari penjiresinden synanyşyň.',
    'auth/network-request-failed': 'Internet baglanyşygy sebäpli Google giriş başartmady.',
    'auth/unauthorized-domain': 'Bu domen Firebase Google giriş üçin rugsatlandyrylmady.',
    'auth/operation-not-allowed': 'Firebase Console-da Google giriş usuly açylmadyk.',
    'auth/account-exists-with-different-credential': 'Bu e-poçta başga giriş usuly bilen baglanyşykly.',
    'auth/user-disabled': 'Bu Google akkaunty Klas üçin öçürilen.',
    'auth/too-many-requests': 'Gaty köp giriş synanyşygy edildi. Biraz wagtdan gaýtadan synanyşyň.',
    'auth/web-storage-unsupported': 'Brauzer sessiýany saklamagy bloklaýar. Cookie we site data sazlamasyny barlaň.',
    'auth/internal-error': 'Google giriş hyzmatynda wagtlaýyn näsazlyk ýüze çykdy.',
    'klas/account-blocked': 'Bu Klas hasaby administrator tarapyndan bloklandy.',
    'klas/account-inactive': 'Bu Klas hasaby işjeň däl. Administrator bilen habarlaşyň.',
    'klas/account-missing': 'Klas akkaunty tapylmady. Täzeden giriş ediň.',
    'klas/auth-superseded': 'Giriş ýagdaýy üýtgedi. Täzeden synanyşyň.',
    'klas/auth-timeout': 'Google barlagy geçdi, emma Klas akkaunty wagtynda taýýarlanmady. Täzeden synanyşyň.',
    'klas/invalid-profile': 'Profil maglumatlaryny barlaň.'
  });

  function createError(code, message) {
    const error = new Error(message || AUTH_MESSAGES[code] || 'Google giriş başartmady.');
    error.name = 'KlasAuthError';
    error.code = code;
    return error;
  }

  function messageFor(error) {
    const code = String(error?.code || '');
    return AUTH_MESSAGES[code] || error?.message || 'Google giriş başartmady.';
  }

  function isExpectedError(error) {
    return String(error?.code || '').startsWith('klas/');
  }

  function isGoogleUser(user) {
    return Boolean(user?.uid && user.providerData?.some(item => item?.providerId === 'google.com'));
  }

  function identityFromUser(user) {
    const displayName = String(user?.displayName || '').trim().slice(0, 100);
    const photoURL = /^https:\/\/[^\s<>]+$/i.test(String(user?.photoURL || '').trim())
      ? String(user.photoURL).trim().slice(0, 2000)
      : '';
    return {
      uid: String(user?.uid || ''),
      email: String(user?.email || ''),
      displayName,
      photoURL,
      authProvider: 'google.com'
    };
  }

  function normalizeAccount(account = {}, { profileExists = false } = {}) {
    const hasStatus = typeof account.status === 'string' && account.status.length > 0;
    const status = !hasStatus || account.status === 'pending' ? ACTIVE_STATUS : account.status;
    const role = ALLOWED_ROLES.includes(account.role) ? account.role : 'user';
    const onboardingComplete = typeof account.onboardingComplete === 'boolean'
      ? account.onboardingComplete
      : Boolean(profileExists);
    return { role, status, onboardingComplete };
  }

  function assertActiveAccount(account) {
    if (!account) throw createError('klas/account-missing');
    if (account.status === 'blocked') throw createError('klas/account-blocked');
    if (account.status !== ACTIVE_STATUS) throw createError('klas/account-inactive');
    return account;
  }

  function cleanText(value, key, fallback = '') {
    const limit = PROFILE_LIMITS[key];
    const text = String(value ?? fallback ?? '').trim();
    if ((key === 'fullName' || key === 'shortName') && !text) {
      throw createError('klas/invalid-profile', key === 'fullName'
        ? 'Doly adyňyzy ýazyň.'
        : 'Gysga adyňyzy ýazyň.');
    }
    if (text.length > limit) {
      const labels = {
        fullName: 'Doly at', shortName: 'Gysga at', city: 'Şäher',
        profession: 'Hünär', bio: 'Bio', school: 'Mekdep ady'
      };
      throw createError('klas/invalid-profile', `${labels[key]} ${limit} belgiden uzyn bolmaly däl.`);
    }
    return text;
  }

  function normalizeAvatar(value, fallback = '') {
    const input = String(value ?? fallback ?? '').trim();
    if (!input) return '';
    let parsed;
    try { parsed = new URL(input); }
    catch { throw createError('klas/invalid-profile', 'Avatar URL salgysy nädogry.'); }
    if (parsed.protocol !== 'https:') {
      throw createError('klas/invalid-profile', 'Avatar üçin diňe HTTPS salgysy kabul edilýär.');
    }
    if (parsed.href.length > 2000) {
      throw createError('klas/invalid-profile', 'Avatar URL salgysy aşa uzyn.');
    }
    return parsed.href;
  }

  function normalizeGraduationYear(value, fallback = 2000) {
    const candidate = value === '' || value === null || value === undefined ? fallback : Number(value);
    if (!Number.isInteger(candidate) || candidate < 1900 || candidate > 2100) {
      throw createError('klas/invalid-profile', 'Uçurym ýyly 1900–2100 aralygynda bolmaly.');
    }
    return candidate;
  }

  function normalizeProfile(input = {}, fallback = {}) {
    return {
      fullName: cleanText(input.fullName, 'fullName', fallback.fullName),
      shortName: cleanText(input.shortName, 'shortName', fallback.shortName),
      city: cleanText(input.city, 'city', fallback.city),
      profession: cleanText(input.profession, 'profession', fallback.profession),
      bio: cleanText(input.bio, 'bio', fallback.bio),
      school: cleanText(input.school, 'school', fallback.school),
      graduationYear: normalizeGraduationYear(input.graduationYear, fallback.graduationYear),
      avatarURL: normalizeAvatar(input.avatarURL, fallback.avatarURL)
    };
  }

  function createBootstrapRegistry({ timeoutMs = 30000, retentionMs = 30000 } = {}) {
    const outcomes = new Map();
    const waiters = new Map();

    function remember(uid, outcome) {
      outcomes.set(uid, outcome);
      const timer = setTimeout(() => {
        if (outcomes.get(uid) === outcome) outcomes.delete(uid);
      }, retentionMs);
      timer?.unref?.();
    }

    function settle(uid, outcome) {
      if (!uid) return;
      remember(uid, outcome);
      const waiting = waiters.get(uid) || [];
      waiters.delete(uid);
      for (const item of waiting) {
        clearTimeout(item.timer);
        if (outcome.ok) item.resolve(outcome.value);
        else item.reject(outcome.error);
      }
    }

    function wait(uid) {
      if (!uid) return Promise.reject(createError('klas/account-missing'));
      const known = outcomes.get(uid);
      if (known) return known.ok ? Promise.resolve(known.value) : Promise.reject(known.error);
      return new Promise((resolve, reject) => {
        const item = { resolve, reject, timer: null };
        item.timer = setTimeout(() => {
          const waiting = (waiters.get(uid) || []).filter(entry => entry !== item);
          if (waiting.length) waiters.set(uid, waiting);
          else waiters.delete(uid);
          reject(createError('klas/auth-timeout'));
        }, timeoutMs);
        const waiting = waiters.get(uid) || [];
        waiting.push(item);
        waiters.set(uid, waiting);
      });
    }

    return Object.freeze({
      wait,
      resolve(uid, value) { settle(uid, { ok: true, value }); },
      reject(uid, error) { settle(uid, { ok: false, error }); }
    });
  }

  return Object.freeze({
    ACTIVE_STATUS,
    ALLOWED_ROLES,
    PROFILE_LIMITS,
    createError,
    messageFor,
    isExpectedError,
    isGoogleUser,
    identityFromUser,
    normalizeAccount,
    assertActiveAccount,
    normalizeProfile,
    createBootstrapRegistry
  });
});
