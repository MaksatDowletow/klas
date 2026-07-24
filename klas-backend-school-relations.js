import { collection, onSnapshot, query, limit } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, runtime, bridge, handleError } from './klas-backend-core.js';
import {
  normalizeMember,
  classmatesFor,
  friendsFor,
  schoolYearGroups,
  schoolGroups
} from './klas-school-groups-policy.mjs';

let stopProfiles = null;
let view = 'classmates';
let profiles = [];
let ownProfile = null;

const definitions = Object.freeze({
  classmates: 'Klasdaşlar — şol bir mekdepde, şol bir klasda we şol bir uçuryş ýyly bilen bellige alnan agzalar.',
  friends: 'Dostlar — dostluk gatnaşyklary iki taraplaýyn tassyklanan agzalar.',
  'school-years': 'Mekdep ýyllary — attendanceYears maglumatynda şol bir mekdepde şol bir ýylda bile okan agzalar.',
  schools: 'Mekdepler — bir schoolId ýa-da kadalaşdyrylan mekdep ady boýunça degişli agzalaryň toparlary.'
});

function allMembers(){
  const current = normalizeMember({ ...window.state?.currentUser, ...ownProfile, id: 'me' });
  return [current, ...profiles.filter(person => person.id !== runtime.user?.uid).map(normalizeMember)];
}

function patchRuntimePeople(){
  profiles.forEach(profile => {
    if (profile.id === runtime.user?.uid) return;
    bridge.patchPerson(profile.id, normalizeMember(profile));
  });
}

function groupData(){
  const members = allMembers();
  const current = members[0];
  if (view === 'classmates') return classmatesFor(current, members.slice(1));
  if (view === 'friends') return friendsFor(members.slice(1));
  if (view === 'school-years') return schoolYearGroups(members).map(group => ({ ...group, current: group.members.some(member => member.id === 'me') }));
  return schoolGroups(members).map(group => ({ ...group, current: group.members.some(member => member.id === 'me') }));
}

function personCard(person){
  const detail = [person.className ? `${person.className} klas` : null, person.graduationYear ? `${person.graduationYear} uçuryş` : null, person.city, person.job || person.profession].filter(Boolean).join(' · ');
  return `<div class="person relationship-person"><span class="presence-avatar"><img class="avatar" src="${window.esc(person.avatar || person.avatarURL || '')}" alt="${window.esc(person.name || person.fullName || '')}">${person.online ? '<i aria-hidden="true"></i>' : ''}</span><div class="person-info"><b>${window.esc(person.name || person.fullName || '')}</b><small>${window.esc(detail)}</small><small class="relationship-school-name">${window.esc(person.school || '')}</small></div><div class="person-actions"><button class="mini" data-message-person="${window.esc(person.id)}">💬</button><button class="mini" data-friend="${window.esc(person.id)}">${window.personButtonText(person.status)}</button></div></div>`;
}

function groupCard(group){
  const isSchool = view === 'schools';
  const title = isSchool ? group.school : `${group.year}-nji ýyl · ${group.school}`;
  return `<article class="relationship-group-card ${group.current ? 'current' : ''}"><div class="relationship-group-icon">${isSchool ? '🏫' : '📅'}</div><div><div class="relationship-card-title"><b>${window.esc(title)}</b>${group.current ? '<span>MENIŇ TOPARYM</span>' : ''}</div><p>${isSchool ? 'Şu mekdebe degişli agzalar' : 'Şol ýylda bu mekdepde bile okan agzalar'}</p><small>${group.members.length} agza</small></div><button type="button" class="secondary" data-exact-group="${window.esc(group.key)}">Agzalary gör</button></article>`;
}

function bind(root){
  root.querySelectorAll('[data-friend]').forEach(button => button.onclick = () => window.toggleFriend(button.dataset.friend));
  root.querySelectorAll('[data-message-person]').forEach(button => button.onclick = () => window.startChatWithPerson(button.dataset.messagePerson));
  root.querySelectorAll('[data-exact-group]').forEach(button => button.onclick = () => {
    const group = groupData().find(item => item.key === button.dataset.exactGroup);
    if (!group) return;
    window.openModal({
      title: view === 'schools' ? group.school : `${group.year}-nji ýylyň agzalary`,
      hideConfirm: true,
      body: `<div class="choice-list">${group.members.map(member => `<button class="choice" data-exact-member="${window.esc(member.id)}"><img class="avatar" src="${window.esc(member.avatar || member.avatarURL || '')}" alt=""><span><b>${window.esc(member.name || member.fullName || '')}</b><small>${window.esc([member.className ? `${member.className} klas` : '', member.school].filter(Boolean).join(' · '))}</small></span></button>`).join('')}</div>`
    });
    document.querySelectorAll('[data-exact-member]').forEach(member => member.onclick = () => {
      if (member.dataset.exactMember === 'me') return;
      window.closeModal();
      window.startChatWithPerson(member.dataset.exactMember);
    });
  });
}

function render(){
  const root = document.getElementById('people');
  if (!root) return;
  const queryText = String(document.getElementById('peopleFilter')?.value || '').toLocaleLowerCase('tk-TM').trim();
  const status = document.getElementById('peopleStatus')?.value || 'all';
  let data = groupData();
  if (view === 'classmates' || view === 'friends') {
    data = data.filter(person => (status === 'all' || person.status === status) && (!queryText || `${person.name || person.fullName} ${person.school} ${person.className} ${person.graduationYear}`.toLocaleLowerCase('tk-TM').includes(queryText)));
    root.innerHTML = data.map(personCard).join('') || `<div class="empty relationship-empty">${view === 'friends' ? 'Heniz özara tassyklanan dost ýok.' : 'Takyk mekdep, klas we uçuryş ýyly boýunça klasdaş tapylmady.'}</div>`;
  } else {
    data = data.filter(group => !queryText || `${group.school} ${group.year || ''}`.toLocaleLowerCase('tk-TM').includes(queryText));
    root.innerHTML = data.map(groupCard).join('') || '<div class="empty relationship-empty">Topar tapylmady. Profilde schoolId/mekdep we attendanceYears maglumatlaryny dolduryň.</div>';
  }
  root.classList.toggle('relationship-groups-grid', view === 'school-years' || view === 'schools');
  const statusSelect = document.getElementById('peopleStatus');
  if (statusSelect) statusSelect.hidden = view === 'school-years' || view === 'schools';
  const count = document.getElementById('peopleCount');
  if (count) count.textContent = data.length;
  bind(root);
}

function installTabs(){
  document.querySelectorAll('.relationship-tab').forEach(button => {
    button.onclick = () => {
      view = button.dataset.relationshipView;
      document.querySelectorAll('.relationship-tab').forEach(item => {
        const active = item.dataset.relationshipView === view;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      const definition = document.getElementById('relationshipDefinition');
      if (definition) definition.textContent = definitions[view];
      render();
    };
  });
}

function enrichPeople(snapshot){
  profiles = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  ownProfile = profiles.find(profile => profile.id === runtime.user?.uid) || null;
  patchRuntimePeople();
  installTabs();
  window.renderPeople = render;
  window.KlasRelationships = Object.freeze({
    classmates: () => classmatesFor(normalizeMember({ ...window.state?.currentUser, ...ownProfile, id: 'me' }), profiles),
    friends: () => friendsFor(profiles),
    schoolYears: () => schoolYearGroups(allMembers()),
    schools: () => schoolGroups(allMembers()),
    render
  });
  render();
}

function stop(){
  stopProfiles?.();
  stopProfiles = null;
  profiles = [];
  ownProfile = null;
}

function start(){
  stop();
  if (!runtime.user) return;
  stopProfiles = onSnapshot(
    query(collection(db, 'profiles'), limit(500)),
    enrichPeople,
    error => handleError(error, 'Mekdep gatnaşyklary ýüklenmedi')
  );
}

window.addEventListener('klas-auth', event => event.detail?.user ? start() : stop());
if (runtime.user) start();
