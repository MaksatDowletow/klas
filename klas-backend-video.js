import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, runtime, bridge, config, handleError, toast } from './klas-backend-core.js';
import { createNotification } from './klas-backend-notifications.js';

let activeCall = null;
let incomingCall = null;
let incomingStop = null;
let callTimeout = null;

function ensureVideoUi(){
  if (!document.getElementById('videoCallLayer')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="video-call-layer hidden" id="videoCallLayer" aria-hidden="true">
        <div class="video-call-stage" role="dialog" aria-modal="true" aria-labelledby="videoCallTitle">
          <video class="remote-video" id="remoteVideo" autoplay playsinline></video>
          <video class="local-video" id="localVideo" autoplay muted playsinline></video>
          <div class="video-call-top"><h2 id="videoCallTitle">Wideoçat</h2><p id="videoCallStatus">Baglanyşýar…</p></div>
          <div class="video-call-controls">
            <button class="call-control" id="toggleCallMic" type="button" aria-label="Mikrofony aç ýa-da ýap">🎙️</button>
            <button class="call-control" id="toggleCallCamera" type="button" aria-label="Kamerany aç ýa-da ýap">📷</button>
            <button class="call-control end" id="hangupVideoCall" type="button" aria-label="Jaňy tamamla">☎</button>
          </div>
        </div>
      </div>
      <div class="incoming-call-card hidden" id="incomingCallCard" aria-hidden="true" role="dialog" aria-labelledby="incomingCallerName">
        <div class="incoming-call-person">
          <img id="incomingCallerAvatar" alt="Jaň edýän ulanyjy">
          <span><b id="incomingCallerName">Klas ulanyjysy</b><small>Gelýän wideo jaň</small></span>
        </div>
        <div class="incoming-call-actions">
          <button class="decline" id="declineVideoCall" type="button">Ret et</button>
          <button class="accept" id="acceptVideoCall" type="button">Kabul et</button>
        </div>
      </div>`);
  }
}
ensureVideoUi();

const defaultIceServers = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
];

function element(id){ return document.getElementById(id); }
function callLayer(){ return element('videoCallLayer'); }
function incomingLayer(){ return element('incomingCallCard'); }
function setCallStatus(text){ const node = element('videoCallStatus'); if (node) node.textContent = text; }

function supportsVideoCall(){
  return Boolean(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
}

function iceConfiguration(){
  const configured = config?.rtc?.iceServers;
  return { iceServers: Array.isArray(configured) && configured.length ? configured : defaultIceServers };
}

function profileName(uid){
  return runtime.profiles.get(uid)?.fullName || 'Klas ulanyjysy';
}

function showCallLayer(title, status){
  const layer = callLayer();
  if (!layer) return;
  element('videoCallTitle').textContent = title;
  setCallStatus(status);
  layer.classList.remove('hidden');
  layer.setAttribute('aria-hidden', 'false');
}

function hideCallLayer(){
  const layer = callLayer();
  if (!layer) return;
  layer.classList.add('hidden');
  layer.setAttribute('aria-hidden', 'true');
}

function showIncoming(id, data){
  incomingCall = { id, data, ref: doc(db, 'calls', id) };
  const layer = incomingLayer();
  if (!layer) return;
  const avatar = runtime.profiles.get(data.callerId)?.avatarURL || '';
  element('incomingCallerName').textContent = profileName(data.callerId);
  element('incomingCallerAvatar').src = avatar;
  layer.classList.remove('hidden');
  layer.setAttribute('aria-hidden', 'false');
}

function hideIncoming(){
  incomingCall = null;
  const layer = incomingLayer();
  if (!layer) return;
  layer.classList.add('hidden');
  layer.setAttribute('aria-hidden', 'true');
}

function stopMedia(stream){
  stream?.getTracks?.().forEach(track => track.stop());
}

function cleanupPeer(){
  clearTimeout(callTimeout);
  callTimeout = null;
  if (!activeCall) {
    hideCallLayer();
    return;
  }
  activeCall.callStop?.();
  activeCall.candidateStop?.();
  activeCall.pc?.close();
  stopMedia(activeCall.localStream);
  const local = element('localVideo');
  const remote = element('remoteVideo');
  if (local) local.srcObject = null;
  if (remote) remote.srcObject = null;
  activeCall = null;
  hideCallLayer();
}

async function finishCall({ notifyRemote = true, status = 'ended', message = 'Jaň tamamlandy' } = {}){
  const call = activeCall;
  if (notifyRemote && call?.ref) {
    await updateDoc(call.ref, { status, endedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
  }
  cleanupPeer();
  if (message) toast(message);
}

async function flushLocalCandidates(){
  if (!activeCall?.signalingReady || !activeCall.pendingCandidates.length) return;
  const pending = activeCall.pendingCandidates.splice(0);
  for (const candidate of pending) {
    await addDoc(collection(activeCall.ref, activeCall.localCandidateCollection), candidate)
      .catch(error => handleError(error, 'ICE kandidaty iberilmedi'));
  }
}

async function addRemoteCandidate(candidate){
  if (!activeCall?.pc) return;
  if (!activeCall.pc.remoteDescription) {
    activeCall.remoteCandidateQueue.push(candidate);
    return;
  }
  await activeCall.pc.addIceCandidate(new RTCIceCandidate(candidate))
    .catch(error => handleError(error, 'ICE kandidaty kabul edilmedi'));
}

async function flushRemoteCandidates(){
  if (!activeCall?.pc?.remoteDescription) return;
  const queue = activeCall.remoteCandidateQueue.splice(0);
  for (const candidate of queue) await addRemoteCandidate(candidate);
}

async function preparePeer({ role, ref, recipientId }){
  if (!supportsVideoCall()) throw new Error('Bu brauzer wideoçaty goldamaýar.');
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
  });
  const pc = new RTCPeerConnection(iceConfiguration());
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  const localVideo = element('localVideo');
  if (localVideo) localVideo.srcObject = localStream;

  activeCall = {
    ...(activeCall || {}),
    role,
    ref,
    id: ref.id,
    recipientId,
    pc,
    localStream,
    localCandidateCollection: role === 'caller' ? 'callerCandidates' : 'calleeCandidates',
    remoteCandidateCollection: role === 'caller' ? 'calleeCandidates' : 'callerCandidates',
    pendingCandidates: [],
    remoteCandidateQueue: [],
    signalingReady: false,
    remoteCandidateIds: new Set()
  };

  pc.ontrack = event => {
    const remoteVideo = element('remoteVideo');
    if (remoteVideo && event.streams[0]) remoteVideo.srcObject = event.streams[0];
  };
  pc.onicecandidate = event => {
    if (!event.candidate || !activeCall) return;
    const candidate = event.candidate.toJSON();
    if (!activeCall.signalingReady) activeCall.pendingCandidates.push(candidate);
    else addDoc(collection(activeCall.ref, activeCall.localCandidateCollection), candidate)
      .catch(error => handleError(error, 'ICE kandidaty iberilmedi'));
  };
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === 'connected') setCallStatus('Baglanyşyk döredildi');
    else if (state === 'connecting') setCallStatus('Baglanyşýar…');
    else if (state === 'failed') finishCall({ notifyRemote: true, message: 'Wideo baglanyşygy başartmady' });
    else if (state === 'disconnected') setCallStatus('Baglanyşyk wagtlaýyn kesildi…');
  };
  return pc;
}

function listenRemoteCandidates(){
  if (!activeCall) return;
  activeCall.candidateStop?.();
  activeCall.candidateStop = onSnapshot(
    collection(activeCall.ref, activeCall.remoteCandidateCollection),
    snapshot => snapshot.docChanges().forEach(change => {
      if (change.type !== 'added' || activeCall.remoteCandidateIds.has(change.doc.id)) return;
      activeCall.remoteCandidateIds.add(change.doc.id);
      addRemoteCandidate(change.doc.data());
    }),
    error => handleError(error, 'ICE kandidatlary ýüklenmedi')
  );
}

function listenCallDocument(){
  if (!activeCall) return;
  activeCall.callStop?.();
  activeCall.callStop = onSnapshot(activeCall.ref, async snapshot => {
    if (!snapshot.exists() || !activeCall) return;
    const data = snapshot.data();
    if (activeCall.role === 'caller' && data.answer && !activeCall.pc.remoteDescription) {
      await activeCall.pc.setRemoteDescription(data.answer);
      await flushRemoteCandidates();
      setCallStatus('Jaň kabul edildi');
    }
    if (data.status === 'accepted') setCallStatus('Baglanyşýar…');
    if (data.status === 'declined') await finishCall({ notifyRemote: false, message: 'Jaň kabul edilmedi' });
    if (data.status === 'busy') await finishCall({ notifyRemote: false, message: 'Ulanyjy başga jaňda' });
    if (data.status === 'ended') await finishCall({ notifyRemote: false, message: 'Jaň tamamlandy' });
  }, error => handleError(error, 'Jaň ýagdaýy ýüklenmedi'));
}

export async function startVideoCall(){
  if (!runtime.user) throw new Error('Wideoçat üçin Google bilen giriş ediň.');
  if (activeCall) throw new Error('Başga jaň dowam edýär.');
  const chat = bridge.getActiveChat();
  if (!chat?.remote || !chat.recipientId) throw new Error('Wideoçat üçin hakyky ulanyjy çaty saýlaň.');
  const callRef = doc(collection(db, 'calls'));
  showCallLayer(chat.name || 'Wideoçat', 'Kamera açylýar…');
  try {
    const pc = await preparePeer({ role: 'caller', ref: callRef, recipientId: chat.recipientId });
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    await setDoc(callRef, {
      callerId: runtime.user.uid,
      calleeId: chat.recipientId,
      participants: [runtime.user.uid, chat.recipientId],
      type: 'video',
      status: 'ringing',
      offer: { type: offer.type, sdp: offer.sdp },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    activeCall.signalingReady = true;
    await flushLocalCandidates();
    listenRemoteCandidates();
    listenCallDocument();
    setCallStatus('Jaň edilýär…');
    await createNotification(chat.recipientId, 'video_call', `${runtime.profile?.shortName || 'Bir ulanyjy'} size wideo jaň edýär`, '📹', 'messages', callRef.id);
    callTimeout = setTimeout(async () => {
      const snapshot = await getDoc(callRef).catch(() => null);
      if (snapshot?.exists() && snapshot.data().status === 'ringing') {
        await finishCall({ notifyRemote: true, message: 'Jaňa jogap berilmedi' });
      }
    }, Number(config?.rtc?.ringTimeoutMs) || 45000);
  } catch (error) {
    cleanupPeer();
    throw error;
  }
}

async function acceptIncoming(){
  if (!incomingCall || !runtime.user) return;
  if (activeCall) {
    await updateDoc(incomingCall.ref, { status: 'busy', endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    hideIncoming();
    return;
  }
  const { ref, data } = incomingCall;
  hideIncoming();
  showCallLayer(profileName(data.callerId), 'Kamera açylýar…');
  try {
    const pc = await preparePeer({ role: 'callee', ref, recipientId: data.callerId });
    await pc.setRemoteDescription(data.offer);
    await flushRemoteCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(ref, {
      answer: { type: answer.type, sdp: answer.sdp },
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
    activeCall.signalingReady = true;
    await flushLocalCandidates();
    listenRemoteCandidates();
    listenCallDocument();
    setCallStatus('Baglanyşýar…');
  } catch (error) {
    await updateDoc(ref, { status: 'ended', endedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
    cleanupPeer();
    throw error;
  }
}

async function declineIncoming(){
  if (!incomingCall) return;
  const reference = incomingCall.ref;
  hideIncoming();
  await updateDoc(reference, { status: 'declined', endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

function startIncomingListener(){
  stopIncomingListener();
  if (!runtime.user) return;
  incomingStop = onSnapshot(
    query(collection(db, 'calls'), where('calleeId', '==', runtime.user.uid), where('status', '==', 'ringing'), limit(5)),
    snapshot => {
      const newest = snapshot.docs
        .map(item => ({ id: item.id, data: item.data() }))
        .find(item => item.id !== activeCall?.id);
      if (!newest) {
        if (!activeCall) hideIncoming();
        return;
      }
      if (activeCall) {
        updateDoc(doc(db, 'calls', newest.id), { status: 'busy', endedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
        return;
      }
      showIncoming(newest.id, newest.data);
    },
    error => handleError(error, 'Giriş wideo jaňlary ýüklenmedi')
  );
}

function stopIncomingListener(){
  incomingStop?.();
  incomingStop = null;
  hideIncoming();
}

function toggleTrack(kind, buttonId){
  const track = activeCall?.localStream?.getTracks().find(item => item.kind === kind);
  if (!track) return;
  track.enabled = !track.enabled;
  const button = element(buttonId);
  button?.classList.toggle('off', !track.enabled);
  if (button) button.setAttribute('aria-pressed', String(!track.enabled));
}

document.addEventListener('click', async event => {
  try {
    if (event.target.closest('#videoCallBtn')) await startVideoCall();
    else if (event.target.closest('#acceptVideoCall')) await acceptIncoming();
    else if (event.target.closest('#declineVideoCall')) await declineIncoming();
    else if (event.target.closest('#hangupVideoCall')) await finishCall({ notifyRemote: true });
    else if (event.target.closest('#toggleCallMic')) toggleTrack('audio', 'toggleCallMic');
    else if (event.target.closest('#toggleCallCamera')) toggleTrack('video', 'toggleCallCamera');
  } catch (error) {
    handleError(error, 'Wideoçat başartmady');
    toast(error.message || 'Wideoçat başartmady');
  }
});

window.addEventListener('pagehide', () => {
  if (activeCall?.ref) updateDoc(activeCall.ref, { status: 'ended', endedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
  cleanupPeer();
});
window.addEventListener('klas-auth', event => {
  if (event.detail.user) startIncomingListener();
  else {
    stopIncomingListener();
    cleanupPeer();
  }
});
if (runtime.user) startIncomingListener();
