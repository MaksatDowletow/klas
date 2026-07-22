import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

export const config = window.KLAS_CONFIG;
export const bridge = window.KlasBridge;
export const app = initializeApp(config.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
export const runtime = { user: null, profile: null, account: null, profiles: new Map(), posts: new Map(), subscriptions: [] };
export const $ = selector => document.querySelector(selector);
export const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
export const toast = text => bridge?.toast(text);
const cloudKey = 'klas-cloudinary-public-config';

export function millis(value) { return value?.toMillis?.() || value?.seconds * 1000 || Date.parse(value || '') || 0; }
export function timeLabel(value) {
  const time = millis(value);
  const delta = Math.max(0, Date.now() - time);
  if (!time || delta < 60000) return 'häzir';
  if (delta < 3600000) return `${Math.floor(delta / 60000)} minut öň`;
  if (delta < 86400000) return `${Math.floor(delta / 3600000)} sagat öň`;
  return new Intl.DateTimeFormat('tk-TM', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(time));
}
export function setStatus(text, kind = 'idle') {
  const element = $('#backendStatus');
  if (!element) return;
  element.textContent = text;
  element.title = text;
  element.classList.toggle('online', kind === 'online');
  element.classList.toggle('error', kind === 'error');
}
export function handleError(error, prefix = 'Firebase ýalňyşlygy') {
  console.error(prefix, error);
  setStatus(`${prefix}: ${error.code || error.message}`, 'error');
  if (String(error.code).includes('permission-denied')) toast(`${prefix}. Firestore Rules sazlamasyny barlaň.`);
}
export function cloudConfig() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(cloudKey) || '{}'); } catch {}
  return { ...config.cloudinary, ...saved };
}
export function cloudReady() { const value = cloudConfig(); return Boolean(value.cloudName && value.uploadPreset); }
export function updateCloudState() {
  const element = $('#cloudinaryState');
  if (!element) return;
  const value = cloudConfig();
  element.textContent = cloudReady() ? `${value.cloudName} / ${value.uploadPreset}` : 'Cloud name girizilmedik';
  element.classList.toggle('ready', cloudReady());
  element.classList.toggle('missing', !cloudReady());
}
export function saveCloudConfig(cloudName, uploadPreset) {
  localStorage.setItem(cloudKey, JSON.stringify({ cloudName, uploadPreset }));
  updateCloudState();
}
export async function uploadMedia(file, folder = 'klas/posts') {
  if (!file) return '';
  const value = cloudConfig();
  if (!cloudReady()) throw new Error('Cloudinary Cloud Name we unsigned Upload Preset sazlanmady.');
  const isVideo = file.type.startsWith('video/');
  const maxBytes = isVideo ? value.maxVideoBytes : value.maxImageBytes;
  if (file.size > maxBytes) throw new Error(`Faýl ${Math.round(maxBytes / 1048576)} MB çäginden uly.`);
  if (!isVideo && !file.type.startsWith('image/')) throw new Error('Diňe surat ýa-da wideo kabul edilýär.');
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', value.uploadPreset);
  form.append('folder', folder);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(value.cloudName)}/${isVideo ? 'video' : 'image'}/upload`, { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) throw new Error(data?.error?.message || 'Cloudinary ýüklemesi başartmady.');
  return data.secure_url;
}

export async function login() {
  try { await signInWithPopup(auth, provider); }
  catch (error) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error.code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}
export const logout = () => signOut(auth);

async function ensureProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  const profileRef = doc(db, 'profiles', user.uid);
  const [userSnap, profileSnap] = await Promise.all([getDoc(userRef), getDoc(profileRef)]);
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role: 'user',
      status: 'active',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
  } else {
    await setDoc(userRef, {
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      lastLogin: serverTimestamp()
    }, { merge: true });
  }
  const account = (await getDoc(userRef)).data();
  if (account.status === 'blocked') throw new Error('Bu Klas hasaby administrator tarapyndan bloklandy.');
  const base = {
    uid: user.uid,
    fullName: user.displayName || user.email?.split('@')[0] || 'Klas ulanyjysy',
    shortName: (user.displayName || 'Ulanyjy').split(' ')[0],
    email: user.email || '',
    avatarURL: user.photoURL || '',
    city: '',
    bio: '',
    profession: '',
    school: 'Öde Abdullaýew adyndaky mekdep',
    graduationYear: 2000
  };
  if (!profileSnap.exists()) {
    await setDoc(profileRef, { ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } else {
    await setDoc(profileRef, { email: user.email || '', updatedAt: serverTimestamp() }, { merge: true });
  }
  const profile = { ...base, ...(await getDoc(profileRef)).data(), role: account.role || 'user', status: account.status || 'active' };
  return { account, profile };
}

export async function saveProfile(data) {
  if (!runtime.user) throw new Error('Ilki Google bilen giriş ediň.');
  const allowed = ['fullName', 'shortName', 'city', 'profession', 'bio', 'avatarURL', 'school', 'graduationYear'];
  const clean = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  await setDoc(doc(db, 'profiles', runtime.user.uid), { ...clean, uid: runtime.user.uid, updatedAt: serverTimestamp() }, { merge: true });
}
export async function createPost({ text, imageURL = '', videoURL = '' }) {
  if (!runtime.user) throw new Error('Post üçin Google bilen giriş ediň.');
  const profile = runtime.profile || {};
  return addDoc(collection(db, 'posts'), {
    authorId: runtime.user.uid,
    authorName: profile.fullName || runtime.user.displayName || 'Ulanyjy',
    authorAvatar: profile.avatarURL || runtime.user.photoURL || '',
    authorRole: profile.profession || runtime.account?.role || 'user',
    text: text || '', imageURL, videoURL, visibility: 'public',
    likesCount: 0, commentsCount: 0,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}
export async function toggleLike(id) {
  if (!runtime.user) throw new Error('Giriş gerek.');
  const postRef = doc(db, 'posts', id);
  const likeRef = doc(db, 'posts', id, 'likes', runtime.user.uid);
  let liked = false;
  await runTransaction(db, async transaction => {
    const [postSnap, likeSnap] = await Promise.all([transaction.get(postRef), transaction.get(likeRef)]);
    if (!postSnap.exists()) throw new Error('Post tapylmady.');
    const count = Number(postSnap.data().likesCount) || 0;
    if (likeSnap.exists()) {
      transaction.delete(likeRef);
      transaction.update(postRef, { likesCount: Math.max(0, count - 1), updatedAt: serverTimestamp() });
    } else {
      transaction.set(likeRef, { userId: runtime.user.uid, createdAt: serverTimestamp() });
      transaction.update(postRef, { likesCount: count + 1, updatedAt: serverTimestamp() });
      liked = true;
    }
  });
  return liked;
}
export async function addComment(id, text) {
  if (!runtime.user) throw new Error('Giriş gerek.');
  const postRef = doc(db, 'posts', id);
  await addDoc(collection(postRef, 'comments'), {
    authorId: runtime.user.uid,
    authorName: runtime.profile?.fullName || runtime.user.displayName || 'Ulanyjy',
    authorAvatar: runtime.profile?.avatarURL || runtime.user.photoURL || '',
    text,
    createdAt: serverTimestamp()
  });
}
export async function deletePost(id) {
  if (!runtime.user) throw new Error('Giriş gerek.');
  await deleteDoc(doc(db, 'posts', id));
}
async function comments(ref) {
  const snapshot = await getDocs(query(collection(ref, 'comments'), orderBy('createdAt', 'asc'), limit(30)));
  return snapshot.docs.map(item => ({ id: item.id, author: item.data().authorName || 'Ulanyjy', avatar: item.data().authorAvatar || '', text: item.data().text || '', time: timeLabel(item.data().createdAt) }));
}
async function liked(id) { return runtime.user ? (await getDoc(doc(db, 'posts', id, 'likes', runtime.user.uid))).exists() : false; }
function subscribePosts() {
  runtime.subscriptions.push(onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50)), async snapshot => {
    const list = await Promise.all(snapshot.docs.map(async item => {
      const data = item.data();
      runtime.posts.set(item.id, { id: item.id, ...data });
      return {
        id: item.id, remote: true, ownerId: data.authorId, authorId: data.authorId,
        author: data.authorName || 'Ulanyjy', role: data.authorRole || 'Ulanyjy', avatar: data.authorAvatar || '',
        time: timeLabel(data.createdAt), text: data.text || '', image: data.imageURL || '', video: data.videoURL || '',
        likes: Number(data.likesCount) || 0, comments: await comments(item.ref).catch(() => []),
        liked: await liked(item.id).catch(() => false), saved: false
      };
    }));
    bridge.mergeRemotePosts(list);
    setStatus(`${list.length} post · Firebase`, 'online');
  }, error => handleError(error, 'Postlar ýüklenmedi')));
}
function subscribeProfiles() {
  runtime.subscriptions.push(onSnapshot(query(collection(db, 'profiles'), limit(150)), snapshot => {
    runtime.profiles = new Map(snapshot.docs.map(item => [item.id, { id: item.id, ...item.data() }]));
    const own = runtime.profiles.get(runtime.user?.uid);
    if (own) {
      runtime.profile = { ...own, role: runtime.account?.role || 'user', status: runtime.account?.status || 'active' };
      bridge.setCurrentUser(runtime.profile);
    }
    const people = snapshot.docs.filter(item => item.id !== runtime.user?.uid).map(item => {
      const profile = item.data();
      return { id: item.id, uid: item.id, remote: true, name: profile.fullName || 'Ulanyjy', city: profile.city || 'Näbelli', job: profile.profession || 'Klas agzasy', avatar: profile.avatarURL || '', status: 'none', online: Boolean(profile.online) };
    });
    bridge.mergeRemotePeople(people);
  }, error => handleError(error, 'Profiller ýüklenmedi')));
}
function stop() {
  while (runtime.subscriptions.length) { try { runtime.subscriptions.pop()(); } catch {} }
  runtime.posts.clear();
  bridge.mergeRemotePosts([]);
  bridge.mergeRemotePeople([]);
}
async function signedIn(user) {
  runtime.user = user;
  const result = await ensureProfile(user);
  runtime.account = result.account;
  runtime.profile = result.profile;
  bridge.setCurrentUser(runtime.profile);
  setStatus('Firebase birikdi', 'online');
  const button = $('#authBtn');
  if (button) { button.textContent = 'Çykmak'; button.classList.add('signed-in'); }
  stop();
  subscribeProfiles();
  subscribePosts();
  window.dispatchEvent(new CustomEvent('klas-auth', { detail: { user } }));
}
function signedOut() {
  runtime.user = null;
  runtime.profile = null;
  runtime.account = null;
  stop();
  const button = $('#authBtn');
  if (button) { button.textContent = 'Google bilen giriş'; button.classList.remove('signed-in'); }
  setStatus('Ýerli režim · giriş ýok');
  window.dispatchEvent(new CustomEvent('klas-auth', { detail: { user: null } }));
}

try { await setPersistence(auth, browserLocalPersistence); } catch (error) { console.warn(error); }
try { await getRedirectResult(auth); } catch (error) { handleError(error, 'Redirect giriş başartmady'); }
onAuthStateChanged(auth, user => user ? signedIn(user).catch(async error => { handleError(error, 'Profil başlangyjy'); await signOut(auth).catch(() => {}); }) : signedOut());