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
import { db, runtime, bridge, config, handleError, toast, millis } from './klas-backend-core.js';
import { createNotification } from './klas-backend-notifications.js';

let activeCall = null;
let incomingCall = null;
let incomingStop = null;
let callTimeout = null;
let disconnectTimeout = null;
let durationTimer = null;
let callStartedAt = 0;
let callStarting = false;
let acceptingCall = false;
let endingCall = false;
let preferredFacingMode = 'user';
let callFocusReturn = null;
let incomingFocusReturn = null;

function ensureVideoUi(){
  if (!document.getElementById('videoCallLayer')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="video-call-layer hidden" id="videoCallLayer" aria-hidden="true">
        <div class="video-call-stage" role="dialog" aria-modal="true" aria-labelledby="videoCallTitle" tabindex="-1">
          <video class="remote-video" id="remoteVideo" autoplay playsinline></video>
          <video class="local-video" id="localVideo" autoplay muted playsinline></video>
          <div class="video-call-top"><h2 id="videoCallTitle">Wideoçat</h2><p><span id="videoCallStatus">Baglanyşýar…</span><span class="video-call-duration" id="videoCallDuration" aria-label="Jaňyň dowamlylygy"></span></p></div>
          <div class="video-call-controls">
            <button class="call-control" id="toggleCallMic" type="button" aria-label="Mikrofony ýap" aria-pressed="false">🎙️</button>
            <button class="call-control" id="toggleCallCamera" type="button" aria-label="Kamerany ýap" aria-pressed="false">📷</button>
            <button class="call-control" id="switchCallCamera" type="button" aria-label="Kamerany çalyş">🔄</button>
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

function focusElement(node){
  requestAnimationFrame(() => node?.focus?.({ preventScroll: true }));
}

function formatDuration(seconds){
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function stopDuration(){
  clearInterval(durationTimer);
  durationTimer = null;
  callStartedAt = 0;
  const node = element('videoCallDuration');
  if (node) node.textContent = '';
}

function startDuration(){
  if (durationTimer) return;
  callStartedAt = Date.now();
  const render = () => {
    const node = element('videoCallDuration');
    if (node) node.textContent = ` · ${formatDuration(Math.floor((Date.now() - callStartedAt) / 1000))}`;
  };
  render();
  durationTimer = setInterval(render, 1000);
}

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
  callFocusReturn = document.activeElement;
  element('videoCallTitle').textContent = title;
  setCallStatus(status);
  layer.classList.remove('hidden');
  layer.setAttribute('aria-hidden', 'false');
  focusElement(element('hangupVideoCall'));
}

function hideCallLayer(){
  const layer = callLayer();
  if (!layer) return;
  layer.classList.add('hidden');
  layer.setAttribute('aria-hidden', 'true');
  const target = callFocusReturn;
  callFocusReturn = null;
  focusElement(target);
}

function showIncoming(id, data){
  if (incomingCall?.id === id) return;
  incomingCall = { id, data, ref: doc(db, 'calls', id) };
  const layer = incomingLayer();
  if (!layer) return;
  incomingFocusReturn = document.activeElement;
  const avatar = runtime.profiles.get(data.callerId)?.avatarURL || '';
  element('incomingCallerName').textContent = profileName(data.callerId);
  const avatarNode = element('incomingCallerAvatar');
  avatarNode.src = avatar;
  avatarNode.hidden = !avatar;
  layer.classList.remove('hidden');
  layer.setAttribute('aria-hidden', 'false');
  navigator.vibrate?.([180, 100, 180]);
  focusElement(element('acceptVideoCall'));
}

function hideIncoming(){
  incomingCall = null;
  const layer = incomingLayer();
  if (!layer) return;
  layer.classList.add('hidden');
  layer.setAttribute('aria-hidden', 'true');
  const target = incomingFocusReturn;
  incomingFocusReturn = null;
  focusElement(target);
}

function stopMedia(stream){
  stream?.getTracks?.().forEach(track => track.stop());
}

function cleanupPeer(){
  clearTimeout(callTimeout);
  callTimeout = null;
  clearTimeout(disconnectTimeout);
  disconnectTimeout = null;
  stopDuration();
  resetMediaControls();
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
  if (endingCall) return;
  endingCall = true;
  const call = activeCall;
  try {
    if (notifyRemote && call?.ref) {
      await updateDoc(call.ref, { status, endedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
    }
    cleanupPeer();
    if (message) toast(message);
  } finally {
    endingCall = false;
  }
}

function serializeCandidate(candidate){
  const value = candidate.toJSON();
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));
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
  let localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { facingMode: preferredFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
  } catch (error) {
    if (['NotAllowedError', 'SecurityError'].includes(error?.name)) throw new Error('Wideo jaň üçin kamera we mikrofon rugsadyny beriň.');
    if (error?.name === 'NotFoundError') throw new Error('Kamera ýa-da mikrofon tapylmady.');
    if (error?.name === 'NotReadableError') throw new Error('Kamera ýa-da mikrofon başga programma tarapyndan ulanylýar.');
    throw error;
  }
  const pc = new RTCPeerConnection(iceConfiguration());
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  const localVideo = element('localVideo');
  if (localVideo) {
    localVideo.srcObject = localStream;
    localVideo.classList.toggle('mirrored', preferredFacingMode === 'user');
  }

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
    const candidate = serializeCandidate(event.candidate);
    if (!activeCall.signalingReady) activeCall.pendingCandidates.push(candidate);
    else addDoc(collection(activeCall.ref, activeCall.localCandidateCollection), candidate)
      .catch(error => handleError(error, 'ICE kandidaty iberilmedi'));
  };
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === 'connected') {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = null;
      setCallStatus('Baglanyşyk döredildi');
      startDuration();
    }
    else if (state === 'connecting') setCallStatus('Baglanyşýar…');
    else if (state === 'failed') finishCall({ notifyRemote: true, message: 'Wideo baglanyşygy başartmady' });
    else if (state === 'disconnected') {
      setCallStatus('Baglanyşyk wagtlaýyn kesildi…');
      clearTimeout(disconnectTimeout);
      disconnectTimeout = setTimeout(() => {
        if (pc.connectionState === 'disconnected') finishCall({ notifyRemote: true, message: 'Internet baglanyşygy kesildi' });
      }, Number(config?.rtc?.disconnectGraceMs) || 12000);
    }
  };
  const videoInputs = typeof navigator.mediaDevices.enumerateDevices === 'function'
    ? await navigator.mediaDevices.enumerateDevices()
      .then(devices => devices.filter(device => device.kind === 'videoinput').length)
      .catch(() => 1)
    : 1;
  const switchButton = element('switchCallCamera');
  if (switchButton) switchButton.disabled = videoInputs < 2;
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
    if (!activeCall) return;
    if (!snapshot.exists()) {
      await finishCall({ notifyRemote: false, message: 'Jaň tamamlandy' });
      return;
    }
    const data = snapshot.data();
    if (activeCall.role === 'caller' && data.answer && !activeCall.pc.remoteDescription) {
      await activeCall.pc.setRemoteDescription(data.answer);
      await flushRemoteCandidates();
      setCallStatus('Jaň kabul edildi');
    }
    if (data.status === 'accepted') {
      clearTimeout(callTimeout);
      callTimeout = null;
      setCallStatus('Baglanyşýar…');
    }
    if (data.status === 'declined') await finishCall({ notifyRemote: false, message: 'Jaň kabul edilmedi' });
    if (data.status === 'busy') await finishCall({ notifyRemote: false, message: 'Ulanyjy başga jaňda' });
    if (data.status === 'ended') await finishCall({ notifyRemote: false, message: 'Jaň tamamlandy' });
  }, error => handleError(error, 'Jaň ýagdaýy ýüklenmedi'));
}

export async function startVideoCall(){
  if (!runtime.user) throw new Error('Wideoçat üçin Google bilen giriş ediň.');
  if (activeCall || callStarting) throw new Error('Başga jaň dowam edýär.');
  const chat = bridge.getActiveChat();
  if (!chat?.remote || !chat.recipientId) throw new Error('Wideoçat üçin hakyky ulanyjy çaty saýlaň.');
  const callRef = doc(collection(db, 'calls'));
  callStarting = true;
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
  } finally {
    callStarting = false;
  }
}

async function acceptIncoming(){
  if (!incomingCall || !runtime.user || acceptingCall) return;
  if (activeCall) {
    await updateDoc(incomingCall.ref, { status: 'busy', endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    hideIncoming();
    return;
  }
  const { ref, data } = incomingCall;
  const returnFocus = incomingFocusReturn;
  acceptingCall = true;
  hideIncoming();
  showCallLayer(profileName(data.callerId), 'Kamera açylýar…');
  callFocusReturn = returnFocus;
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
  } finally {
    acceptingCall = false;
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
      const now = Date.now();
      const maxAge = Number(config?.rtc?.maxCallAgeMs) || ((Number(config?.rtc?.ringTimeoutMs) || 45000) + 15000);
      const calls = snapshot.docs.map(item => ({ id: item.id, data: item.data(), createdAt: millis(item.data().createdAt) }));
      calls.filter(item => item.createdAt && now - item.createdAt > maxAge).forEach(item => {
        updateDoc(doc(db, 'calls', item.id), {
          status: 'ended', endedAt: serverTimestamp(), updatedAt: serverTimestamp()
        }).catch(() => {});
      });
      const newest = calls
        .filter(item => (!item.createdAt || now - item.createdAt <= maxAge) && item.id !== activeCall?.id)
        .sort((left, right) => right.createdAt - left.createdAt)[0];
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
  if (button) {
    button.setAttribute('aria-pressed', String(!track.enabled));
    button.setAttribute('aria-label', kind === 'audio'
      ? track.enabled ? 'Mikrofony ýap' : 'Mikrofony aç'
      : track.enabled ? 'Kamerany ýap' : 'Kamerany aç');
  }
}

function resetMediaControls(){
  for (const [id, label] of [['toggleCallMic', 'Mikrofony ýap'], ['toggleCallCamera', 'Kamerany ýap']]) {
    const button = element(id);
    button?.classList.remove('off');
    button?.setAttribute('aria-pressed', 'false');
    button?.setAttribute('aria-label', label);
  }
  const switchButton = element('switchCallCamera');
  if (switchButton) switchButton.disabled = false;
}

async function switchCamera(){
  if (!activeCall?.pc || !activeCall.localStream) return;
  const nextFacingMode = preferredFacingMode === 'user' ? 'environment' : 'user';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: nextFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });
  const nextTrack = stream.getVideoTracks()[0];
  const sender = activeCall.pc.getSenders().find(item => item.track?.kind === 'video');
  if (!nextTrack || !sender) {
    stopMedia(stream);
    throw new Error('Başga kamera tapylmady.');
  }
  const previousTrack = activeCall.localStream.getVideoTracks()[0];
  await sender.replaceTrack(nextTrack);
  if (previousTrack) {
    activeCall.localStream.removeTrack(previousTrack);
    previousTrack.stop();
  }
  activeCall.localStream.addTrack(nextTrack);
  preferredFacingMode = nextFacingMode;
  const localVideo = element('localVideo');
  if (localVideo) {
    localVideo.srcObject = activeCall.localStream;
    localVideo.classList.toggle('mirrored', preferredFacingMode === 'user');
  }
}

document.addEventListener('click', async event => {
  try {
    if (event.target.closest('#videoCallBtn')) await startVideoCall();
    else if (event.target.closest('#acceptVideoCall')) await acceptIncoming();
    else if (event.target.closest('#declineVideoCall')) await declineIncoming();
    else if (event.target.closest('#hangupVideoCall')) await finishCall({ notifyRemote: true });
    else if (event.target.closest('#toggleCallMic')) toggleTrack('audio', 'toggleCallMic');
    else if (event.target.closest('#toggleCallCamera')) toggleTrack('video', 'toggleCallCamera');
    else if (event.target.closest('#switchCallCamera')) await switchCamera();
  } catch (error) {
    handleError(error, 'Wideoçat başartmady');
    toast(error.message || 'Wideoçat başartmady');
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && incomingCall && !incomingLayer()?.classList.contains('hidden')) {
    event.preventDefault();
    declineIncoming().catch(error => handleError(error, 'Jaň ret edilmedi'));
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
