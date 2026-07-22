(function createKlasBridge(){
  'use strict';
  const deepClone = value => JSON.parse(JSON.stringify(value));
  const render = () => {
    if (typeof renderEverything === 'function') renderEverything();
    else {
      if (typeof renderAllPosts === 'function') renderAllPosts();
      if (typeof renderPeople === 'function') renderPeople();
      if (typeof renderChats === 'function') renderChats();
      if (typeof renderNotifications === 'function') renderNotifications();
    }
  };
  const preserveLocal = items => items.filter(item => !item?.remote);
  window.KlasBridge = Object.freeze({
    getState: () => deepClone(state),
    getCurrentUser: () => deepClone(state.currentUser),
    getPost: id => deepClone(state.posts.find(item => item.id === id) || null),
    getPerson: id => deepClone(state.people.find(item => item.id === id) || null),
    getChat: id => deepClone(state.chats.find(item => item.id === id) || null),
    getActiveChat: () => deepClone(state.chats.find(item => item.id === state.activeChat) || null),
    setActiveChat(id){ state.activeChat = id; save(); if(typeof renderChats==='function') renderChats(); if(typeof renderMessages==='function') renderMessages(); },
    setCurrentUser(profile){
      const old = state.currentUser;
      const fullName = profile.fullName || profile.displayName || old.name;
      state.currentUser = {
        ...old,
        id: profile.uid || old.id,
        uid: profile.uid || old.uid,
        name: fullName,
        shortName: profile.shortName || fullName.split(' ')[0],
        role: profile.profession || profile.role || old.role || 'Ulanyjy',
        city: profile.city || old.city || '',
        bio: profile.bio || old.bio || '',
        avatar: profile.avatarURL || profile.photoURL || old.avatar,
        remote: true
      };
      state.posts.forEach(post => {
        if(post.ownerId === 'me' || post.ownerId === state.currentUser.uid){
          post.author = state.currentUser.name;
          post.role = state.currentUser.role;
          post.avatar = state.currentUser.avatar;
        }
      });
      save(); render();
    },
    mergeRemotePosts(remotePosts){ state.posts = [...remotePosts, ...preserveLocal(state.posts)]; save(); if(typeof renderAllPosts==='function') renderAllPosts(); },
    patchPost(id, patch){ const post=state.posts.find(item=>item.id===id); if(post){Object.assign(post,patch);save();if(typeof renderAllPosts==='function')renderAllPosts();} },
    mergeRemotePeople(remotePeople){ const local=preserveLocal(state.people),ids=new Set(local.map(item=>item.id));state.people=[...remotePeople.filter(item=>!ids.has(item.id)),...local];save();if(typeof renderPeople==='function')renderPeople();if(typeof renderSuggestions==='function')renderSuggestions();if(typeof renderOnline==='function')renderOnline(); },
    patchPerson(id, patch){ const person=state.people.find(item=>item.id===id);if(person){Object.assign(person,patch);save();render();} },
    mergeRemoteChats(remoteChats){ const local=preserveLocal(state.chats),active=state.activeChat;state.chats=[...remoteChats,...local];if(!state.chats.some(item=>item.id===active))state.activeChat=state.chats[0]?.id||'';save();if(typeof renderChats==='function')renderChats();if(typeof renderMessages==='function')renderMessages(); },
    mergeRemoteNotifications(remoteNotifications){ state.notifications=[...remoteNotifications,...preserveLocal(state.notifications)];save();if(typeof renderNotifications==='function')renderNotifications(); },
    mergeRemoteGroups(remoteGroups){ state.groups=[...remoteGroups,...preserveLocal(state.groups)];save();if(typeof renderGroups==='function')renderGroups(); },
    mergeRemoteEvents(remoteEvents){ state.events=[...remoteEvents,...preserveLocal(state.events)];save();if(typeof renderEvents==='function')renderEvents();if(typeof renderNextEvent==='function')renderNextEvent(); },
    mergeRemoteMedia(remoteMedia){ state.media=[...remoteMedia,...preserveLocal(state.media)];save();if(typeof renderMedia==='function')renderMedia(); },
    mergeRemoteStories(remoteStories){ state.stories=[...remoteStories,...state.stories.filter(item=>!item.remote&&item.id!=='story-me')];save();if(typeof renderStories==='function')renderStories(); },
    notify(text, icon='🔔', page='feed'){ addNotification(text,icon,page);save();if(typeof renderNotifications==='function')renderNotifications(); },
    toast: text => toast(text),
    openModal: options => openModal(options),
    closeModal: () => closeModal(),
    render,
    localFileToDataUrl: file => fileToDataUrl(file)
  });
})();
