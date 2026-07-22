import { collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, limit, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, runtime, bridge, handleError, timeLabel, millis } from './klas-backend-core.js';

let stops = [];
function clear() {
  stops.forEach(stop => stop());
  stops = [];
  bridge.mergeRemoteNotifications([]);
}
export async function createNotification(userId, type, text, icon = '🔔', page = 'feed', targetId = '') {
  if (!runtime.user || !userId || userId === runtime.user.uid) return;
  await addDoc(collection(db, 'notifications'), {
    userId, type, text, icon, page, targetId,
    fromUserId: runtime.user.uid,
    read: false,
    createdAt: serverTimestamp()
  });
}
export async function notifyPostAuthor(postId, type, text, icon = '🔔') {
  const post = runtime.posts.get(postId);
  if (post?.authorId) await createNotification(post.authorId, type, text, icon, 'feed', postId);
}
export async function toggleFriendship(targetUid) {
  if (!runtime.user) throw new Error('Giriş gerek.');
  if (!targetUid || targetUid === runtime.user.uid) throw new Error('Nädogry ulanyjy.');
  const participants = [runtime.user.uid, targetUid].sort();
  const reference = doc(db, 'friendships', participants.join('_'));
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await setDoc(reference, { fromUser: runtime.user.uid, toUser: targetUid, participants, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await createNotification(targetUid, 'friend_request', `${runtime.profile?.shortName || 'Bir ulanyjy'} dost bolmak isleýär`, '👥', 'classmates', reference.id);
    return 'pending';
  }
  const data = snapshot.data();
  if (data.status === 'pending' && data.toUser === runtime.user.uid) {
    await updateDoc(reference, { status: 'accepted', updatedAt: serverTimestamp() });
    await createNotification(data.fromUser, 'friend_accepted', `${runtime.profile?.shortName || 'Bir ulanyjy'} dostluk haýyşyňyzy kabul etdi`, '👥', 'classmates', reference.id);
    return 'friend';
  }
  await deleteDoc(reference);
  return 'none';
}
export const markRead = id => updateDoc(doc(db, 'notifications', id), { read: true });
export async function markAllRead() {
  if (!runtime.user) return;
  const snapshot = await getDocs(query(collection(db, 'notifications'), where('userId', '==', runtime.user.uid), limit(100)));
  const batch = writeBatch(db);
  let changed = false;
  snapshot.docs.forEach(item => { if (!item.data().read) { batch.update(item.ref, { read: true }); changed = true; } });
  if (changed) await batch.commit();
}
function start() {
  clear();
  if (!runtime.user) return;
  stops.push(onSnapshot(query(collection(db, 'notifications'), where('userId', '==', runtime.user.uid), limit(100)), snapshot => {
    const list = snapshot.docs.map(item => {
      const value = item.data();
      return { id: item.id, remote: true, icon: value.icon || '🔔', text: value.text || 'Bildiriş', time: timeLabel(value.createdAt), read: Boolean(value.read), page: value.page || 'feed', _time: millis(value.createdAt) };
    }).sort((a, b) => b._time - a._time);
    bridge.mergeRemoteNotifications(list);
  }, error => handleError(error, 'Bildirişler ýüklenmedi')));
  stops.push(onSnapshot(query(collection(db, 'friendships'), where('participants', 'array-contains', runtime.user.uid), limit(200)), snapshot => {
    const statuses = new Map();
    snapshot.docs.forEach(item => {
      const value = item.data();
      const other = (value.participants || []).find(id => id !== runtime.user.uid);
      if (other) statuses.set(other, value.status === 'accepted' ? 'friend' : 'pending');
    });
    bridge.getState().people.filter(person => person.remote).forEach(person => bridge.patchPerson(person.id, { status: statuses.get(person.uid || person.id) || 'none' }));
  }, error => handleError(error, 'Dostluklar ýüklenmedi')));
}
window.addEventListener('klas-auth', event => event.detail.user ? start() : clear());