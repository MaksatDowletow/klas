function renderGroups(){
  $('#groups').innerHTML=state.groups.map(g=>`<div class="group"><div class="group-icon">${esc(g.icon)}</div><div class="group-info"><b>${esc(g.name)}</b><small>${g.members} agza · ${esc(g.description||'')}</small></div><button class="mini" data-group-toggle="${esc(g.id)}">${g.joined?'Goşuldy ✓':'Goşul'}</button>${g.owner?`<button class="mini" data-group-delete="${esc(g.id)}" aria-label="${esc(g.name)} gurnagyny aýyr">🗑️</button>`:''}</div>`).join('');
  $$('[data-group-toggle]').forEach(b=>b.onclick=()=>{const g=state.groups.find(x=>x.id===b.dataset.groupToggle);g.joined=!g.joined;g.members=Math.max(0,g.members+(g.joined?1:-1));addNotification(g.joined?`${g.name} gurnagyna goşuldyňyz`:`${g.name} gurnagyndan çykdyňyz`,'🏫','groups');save();renderGroups();toast(g.joined?'Gurnaga goşuldyňyz':'Gurnakdan çykdyňyz')});
  $$('[data-group-delete]').forEach(b=>b.onclick=()=>{if(confirm('Bu gurnagy aýyrmalymy?')){state.groups=state.groups.filter(g=>g.id!==b.dataset.groupDelete);save();renderGroups();toast('Gurnak aýryldy')}});
}
function openGroupComposer(){openModal({title:'Täze gurnak döret',confirmText:'Döret',body:`<div class="form-grid"><div class="field"><label>Gurnagyň ady</label><input id="groupName" maxlength="80"></div><div class="field"><label>Nyşan</label><input id="groupIcon" value="🏫" maxlength="4"></div><div class="field"><label>Beýany</label><textarea id="groupDescription" maxlength="300"></textarea></div></div>`,onConfirm:()=>{const name=$('#groupName').value.trim();if(!name)throw new Error('Gurnagyň adyny ýazyň.');state.groups.unshift({id:uid(),name,members:1,icon:$('#groupIcon').value.trim()||'🏫',description:$('#groupDescription').value.trim(),joined:true,owner:true});addNotification(`${name} gurnagy döredildi`,'🏫','groups');save();renderGroups();closeModal();toast('Gurnak döredildi')}});}

function currentChat(){return state.chats.find(c=>c.id===state.activeChat)||state.chats[0];}
function renderChats(){
  const q=$('#chatSearch')?.value.toLowerCase().trim()||'';const list=state.chats.filter(c=>!q||`${c.name} ${c.preview}`.toLowerCase().includes(q));
  $('#chatList').innerHTML=list.map(c=>`<button class="chat-user ${state.activeChat===c.id?'active':''}" data-chat="${esc(c.id)}"><img class="avatar" src="${esc(c.avatar)}" alt=""><span><b>${esc(c.name)}</b><small>${esc(c.preview||'')}</small></span>${c.unread?`<i class="unread-dot">${c.unread}</i>`:''}</button>`).join('')||'<div class="empty">Çat tapylmady.</div>';
  $$('[data-chat]').forEach(b=>b.onclick=()=>{state.activeChat=b.dataset.chat;const c=currentChat();c.unread=0;save();renderChats();renderMessages();setMobileChatOpen(true)}); updateBadges();
}
function renderMessages(){const c=currentChat();if(!c){$('#chatHead').textContent='Çat ýok';$('#messages').innerHTML='<div class="empty">Täze çat başlaň.</div>';return;}$('#chatHead').textContent=c.name;$('#messages').innerHTML=c.messages.map(m=>`<div class="bubble-wrap ${m.from==='me'?'me':''}"><div class="bubble">${esc(m.text)}</div><div class="bubble-time">${esc(m.time||'')}</div></div>`).join('')||'<div class="empty">Heniz habar ýok. Ilkinji habary ýazyň.</div>';$('#messages').scrollTop=$('#messages').scrollHeight;}
function openNewChat(){const available=state.people.map(p=>`<button class="choice" data-chat-choice="${esc(p.id)}"><img class="avatar" src="${esc(p.avatar)}" alt=""><span><b>${esc(p.name)}</b><small>${esc(p.city)} · ${esc(p.job)}</small></span></button>`).join('');openModal({title:'Täze çat başla',hideConfirm:true,body:`<div class="choice-list">${available}</div>`});$$('[data-chat-choice]').forEach(b=>b.onclick=()=>{closeModal();startChatWithPerson(b.dataset.chatChoice)});}

function renderMedia(){
  const filter=state.mediaFilter||'all';$$('[data-media-filter]').forEach(b=>{const active=b.dataset.mediaFilter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});const list=state.media.filter(m=>filter==='all'||m.type===filter);
  $('#mediaGrid').innerHTML=list.map(m=>{const src=safeLocalUrl(m.src,{allowDataImage:m.type==='image'});if(!src)return '';const thumbnail=window.KlasMediaViewer?.cloudinaryThumbnail(src,m.type)||src;const preview=m.type==='image'||thumbnail!==src?`<img src="${esc(thumbnail)}" alt="${esc(m.title)}" loading="lazy">`:isDirectVideo(src)?`<video src="${esc(src)}" muted preload="metadata" playsinline></video>`:`<div class="media-placeholder">🎥</div>`;return `<button class="media-item" data-media="${esc(m.id)}" aria-label="${esc(m.title)} mediasyny aç">${preview}<span class="media-type-badge">${m.type==='video'?'▶ Wideo':'▧ Surat'}</span><span class="media-label">${esc(m.title)}</span></button>`}).join('')||'<div class="empty">Bu bölümde media ýok.</div>';
  $$('[data-media]').forEach(b=>b.onclick=()=>viewMedia(b.dataset.media));
}
function mediaViewerList(){const filter=state.mediaFilter||'all';return state.media.filter(m=>filter==='all'||m.type===filter).map(m=>({...m,description:m.description||''}));}
function ownsMedia(item){return item.ownerId==='me'||Boolean(item.remote&&item.ownerId&&(item.ownerId===state.currentUser.uid||item.ownerId===state.currentUser.id));}
async function deleteViewerMedia(item){
  if(!confirm('Mediany hemişelik aýyrmalymy?'))return false;
  if(item.remote){
    if(!window.KlasBackend?.deleteMedia)throw new Error('Firebase media dolandyryşy entek taýýar däl.');
    await window.KlasBackend.deleteMedia(item.id);
  }else{
    state.media=state.media.filter(media=>media.id!==item.id);
    save();
    renderMedia();
  }
  toast('Media aýryldy');
  return true;
}
function viewMedia(id){
  const m=state.media.find(x=>x.id===id);if(!m)return;
  if(!safeLocalUrl(m.src,{allowDataImage:m.type==='image'})){toast('Media salgysy howpsuz däl');return}
  if(!window.KlasMediaViewer?.open(mediaViewerList(),id,{canDelete:ownsMedia,onDelete:deleteViewerMedia}))toast('Media viewer açylmady');
}
function openMediaUpload(){openModal({title:'Media ýükle',confirmText:'Ýükle',body:`<div class="form-grid"><div class="field"><label>Görnüşi</label><select id="mediaType"><option value="image">Surat</option><option value="video">Wideo URL</option></select></div><div class="field"><label>Ady</label><input id="mediaTitle" maxlength="100"></div><div class="field" id="mediaFileField"><label>Surat faýly</label><input id="mediaFile" type="file" accept="image/*"><div class="field-help">Iň köp 1.5 MB.</div></div><div class="field"><label>Ýa-da URL</label><input id="mediaUrl" type="url" placeholder="https://..."></div></div>`,onConfirm:async()=>{const type=$('#mediaType').value;const file=$('#mediaFile')?.files[0];const src=type==='image'?(file?await fileToDataUrl(file):normalizeLocalUrl($('#mediaUrl').value.trim())):normalizeLocalUrl($('#mediaUrl').value.trim());if(!src)throw new Error('Faýl ýa-da URL giriziň.');state.media.unshift({id:uid(),type,src,title:$('#mediaTitle').value.trim()||'Täze media',ownerId:'me'});save();renderMedia();closeModal();toast('Media ýüklendi')}});$('#mediaType').onchange=e=>$('#mediaFileField').classList.toggle('hidden',e.target.value==='video');}

function renderEvents(){
  const sorted=[...state.events].sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  $('#events').innerHTML=sorted.map(e=>{const d=formatEventDate(e.date);const past=new Date(`${e.date}T${e.time||'00:00'}`)<new Date();return `<div class="event ${past?'past':''}"><div class="datebox"><small>${esc(d.month)}</small><b>${esc(d.day)}</b></div><div><b>${esc(e.title)}</b><p>${esc(e.location)} · ${esc(e.time)}</p><small>${esc(e.description||'')}</small></div><div class="event-actions"><button class="secondary" data-attend="${esc(e.id)}">${e.attending?'Gatnaşaryn ✓':'Gatnaşaryn'}</button>${e.ownerId==='me'?`<button class="mini" data-delete-event="${esc(e.id)}" aria-label="${esc(e.title)} çäresini aýyr">🗑️</button>`:''}</div></div>`}).join('')||'<div class="empty">Heniz çäre ýok.</div>';
  $$('[data-attend]').forEach(b=>b.onclick=()=>{const e=state.events.find(x=>x.id===b.dataset.attend);e.attending=!e.attending;addNotification(e.attending?`${e.title} çäresine gatnaşygyňyz tassyklandy`:`${e.title} çäresine gatnaşygyňyz ýatyryldy`,'📅','events');save();renderEvents();renderNextEvent();toast(e.attending?'Gatnaşyk tassyklandy':'Gatnaşyk ýatyryldy')});
  $$('[data-delete-event]').forEach(b=>b.onclick=()=>{if(confirm('Çäräni aýyrmalymy?')){state.events=state.events.filter(e=>e.id!==b.dataset.deleteEvent);save();renderEvents();renderNextEvent();toast('Çäre aýryldy')}});
}
function openEventComposer(){const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);openModal({title:'Täze çäre döret',confirmText:'Döret',body:`<div class="form-grid"><div class="field"><label>Çäräniň ady</label><input id="eventTitle" maxlength="120"></div><div class="form-grid two"><div class="field"><label>Sene</label><input id="eventDate" type="date" min="${new Date().toISOString().slice(0,10)}" value="${tomorrow}"></div><div class="field"><label>Wagt</label><input id="eventTime" type="time" value="18:00"></div></div><div class="field"><label>Ýer</label><input id="eventLocation" maxlength="180"></div><div class="field"><label>Beýany</label><textarea id="eventDescription" maxlength="500"></textarea></div></div>`,onConfirm:()=>{const title=$('#eventTitle').value.trim(),date=$('#eventDate').value,time=$('#eventTime').value,location=$('#eventLocation').value.trim();if(!title||!date||!time||!location)throw new Error('Ady, senesi, wagty we ýeri hökmany.');state.events.push({id:uid(),title,date,time,location,description:$('#eventDescription').value.trim(),attending:true,ownerId:'me'});addNotification(`${title} çäresi döredildi`,'📅','events');save();renderEvents();renderNextEvent();closeModal();toast('Çäre döredildi')}});}
function renderNextEvent(){const future=[...state.events].filter(e=>new Date(`${e.date}T${e.time}`)>=new Date()).sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];$('#nextEvent').innerHTML=future?`<div class="next-event-card"><b>${esc(future.title)}</b><small>${esc(future.date)} · ${esc(future.time)}</small><small>${esc(future.location)}</small></div>`:'<div class="empty">Ýakyn çäre ýok.</div>';}

function renderNotifications(){const unread=state.notifications.filter(n=>!n.read).length;$('#noticeBadge').textContent=unread;$('#noticeBadge').classList.toggle('hidden',!unread);$('#notifications').innerHTML=state.notifications.map(n=>`<button class="notice ${n.read?'':'unread'}" data-notice="${esc(n.id)}"><span>${esc(n.icon)}</span><span><b>${esc(n.text)}</b><small>${esc(n.time)}</small></span></button>`).join('')||'<div class="empty">Bildiriş ýok.</div>';$$('[data-notice]').forEach(b=>b.onclick=()=>{const n=state.notifications.find(x=>x.id===b.dataset.notice);n.read=true;save();renderNotifications();if(n.page)showPage(n.page)});}

function renderProfile(){const u=state.currentUser;$('#profileAvatar').src=u.avatar;$('#profileName').textContent=u.name;$('#profileBio').textContent=u.bio;$('#profileMeta').textContent=`${u.city} · ${u.role}`;$('#notifySwitch').classList.toggle('on',state.notify);$('#notifySwitch').setAttribute('aria-checked',String(state.notify));state.privacy='school';$('#privacy').value='school';}
let contactSyncSessionContacts=[];
let contactSyncSource='device';
let contactSyncInviteTargets=[];

function contactSyncStorage(){
  try{return window.localStorage}catch{return null}
}

function contactSyncCloudMode(){
  return Boolean(window.KlasBridge?.isCloudMode?.());
}

function contactSyncMembers(){
  return contactSyncCloudMode()?state.people.filter(person=>person.remote):[];
}

function currentContactSyncResult(){
  return window.KlasContactSync?.matchContacts(contactSyncSessionContacts,contactSyncMembers())||{selected:[],matches:[],unmatched:[],ambiguous:[]};
}

function contactSyncDate(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return'';
  return new Intl.DateTimeFormat('tk-TM',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
}

function renderContactSyncStatus(){
  const api=window.KlasContactSync,status=$('#contactSyncStatus'),picker=$('#contactPickerBtn'),results=$('#contactSyncResultsBtn'),vcf=$('#contactVcfLabel');
  if(!api||!status)return;
  const pickerReady=api.pickerSupported(navigator);
  picker.hidden=!pickerReady;
  vcf?.classList.toggle('primary',!pickerReady);
  vcf?.classList.toggle('secondary',pickerReady);
  results.hidden=!contactSyncSessionContacts.length;
  if(contactSyncSessionContacts.length){
    const result=currentContactSyncResult(),summary=api.createSummary(result,contactSyncSource);
    api.writeSummary(contactSyncStorage(),summary);
    status.textContent=contactSyncCloudMode()
      ?`${summary.selectedCount} kontakt barlandy · ${summary.matchedCount} Klas agzasy tapyldy · maglumatlar serwere ugradylmady.`
      :`${summary.selectedCount} kontakt saýlandy · agzalar bilen deňeşdirmek üçin Google giriş ediň. Maglumatlar serwere ugradylmady.`;
    return;
  }
  const summary=api.readSummary(contactSyncStorage());
  if(summary){
    status.textContent=`Soňky barlag: ${summary.selectedCount} kontakt · ${summary.matchedCount} gabat gelme · ${contactSyncDate(summary.syncedAt)}. Telefon we e-poçta saklanmady.`;
    return;
  }
  status.textContent=pickerReady
    ?'Kontaktlar diňe şu enjamda deňeşdirilýär; telefon we e-poçta maglumatlary Klas-a ýüklenmeýär.'
    :'Bu brauzerde ulgam kontakt saýlaýjysy ýok. VCF saýlaň; maglumatlar diňe şu enjamda deňeşdiriler.';
}

function contactDisplayName(contact){
  return contact.name||'Atsyz kontakt';
}

function contactInviteItem(contact,ambiguous=false){
  const index=contactSyncInviteTargets.push(contact)-1;
  const channel=window.KlasContactSync.preferredInviteChannel(contact);
  const action=channel.type==='sms'?'SMS bilen çagyr':channel.type==='email'?'E-poçta bilen çagyr':'Çakylygy paýlaş';
  return`<div class="contact-result-item"><span class="contact-result-icon" aria-hidden="true">${ambiguous?'◫':'+'}</span><span><b>${esc(contactDisplayName(contact))}</b><small>${ambiguous?'Birnäçe birmeňzeş atly Klas profili bar':'Klas agzalarynyň arasynda tapylmady'}</small></span><button type="button" class="mini" data-contact-invite="${index}">${action}</button></div>`;
}

function openContactSyncResults(){
  const api=window.KlasContactSync;
  if(!api||!contactSyncSessionContacts.length){toast('Ilki kontaktlary saýlaň.');return}
  const cloud=contactSyncCloudMode(),result=currentContactSyncResult();
  contactSyncInviteTargets=[];
  const matches=result.matches.map(({contact,person})=>`<button type="button" class="contact-result-item contact-match" data-chat-choice="${esc(person.id)}"><span class="presence-avatar"><img class="avatar" src="${esc(person.avatar||avatarUrl(1))}" alt="">${person.online?'<i aria-hidden="true"></i>':''}</span><span><b>${esc(person.name)}</b><small>${esc(contactDisplayName(contact))} kontakty bilen doly ady gabat geldi${person.online?' · Onlaýn':''}</small></span><span class="contact-result-action">Çat aç →</span></button>`).join('');
  const unmatched=result.unmatched.slice(0,100).map(contact=>contactInviteItem(contact)).join('');
  const ambiguous=result.ambiguous.slice(0,100).map(contact=>contactInviteItem(contact,true)).join('');
  const hiddenCount=Math.max(0,result.unmatched.length+result.ambiguous.length-200);
  const comparison=cloud
    ?`${matches?`<section class="contact-result-section"><div class="contact-section-title"><b>Klas-da tapylanlar</b><span>${result.matches.length}</span></div><p class="contact-section-help">Diňe doly adyň takyk gabat gelmegine görä görkezilýär.</p><div class="contact-result-list">${matches}</div></section>`:'<div class="empty contact-empty">Saýlanan kontaktlaryň arasynda ady takyk gabat gelýän Klas agzasy tapylmady.</div>'}
       ${(unmatched||ambiguous)?`<section class="contact-result-section"><div class="contact-section-title"><b>Çagyrmak üçin</b><span>${result.unmatched.length+result.ambiguous.length}</span></div><div class="contact-result-list">${ambiguous}${unmatched}</div>${hiddenCount?`<small class="contact-overflow-note">Ýene ${hiddenCount} kontakt görkezilmedi.</small>`:''}</section>`:''}`
    :`<div class="contact-login-note"><b>Agza barlagy üçin Google giriş gerek</b><span>Kontaktlar saýlandy. Giriş edeniňizden soň şu sessiýada Klas profilleri bilen ýerli deňeşdiriler.</span></div><section class="contact-result-section"><div class="contact-section-title"><b>Saýlanan kontaktlar</b><span>${result.selected.length}</span></div><div class="contact-result-list">${result.selected.slice(0,100).map(contact=>contactInviteItem(contact)).join('')}</div></section>`;
  openModal({
    title:'Kontakt sinhronizasiýasy',
    hideConfirm:true,
    cancelText:'Ýap',
    body:`<div class="contact-privacy-note"><span aria-hidden="true">🔒</span><div><b>Enjamyňyzda işlenýär</b><small>Telefon belgileri we e-poçta salgylary Firestore-a, Cloudinary-a ýa-da başga serwere ugradylmaýar we brauzerde saklanmaýar.</small></div></div><div class="contact-stats" aria-label="Sinhronizasiýa netijeleri"><div><strong>${result.selected.length}</strong><span>Saýlandy</span></div><div><strong>${cloud?result.matches.length:'—'}</strong><span>Klas-da tapyldy</span></div><div><strong>${cloud?result.unmatched.length+result.ambiguous.length:'—'}</strong><span>Çagyrmak üçin</span></div></div>${comparison}<div class="contact-result-controls"><button type="button" class="secondary" data-contact-share>Umumy çakylygy paýlaş</button><button type="button" class="secondary contact-forget" data-contact-forget>Kontaktlary ýatdan aýyr</button></div>`
  });
  $$('[data-contact-invite]',$('#modalBody')).forEach(button=>button.onclick=()=>sendContactInvite(contactSyncInviteTargets[Number(button.dataset.contactInvite)]));
  $('[data-contact-share]',$('#modalBody')).onclick=()=>shareKlasInvite();
  $('[data-contact-forget]',$('#modalBody')).onclick=clearContactSync;
}

function klasInviteDetails(){
  const url=`${location.origin}${location.pathname}`;
  return{url,title:'Klas — mekdep jemgyýeti',text:`Klas jemgyýetimize goşulyň: ${url}`};
}

async function shareKlasInvite(){
  const invite=klasInviteDetails();
  try{
    if(typeof navigator.share==='function'){await navigator.share(invite);return}
    await navigator.clipboard.writeText(invite.text);
    toast('Çakylyk baglanyşygy nusgalandy');
  }catch(error){
    if(error?.name!=='AbortError')prompt('Çakylyk baglanyşygy:',invite.text);
  }
}

async function sendContactInvite(contact){
  const channel=window.KlasContactSync.preferredInviteChannel(contact),invite=klasInviteDetails();
  if(channel.type==='sms'){
    location.href=`sms:${encodeURIComponent(channel.target)}?body=${encodeURIComponent(invite.text)}`;
    return;
  }
  if(channel.type==='email'){
    location.href=`mailto:${encodeURIComponent(channel.target)}?subject=${encodeURIComponent(invite.title)}&body=${encodeURIComponent(invite.text)}`;
    return;
  }
  await shareKlasInvite();
}

function finishContactSync(contacts,source){
  if(!contacts?.length){toast('Kontakt saýlanmady.');return}
  contactSyncSessionContacts=window.KlasContactSync.sanitizeContacts(contacts);
  contactSyncSource=source==='vcard'?'vcard':'device';
  const result=currentContactSyncResult(),summary=window.KlasContactSync.createSummary(result,contactSyncSource);
  window.KlasContactSync.writeSummary(contactSyncStorage(),summary);
  renderContactSyncStatus();
  openContactSyncResults();
}

async function selectDeviceContacts(){
  try{
    const contacts=await window.KlasContactSync.pickContacts(navigator);
    finishContactSync(contacts,'device');
  }catch(error){
    if(error?.name!=='AbortError')toast(error?.message||'Kontaktlar saýlanmady.');
  }
}

async function importContactVcf(file){
  if(!file)return;
  try{
    if(file.size>window.KlasContactSync.MAX_VCARD_BYTES)throw new Error('VCF faýly 5 MB-dan uly bolmaly däl.');
    finishContactSync(window.KlasContactSync.parseVCard(await file.text()),'vcard');
  }catch(error){
    toast(error?.message||'VCF faýly okalmady.');
  }finally{
    $('#contactVcfInput').value='';
  }
}

function clearContactSync(){
  contactSyncSessionContacts=[];
  contactSyncInviteTargets=[];
  window.KlasContactSync?.removeSummary(contactSyncStorage());
  closeModal();
  renderContactSyncStatus();
  toast('Kontakt maglumatlary ýatdan aýryldy');
}
function openProfileEditor(){const u=state.currentUser;openModal({title:'Profili üýtget',confirmText:'Sakla',body:`<div class="form-grid"><div class="field"><label>Doly ady</label><input id="profileNameInput" value="${esc(u.name)}" maxlength="100"></div><div class="field"><label>Gysga ady</label><input id="profileShortInput" value="${esc(u.shortName||'')}" maxlength="30"></div><div class="form-grid two"><div class="field"><label>Şäher</label><input id="profileCityInput" value="${esc(u.city)}" maxlength="80"></div><div class="field"><label>Rol / iş</label><input id="profileRoleInput" value="${esc(u.role)}" maxlength="80"></div></div><div class="field"><label>Bio</label><textarea id="profileBioInput" maxlength="500">${esc(u.bio)}</textarea></div><div class="field"><label>Avatar URL-si</label><input id="profileAvatarInput" value="${esc(u.avatar)}" type="url"></div><div class="field"><label>Ýa-da avatar faýly</label><input id="profileAvatarFile" type="file" accept="image/*"><div class="field-help">Iň köp 1.5 MB.</div></div></div>`,onConfirm:async()=>{const name=$('#profileNameInput').value.trim();if(!name)throw new Error('Adyňyzy ýazyň.');const file=$('#profileAvatarFile').files[0];const avatar=file?await fileToDataUrl(file):normalizeLocalUrl($('#profileAvatarInput').value.trim()||u.avatar,{allowDataImage:true});state.currentUser={...u,name,shortName:$('#profileShortInput').value.trim()||name.split(' ')[0],city:$('#profileCityInput').value.trim(),role:$('#profileRoleInput').value.trim(),bio:$('#profileBioInput').value.trim(),avatar};state.posts.forEach(p=>{if(p.ownerId==='me'){p.author=name;p.role=state.currentUser.role;p.avatar=avatar}});save();updateUserUI();renderProfile();renderAllPosts();renderStories();closeModal();toast('Profil saklandy')}});}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`klas-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('Ätiýaç nusga taýýarlandy');}
async function importData(file){if(!file)return;try{const data=JSON.parse(await file.text());state=normalizeState(data);save();renderEverything();toast('Maglumatlar üstünlikli dikeldildi')}catch{toast('JSON faýly nädogry ýa-da zaýalanan')}}

function globalSearch(q){
  q=q.toLowerCase().trim();const box=$('#searchResults'),input=$('#searchInput');$('#searchClear').classList.toggle('hidden',!q);if(q.length<2){box.classList.add('hidden');box.innerHTML='';input.setAttribute('aria-expanded','false');return;}
  const groups=[];
  const people=state.people.filter(p=>`${p.name} ${p.city} ${p.job}`.toLowerCase().includes(q)).slice(0,5);
  const g=state.groups.filter(x=>`${x.name} ${x.description}`.toLowerCase().includes(q)).slice(0,5);
  const posts=state.posts.filter(p=>`${p.author} ${p.text}`.toLowerCase().includes(q)).slice(0,5);
  const events=state.events.filter(e=>`${e.title} ${e.location} ${e.description}`.toLowerCase().includes(q)).slice(0,5);
  if(people.length)groups.push(`<div class="search-group-title">Synpdaşlar</div>${people.map(p=>`<button class="search-result" data-search-person="${esc(p.id)}"><span class="presence-avatar"><img class="avatar" src="${esc(p.avatar)}" alt="">${p.online?'<i aria-hidden="true"></i>':''}</span><span><b>${esc(p.name)} ${p.online?'<span class="presence-badge"><i aria-hidden="true"></i>Onlaýn</span>':''}</b><small>${esc(p.city)} · ${esc(p.job)}</small></span></button>`).join('')}`);
  if(g.length)groups.push(`<div class="search-group-title">Gurnaklar</div>${g.map(x=>`<button class="search-result" data-search-page="groups"><span>🏫</span><span><b>${esc(x.name)}</b><small>${esc(x.description)}</small></span></button>`).join('')}`);
  if(posts.length)groups.push(`<div class="search-group-title">Postlar</div>${posts.map(p=>`<button class="search-result" data-search-post="${esc(p.id)}"><span>📝</span><span><b>${esc(p.author)}</b><small>${esc(p.text.slice(0,100))}</small></span></button>`).join('')}`);
  if(events.length)groups.push(`<div class="search-group-title">Çäreler</div>${events.map(e=>`<button class="search-result" data-search-page="events"><span>📅</span><span><b>${esc(e.title)}</b><small>${esc(e.date)} · ${esc(e.location)}</small></span></button>`).join('')}`);
  box.innerHTML=groups.join('')||'<div class="empty">Netije tapylmady.</div>';box.classList.remove('hidden');input.setAttribute('aria-expanded','true');
  $$('[data-search-person]',box).forEach(b=>b.onclick=()=>{startChatWithPerson(b.dataset.searchPerson);box.classList.add('hidden');input.setAttribute('aria-expanded','false')});
  $$('[data-search-page]',box).forEach(b=>b.onclick=()=>{showPage(b.dataset.searchPage);box.classList.add('hidden');input.setAttribute('aria-expanded','false')});
  $$('[data-search-post]',box).forEach(b=>b.onclick=()=>{showPage('feed');box.classList.add('hidden');input.setAttribute('aria-expanded','false');setTimeout(()=>$(`[data-post-card="${CSS.escape(b.dataset.searchPost)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),50)});
}
