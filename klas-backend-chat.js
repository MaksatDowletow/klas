import { collection, doc, getDoc, setDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, runtime, bridge, handleError, timeLabel } from './klas-backend-core.js';
import { createNotification } from './klas-backend-notifications.js';

const messageStops = new Map();
let conversationStop = null;
const remoteChats = new Map();

function info(data) {
  const other = (data.participants || []).find(id => id !== runtime.user?.uid);
  const profile = runtime.profiles.get(other) || {};
  return { other, name: profile.fullName || data.title || 'Klas çat', avatar: profile.avatarURL || '' };
}

export async function ensureConversation(targetUid) {
  if (!runtime.user) throw new Error('Giriş gerek.');
  if (!targetUid || targetUid === runtime.user.uid) throw new Error('Çat üçin başga ulanyjy saýlaň.');
  const participants = [runtime.user.uid, targetUid].sort();
  const id = `direct_${participants.join('_')}`;
  const reference = doc(db, 'conversations', id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await setDoc(reference, {
      type: 'direct', participants, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: ''
    });
  }
  bridge.setActiveChat(id);
  return id;
}

export async function sendMessage(id, text) {
  if (!runtime.user) throw new Error('Giriş gerek.');
  const clean = String(text || '').trim();
  if (!clean) return;
  if (clean.length > 4000) throw new Error('Habar 4000 belgiden uzyn bolmaly däl.');
  const conversationRef = doc(db, 'conversations', id);
  const conversationSnap = await getDoc(conversationRef);
  if (!conversationSnap.exists() || !(conversationSnap.data().participants || []).includes(runtime.user.uid)) throw new Error('Bu çata rugsat ýok.');
  const messageRef = doc(collection(conversationRef, 'messages'));
  const batch = writeBatch(db);
  batch.set(messageRef, { senderId: runtime.user.uid, text: clean, createdAt: serverTimestamp(), seenBy: [runtime.user.uid] });
  batch.update(conversationRef, { lastMessage: clean, updatedAt: serverTimestamp() });
  await batch.commit();
  const recipient = (conversationSnap.data().participants || []).find(uid => uid !== runtime.user.uid);
  if (recipient) await createNotification(recipient, 'message', `${runtime.profile?.shortName || 'Bir ulanyjy'} size habar iberdi`, '💬', 'messages', id);
}

function watchMessages(id, data) {
  messageStops.get(id)?.();
  const stop = onSnapshot(query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt', 'asc'), limit(200)), snapshot => {
    const details = info(data);
    const messages = snapshot.docs.map(item => ({ id: item.id, from: item.data().senderId === runtime.user.uid ? 'me' : 'them', text: item.data().text || '', time: timeLabel(item.data().createdAt) }));
    remoteChats.set(id, { id, remote: true, recipientId: details.other, name: details.name, avatar: details.avatar, preview: data.lastMessage || messages.at(-1)?.text || 'Täze çat', unread: 0, messages });
    bridge.mergeRemoteChats([...remoteChats.values()]);
  }, error => handleError(error, 'Habarlar ýüklenmedi'));
  messageStops.set(id, stop);
}

function start() {
  stop();
  if (!runtime.user) return;
  conversationStop = onSnapshot(query(collection(db, 'conversations'), where('participants', 'array-contains', runtime.user.uid), limit(50)), snapshot => {
    const ids = new Set();
    snapshot.docs.forEach(item => { ids.add(item.id); watchMessages(item.id, item.data()); });
    for (const [id, unsubscribe] of messageStops) {
      if (!ids.has(id)) { unsubscribe(); messageStops.delete(id); remoteChats.delete(id); }
    }
  }, error => handleError(error, 'Çatlar ýüklenmedi'));
}
function stop() {
  conversationStop?.();
  conversationStop = null;
  for (const unsubscribe of messageStops.values()) unsubscribe();
  messageStops.clear();
  remoteChats.clear();
  bridge.mergeRemoteChats([]);
}
window.addEventListener('klas-auth', event => event.detail.user ? start() : stop());
if (runtime.user) start();