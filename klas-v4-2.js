function updateUserUI(){
  $('#headerAvatar').src=state.currentUser.avatar; $('#headerName').textContent=state.currentUser.shortName||state.currentUser.name.split(' ')[0];
  $$('.current-user-avatar').forEach(i=>i.src=state.currentUser.avatar);
}
function updateBadges(){
  const unreadNotices=state.notifications.filter(n=>!n.read).length;
  const unreadChats=state.chats.reduce((sum,c)=>sum+(Number(c.unread)||0),0);
  for(const [id,count] of [['#noticeBadge',unreadNotices],['#messageBadge',unreadChats]]){ const el=$(id); el.textContent=count; el.classList.toggle('hidden',!count); }
  $('#chatUnreadCount').textContent=unreadChats;
  $('#peopleCount').textContent=state.people.length;
}
function applyTheme(){
  document.body.classList.toggle('dark',state.dark);
  $('#themeBtn').textContent=state.dark?'☀️':'🌙';
  $('#themeBtn').setAttribute('aria-label', state.dark ? 'Ýagty temany aç' : 'Garaňky temany aç');
  $('#darkSwitch').classList.toggle('on',state.dark);
  $('#darkSwitch').setAttribute('aria-checked', String(state.dark));
  $('#themeColor')?.setAttribute('content', state.dark ? '#0b1320' : '#2563eb');
}

function renderStories(){
  const items=[{id:'add',own:true,name:'Täze pursat',avatar:state.currentUser.avatar},...state.stories.filter(s=>s.id!=='story-me')];
  $('#stories').innerHTML=items.map(s=>s.id==='add'?`<button class="story" data-story-add><div class="story-add">＋</div><span>Täze pursat</span></button>`:`<button class="story" data-story="${esc(s.id)}"><div class="story-ring ${s.viewed?'viewed':''}"><img src="${esc(s.avatar)}" alt="${esc(s.name)}"></div><span>${esc(s.name)}</span></button>`).join('');
  $('[data-story-add]').onclick=openStoryComposer;
  $$('[data-story]').forEach(btn=>btn.onclick=()=>viewStory(btn.dataset.story));
}
function openStoryComposer(){
  openModal({title:'Täze pursat goş',confirmText:'Paýlaş',body:`<div class="form-grid"><div class="field"><label>Gysga ýazgy</label><textarea id="storyText" placeholder="Pursatyňyzy beýan ediň..."></textarea></div><div class="field"><label>Surat</label><input id="storyFile" type="file" accept="image/*"><div class="field-help">Ýerli saklanyş üçin iň köp 1.5 MB.</div></div><div class="field"><label>Ýa-da surat URL-si</label><input id="storyUrl" type="url" placeholder="https://..."></div></div>`,onConfirm:async()=>{
    const file=$('#storyFile').files[0]; const url=$('#storyUrl').value.trim(); const media=file?await fileToDataUrl(file):normalizeLocalUrl(url);
    if(!media) throw new Error('Surat saýlaň ýa-da URL giriziň.');
    state.stories.unshift({id:uid(),ownerId:'me',name:state.currentUser.shortName||'Men',avatar:state.currentUser.avatar,text:$('#storyText').value.trim(),media,viewed:false,own:true});
    save(); renderStories(); closeModal(); toast('Pursat paýlaşyldy');
  }});
}
function viewStory(id){ const story=state.stories.find(s=>s.id===id); if(!story)return; story.viewed=true; save(); renderStories(); openLightbox(`<div class="story-view"><img src="${esc(story.media)}" alt="${esc(story.name)}"><h2>${esc(story.name)}</h2><p>${esc(story.text||'')}</p>${story.own?`<button class="danger" data-delete-story="${esc(story.id)}">Pursaty aýyr</button>`:''}</div>`); $('[data-delete-story]')?.addEventListener('click',()=>{if(confirm('Bu pursaty aýyrmalymy?')){state.stories=state.stories.filter(s=>s.id!==id);save();renderStories();closeLightbox();toast('Pursat aýryldy')}}); }

function mediaMarkup(p){
  const image = safeLocalUrl(p.image, { allowDataImage: true });
  const video = safeLocalUrl(p.video);
  if(image) return `<img class="post-image" src="${esc(image)}" alt="Post suraty" loading="lazy">`;
  if(video){ return isDirectVideo(video)?`<video class="post-video" controls preload="metadata" src="${esc(video)}"></video>`:`<a class="post-video-link" target="_blank" rel="noopener noreferrer" href="${esc(video)}">🎥 Wideony aç</a>`; }
  return '';
}
function postHTML(p){
  const comments=p.comments||[];
  return `<article class="card post" data-post-card="${esc(p.id)}"><div class="post-head"><img class="avatar" src="${esc(p.avatar)}" alt="${esc(p.author)}"><div class="post-meta"><b>${esc(p.author)}</b><small>${esc(p.role)} · ${esc(p.time)}</small></div><button class="post-menu" data-post-menu="${esc(p.id)}" title="Post amallary">⋯</button><div class="post-dropdown hidden" data-post-dropdown><button data-save="${esc(p.id)}">${p.saved?'🔖 Saklananlardan aýyr':'🔖 Sakla'}</button>${p.ownerId==='me'?`<button data-delete-post="${esc(p.id)}">🗑️ Posty aýyr</button>`:''}</div></div><div class="post-text">${esc(p.text)}</div>${mediaMarkup(p)}<div class="post-stats"><span>👍 ${Number(p.likes)||0}</span><button class="link-btn" data-comment-toggle="${esc(p.id)}">${comments.length} teswir</button></div><div class="post-actions"><button data-like="${esc(p.id)}" class="${p.liked?'on':''}">👍 Hala</button><button data-comment-toggle="${esc(p.id)}">💬 Teswir</button><button data-share="${esc(p.id)}">↗ Paýlaş</button></div><div class="comments-panel hidden" data-comments-panel><div class="comments-list">${comments.map(c=>`<div class="comment"><img class="avatar" src="${esc(c.avatar||state.currentUser.avatar)}" alt=""><div class="comment-body"><b>${esc(c.author)}</b><div>${esc(c.text)}</div><small>${esc(c.time||'häzir')}</small></div></div>`).join('')||'<div class="empty">Heniz teswir ýok.</div>'}</div><form class="comment-form" data-comment-form="${esc(p.id)}"><input placeholder="Teswir ýazyň..." maxlength="500"><button>Ugrat</button></form></div></article>`;
}
function bindPosts(root=document){
  $$('[data-post-menu]',root).forEach(b=>b.onclick=e=>{e.stopPropagation();const menu=b.closest('[data-post-card]')?.querySelector('[data-post-dropdown]');$$('.post-dropdown').forEach(x=>x.classList.add('hidden'));menu?.classList.toggle('hidden')});
  $$('[data-like]',root).forEach(b=>b.onclick=()=>{const p=state.posts.find(x=>x.id===b.dataset.like);if(!p)return;p.liked=!p.liked;p.likes=Math.max(0,(Number(p.likes)||0)+(p.liked?1:-1));save();renderAllPosts()});
  $$('[data-save]',root).forEach(b=>b.onclick=()=>{const p=state.posts.find(x=>x.id===b.dataset.save);if(!p)return;p.saved=!p.saved;save();renderAllPosts();toast(p.saved?'Post saklandy':'Saklananlardan aýryldy')});
  $$('[data-delete-post]',root).forEach(b=>b.onclick=()=>{if(!confirm('Posty hemişelik aýyrmalymy?'))return;state.posts=state.posts.filter(p=>p.id!==b.dataset.deletePost);save();renderAllPosts();toast('Post aýryldy')});
  $$('[data-comment-toggle]',root).forEach(b=>b.onclick=()=>{b.closest('[data-post-card]')?.querySelector('[data-comments-panel]')?.classList.toggle('hidden')});
  $$('[data-comment-form]',root).forEach(form=>form.onsubmit=e=>{e.preventDefault();const input=$('input',form),text=input.value.trim();if(!text)return;const p=state.posts.find(x=>x.id===form.dataset.commentForm),rootId=root.id; p.comments.push({id:uid(),author:state.currentUser.name,avatar:state.currentUser.avatar,text,time:'häzir'});input.value='';addNotification(`${state.currentUser.shortName} täze teswir goşdy`,'💬','feed');save();renderAllPosts();setTimeout(()=>{const target=$(`[data-post-card="${CSS.escape(p.id)}"]`,$(`#${CSS.escape(rootId)}`));target?.querySelector('[data-comments-panel]')?.classList.remove('hidden')},0);toast('Teswir goşuldy')});
  $$('[data-share]',root).forEach(b=>b.onclick=async()=>{const p=state.posts.find(x=>x.id===b.dataset.share);const data={title:`${p.author} — Klas`,text:p.text,url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(`${p.author}: ${p.text}\n${location.href}`);toast('Post baglanyşygy nusgalandy')}}catch(e){if(e.name!=='AbortError')toast('Paýlaşmak başartmady')}});
}
function renderFeed(){ $('#feed').innerHTML=state.posts.map(postHTML).join('')||'<div class="empty">Heniz post ýok.</div>'; bindPosts($('#feed')); }
function renderSaved(){ const list=state.posts.filter(p=>p.saved); $('#saved').innerHTML=list.map(postHTML).join('')||'<div class="empty">Heniz saklanan post ýok.</div>'; bindPosts($('#saved')); }
function renderAllPosts(){renderFeed();renderSaved();}
function openComposer(mode='text'){
  const label=mode==='video'?'Wideo URL-si':mode==='image'?'Surat':'Goşundy';
  openModal({title:'Täze post',confirmText:'Çap et',body:`<div class="form-grid"><div class="field"><label>Post teksti</label><textarea id="postText" maxlength="3000" placeholder="Pikiriňizi, habaryňyzy ýa-da ýatlamaňyzy ýazyň..."></textarea></div>${mode==='image'?`<div class="field"><label>${label}</label><input id="postFile" type="file" accept="image/*"><div class="field-help">Iň köp 1.5 MB; brauzeriňizde ýerli saklanar.</div></div><div class="field"><label>Ýa-da surat URL-si</label><input id="postMediaUrl" type="url" placeholder="https://..."></div>`:mode==='video'?`<div class="field"><label>${label}</label><input id="postMediaUrl" type="url" placeholder="https://.../video.mp4 ýa-da wideo sahypasy"><div class="field-help">Göni MP4/WebM salgysy player-de açylar, beýleki baglanyşyklar täze sahypada açylar.</div></div>`:''}</div>`,onConfirm:async()=>{
    const text=$('#postText').value.trim(); let image='',video='';
    if(mode==='image'){const file=$('#postFile').files[0];image=file?await fileToDataUrl(file):normalizeLocalUrl($('#postMediaUrl').value.trim());}
    if(mode==='video') video=normalizeLocalUrl($('#postMediaUrl').value.trim());
    if(!text && !image && !video) throw new Error('Post üçin tekst ýa-da media goşuň.');
    state.posts.unshift({id:uid(),ownerId:'me',author:state.currentUser.name,role:state.currentUser.role,avatar:state.currentUser.avatar,time:'häzir',text,image,video,likes:0,liked:false,saved:false,comments:[]});
    if(image) state.media.unshift({id:uid(),type:'image',src:image,title:text.slice(0,40)||'Täze surat',ownerId:'me'});
    if(video) state.media.unshift({id:uid(),type:'video',src:video,title:text.slice(0,40)||'Täze wideo',ownerId:'me'});
    save();renderAllPosts();renderMedia();closeModal();showPage('feed');toast('Post çap edildi');
  }});
}

function personButtonText(status){return status==='friend'?'Dost ✓':status==='pending'?'Garaşylýar':'Goş';}
function renderPeople(){
  const q=$('#peopleFilter')?.value.toLowerCase().trim()||''; const status=$('#peopleStatus')?.value||'all';
  const list=state.people.filter(p=>(status==='all'||p.status===status)&&(!q||`${p.name} ${p.city} ${p.job}`.toLowerCase().includes(q)));
  $('#people').innerHTML=list.map(p=>`<div class="person"><img class="avatar" src="${esc(p.avatar)}" alt="${esc(p.name)}"><div class="person-info"><b>${esc(p.name)} ${p.online?'🟢':''}</b><small>${esc(p.city)} · ${esc(p.job)}</small></div><div class="person-actions"><button class="mini" data-message-person="${esc(p.id)}" aria-label="${esc(p.name)} bilen habarlaş">💬</button><button class="mini" data-friend="${esc(p.id)}" aria-label="${esc(p.name)}: dostluk ýagdaýy">${personButtonText(p.status)}</button></div></div>`).join('')||'<div class="empty">Netije tapylmady.</div>';
  $$('[data-friend]').forEach(b=>b.onclick=()=>toggleFriend(b.dataset.friend)); $$('[data-message-person]').forEach(b=>b.onclick=()=>startChatWithPerson(b.dataset.messagePerson));
}
function toggleFriend(id){const p=state.people.find(x=>x.id===id);if(!p)return;if(p.status==='none'){p.status='pending';toast('Synpdaşlyk haýyşy ugradyldy')}else if(p.status==='pending'){p.status='none';toast('Haýyş ýatyryldy')}else{if(confirm(`${p.name} dostlaryňyzdan aýrylsynmy?`)){p.status='none';toast('Dostlardan aýryldy')}else return;}save();renderPeople();renderSuggestions();}
function startChatWithPerson(id){const p=state.people.find(x=>x.id===id);if(!p)return;let chat=state.chats.find(c=>c.personId===id);if(!chat){chat={id:uid(),personId:id,name:p.name,avatar:p.avatar,preview:'Täze çat',unread:0,messages:[]};state.chats.unshift(chat);}state.activeChat=chat.id;chat.unread=0;save();renderChats();renderMessages();showPage('messages');setMobileChatOpen(true);}
function renderSuggestions(){const list=state.people.filter(p=>p.status!=='friend').slice(0,3);$('#suggestions').innerHTML=list.map(p=>`<div class="suggestion"><img class="avatar" src="${esc(p.avatar)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.city)}</small></div><button class="mini" data-suggest-friend="${esc(p.id)}" aria-label="${esc(p.name)} bilen dostlaş">${p.status==='pending'?'…':'＋'}</button></div>`).join('')||'<div class="empty">Täze teklip ýok.</div>';$$('[data-suggest-friend]').forEach(b=>b.onclick=()=>toggleFriend(b.dataset.suggestFriend));}
function renderOnline(){const list=state.people.filter(p=>p.online);$('#onlineCount').textContent=`● ${list.length}`;$('#onlinePeople').innerHTML=list.map(p=>`<button data-online-chat="${esc(p.id)}" title="${esc(p.name)}"><img src="${esc(p.avatar)}" alt="${esc(p.name)}"></button>`).join('');$$('[data-online-chat]').forEach(b=>b.onclick=()=>startChatWithPerson(b.dataset.onlineChat));}
