import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import {
  db,
  runtime,
  bridge,
  timeLabel,
  handleError
} from './klas-backend-core.js?v=20260722-dynamic1';

const commentStops = new Map();
let syncFrame = 0;

function stopComments(){
  for(const unsubscribe of commentStops.values()) unsubscribe();
  commentStops.clear();
}

function watchComments(postId){
  if(commentStops.has(postId)) return;
  const reference = collection(db, 'posts', postId, 'comments');
  const unsubscribe = onSnapshot(
    query(reference, orderBy('createdAt', 'asc'), limit(100)),
    snapshot => {
      const comments = snapshot.docs.map(item => {
        const value = item.data();
        return {
          id: item.id,
          author: value.authorName || 'Ulanyjy',
          avatar: value.authorAvatar || '',
          text: value.text || '',
          time: timeLabel(value.createdAt)
        };
      });
      bridge.patchPost(postId, { comments });
    },
    error => handleError(error, 'Teswirler realtime täzelenmedi')
  );
  commentStops.set(postId, unsubscribe);
}

function syncCommentListeners(){
  cancelAnimationFrame(syncFrame);
  syncFrame = requestAnimationFrame(() => {
    syncFrame = 0;
    if(!runtime.user){
      stopComments();
      return;
    }
    const remotePosts = bridge.getState().posts.filter(post => post.remote);
    const ids = new Set(remotePosts.map(post => post.id));
    ids.forEach(watchComments);
    for(const [postId, unsubscribe] of commentStops){
      if(!ids.has(postId)){
        unsubscribe();
        commentStops.delete(postId);
      }
    }
  });
}

window.addEventListener('klas-auth', event => {
  if(event.detail.user) syncCommentListeners();
  else stopComments();
});
window.addEventListener('klas:statechange', event => {
  const collections = event.detail?.collections || [];
  if(collections.includes('all') || collections.includes('posts')) syncCommentListeners();
});
window.addEventListener('pagehide', stopComments);

if(runtime.user) syncCommentListeners();
