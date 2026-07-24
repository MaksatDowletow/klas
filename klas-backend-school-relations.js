import { collection, onSnapshot, query, limit } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, runtime, bridge, handleError } from './klas-backend-core.js';

let stopProfiles = null;

function cleanClassName(value){
  const result = String(value || '').trim().toUpperCase().slice(0, 12);
  return result || 'A';
}

function enrichPeople(snapshot){
  const profiles = new Map(snapshot.docs.map(item => [item.id, item.data()]));
  for (const [uid, profile] of profiles) {
    if (uid === runtime.user?.uid) continue;
    bridge.patchPerson(uid, {
      school: String(profile.school || '').trim(),
      schoolId: String(profile.schoolId || '').trim(),
      graduationYear: Number(profile.graduationYear) || 2000,
      className: cleanClassName(profile.className),
      attendanceYears: Array.isArray(profile.attendanceYears)
        ? profile.attendanceYears.filter(Number.isInteger).slice(0, 20)
        : []
    });
  }
  const own = profiles.get(runtime.user?.uid);
  if (own) {
    window.dispatchEvent(new CustomEvent('klas-school-profile', {
      detail: {
        uid: runtime.user.uid,
        school: String(own.school || '').trim(),
        schoolId: String(own.schoolId || '').trim(),
        graduationYear: Number(own.graduationYear) || 2000,
        className: cleanClassName(own.className),
        attendanceYears: Array.isArray(own.attendanceYears)
          ? own.attendanceYears.filter(Number.isInteger).slice(0, 20)
          : []
      }
    }));
  }
}

function stop(){
  stopProfiles?.();
  stopProfiles = null;
}

function start(){
  stop();
  if (!runtime.user) return;
  stopProfiles = onSnapshot(
    query(collection(db, 'profiles'), limit(150)),
    enrichPeople,
    error => handleError(error, 'Mekdep gatnaşyklary ýüklenmedi')
  );
}

window.addEventListener('klas-auth', event => event.detail?.user ? start() : stop());
if (runtime.user) start();
