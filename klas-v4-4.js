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
}

$$('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$('#menuBtn').onclick=()=>{const open=$('#sidebar').classList.toggle('open');$('#menuBtn').setAttribute('aria-expanded',String(open))};
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
  if(!e.target.closest('.post-menu,.post-dropdown'))$$('.post-dropdown').forEach(x=>x.classList.add('hidden'));
  if(!e.target.closest('.search-wrap')){$('#searchResults').classList.add('hidden');$('#searchInput').setAttribute('aria-expanded','false')}
  if($('#sidebar').classList.contains('open')&&!e.target.closest('#sidebar,#menuBtn')){$('#sidebar').classList.remove('open');$('#menuBtn').setAttribute('aria-expanded','false')}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeLightbox();$('#searchResults').classList.add('hidden');$('#searchInput').setAttribute('aria-expanded','false');$('#sidebar').classList.remove('open');$('#menuBtn').setAttribute('aria-expanded','false')}
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
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#searchInput').focus()}
});

renderEverything();
routeFromHash();
