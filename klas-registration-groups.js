import { collection, getDocs, query, limit } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, runtime, bridge, toast } from './klas-backend-core.js';
import { createGroup, toggleGroup } from './klas-backend-community.js';
import { normalizeRegistrationGroupData, automaticGroupDefinitions } from './klas-registration-groups-policy.mjs';

const markerKey = uid => `klas-registration-groups:${uid}`;
let opening = false;

async function existingGroups(){
  const snapshot = await getDocs(query(collection(db, 'groups'), limit(500)));
  return snapshot.docs.map(item => ({ id:item.id, ...item.data() }));
}

export async function assignRegistrationGroups(input){
  const user = runtime.user;
  if (!user || runtime.account?.onboardingComplete !== true) throw new Error('Akkaunt doly tamamlanmady.');
  const data = normalizeRegistrationGroupData(input);
  const definitions = automaticGroupDefinitions(data);
  const current = await existingGroups();

  for (const definition of definitions) {
    const found = current.find(group => group.name === definition.name);
    if (!found) {
      await createGroup(definition);
      continue;
    }
    if (!(found.memberIds || []).includes(user.uid)) await toggleGroup(found.id, false);
  }

  localStorage.setItem(markerKey(user.uid), JSON.stringify({ ...data, assignedAt:new Date().toISOString() }));
  window.dispatchEvent(new CustomEvent('klas-registration-groups', { detail:{ uid:user.uid, groups:definitions } }));
  return definitions;
}

function openAssignmentDialog(){
  if (opening || !runtime.user || runtime.account?.onboardingComplete !== true) return;
  if (localStorage.getItem(markerKey(runtime.user.uid))) return;
  opening = true;
  const profile = runtime.profile || {};
  bridge.openModal({
    title:'Toparlara awtomatik ýerleşdirmek',
    confirmText:'Toparlara goşul',
    cancelText:'Soňkyra',
    body:`<div class="backend-modal-status">Registrasiýa maglumatlaryňyz boýunça klasdaşlar, mekdep ýyllary we mekdep toparlary awtomatik dörediler.</div><div class="form-grid"><div class="field"><label>Mekdep</label><input id="autoGroupSchool" maxlength="120" value="${String(profile.school||'').replace(/"/g,'&quot;')}" required></div><div class="form-grid two"><div class="field"><label>Mekdep ID-si</label><input id="autoGroupSchoolId" maxlength="120" value="${String(profile.schoolId||'').replace(/"/g,'&quot;')}" placeholder="mysal: ode-abdullayew-1"></div><div class="field"><label>Klas</label><input id="autoGroupClass" maxlength="12" value="${String(profile.className||'').replace(/"/g,'&quot;')}" placeholder="A" required></div></div><div class="form-grid two"><div class="field"><label>Uçuryş ýyly</label><input id="autoGroupGraduation" type="number" min="1900" max="2100" value="${Number(profile.graduationYear)||2000}" required></div><div class="field"><label>Mekdebe baran ýyllar</label><input id="autoGroupYears" value="${Array.isArray(profile.attendanceYears)?profile.attendanceYears.join(', '):''}" placeholder="1990, 1991, 1992" required></div></div></div>`,
    onConfirm:async button=>{
      button.disabled=true;
      try{
        const groups=await assignRegistrationGroups({
          school:document.getElementById('autoGroupSchool').value,
          schoolId:document.getElementById('autoGroupSchoolId').value,
          className:document.getElementById('autoGroupClass').value,
          graduationYear:document.getElementById('autoGroupGraduation').value,
          attendanceYears:document.getElementById('autoGroupYears').value
        });
        bridge.closeModal();
        toast(`${groups.length} degişli topar taýýarlandy`);
      }finally{button.disabled=false;opening=false;}
    }
  });
  setTimeout(()=>{ if(document.querySelector('.modal-overlay.open')===null) opening=false; },500);
}

window.addEventListener('klas-account',()=>setTimeout(openAssignmentDialog,450));
window.addEventListener('klas-auth',event=>{ if(event.detail?.user&&!event.detail?.needsOnboarding)setTimeout(openAssignmentDialog,700); });
window.KlasRegistrationGroups=Object.freeze({ assign:assignRegistrationGroups, open:openAssignmentDialog });
if(runtime.user&&runtime.account?.onboardingComplete===true)setTimeout(openAssignmentDialog,700);
