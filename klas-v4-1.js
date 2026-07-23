'use strict';

const appRuntime = window.KlasRuntime;
const STORAGE_KEY = appRuntime?.STORAGE_KEY || 'klas-v4-state';
const APP_VERSION = 4;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowLabel = () => new Intl.DateTimeFormat('tk-TM', {hour:'2-digit', minute:'2-digit'}).format(new Date());
const avatarUrl = i => `https://i.pravatar.cc/160?img=${i}`;
const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const DATA_IMAGE_PREFIX = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i;

function normalizeLocalUrl(value, { allowEmpty = true, allowDataImage = false } = {}){
  const input = String(value || '').trim();
  if (!input && allowEmpty) return '';
  if (allowDataImage && DATA_IMAGE_PREFIX.test(input)) return input;
  let parsed;
  try { parsed = new URL(input); }
  catch { throw new Error('URL salgysy nädogry.'); }
  if (parsed.protocol !== 'https:') throw new Error('Diňe HTTPS salgysy kabul edilýär.');
  return parsed.href;
}

function safeLocalUrl(value, options){
  try { return normalizeLocalUrl(value, options); }
  catch { return ''; }
}

const defaultState = {
  version: APP_VERSION,
  dark: false,
  notify: true,
  privacy: 'school',
  activeChat: 'chat-aylar',
  mediaFilter: 'all',
  currentUser: {id:'me', name:'Maksat Dowletow', shortName:'Maksat', role:'Administrator', city:'Kerki', bio:'2000-nji ýyl uçurymy. Klas jemgyýetiniň administratory.', avatar:avatarUrl(12)},
  stories: [
    {id:'story-me', ownerId:'me', name:'Täze pursat', avatar:avatarUrl(12), text:'', media:'', viewed:false, own:true},
    {id:'story-aylar', name:'Aýlar', avatar:avatarUrl(47), media:'https://picsum.photos/seed/story-aylar/700/1000', text:'Köne mekdep suratlaryndan bir pursat.', viewed:false},
    {id:'story-serdar', name:'Serdar', avatar:avatarUrl(11), media:'https://picsum.photos/seed/story-serdar/700/1000', text:'Kerki şäherinden salam!', viewed:false},
    {id:'story-mahri', name:'Mähri', avatar:avatarUrl(44), media:'https://picsum.photos/seed/story-mahri/700/1000', text:'Synpdaşlar duşuşygyna taýýarlyk.', viewed:false}
  ],
  posts: [
    {id:'post-1', ownerId:'me', author:'Maksat Dowletow', role:'Administrator', avatar:avatarUrl(12), time:'12 minut öň', text:'Klas platformasynyň täze görnüşine hoş geldiňiz! Bu giňişlikde synpdaşlar bilen habarlaşyp, ýatlamalary paýlaşyp we duşuşyklary meýilleşdirip bilersiňiz.', image:'https://picsum.photos/seed/school2000/1000/600', video:'', likes:36, liked:false, saved:false, comments:[{id:'c1',author:'Aýlar Rejepowa',avatar:avatarUrl(47),text:'Täze görnüş örän gowy bolupdyr!',time:'8 minut öň'}]},
    {id:'post-2', ownerId:'aylar', author:'Aýlar Rejepowa', role:'2000-nji ýyl uçurymy', avatar:avatarUrl(47), time:'1 sagat öň', text:'Köne synp suratlaryny täze alboma goşdum. Hemmeleri bellik etmäge kömek ediň!', image:'https://picsum.photos/seed/classmemory/1000/600', video:'', likes:24, liked:true, saved:true, comments:[{id:'c2',author:'Serdar Ataýew',avatar:avatarUrl(11),text:'Suratlary gördüm, sag bol!',time:'45 minut öň'}]}
  ],
  people: [
    {id:'aylar',name:'Aýlar Rejepowa',city:'Aşgabat',job:'Mugallym',avatar:avatarUrl(47),status:'friend',online:true},
    {id:'serdar',name:'Serdar Ataýew',city:'Kerki',job:'Inžener',avatar:avatarUrl(11),status:'friend',online:true},
    {id:'mahri',name:'Mähri Orazowa',city:'Türkmenabat',job:'Lukman',avatar:avatarUrl(44),status:'none',online:false},
    {id:'dowlet',name:'Döwlet Myradow',city:'Aşgabat',job:'Telekeçi',avatar:avatarUrl(15),status:'pending',online:true},
    {id:'ogulabat',name:'Ogulabat Annaýewa',city:'Mary',job:'Mugallym',avatar:avatarUrl(32),status:'none',online:true}
  ],
  groups: [
    {id:'g-school',name:'Öde Abdullaýew mekdebi',members:428,icon:'🏫',description:'Mekdebiň umumy jemgyýeti',joined:true,owner:false},
    {id:'g-2000',name:'2000-nji ýyl uçurymlary',members:128,icon:'🎓',description:'Biziň synpdaşlar jemgyýetimiz',joined:true,owner:true},
    {id:'g-football',name:'Futbol gurnagy',members:74,icon:'⚽',description:'Sport we futbol söýüjiler',joined:false,owner:false},
    {id:'g-books',name:'Edebiýat söýüjiler',members:52,icon:'📚',description:'Kitaplar we döredijilik',joined:false,owner:false}
  ],
  chats: [
    {id:'chat-aylar',personId:'aylar',name:'Aýlar Rejepowa',avatar:avatarUrl(47),preview:'Suratlary gördüňmi?',unread:0,messages:[{id:'m1',from:'them',text:'Salam! Täze albomy gördüňmi?',time:'18:05'},{id:'m2',from:'me',text:'Hawa, örän gowy suratlar eken.',time:'18:07'}]},
    {id:'chat-group',personId:null,name:'2000 uçurymlar',avatar:avatarUrl(11),preview:'Duşuşygy tassyklaýarys',unread:2,messages:[{id:'m3',from:'them',text:'15-nji awgust üçin duşuşygy tassyklaýarys.',time:'17:42'},{id:'m4',from:'me',text:'Men gatnaşaryn.',time:'17:45'}]},
    {id:'chat-serdar',personId:'serdar',name:'Serdar Ataýew',avatar:avatarUrl(15),preview:'Soňky habar',unread:1,messages:[{id:'m5',from:'them',text:'Soňky täzelikleri gördüňmi?',time:'16:14'}]}
  ],
  notifications: [
    {id:'n1',icon:'💬',text:'Aýlar size täze habar iberdi',time:'5 minut öň',read:false,page:'messages'},
    {id:'n2',icon:'👥',text:'Serdar synpdaşlyk haýyşyňyzy kabul etdi',time:'24 minut öň',read:false,page:'classmates'},
    {id:'n3',icon:'📅',text:'Duşuşyk senesi täzelendi',time:'1 sagat öň',read:false,page:'events'}
  ],
  media: [
    {id:'media-1',type:'image',src:'https://picsum.photos/seed/klas1/900/900',title:'Mekdep ýatlamasy',ownerId:'aylar'},
    {id:'media-2',type:'image',src:'https://picsum.photos/seed/klas2/900/900',title:'Synp suraty',ownerId:'serdar'},
    {id:'media-3',type:'image',src:'https://picsum.photos/seed/klas3/900/900',title:'Duşuşyk',ownerId:'me'},
    {id:'media-4',type:'image',src:'https://picsum.photos/seed/klas4/900/900',title:'Mekdep',ownerId:'aylar'},
    {id:'media-5',type:'image',src:'https://picsum.photos/seed/klas5/900/900',title:'Uçurymlar',ownerId:'me'},
    {id:'media-6',type:'image',src:'https://picsum.photos/seed/klas6/900/900',title:'Ýatlama',ownerId:'serdar'}
  ],
  events: [
    {id:'e1',title:'2000-nji ýyl uçurymlarynyň duşuşygy',date:'2026-08-15',time:'18:00',location:'Kerki · Öde Abdullaýew adyndaky mekdep',description:'Uçurymlaryň ýyllyk duşuşygy.',attending:false,ownerId:'me'}
  ]
};

function normalizeState(raw){
  const s = {...clone(defaultState), ...(raw || {})};
  s.currentUser = {...clone(defaultState.currentUser), ...(raw?.currentUser || {})};
  for(const key of ['stories','posts','people','groups','chats','notifications','media','events']) if(!Array.isArray(s[key])) s[key] = clone(defaultState[key]);
  s.currentUser.avatar = safeLocalUrl(s.currentUser.avatar, { allowDataImage: true }) || clone(defaultState.currentUser.avatar);
  s.stories = s.stories.map(item => ({
    ...item,
    avatar: safeLocalUrl(item.avatar, { allowDataImage: true }),
    media: safeLocalUrl(item.media, { allowDataImage: true })
  }));
  s.posts = s.posts.map(p => ({
    image:'', video:'', comments:[], liked:false, saved:false, likes:0, ...p,
    avatar: safeLocalUrl(p.avatar, { allowDataImage: true }),
    image: safeLocalUrl(p.image, { allowDataImage: true }),
    video: safeLocalUrl(p.video),
    comments: (Array.isArray(p.comments) ? p.comments : []).map(comment => ({
      ...comment,
      avatar: safeLocalUrl(comment.avatar, { allowDataImage: true })
    }))
  }));
  s.people = s.people.map(person => ({ ...person, avatar: safeLocalUrl(person.avatar, { allowDataImage: true }) }));
  s.chats = s.chats.map(c => ({
    unread:0, messages:[], ...c,
    avatar: safeLocalUrl(c.avatar, { allowDataImage: true }),
    messages:Array.isArray(c.messages)?c.messages:[]
  }));
  s.media = s.media.map(item => {
    const type = item.type === 'video' ? 'video' : 'image';
    return { ...item, type, src: safeLocalUrl(item.src, { allowDataImage: type === 'image' }) };
  }).filter(item => item.src);
  s.version = APP_VERSION;
  return s;
}

function readLocalState(){
  if(appRuntime?.stateStore) return appRuntime.stateStore.read(null);
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch(error){ appRuntime?.reportError(error, 'state:read'); return null; }
}

let state = normalizeState(readLocalState());

function save(){
  let saved = false;
  if(appRuntime?.stateStore) saved = appRuntime.stateStore.write(state);
  else {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); saved = true; }
    catch(error){ appRuntime?.reportError(error, 'state:save'); }
  }
  if(!saved){
    appRuntime?.updateRuntimeUI();
    toast('Maglumat saklanmady. Brauzeriň saklanyş rugsadyny barlaň.');
  }
  updateBadges();
  appRuntime?.emit(appRuntime.EVENTS.stateChange, { collections:['local'], cloudMode:false });
  return saved;
}
function toast(text){ const el=$('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.classList.remove('show'),2300); }
function addNotification(text, icon='🔔', page='feed'){
  if(!state.notify) return;
  state.notifications.unshift({id:uid(),icon,text,time:'häzir',read:false,page});
}
function formatEventDate(value){ const d=new Date(`${value}T12:00:00`); return {month:new Intl.DateTimeFormat('tk-TM',{month:'short'}).format(d).toUpperCase(),day:String(d.getDate()).padStart(2,'0')}; }
function isDirectVideo(url=''){ return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url); }
function fileToDataUrl(file, maxBytes=1500000){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve('');
    if(file.size>maxBytes) return reject(new Error('Faýl 1.5 MB-dan uly bolmaly däl.'));
    const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=()=>reject(new Error('Faýl okalmady.')); r.readAsDataURL(file);
  });
}

const PAGE_NAMES = new Set(appRuntime?.PAGES || ['feed','classmates','messages','groups','media','events','saved','notifications','settings']);
let pageRenderFrame = 0;

function activePageName(){
  const element = $('.page.active');
  return element?.id?.replace(/^page-/, '') || 'feed';
}

function renderPage(name = activePageName()){
  const page = PAGE_NAMES.has(name) ? name : 'feed';
  const call = functionName => {
    const fn = window[functionName];
    if(typeof fn === 'function') fn();
  };
  const renderers = {
    feed: ['renderStories','renderAllPosts'],
    classmates: ['renderPeople'],
    messages: ['renderChats','renderMessages'],
    groups: ['renderGroups'],
    media: ['renderMedia'],
    events: ['renderEvents','renderNextEvent'],
    saved: ['renderSaved'],
    notifications: ['renderNotifications'],
    settings: ['renderProfile']
  };
  (renderers[page] || []).forEach(call);
  ['updateBadges','renderSuggestions','renderOnline','renderNextEvent'].forEach(call);
}

function schedulePageRender(name = activePageName()){
  cancelAnimationFrame(pageRenderFrame);
  pageRenderFrame = requestAnimationFrame(() => {
    pageRenderFrame = 0;
    renderPage(name);
  });
}

function setMobileChatOpen(open){
  const shell = $('#page-messages .chat-shell');
  if(!shell) return;
  shell.classList.toggle('mobile-chat-open', Boolean(open));
  if(!open) requestAnimationFrame(() => $(`[data-chat="${CSS.escape(state.activeChat || '')}"]`)?.focus());
}

function closeMobileSearch(){
  const topbar = $('.topbar');
  const button = $('#mobileSearchBtn');
  if(!topbar || !button) return;
  topbar.classList.remove('search-open');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Gözlegi aç');
}

function toggleMobileSearch(force){
  const topbar = $('.topbar');
  const button = $('#mobileSearchBtn');
  if(!topbar || !button) return;
  const open = typeof force === 'boolean' ? force : !topbar.classList.contains('search-open');
  topbar.classList.toggle('search-open', open);
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? 'Gözlegi ýap' : 'Gözlegi aç');
  if(open){
    $('#sidebar').classList.remove('open');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    requestAnimationFrame(() => $('#searchInput').focus());
  }
}

function showPage(requestedName, updateHash=true){
  const normalizedName = appRuntime?.normalizePage(requestedName) || requestedName;
  const name = PAGE_NAMES.has(normalizedName) && $(`#page-${normalizedName}`) ? normalizedName : 'feed';
  $$('.page').forEach(el=>el.classList.remove('active'));
  $(`#page-${name}`)?.classList.add('active');
  $$('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===name));
  $('#sidebar').classList.remove('open');
  $('#menuBtn').setAttribute('aria-expanded','false');
  setMobileChatOpen(false);
  closeMobileSearch();
  $('#searchResults').classList.add('hidden');
  $('#searchInput').setAttribute('aria-expanded','false');
  if(updateHash && location.hash !== `#${name}`){
    history.pushState({page:name},'',`${location.pathname}${location.search}#${name}`);
  }
  schedulePageRender(name);
  if(appRuntime) appRuntime.emit(appRuntime.EVENTS.pageChange, { page:name });
  else window.dispatchEvent(new CustomEvent('klas:pagechange',{detail:{page:name}}));
  window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function routeFromHash(){ showPage(appRuntime?.pageFromHash(location.hash) || (location.hash||'#feed').slice(1),false); }

let modalReturnFocus = null;
let lightboxReturnFocus = null;
function updateOverlayState(){
  document.body.classList.toggle('overlay-open', $('#appModal').classList.contains('open') || $('#lightbox').classList.contains('open'));
}
function openModal({title,body,confirmText='Sakla',cancelText='Ýatyr',onConfirm,hideConfirm=false}){
  modalReturnFocus = document.activeElement;
  $('#modalTitle').textContent=title;
  $('#modalBody').innerHTML=body;
  $('#modalFooter').innerHTML=`<button class="secondary" type="button" data-modal-cancel>${esc(cancelText)}</button>${hideConfirm?'':`<button class="primary" type="button" data-modal-confirm>${esc(confirmText)}</button>`}`;
  $('#appModal').classList.add('open'); $('#appModal').setAttribute('aria-hidden','false');
  updateOverlayState();
  $('[data-modal-cancel]').onclick=closeModal;
  const confirm=$('[data-modal-confirm]');
  if(confirm) confirm.onclick=appRuntime?.guard('modal:confirm', async()=>onConfirm?.(confirm)) || (async()=>{ try{ await onConfirm?.(confirm); }catch(e){ toast(e.message||'Ýalňyşlyk ýüze çykdy'); } });
  setTimeout(() => ($('#modalBody input, #modalBody textarea, #modalBody select, [data-modal-confirm]') || $('.modal-card'))?.focus(), 50);
}
function closeModal(){
  const modal = $('#appModal');
  if(!modal.classList.contains('open')) return;
  modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
  updateOverlayState();
  modalReturnFocus?.focus?.();
  modalReturnFocus = null;
}
function openLightbox(html){
  lightboxReturnFocus = document.activeElement;
  $('#lightboxContent').innerHTML=html;
  $('#lightbox').classList.add('open');
  $('#lightbox').setAttribute('aria-hidden','false');
  updateOverlayState();
  setTimeout(() => $('.lightbox-dialog')?.focus(), 0);
}
function closeLightbox(){
  const lightbox = $('#lightbox');
  if(!lightbox.classList.contains('open')) return;
  lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden','true');
  $('#lightboxContent').innerHTML='';
  updateOverlayState();
  lightboxReturnFocus?.focus?.();
  lightboxReturnFocus = null;
}
