(function createKlasBridge(){
  'use strict';

  const COLLECTION_KEYS = ['stories','posts','people','groups','chats','notifications','media','events'];
  const deepClone = value => JSON.parse(JSON.stringify(value));
  const localOnly = items => (Array.isArray(items) ? items.filter(item => !item?.remote) : []);
  let cloudMode = false;
  let localSnapshot = null;

  const render = () => {
    if (typeof renderEverything === 'function') renderEverything();
    else {
      if (typeof renderAllPosts === 'function') renderAllPosts();
      if (typeof renderPeople === 'function') renderPeople();
      if (typeof renderChats === 'function') renderChats();
      if (typeof renderNotifications === 'function') renderNotifications();
    }
  };

  function snapshotLocalState(){
    const fallbackUser = typeof defaultState !== 'undefined' ? defaultState.currentUser : state.currentUser;
    const currentUser = state.currentUser?.remote ? fallbackUser : state.currentUser;
    return {
      currentUser: deepClone(currentUser),
      activeChat: state.activeChat,
      collections: Object.fromEntries(COLLECTION_KEYS.map(key => [key, deepClone(localOnly(state[key]))]))
    };
  }

  function setCollection(name, remoteItems){
    const remote = Array.isArray(remoteItems) ? remoteItems : [];
    state[name] = cloudMode ? [...remote] : [...remote, ...localOnly(state[name])];
  }

  function renderPeopleRelated(){
    if (typeof renderPeople === 'function') renderPeople();
    if (typeof renderSuggestions === 'function') renderSuggestions();
    if (typeof renderOnline === 'function') renderOnline();
    if (typeof updateBadges === 'function') updateBadges();
  }

  window.KlasBridge = Object.freeze({
    isCloudMode: () => cloudMode,
    getState: () => deepClone(state),
    getCurrentUser: () => deepClone(state.currentUser),
    getPost: id => deepClone(state.posts.find(item => item.id === id) || null),
    getPerson: id => deepClone(state.people.find(item => item.id === id) || null),
    getChat: id => deepClone(state.chats.find(item => item.id === id) || null),
    getActiveChat: () => deepClone(state.chats.find(item => item.id === state.activeChat) || null),

    setCloudMode(enabled){
      const next = Boolean(enabled);
      if (next === cloudMode) return;
      if (next) {
        localSnapshot = snapshotLocalState();
        cloudMode = true;
        COLLECTION_KEYS.forEach(key => { state[key] = []; });
        state.activeChat = '';
      } else {
        cloudMode = false;
        if (localSnapshot) {
          state.currentUser = deepClone(localSnapshot.currentUser);
          COLLECTION_KEYS.forEach(key => { state[key] = deepClone(localSnapshot.collections[key] || []); });
          state.activeChat = localSnapshot.activeChat || state.chats[0]?.id || '';
          localSnapshot = null;
          if (typeof save === 'function') save();
        } else {
          COLLECTION_KEYS.forEach(key => { state[key] = localOnly(state[key]); });
        }
      }
      render();
    },

    setActiveChat(id){
      state.activeChat = id;
      if (!cloudMode && typeof save === 'function') save();
      if (typeof renderChats === 'function') renderChats();
      if (typeof renderMessages === 'function') renderMessages();
    },

    setCurrentUser(profile){
      const old = state.currentUser;
      const fullName = profile.fullName || profile.displayName || old.name;
      const accountRole = profile.role || 'user';
      const displayRole = accountRole === 'admin'
        ? 'Administrator'
        : accountRole === 'moderator'
          ? 'Moderator'
          : profile.profession || 'Klas agzasy';
      state.currentUser = {
        ...old,
        id: profile.uid || old.id,
        uid: profile.uid || old.uid,
        name: fullName,
        shortName: profile.shortName || fullName.split(' ')[0],
        role: displayRole,
        accountRole,
        city: profile.city || '',
        bio: profile.bio || '',
        avatar: profile.avatarURL || profile.photoURL || old.avatar,
        remote: true
      };
      state.posts.forEach(post => {
        if (post.ownerId === state.currentUser.uid) {
          post.author = state.currentUser.name;
          post.role = state.currentUser.role;
          post.avatar = state.currentUser.avatar;
        }
      });
      if (!cloudMode && typeof save === 'function') save();
      render();
    },

    mergeRemotePosts(remotePosts){
      setCollection('posts', remotePosts);
      if (typeof renderAllPosts === 'function') renderAllPosts();
    },
    patchPost(id, patch){
      const post = state.posts.find(item => item.id === id);
      if (post) {
        Object.assign(post, patch);
        if (!post.remote && !cloudMode && typeof save === 'function') save();
        if (typeof renderAllPosts === 'function') renderAllPosts();
      }
    },
    mergeRemotePeople(remotePeople){
      setCollection('people', remotePeople);
      renderPeopleRelated();
    },
    patchPerson(id, patch){
      const person = state.people.find(item => item.id === id);
      if (person) {
        Object.assign(person, patch);
        if (!person.remote && !cloudMode && typeof save === 'function') save();
        renderPeopleRelated();
      }
    },
    setPeopleStatuses(statuses){
      const map = statuses || {};
      state.people.forEach(person => {
        if (person.remote) person.status = map[person.uid || person.id] || 'none';
      });
      renderPeopleRelated();
    },
    mergeRemoteChats(remoteChats){
      const active = state.activeChat;
      setCollection('chats', remoteChats);
      if (!state.chats.some(item => item.id === active)) state.activeChat = state.chats[0]?.id || '';
      if (typeof renderChats === 'function') renderChats();
      if (typeof renderMessages === 'function') renderMessages();
      if (typeof updateBadges === 'function') updateBadges();
    },
    mergeRemoteNotifications(remoteNotifications){
      setCollection('notifications', remoteNotifications);
      if (typeof renderNotifications === 'function') renderNotifications();
      if (typeof updateBadges === 'function') updateBadges();
    },
    mergeRemoteGroups(remoteGroups){
      setCollection('groups', remoteGroups);
      if (typeof renderGroups === 'function') renderGroups();
    },
    mergeRemoteEvents(remoteEvents){
      setCollection('events', remoteEvents);
      if (typeof renderEvents === 'function') renderEvents();
      if (typeof renderNextEvent === 'function') renderNextEvent();
    },
    mergeRemoteMedia(remoteMedia){
      setCollection('media', remoteMedia);
      if (typeof renderMedia === 'function') renderMedia();
    },
    mergeRemoteStories(remoteStories){
      setCollection('stories', remoteStories);
      if (typeof renderStories === 'function') renderStories();
    },
    notify(text, icon='🔔', page='feed'){
      if (cloudMode) return;
      addNotification(text, icon, page);
      save();
      if (typeof renderNotifications === 'function') renderNotifications();
    },
    toast: text => toast(text),
    openModal: options => openModal(options),
    closeModal: () => closeModal(),
    render,
    localFileToDataUrl: file => fileToDataUrl(file)
  });
})();
