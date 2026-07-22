import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, limit, serverTimestamp, increment, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { db, runtime, bridge, handleError } from './klas-backend-core.js';
let stops=[];function clear(){stops.forEach(s=>s());stops=[];bridge.mergeRemoteGroups([]);bridge.mergeRemoteEvents([]);bridge.mergeRemoteMedia([]);bridge.mergeRemoteStories([])}
function watch(name,map,method){stops.push(onSnapshot(query(collection(db,name),limit(100)),s=>bridge[method](s.docs.map(x=>map(x.id,x.data()))),e=>handleError(e,`${name} ýüklenmedi`)))}
function start(){clear();if(!runtime.user)return;watch('groups',(id,g)=>({id,remote:true,name:g.name||'Gurnak',members:Number(g.membersCount)||1,icon:g.icon||'🏫',description:g.description||'',joined:(g.memberIds||[]).includes(runtime.user.uid),owner:g.ownerId===runtime.user.uid,ownerId:g.ownerId}),'mergeRemoteGroups');watch('events',(id,e)=>({id,remote:true,title:e.title||'Çäre',date:e.date||'',time:e.time||'18:00',location:e.location||'',description:e.description||'',attending:(e.attendeeIds||[]).includes(runtime.user.uid),ownerId:e.ownerId}),'mergeRemoteEvents');watch('media',(id,m)=>({id,remote:true,type:m.type||'image',src:m.src||'',title:m.title||'Media',ownerId:m.ownerId}),'mergeRemoteMedia');watch('stories',(id,s)=>({id,remote:true,ownerId:s.ownerId,name:s.ownerName||'Ulanyjy',avatar:s.ownerAvatar||'',media:s.media||'',text:s.text||'',viewed:false,own:s.ownerId===runtime.user.uid}),'mergeRemoteStories')}
export async function createGroup(d){await addDoc(collection(db,'groups'),{...d,ownerId:runtime.user.uid,memberIds:[runtime.user.uid],membersCount:1,createdAt:serverTimestamp()})}
export async function toggleGroup(id,joined){await updateDoc(doc(db,'groups',id),{memberIds:joined?arrayRemove(runtime.user.uid):arrayUnion(runtime.user.uid),membersCount:increment(joined?-1:1),updatedAt:serverTimestamp()})}
export const deleteGroup=id=>deleteDoc(doc(db,'groups',id));
export async function createEvent(d){await addDoc(collection(db,'events'),{...d,ownerId:runtime.user.uid,attendeeIds:[runtime.user.uid],createdAt:serverTimestamp()})}
export async function toggleEvent(id,on){await updateDoc(doc(db,'events',id),{attendeeIds:on?arrayRemove(runtime.user.uid):arrayUnion(runtime.user.uid),updatedAt:serverTimestamp()})}
export const deleteEvent=id=>deleteDoc(doc(db,'events',id));
export async function createMedia(d){await addDoc(collection(db,'media'),{...d,ownerId:runtime.user.uid,createdAt:serverTimestamp()})}
export const deleteMedia=id=>deleteDoc(doc(db,'media',id));
export async function createStory(d){await addDoc(collection(db,'stories'),{...d,ownerId:runtime.user.uid,ownerName:runtime.profile?.shortName||runtime.user.displayName||'Ulanyjy',ownerAvatar:runtime.profile?.avatarURL||runtime.user.photoURL||'',createdAt:serverTimestamp()})}
export const deleteStory=id=>deleteDoc(doc(db,'stories',id));
window.addEventListener('klas-auth',e=>e.detail.user?start():clear());
