import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, runtime, bridge, handleError, timeLabel, millis } from './klas-backend-core.js';
import { createNotification } from './klas-backend-notifications.js';

const conversationData = new Map();
const messageSnapshots = new Map();
const messageStops = new Map();
const typingStates = new Map();
const remoteChats = new Map();
const seenPending = new Set();
let conversationStop = null;
let activeTypingStop = null;
let activeTypingChatId = '';
let typingTimer = null;
let activeChatPoll = null;

function currentActiveChatId(){
  return bridge.getActiveChat()?.id || '';
}

function isMessagesPageActive(){
  return document.querySelector('#page-messages')?.classList.contains('active') && !document.hidden;
}

function personInfo(data){
  const other = (data.participants || []).find(id => id !== runtime.user?.uid) || '';
  const profile = runtime.profiles.get(other) || {};
  return {
    other,
    name: profile.fullName || data.title || 'Klas çat',
    avatar: profile.avatarURL || '',
    online: Boolean(profile.online),
    lastSeen: profile.lastSeen
  };
}

function formatMessage(item, otherUid){
  const data = item.data();
  const fromMe = data.senderId === runtime.user.uid;
  const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];
  const delivered = fromMe && otherUid && seenBy.includes(otherUid);
  return {
    id: item.id,
    from: fromMe ? 'me' : 'them',
    text: data.text || '',
    time: `${timeLabel(data.createdAt)}${fromMe ? delivered ? ' · Görüldi' : ' · Ugradyldy' : ''}`,
    seen: delivered
  };
}

function escapeHtml(value = ''){
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function updateChatChrome(){
  const chat = bridge.getActiveChat();
  const head = document.querySelector('#chatHead');
  let typing = document.querySelector('#typingIndicator');
  if (!typing) {
    const form = document.querySelector('#chatForm');
    if (form) {
      typing = document.createElement('div');
      typing.id = 'typingIndicator';
      typing.className = 'typing-indicator';
      typing.setAttribute('aria-live', 'polite');
      form.before(typing);
    }
  }
  if (!head) return;
  if (!chat) {
    head.textContent = 'Çaty saýlaň';
    if (typing) typing.textContent = '';
    return;
  }
  const presence = chat.typing
    ? 'ýazýar…'
    : chat.online
      ? '● Onlaýn'
      : chat.lastSeen
        ? `Soňky gezek ${chat.lastSeen}`
        : 'Oflayn';
  head.innerHTML = `<div class="chat-head-person"><img class="avatar" src="${escapeHtml(chat.avatar || '')}" alt=""><span><b>${escapeHtml(chat.name || 'Klas çat')}</b><small class="${chat.online ? 'online' : ''}">${escapeHtml(presence)}</small></span></div>${chat.remote && chat.recipientId ? '<button class="video-call-start" id="videoCallBtn" type="button" aria-label="Wideo jaň başlat">📹 <span>Wideoçat</span></button>' : ''}`;
  if (typing) typing.textContent = chat.typing ? `${chat.name} ýazýar…` : '';
}

function rebuildChat(id){
  const data = conversationData.get(id);
  const snapshot = messageSnapshots.get(id);
  if (!data || !snapshot || !runtime.user) return;
  const details = personInfo(data);
  const messages = snapshot.docs.map(item => formatMessage(item, details.other));
  const unread = snapshot.docs.reduce((count, item) => {
    const value = item.data();
    const seenBy = Array.isArray(value.seenBy) ? value.seenBy : [];
    return count + (value.senderId !== runtime.user.uid && !seenBy.includes(runtime.user.uid) ? 1 : 0);
  }, 0);
  remoteChats.set(id, {
    id,
    remote: true,
    recipientId: details.other,
    name: details.name,
    avatar: details.avatar,
    online: details.online,
    lastSeen: details.lastSeen ? timeLabel(details.lastSeen) : '',
    typing: Boolean(typingStates.get(id)),
    preview: data.lastMessage || messages.at(-1)?.text || 'Täze çat',
    unread,
    messages
  });
  bridge.mergeRemoteChats([...remoteChats.values()].sort((a, b) => {
    const left = millis(conversationData.get(a.id)?.updatedAt);
    const right = millis(conversationData.get(b.id)?.updatedAt);
    return right - left;
  }));
  queueMicrotask(updateChatChrome);
}

async function markSnapshotSeen(id, snapshot){
  if (!runtime.user || !snapshot || seenPending.has(id)) return;
  if (currentActiveChatId() !== id || !isMessagesPageActive()) return;
  const unseen = snapshot.docs.filter(item => {
    const value = item.data();
    const seenBy = Array.isArray(value.seenBy) ? value.seenBy : [];
    return value.senderId !== runtime.user.uid && !seenBy.includes(runtime.user.uid);
  });
  if (!unseen.length) return;
  seenPending.add(id);
  try {
    const batch = writeBatch(db);
    unseen.forEach(item => batch.update(item.ref, { seenBy: arrayUnion(runtime.user.uid) }));
    await batch.commit();
  } catch (error) {
    handleError(error, 'Habar görüldi diýip bellenmedi');
  } finally {
    seenPending.delete(id);
  }
}

function watchMessages(id){
  if (messageStops.has(id)) return;
  const stop = onSnapshot(
    query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt', 'asc'), limit(200)),
    snapshot => {
      messageSnapshots.set(id, snapshot);
      rebuildChat(id);
      markSnapshotSeen(id, snapshot);
    },
    error => handleError(error, 'Habarlar ýüklenmedi')
  );
  messageStops.set(id, stop);
}

function stopTypingWatch(){
  activeTypingStop?.();
  activeTypingStop = null;
  if (activeTypingChatId) {
    typingStates.set(activeTypingChatId, false);
    rebuildChat(activeTypingChatId);
  }
  activeTypingChatId = '';
}

function watchTyping(id){
  if (!runtime.user || !id || activeTypingChatId === id) return;
  stopTypingWatch();
  activeTypingChatId = id;
  activeTypingStop = onSnapshot(
    collection(db, 'conversations', id, 'typing'),
    snapshot => {
      const now = Date.now();
      const active = snapshot.docs.some(item => {
        if (item.id === runtime.user.uid) return false;
        const value = item.data();
        const updated = millis(value.updatedAt);
        return value.active === true && (!updated || now - updated < 12000);
      });
      typingStates.set(id, active);
      rebuildChat(id);
    },
    error => handleError(error, 'Ýazýar ýagdaýy ýüklenmedi')
  );
}

async function setTyping(id, active){
  if (!runtime.user || !id) return;
  const reference = doc(db, 'conversations', id, 'typing', runtime.user.uid);
  try {
    if (active) await setDoc(reference, { active: true, updatedAt: serverTimestamp() });
    else await deleteDoc(reference);
  } catch (error) {
    if (active) handleError(error, 'Ýazýar ýagdaýy iberilmedi');
  }
}

function activateChat(id = currentActiveChatId()){
  if (!id || !conversationData.has(id)) {
    stopTypingWatch();
    updateChatChrome();
    return;
  }
  watchTyping(id);
  markSnapshotSeen(id, messageSnapshots.get(id));
  updateChatChrome();
}

export async function ensureConversation(targetUid){
  if (!runtime.user) throw new Error('Giriş gerek.');
  if (!targetUid || targetUid === runtime.user.uid) throw new Error('Çat üçin başga ulanyjy saýlaň.');
  const participants = [runtime.user.uid, targetUid].sort();
  const id = `direct_${participants.join('_')}`;
  const reference = doc(db, 'conversations', id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await setDoc(reference, {
      type: 'direct',
      participants,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: '',
      lastMessageAt: null,
      lastMessageSenderId: ''
    });
  }
  bridge.setActiveChat(id);
  setTimeout(() => activateChat(id), 0);
  return id;
}

export async function sendMessage(id, text){
  if (!runtime.user) throw new Error('Giriş gerek.');
  const clean = String(text || '').trim();
  if (!clean) return;
  if (clean.length > 4000) throw new Error('Habar 4000 belgiden uzyn bolmaly däl.');
  const conversationRef = doc(db, 'conversations', id);
  const conversationSnapshot = await getDoc(conversationRef);
  if (!conversationSnapshot.exists() || !(conversationSnapshot.data().participants || []).includes(runtime.user.uid)) {
    throw new Error('Bu çata rugsat ýok.');
  }
  const messageRef = doc(collection(conversationRef, 'messages'));
  const batch = writeBatch(db);
  batch.set(messageRef, {
    senderId: runtime.user.uid,
    text: clean,
    createdAt: serverTimestamp(),
    seenBy: [runtime.user.uid]
  });
  batch.update(conversationRef, {
    lastMessage: clean,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: runtime.user.uid,
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  await setTyping(id, false);
  const recipient = (conversationSnapshot.data().participants || []).find(uid => uid !== runtime.user.uid);
  if (recipient) {
    await createNotification(recipient, 'message', `${runtime.profile?.shortName || 'Bir ulanyjy'} size habar iberdi`, '💬', 'messages', id);
  }
}

function start(){
  stop();
  if (!runtime.user) return;
  conversationStop = onSnapshot(
    query(collection(db, 'conversations'), where('participants', 'array-contains', runtime.user.uid), limit(50)),
    snapshot => {
      const ids = new Set();
      snapshot.docs.forEach(item => {
        ids.add(item.id);
        conversationData.set(item.id, item.data());
        watchMessages(item.id);
        if (messageSnapshots.has(item.id)) rebuildChat(item.id);
      });
      for (const [id, unsubscribe] of messageStops) {
        if (!ids.has(id)) {
          unsubscribe();
          messageStops.delete(id);
          messageSnapshots.delete(id);
          conversationData.delete(id);
          typingStates.delete(id);
          remoteChats.delete(id);
        }
      }
      bridge.mergeRemoteChats([...remoteChats.values()]);
      activateChat();
    },
    error => handleError(error, 'Çatlar ýüklenmedi')
  );
  const input = document.querySelector('#chatInput');
  if (input && !input.dataset.liveBound) {
    input.dataset.liveBound = '1';
    input.addEventListener('input', () => {
      const chat = bridge.getActiveChat();
      if (!chat?.remote) return;
      clearTimeout(typingTimer);
      setTyping(chat.id, Boolean(input.value.trim()));
      typingTimer = setTimeout(() => setTyping(chat.id, false), 3500);
    });
    input.addEventListener('blur', () => {
      const chat = bridge.getActiveChat();
      if (chat?.remote) setTyping(chat.id, false);
    });
  }
  activeChatPoll = setInterval(() => activateChat(), 1000);
}

function stop(){
  conversationStop?.();
  conversationStop = null;
  stopTypingWatch();
  clearInterval(activeChatPoll);
  activeChatPoll = null;
  clearTimeout(typingTimer);
  for (const unsubscribe of messageStops.values()) unsubscribe();
  messageStops.clear();
  messageSnapshots.clear();
  conversationData.clear();
  typingStates.clear();
  remoteChats.clear();
  bridge.mergeRemoteChats([]);
  updateChatChrome();
}

document.addEventListener('click', event => {
  const chatButton = event.target.closest('[data-chat]');
  if (chatButton) setTimeout(() => activateChat(chatButton.dataset.chat), 0);
  if (event.target.closest('[data-page="messages"]')) setTimeout(() => activateChat(), 0);
});
window.addEventListener('hashchange', () => setTimeout(() => activateChat(), 0));
window.addEventListener('klas-presence', () => {
  for (const id of conversationData.keys()) {
    if (messageSnapshots.has(id)) rebuildChat(id);
  }
  updateChatChrome();
});
window.addEventListener('klas-auth', event => event.detail.user ? start() : stop());
if (runtime.user) start();
