import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
if (!config?.firebase?.projectId) throw new Error('Firebase konfigurasiýasy tapylmady.');
if (!bridge) throw new Error('Klas bridge moduly tapylmady.');

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
  subscriptions: []
};

export const $ = selector => document.querySelector(selector);
export const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
export const toast = text => bridge.toast(text);

const cloudKey = 'klas-cloudinary-public-config';
let presenceSequence = Promise.resolve();
let authOperation = null;

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
  const code = error?.code || error?.message || 'unknown';
  setStatus(`${prefix}: ${code}`, 'error');
  if (String(code).includes('permission-denied')) toast(`${prefix}. Firestore Rules sazlamasyny barlaň.`);
}

export function authErrorMessage(error){
  const code = String(error?.code || '');
  const messages = {
    'auth/popup-closed-by-user': 'Google giriş penjiresi tamamlanmazdan ýapyldy.',
    'auth/cancelled-popup-request': 'Öňki Google giriş synanyşygy bes edildi. Täzeden synanyşyň.',
    'auth/popup-blocked': 'Brauzer Google giriş penjiresini bloklady. Redirect arkaly dowam edilýär.',
    'auth/network-request-failed': 'Internet baglanyşygy sebäpli Google giriş başartmady.',
    'auth/unauthorized-domain': 'Bu domen Firebase Google giriş üçin rugsatlandyrylmady.',
    'auth/operation-not-allowed': 'Firebase Console-da Google giriş usuly açylmadyk.',
    'auth/account-exists-with-different-credential': 'Bu e-poçta başga giriş usuly bilen baglanyşykly.',
    'auth/user-disabled': 'Bu Google akkaunty Klas üçin öçürilen.',
    'auth/too-many-requests': 'Gaty köp giriş synanyşygy edildi. Biraz wagtdan gaýtadan synanyşyň.',
    'auth/web-storage-unsupported': 'Brauzer sessiýany saklamagy bloklaýar. Cookie we site data sazlamasyny barlaň.',
    'auth/internal-error': 'Google giriş hyzmatynda wagtlaýyn näsazlyk ýüze çykdy.'
  };
  return messages[code] || error?.message || 'Google giriş başartmady.';
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
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(cloudKey) || '{}'); }
  catch { localStorage.removeItem(cloudKey); }
  return { ...config.cloudinary, ...saved };
}

export function cloudReady(){
  const value = cloudConfig();
  return Boolean(value.cloudName && value.uploadPreset);
}

export function updateCloudState(){
  const element = $('#cloudinaryState');
  if (!element) return;
  const value = cloudConfig();
  element.textContent = cloudReady()
    ? `${value.cloudName} / ${value.uploadPreset}`
    : 'Cloud Name girizilmedik';
  element.classList.toggle('ready', cloudReady());
  element.classList.toggle('missing', !cloudReady());
}

export function saveCloudConfig(cloudName, uploadPreset){
  const name = String(cloudName || '').trim();
  const preset = String(uploadPreset || '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Cloud Name diňe harp, san, tire we aşaky çyzyk kabul edýär.');
  if (!/^[a-zA-Z0-9_-]+$/.test(preset)) throw new Error('Upload Preset formaty nädogry.');
  localStorage.setItem(cloudKey, JSON.stringify({ cloudName: name, uploadPreset: preset }));
  updateCloudState();
}

export async function uploadMedia(file, folder = 'klas/posts'){
  if (!file) return '';
  const value = cloudConfig();
  if (!cloudReady()) throw new Error('Cloudinary Cloud Name we unsigned Upload Preset sazlanmady.');
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

function shouldUseRedirect(){
  return window.matchMedia?.('(max-width: 760px)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function login(){
  if (authOperation) return authOperation;
  if (!navigator.onLine) throw new Error('Google giriş üçin internet baglanyşygy gerek.');
  authOperation = (async () => {
    updateAuthButton({ busy: true, signedIn: false });
    if (shouldUseRedirect()) {
      await signInWithRedirect(auth, provider);
      return;
    }
    try { await signInWithPopup(auth, provider); }
    catch (error) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
  })();
  try { return await authOperation; }
  finally {
    authOperation = null;
    updateAuthButton({ signedIn: Boolean(runtime.user) });
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
  const [userSnapshot, profileSnapshot] = await Promise.all([getDoc(userRef), getDoc(profileRef)]);

  const isNewAccount = !userSnapshot.exists();
  if (isNewAccount) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      authProvider: 'google.com',
      role: 'user',
      status: 'active',
      onboardingComplete: false,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
  } else {
    await setDoc(userRef, {
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      authProvider: 'google.com',
      lastLogin: serverTimestamp()
    }, { merge: true });
  }

  const account = (await getDoc(userRef)).data();
  if (account.status === 'blocked') throw new Error('Bu Klas hasaby administrator tarapyndan bloklandy.');
  if (account.status && account.status !== 'active') {
    throw new Error('Bu Klas hasaby heniz işjeňleşdirilmedi. Administrator bilen habarlaşyň.');
  }

  const base = {
    uid: user.uid,
    fullName: user.displayName || user.email?.split('@')[0] || 'Klas ulanyjysy',
    shortName: (user.displayName || 'Ulanyjy').split(' ')[0],
    avatarURL: user.photoURL || '',
    city: '',
    bio: '',
    profession: '',
    school: 'Öde Abdullaýew adyndaky mekdep',
    graduationYear: 2000,
    online: true
  };

  if (!profileSnapshot.exists()) {
    await setDoc(profileRef, {
      ...base,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });
  } else {
    await setDoc(profileRef, {
      email: deleteField(),
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
  const allowed = ['fullName', 'shortName', 'city', 'profession', 'bio', 'avatarURL', 'school', 'graduationYear'];
  const clean = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  if ('avatarURL' in clean) clean.avatarURL = normalizeHttpUrl(clean.avatarURL);
  if (String(clean.fullName || '').length > 100) throw new Error('Doly at 100 belgiden uzyn bolmaly däl.');
  if (String(clean.shortName || '').length > 30) throw new Error('Gysga at 30 belgiden uzyn bolmaly däl.');
  if (String(clean.city || '').length > 80) throw new Error('Şäher 80 belgiden uzyn bolmaly däl.');
  if (String(clean.profession || '').length > 80) throw new Error('Hünär 80 belgiden uzyn bolmaly däl.');
  if (String(clean.bio || '').length > 500) throw new Error('Bio 500 belgiden uzyn bolmaly däl.');
  await setDoc(doc(db, 'profiles', runtime.user.uid), {
    ...clean,
    uid: runtime.user.uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function completeOnboarding(data){
  if (!runtime.user) throw new Error('Ilki Google bilen giriş ediň.');
  await saveProfile(data);
  await setDoc(doc(db, 'users', runtime.user.uid), {
    onboardingComplete: true,
    acceptedCommunityRulesAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  runtime.account = { ...runtime.account, onboardingComplete: true };
  runtime.profile = { ...runtime.profile, ...data };
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

async function signedIn(user){
  bridge.setCloudMode(true);
  runtime.user = user;
  const result = await ensureProfile(user);
  runtime.account = result.account;
  runtime.profile = result.profile;
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
}

function signedOut(){
  runtime.user = null;
  runtime.profile = null;
  runtime.account = null;
  stop();
  bridge.setCloudMode(false);
  updateAuthButton({ signedIn: false });
  setStatus('Ýerli režim · giriş ýok');
  window.dispatchEvent(new CustomEvent('klas-auth', { detail: { user: null } }));
}

document.addEventListener('visibilitychange', () => {
  if (runtime.user) setPresence(!document.hidden).catch(() => {});
});
window.addEventListener('pagehide', () => {
  if (runtime.user) setPresence(false).catch(() => {});
});

try { await setPersistence(auth, browserLocalPersistence); }
catch (error) { console.warn('Auth persistence sazlanmady', error); }
try { await getRedirectResult(auth); }
catch (error) {
  const message = authErrorMessage(error);
  console.error('Redirect giriş başartmady', error);
  setStatus(message, 'error');
  toast(message);
}

onAuthStateChanged(auth, user => {
  if (user) {
    const googleAccount = user.providerData?.some(item => item.providerId === 'google.com');
    if (!googleAccount) {
      toast('Klas-a diňe Google akkaunty bilen girip bolýar.');
      signOut(auth).catch(() => {});
      return;
    }
    signedIn(user).catch(async error => {
      handleError(error, 'Profil başlangyjy');
      if (!String(error?.code || '').includes('permission-denied')) {
        toast(error?.message || 'Google akkaunty açylmady.');
      }
      await signOut(auth).catch(() => {});
    });
  } else signedOut();
});
