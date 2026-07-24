function renderEverything(){
  updateUserUI();
  applyTheme();
  updateBadges();
  renderStories();
  renderAllPosts();
  renderPeople();
  renderGroups();
  renderSuggestions();
  renderOnline();
  renderChats();
  renderMessages();
  renderMedia();
  renderEvents();
  renderNextEvent();
  renderNotifications();
  renderProfile();
  renderContactSyncStatus();
}

$$('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$('#menuBtn').onclick=()=>{closeMobileSearch();const open=$('#sidebar').classList.toggle('open');$('#menuBtn').setAttribute('aria-expanded',String(open))};
$('#mobileSearchBtn').onclick=()=>toggleMobileSearch();
$('#mobileChatBack').onclick=()=>setMobileChatOpen(false);
$('#themeBtn').onclick=()=>{state.dark=!state.dark;save();applyTheme()};
$('#darkSwitch').onclick=()=>$('#themeBtn').click();
$('#notifySwitch').onclick=()=>{state.notify=!state.notify;save();renderProfile();toast('Bildiriş sazlamasy saklandy')};
$('#composerOpen').onclick=()=>openComposer('text');
$$('[data-compose]').forEach(b=>b.onclick=()=>openComposer(b.dataset.compose));
$('#peopleFilter').oninput=renderPeople;
$('#peopleStatus').onchange=renderPeople;
$('#inviteBtn').onclick=async()=>{const text=`Klas jemgyýetimize goşulyň: ${location.origin}${location.pathname}`;try{await navigator.clipboard.writeText(text);toast('Çakylyk baglanyşygy nusgalandy')}catch{prompt('Çakylyk baglanyşygy:',text)}};
$('#createGroupBtn').onclick=openGroupComposer;
$('#newChatBtn').onclick=openNewChat;
$('#chatSearch').oninput=renderChats;
$('#chatForm').onsubmit=e=>{e.preventDefault();const c=currentChat(),input=$('#chatInput'),text=input.value.trim();if(!c||!text)return;c.messages.push({id:uid(),from:'me',text,time:nowLabel()});c.preview=text;c.unread=0;input.value='';save();renderChats();renderMessages();};
$('#uploadMediaBtn').onclick=openMediaUpload;
$$('[data-media-filter]').forEach(b=>b.onclick=()=>{state.mediaFilter=b.dataset.mediaFilter;save();renderMedia()});
$('#createEventBtn').onclick=openEventComposer;
$('#readAll').onclick=()=>{state.notifications.forEach(n=>n.read=true);save();renderNotifications();toast('Ähli bildirişler okalan edildi')};
$('#editProfileBtn').onclick=openProfileEditor;
$('#contactPickerBtn').onclick=selectDeviceContacts;
$('#contactVcfInput').onchange=e=>importContactVcf(e.target.files[0]);
$('#contactSyncResultsBtn').onclick=openContactSyncResults;
$('#exportBtn').onclick=exportData;
$('#importInput').onchange=e=>importData(e.target.files[0]);
$('#resetBtn').onclick=()=>{if(confirm('Ähli ýerli maglumatlar arassalanyp, programma başlangyç ýagdaýa getirilsinmi?')){state=clone(defaultState);save();renderEverything();showPage('feed');toast('Maglumatlar arassalandy')}};
$('#searchInput').oninput=e=>globalSearch(e.target.value);
$('#searchClear').onclick=()=>{$('#searchInput').value='';globalSearch('');$('#searchInput').focus()};
$('#modalClose').onclick=closeModal;
$('#appModal').onclick=e=>{if(e.target===$('#appModal'))closeModal()};
$('#lightboxClose').onclick=closeLightbox;
$('#lightbox').onclick=e=>{if(e.target===$('#lightbox'))closeLightbox()};

window.addEventListener('hashchange',routeFromHash);
window.addEventListener('popstate',routeFromHash);
window.addEventListener('klas:statechange',()=>schedulePageRender(activePageName()));
window.addEventListener('klas:pagechange',event=>schedulePageRender(event.detail?.page||activePageName()));
window.addEventListener('online',()=>{schedulePageRender(activePageName());toast('Internet baglanyşygy dikeldildi')});
window.addEventListener('offline',()=>toast('Internet baglanyşygy kesildi. Ýerli režim dowam edýär.'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedulePageRender(activePageName())});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-chat],[data-message-person],[data-online-chat],[data-search-person],[data-chat-choice]')) setTimeout(()=>setMobileChatOpen(true),0);
  if(!e.target.closest('.post-menu,.post-dropdown'))$$('.post-dropdown').forEach(x=>x.classList.add('hidden'));
  if(!e.target.closest('.search-wrap,#mobileSearchBtn')){closeMobileSearch();$('#searchResults').classList.add('hidden');$('#searchInput').setAttribute('aria-expanded','false')}
  if($('#sidebar').classList.contains('open')&&!e.target.closest('#sidebar,#menuBtn')){$('#sidebar').classList.remove('open');$('#menuBtn').setAttribute('aria-expanded','false')}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeLightbox();closeMobileSearch();setMobileChatOpen(false);$('#searchResults').classList.add('hidden');$('#searchInput').setAttribute('aria-expanded','false');$('#sidebar').classList.remove('open');$('#menuBtn').setAttribute('aria-expanded','false')}
  if(e.key==='Tab'){
    const root=$('#appModal').classList.contains('open')?$('.modal-card'):$('#lightbox').classList.contains('open')?$('.lightbox-dialog'):null;
    if(root){
      const focusable=$$('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',root).filter(node=>node.offsetParent!==null);
      if(!focusable.length){e.preventDefault();root.focus();return}
      const first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(matchMedia('(max-width:860px)').matches)toggleMobileSearch(true);else $('#searchInput').focus()}
});

window.addEventListener('resize',()=>{if(!matchMedia('(max-width:860px)').matches)closeMobileSearch()});

/* School relationship domains: classmates, mutual friends, school years and schools. */
let relationshipView='classmates';

function relationshipText(value){return String(value||'').trim()}
function relationshipKey(value){return relationshipText(value).toLocaleLowerCase('tk-TM').replace(/[^a-z0-9äçňöşüýž]+/gi,'-').replace(/^-+|-+$/g,'')||'unknown'}
function relationshipSchool(person){return relationshipText(person.school||person.schoolName||state.currentUser.school||'Öde Abdullaýew adyndaky mekdep')}
function relationshipYear(person){return Number(person.graduationYear||person.schoolYear||state.currentUser.graduationYear||2000)}
function relationshipClass(person){return relationshipText(person.className||person.class||state.currentUser.className||'A').toUpperCase()}
function relationshipMeta(person){return {...person,school:relationshipSchool(person),graduationYear:relationshipYear(person),className:relationshipClass(person)}}
function sameSchool(a,b){return relationshipKey(relationshipSchool(a))===relationshipKey(relationshipSchool(b))}
function sameClass(a,b){return sameSchool(a,b)&&relationshipYear(a)===relationshipYear(b)&&relationshipClass(a)===relationshipClass(b)}

function relationshipPeople(){return state.people.map(relationshipMeta)}
function classmatesList(){const me=relationshipMeta(state.currentUser);return relationshipPeople().filter(person=>sameClass(me,person))}
function friendsList(){return relationshipPeople().filter(person=>person.status==='friend')}

function relationshipPersonCard(person){
  const detail=[person.className?`${person.className} klas`:null,person.graduationYear?`${person.graduationYear} uçuryş`:null,person.city,person.job].filter(Boolean).join(' · ');
  return `<div class="person relationship-person"><span class="presence-avatar"><img class="avatar" src="${esc(person.avatar)}" alt="${esc(person.name)}">${person.online?'<i aria-hidden="true"></i>':''}</span><div class="person-info"><b>${esc(person.name)} ${person.online?'<span class="presence-badge"><i aria-hidden="true"></i>Onlaýn</span>':''}</b><small>${esc(detail)}</small><small class="relationship-school-name">${esc(person.school)}</small></div><div class="person-actions"><button class="mini" data-message-person="${esc(person.id)}" aria-label="${esc(person.name)} bilen habarlaş">💬</button><button class="mini" data-friend="${esc(person.id)}">${personButtonText(person.status)}</button></div></div>`;
}

function aggregateRelationships(type){
  const me=relationshipMeta(state.currentUser);
  const members=[me,...relationshipPeople()];
  const map=new Map();
  members.forEach(person=>{
    const school=relationshipSchool(person),year=relationshipYear(person);
    const key=type==='schools'?relationshipKey(school):`${relationshipKey(school)}:${year}`;
    if(!map.has(key)) map.set(key,{key,school,year,members:[],current:false});
    const item=map.get(key);item.members.push(person);item.current=item.current||(type==='schools'?sameSchool(me,person):(sameSchool(me,person)&&year===relationshipYear(me)));
  });
  return [...map.values()].sort((a,b)=>Number(b.current)-Number(a.current)||b.members.length-a.members.length||a.school.localeCompare(b.school,'tk'));
}

function relationshipGroupCard(group,type){
  const title=type==='schools'?group.school:`${group.year}-nji ýyl · ${group.school}`;
  const subtitle=type==='schools'?'Mekdebiň okuwçylary, mugallymlary we uçurymlary':'Şol ýylda bu mekdepde bile okan agzalar';
  return `<article class="relationship-group-card ${group.current?'current':''}"><div class="relationship-group-icon">${type==='schools'?'🏫':'📅'}</div><div><div class="relationship-card-title"><b>${esc(title)}</b>${group.current?'<span>MENIŇ TOPARYM</span>':''}</div><p>${esc(subtitle)}</p><small>${group.members.length} agza</small></div><button type="button" class="secondary" data-open-relationship-group="${esc(group.key)}" data-relationship-kind="${type}">Agzalary gör</button></article>`;
}

function relationshipEmpty(text){return `<div class="empty relationship-empty">${esc(text)}</div>`}

function bindRelationshipPeople(){
  $$('[data-friend]',$('#people')).forEach(button=>button.onclick=()=>toggleFriend(button.dataset.friend));
  $$('[data-message-person]',$('#people')).forEach(button=>button.onclick=()=>startChatWithPerson(button.dataset.messagePerson));
  $$('[data-open-relationship-group]',$('#people')).forEach(button=>button.onclick=()=>{
    const type=button.dataset.relationshipKind;
    const group=aggregateRelationships(type).find(item=>item.key===button.dataset.openRelationshipGroup);
    if(!group)return;
    openModal({title:type==='schools'?group.school:`${group.year}-nji ýylyň mekdep agzalary`,hideConfirm:true,body:`<div class="choice-list">${group.members.map(person=>`<button class="choice" data-relationship-member="${esc(person.id||'me')}"><img class="avatar" src="${esc(person.avatar)}" alt=""><span><b>${esc(person.name)}</b><small>${esc([relationshipClass(person)+' klas',person.city,person.job].filter(Boolean).join(' · '))}</small></span></button>`).join('')}</div>`});
    $$('[data-relationship-member]').forEach(member=>member.onclick=()=>{const id=member.dataset.relationshipMember;if(id==='me')return;closeModal();startChatWithPerson(id)});
  });
}

function renderRelationshipHub(){
  const root=$('#people');if(!root)return;
  const queryValue=$('#peopleFilter')?.value.toLocaleLowerCase('tk-TM').trim()||'';
  const status=$('#peopleStatus')?.value||'all';
  let html='';
  if(relationshipView==='classmates'||relationshipView==='friends'){
    let list=relationshipView==='friends'?friendsList():classmatesList();
    list=list.filter(person=>(status==='all'||person.status===status)&&(!queryValue||`${person.name} ${person.city} ${person.job} ${person.school} ${person.className} ${person.graduationYear}`.toLocaleLowerCase('tk-TM').includes(queryValue)));
    html=list.map(relationshipPersonCard).join('')||relationshipEmpty(relationshipView==='friends'?'Heniz özara tassyklanan dost ýok.':'Şol bir mekdep, uçuryş ýyly we klas boýunça klasdaş tapylmady.');
  }else{
    const groups=aggregateRelationships(relationshipView).filter(group=>!queryValue||`${group.school} ${group.year}`.toLocaleLowerCase('tk-TM').includes(queryValue));
    html=groups.map(group=>relationshipGroupCard(group,relationshipView)).join('')||relationshipEmpty('Topar tapylmady.');
  }
  root.classList.toggle('relationship-groups-grid',relationshipView==='school-years'||relationshipView==='schools');
  root.innerHTML=html;
  $$('.relationship-tab').forEach(button=>{const active=button.dataset.relationshipView===relationshipView;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});
  const select=$('#peopleStatus');if(select)select.hidden=relationshipView==='school-years'||relationshipView==='schools';
  bindRelationshipPeople();
  const count=relationshipView==='classmates'?classmatesList().length:relationshipView==='friends'?friendsList().length:aggregateRelationships(relationshipView).length;
  const countNode=$('#peopleCount');if(countNode)countNode.textContent=count;
}

function installRelationshipHub(){
  const nav=$('[data-page="classmates"] span');if(nav)nav.textContent='Klasdaşlar';
  const section=$('#page-classmates');if(!section||section.dataset.relationshipReady)return;
  section.dataset.relationshipReady='true';
  const head=$('.page-head',section);if(head){$('h1',head).textContent='Mekdep aragatnaşyklary';$('p',head).textContent='Klasdaşlar, özara dostlar, mekdep ýyllary we mekdepler aýratyn görkezilýär.'}
  const filters=$('.filter-row',section);
  filters?.insertAdjacentHTML('beforebegin',`<div class="relationship-tabs" role="tablist" aria-label="Mekdep aragatnaşyk görnüşleri"><button type="button" class="relationship-tab active" data-relationship-view="classmates" role="tab" aria-selected="true">👥 Klasdaşlar</button><button type="button" class="relationship-tab" data-relationship-view="friends" role="tab" aria-selected="false">🤝 Dostlar</button><button type="button" class="relationship-tab" data-relationship-view="school-years" role="tab" aria-selected="false">📅 Mekdep ýyllary</button><button type="button" class="relationship-tab" data-relationship-view="schools" role="tab" aria-selected="false">🏫 Mekdepler</button></div><div class="relationship-definition" id="relationshipDefinition">Klasdaşlar — şol bir mekdepde, şol bir uçuryş ýylynda we şol bir klasda bellige alnan agzalar.</div>`);
  $$('.relationship-tab',section).forEach(button=>button.onclick=()=>{relationshipView=button.dataset.relationshipView;const texts={classmates:'Klasdaşlar — şol bir mekdepde, şol bir uçuryş ýylynda we şol bir klasda bellige alnan agzalar.',friends:'Dostlar — dostluk haýyşy iki taraplaýyn tassyklanan agzalar.', 'school-years':'Mekdep ýyllary — şol bir ýylda şol mekdepde bile okan agzalaryň awtomatik toparlary.',schools:'Mekdepler — degişli okuwçylary, mugallymlary we uçurymlary birleşdirýän giňişlikler.'};$('#relationshipDefinition').textContent=texts[relationshipView];renderRelationshipHub()});
  const style=document.createElement('style');style.textContent=`.relationship-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:16px 0 10px}.relationship-tab{min-height:44px;border:1px solid var(--border,#dbe3ef);border-radius:12px;background:var(--card,#fff);font-weight:700;cursor:pointer}.relationship-tab.active{background:var(--primary,#2563eb);color:#fff;border-color:var(--primary,#2563eb)}.relationship-definition{padding:12px 14px;margin-bottom:14px;border-radius:12px;background:rgba(37,99,235,.08);font-size:.92rem}.relationship-school-name{display:block;margin-top:3px}.relationship-groups-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.relationship-group-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:16px;border:1px solid var(--border,#dbe3ef);border-radius:16px;background:var(--card,#fff)}.relationship-group-card.current{border-color:var(--primary,#2563eb);box-shadow:0 0 0 2px rgba(37,99,235,.1)}.relationship-group-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:rgba(37,99,235,.1);font-size:24px}.relationship-card-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.relationship-card-title span{font-size:10px;padding:3px 6px;border-radius:999px;background:#dcfce7;color:#166534}.relationship-group-card p{margin:4px 0;color:var(--muted,#64748b)}@media(max-width:760px){.relationship-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.relationship-groups-grid{grid-template-columns:1fr}.relationship-group-card{grid-template-columns:auto 1fr}.relationship-group-card>button{grid-column:1/-1;width:100%}}`;
  document.head.append(style);
}

installRelationshipHub();
renderPeople=renderRelationshipHub;
window.KlasRelationships=Object.freeze({sameClass,classmates:classmatesList,friends:friendsList,schoolYears:()=>aggregateRelationships('school-years'),schools:()=>aggregateRelationships('schools'),render:renderRelationshipHub});

renderEverything();
routeFromHash();