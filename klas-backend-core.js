import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

export const config = window.KLAS_CONFIG;
export const bridge = window.KlasBridge;
export const authPolicy = window.KlasAuthPolicy;
if (!config?.firebase?.projectId) throw new Error('Firebase konfigurasiýasy tapylmady.');
if (!bridge) throw new Error('Klas bridge moduly tapylmady.');
if (!authPolicy) throw new Error('Klas auth policy moduly tapylmady.');

export const app = initializeApp(config.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
provider.addScope('email');
auth.useDeviceLanguage();

export const runtime = {
  user: null,
  profile: null,
  account: null,
  profiles: new Map(),
  posts: new Map(),
  subscriptions: [],
  authPersistence: 'checking'
};

export const $ = selector => document.querySelector(selector);
export const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
export const toast = text => bridge.toast(text);

let presenceSequence = Promise.resolve();
let authOperation = null;
let authRevision = 0;
let lastAuthFailure = null;
const authBootstrap = authPolicy.createBootstrapRegistry();

export function millis(value){
  return value?.toMillis?.() || value?.seconds * 1000 || Date.parse(value || '') || 0;
}

export function timeLabel(value){
  const timestamp = millis(value);
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (!timestamp || elapsed < 60000) return 'häzir';
  if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)} minut öň`;
  if (elapsed < 86400000) return `${Math.floor(elapsed / 3600000)} sagat öň`;
  return new Intl.DateTimeFormat('tk-TM', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(timestamp));
}

export function normalizeHttpUrl(value, { allowEmpty = true } = {}){
  const input = String(value || '').trim();
  if (!input && allowEmpty) return '';
  let parsed;
  try { parsed = new URL(input); }
  catch { throw new Error('URL salgysy nädogry.'); }
  if (parsed.protocol !== 'https:') throw new Error('Diňe HTTPS salgysy kabul edilýär.');
  return parsed.href;
}

export function setStatus(text, kind = 'idle'){
  const element = $('#backendStatus');
  if (!element) return;
  element.textContent = text;
  element.title = text;
  element.classList.toggle('online', kind === 'online');
  element.classList.toggle('error', kind === 'error');
}

export function handleError(error, prefix = 'Firebase ýalňyşlygy'){
  console.error(prefix, error);
  window.KlasRuntime?.reportError(error, `firebase:${prefix}`);
  const code = error?.code || error?.message || 'unknown';
  setStatus(`${prefix}: ${code}`, 'error');
  if (String(code).includes('permission-denied')) toast(`${prefix}. Firestore Rules sazlamasyny barlaň.`);
}

export function authErrorMessage(error){
  return authPolicy.messageFor(error);
}

function updateAuthButton({ busy = false, signedIn = Boolean(runtime.user) } = {}){
  const button = $('#authBtn');
  if (!button) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  if (busy) {
    button.textContent = signedIn ? 'Çykylýar…' : 'Garaşyň…';
    button.setAttribute('aria-label', button.textContent);
    return;
  }
  button.textContent = signedIn ? 'Çykmak' : 'Google giriş';
  button.setAttribute('aria-label', signedIn
    ? `${runtime.user?.displayName || 'Google'} akkauntyndan çykmak`
    : 'Google bilen giriş ýa-da akkaunt döretmek');
  button.classList.toggle('signed-in', signedIn);
}

export function cloudConfig(){
  return config.cloudinary || {};
}

export function cloudReady(){
  const value = cloudConfig();
  return Boolean(value.cloudName && value.uploadPreset);
}

export async function uploadMedia(file, folder = 'klas/posts'){
  if (!file) return '';
  const value = cloudConfig();
  if (!cloudReady()) throw new Error('Klas media hyzmatynyň merkezi konfigurasiýasy doly däl.');
  const video = file.type.startsWith('video/');
  const image = file.type.startsWith('image/');
  if (!video && !image) throw new Error('Diňe surat ýa-da wideo kabul edilýär.');
  const maxBytes = video ? value.maxVideoBytes : value.maxImageBytes;
  if (file.size > maxBytes) throw new Error(`Faýl ${Math.round(maxBytes / 1048576)} MB çäginden uly.`);

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', value.uploadPreset);
  form.append('folder', folder);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(value.cloudName)}/${video ? 'video' : 'image'}/upload`,
    { method: 'POST', body: form }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) throw new Error(data?.error?.message || 'Cloudinary ýüklemesi başartmady.');
  return normalizeHttpUrl(data.secure_url, { allowEmpty: false });
}

export async function login(){
  if (authOperation) return authOperation;
  if (!navigator.onLine) throw new Error('Google giriş üçin internet baglanyşygy gerek.');
  authOperation = (async () => {
    updateAuthButton({ busy: true, signedIn: false });
    const credential = await signInWithPopup(auth, provider);
    return authBootstrap.wait(credential.user.uid);
  })();
  try { return await authOperation; }
  finally {
    authOperation = null;
    updateAuthButton({ signedIn: Boolean(runtime.user?.uid && runtime.user.uid === auth.currentUser?.uid) });
  }
}

async function setPresence(online){
  const user = auth.currentUser;
  if (!user) return;
  presenceSequence = presenceSequence
    .catch(() => {})
    .then(() => setDoc(doc(db, 'profiles', user.uid), {
      uid: user.uid,
      online: Boolean(online),
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true }));
  await presenceSequence;
}

export async function logout(){
  if (authOperation) return authOperation;
  authOperation = (async () => {
    updateAuthButton({ busy: true, signedIn: true });
    await setPresence(false).catch(() => {});
    await signOut(auth);
  })();
  try { return await authOperation; }
  finally {
    authOperation = null;
    updateAuthButton({ signedIn: Boolean(auth.currentUser) });
  }
}

async function ensureProfile(user){
  const userRef = doc(db, 'users', user.uid);
  const profileRef = doc(db, 'profiles', user.uid);
  const userSnapshot = await getDoc(userRef);

  const isNewAccount = !userSnapshot.exists();
  const previousAccount = userSnapshot.data() || {};
  const identity = authPolicy.identityFromUser(user);
  if (isNewAccount) {
    await setDoc(userRef, {
      ...identity,
      role: 'user',
      status: 'active',
      onboardingComplete: false,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else if (previousAccount.status === 'blocked') {
    throw authPolicy.createError('klas/account-blocked');
  } else if (previousAccount.status
      && !['active', 'pending'].includes(previousAccount.status)) {
    throw authPolicy.createError('klas/account-inactive');
  }

  // A new Google member must be provisioned before Firestore can safely allow
  // the member to inspect or repair only their own profile document.
  const profileSnapshot = await getDoc(profileRef);

  if (!isNewAccount) {
    const normalized = authPolicy.normalizeAccount(previousAccount, {
      profileExists: profileSnapshot.exists()
    });
    const legacyConsent = typeof previousAccount.onboardingComplete !== 'boolean'
      && normalized.onboardingComplete
      ? { acceptedCommunityRulesAt: serverTimestamp() }
      : {};
    await setDoc(userRef, {
      ...identity,
      ...normalized,
      ...legacyConsent,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  const account = authPolicy.assertActiveAccount((await getDoc(userRef)).data());

  const base = {
    uid: user.uid,
    fullName: identity.displayName || identity.email.split('@')[0] || 'Klas ulanyjysy',
    shortName: (identity.displayName || 'Ulanyjy').split(/\s+/)[0].slice(0, 30),
    avatarURL: identity.photoURL,
    city: '',
    bio: '',
    profession: '',
    school: 'Öde Abdullaýew adyndaky mekdep',
    graduationYear: 2000,
    online: true
  };
  base.fullName = base.fullName.slice(0, 100);

  if (!profileSnapshot.exists()) {
    await setDoc(profileRef, {
      ...base,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });
  } else {
    const previousProfile = profileSnapshot.data() || {};
    const repairText = (value, fallback, max, required = false) => {
      const text = typeof value === 'string' ? value.trim() : '';
      if (text.length > max || (required && !text)) return fallback;
      return text;
    };
    const repaired = authPolicy.normalizeProfile({
      fullName: repairText(previousProfile.fullName, base.fullName, 100, true),
      shortName: repairText(previousProfile.shortName, base.shortName, 30, true),
      avatarURL: typeof previousProfile.avatarURL === 'string'
      && /^https:\/\/[^\s<>]+$/i.test(previousProfile.avatarURL)
      ? previousProfile.avatarURL
      : base.avatarURL,
      city: repairText(previousProfile.city, '', 80),
      bio: repairText(previousProfile.bio, '', 500),
      profession: repairText(previousProfile.profession, '', 80),
      school: repairText(previousProfile.school, base.school, 120),
      graduationYear: Number.isInteger(previousProfile.graduationYear)
        && previousProfile.graduationYear >= 1900
        && previousProfile.graduationYear <= 2100
        ? previousProfile.graduationYear
        : base.graduationYear
    }, base);
    await setDoc(profileRef, {
      uid: user.uid,
      ...repaired,
      email: deleteField(),
      role: deleteField(),
      status: deleteField(),
      admin: deleteField(),
      online: true,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  const profile = {
    ...base,
    ...(await getDoc(profileRef)).data(),
    role: account.role || 'user',
    status: account.status || 'active'
  };
  delete profile.email;
  return {
    account,
    profile,
    isNewAccount,
    needsOnboarding: isNewAccount || account.onboardingComplete === false
  };
}

export async function saveProfile(data){
  if (!runtime.user) throw new Error('Ilki Google bilen giriş ediň.');
  const clean = authPolicy.normalizeProfile(data, runtime.profile || {});
  await setDoc(doc(db, 'profiles', runtime.user.uid), {
    ...clean,
    uid: runtime.user.uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  runtime.profile = { ...runtime.profile, ...clean };
  bridge.setCurrentUser(runtime.profile);
  return clean;
}

export async function completeOnboarding(data){
  if (!runtime.user) throw new Error('Ilki Google bilen giriş ediň.');
  const uid = runtime.user.uid;
  const clean = authPolicy.normalizeProfile(data, runtime.profile || {});
  const userRef = doc(db, 'users', uid);
  const profileRef = doc(db, 'profiles', uid);
  await runTransaction(db, async transaction => {
    const accountSnapshot = await transaction.get(userRef);
    const account = authPolicy.assertActiveAccount(accountSnapshot.exists()
      ? accountSnapshot.data()
      : null);
    transaction.set(profileRef, {
      ...clean,
      uid,
      updatedAt: serverTimestamp()
    }, { merge: true });
    transaction.set(userRef, {
      onboardingComplete: true,
      acceptedCommunityRulesAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return account;
  });
  runtime.account = { ...runtime.account, onboardingComplete: true };
  runtime.profile = { ...runtime.profile, ...clean };
  bridge.setCurrentUser(runtime.profile);
  await startMemberData();
  window.dispatchEvent(new CustomEvent('klas-account', {
    detail: { user: runtime.user, account: runtime.account, profile: runtime.profile }
  }));
}

function publicRole(profile){
  const role = runtime.account?.role || 'user';
  if (role === 'admin') return 'Administrator';
  if (role === 'moderator') return 'Moderator';
  return profile.profession || 'Klas agzasy';
}

export async function createPost({ text, imageURL = '', videoURL = '' }){
  if (!runtime.user) throw new Error('Post üçin Google bilen giriş ediň.');
  const cleanText = String(text || '').trim();
  if (cleanText.length > 5000) throw new Error('Post 5000 belgiden uzyn bolmaly däl.');
  const image = normalizeHttpUrl(imageURL);
  const video = normalizeHttpUrl(videoURL);
  if (!cleanText && !image && !video) throw new Error('Tekst ýa-da media gerek.');
  const profile = runtime.profile || {};
  return addDoc(collection(db, 'posts'), {
    authorId: runtime.user.uid,
    authorName: profile.fullName || runtime.user.displayName || 'Ulanyjy',
    authorAvatar: profile.avatarURL || runtime.user.photoURL || '',
    authorRole: publicRole(profile),
    text: cleanText,
    imageURL: image,
    videoURL: video,
    visibility: 'public',
    likesCount: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function toggleLike(id){
  if (!runtime.user) throw new Error('Giriş gerek.');
  const postRef = doc(db, 'posts', id);
  const likeRef = doc(db, 'posts', id, 'likes', runtime.user.uid);
  let liked = false;
  await runTransaction(db, async transaction => {
    const [postSnapshot, likeSnapshot] = await Promise.all([
      transaction.get(postRef), transaction.get(likeRef)
    ]);
    if (!postSnapshot.exists()) throw new Error('Post tapylmady.');
    const count = Number(postSnapshot.data().likesCount) || 0;
    if (likeSnapshot.exists()) {
      transaction.delete(likeRef);
      transaction.update(postRef, {
        likesCount: Math.max(0, count - 1),
        updatedAt: serverTimestamp()
      });
    } else {
      transaction.set(likeRef, {
        userId: runtime.user.uid,
        createdAt: serverTimestamp()
      });
      transaction.update(postRef, {
        likesCount: count + 1,
        updatedAt: serverTimestamp()
      });
      liked = true;
    }
  });
  return liked;
}

export async function addComment(id, text){
  if (!runtime.user) throw new Error('Giriş gerek.');
  const clean = String(text || '').trim();
  if (!clean) return;
  if (clean.length > 2000) throw new Error('Teswir 2000 belgiden uzyn bolmaly däl.');
  const postRef = doc(db, 'posts', id);
  await addDoc(collection(postRef, 'comments'), {
    authorId: runtime.user.uid,
    authorName: runtime.profile?.fullName || runtime.user.displayName || 'Ulanyjy',
    authorAvatar: runtime.profile?.avatarURL || runtime.user.photoURL || '',
    text: clean,
    createdAt: serverTimestamp()
  });
}

export async function deletePost(id){
  if (!runtime.user) throw new Error('Giriş gerek.');
  await deleteDoc(doc(db, 'posts', id));
}

async function isLiked(id){
  return runtime.user
    ? (await getDoc(doc(db, 'posts', id, 'likes', runtime.user.uid))).exists()
    : false;
}

function subscribePosts(){
  runtime.subscriptions.push(onSnapshot(
    query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(25)),
    async snapshot => {
      runtime.posts = new Map(snapshot.docs.map(item => [item.id, { id: item.id, ...item.data() }]));
      const list = await Promise.all(snapshot.docs.map(async item => {
        const data = item.data();
        return {
          id: item.id,
          remote: true,
          ownerId: data.authorId,
          authorId: data.authorId,
          author: data.authorName || 'Ulanyjy',
          role: data.authorRole || 'Klas agzasy',
          avatar: data.authorAvatar || '',
          time: timeLabel(data.createdAt),
          text: data.text || '',
          image: data.imageURL || '',
          video: data.videoURL || '',
          likes: Number(data.likesCount) || 0,
          comments: [],
          liked: await isLiked(item.id).catch(() => false),
          saved: false
        };
      }));
      bridge.mergeRemotePosts(list);
      setStatus(`${list.length} post · Firebase`, 'online');
    },
    error => handleError(error, 'Postlar ýüklenmedi')
  ));
}

function subscribeProfiles(){
  runtime.subscriptions.push(onSnapshot(
    query(collection(db, 'profiles'), limit(150)),
    snapshot => {
      runtime.profiles = new Map(snapshot.docs.map(item => [item.id, { id: item.id, ...item.data() }]));
      const own = runtime.profiles.get(runtime.user?.uid);
      if (own) {
        runtime.profile = {
          ...own,
          role: runtime.account?.role || 'user',
          status: runtime.account?.status || 'active'
        };
        delete runtime.profile.email;
        bridge.setCurrentUser(runtime.profile);
      }
      const people = snapshot.docs
        .filter(item => item.id !== runtime.user?.uid)
        .map(item => {
          const profile = item.data();
          return {
            id: item.id,
            uid: item.id,
            remote: true,
            name: profile.fullName || 'Ulanyjy',
            city: profile.city || 'Näbelli',
            job: profile.profession || 'Klas agzasy',
            avatar: profile.avatarURL || '',
            status: 'none',
            online: Boolean(profile.online)
          };
        });
      bridge.mergeRemotePeople(people);
    },
    error => handleError(error, 'Profiller ýüklenmedi')
  ));
}

function stop(){
  while (runtime.subscriptions.length) {
    try { runtime.subscriptions.pop()(); }
    catch {}
  }
  runtime.posts.clear();
  runtime.profiles.clear();
  bridge.mergeRemotePosts([]);
  bridge.mergeRemotePeople([]);
}

async function startMemberData(){
  bridge.setCloudMode(true);
  stop();
  subscribeProfiles();
  subscribePosts();
  setStatus('Firebase birikdi', 'online');
  await setPresence(true).catch(() => {});
}

async function signedIn(user, revision){
  const result = await ensureProfile(user);
  if (revision !== authRevision || auth.currentUser?.uid !== user.uid) {
    throw authPolicy.createError('klas/auth-superseded');
  }
  runtime.user = user;
  runtime.account = result.account;
  runtime.profile = result.profile;
  bridge.setCloudMode(true);
  bridge.setCurrentUser(runtime.profile);
  updateAuthButton({ signedIn: true });
  if (result.needsOnboarding) {
    stop();
    setStatus('Akkaunty tamamlaň');
  } else {
    await startMemberData();
  }
  window.dispatchEvent(new CustomEvent('klas-auth', {
    detail: {
      user,
      account: result.account,
      profile: result.profile,
      isNewAccount: result.isNewAccount,
      needsOnboarding: result.needsOnboarding
    }
  }));
  authBootstrap.resolve(user.uid, result);
  return result;
}

function signedOut(){
  runtime.user = null;
  runtime.profile = null;
  runtime.account = null;
  stop();
  bridge.setCloudMode(false);
  updateAuthButton({ signedIn: false });
  if (lastAuthFailure) {
    setStatus(authErrorMessage(lastAuthFailure), 'error');
    lastAuthFailure = null;
  } else {
    setStatus('Ýerli režim · giriş ýok');
  }
  window.dispatchEvent(new CustomEvent('klas-auth', { detail: { user: null } }));
}

document.addEventListener('visibilitychange', () => {
  if (runtime.user) setPresence(!document.hidden).catch(() => {});
});
window.addEventListener('pagehide', () => {
  if (runtime.user) setPresence(false).catch(() => {});
});

try {
  await setPersistence(auth, browserLocalPersistence);
  runtime.authPersistence = 'local';
} catch (error) {
  runtime.authPersistence = 'limited';
  console.warn('Auth persistence sazlanmady', error);
}

onAuthStateChanged(auth, user => {
  const revision = ++authRevision;
  if (user) {
    if (!authPolicy.isGoogleUser(user)) {
      const error = authPolicy.createError(
        'klas/account-inactive',
        'Klas-a diňe Google akkaunty bilen girip bolýar.'
      );
      lastAuthFailure = error;
      authBootstrap.reject(user.uid, error);
      toast(error.message);
      signOut(auth).catch(() => {});
      return;
    }
    updateAuthButton({ busy: true, signedIn: false });
    setStatus('Google akkaunty we Klas profili barlanýar…');
    signedIn(user, revision).catch(async error => {
      authBootstrap.reject(user.uid, error);
      if (revision !== authRevision || auth.currentUser?.uid !== user.uid) return;
      lastAuthFailure = error;
      if (authPolicy.isExpectedError(error)) {
        setStatus(authErrorMessage(error), 'error');
      } else {
        handleError(error, 'Profil başlangyjy');
      }
      toast(authErrorMessage(error));
      if (auth.currentUser?.uid === user.uid) await signOut(auth).catch(() => {});
    });
  } else signedOut();
});
