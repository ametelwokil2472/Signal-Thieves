import { getStore } from '@netlify/blobs';
import { createRoom,revive,serialize,advance,publicState,privateState,act,cleanName,code } from '../../game/state.js';
const store=()=>getStore({name:'signal-thieves-rooms',consistency:'strong'});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export default async function handler(request:Request){
 if(request.method!=='POST')return reply({ok:false,error:'POST required'},405);
 let body:any;try{body=await request.json();}catch{return reply({ok:false,error:'Invalid JSON'},400);}
 const action=String(body?.action||'');const now=Date.now();const blobs=store();
 try{
 if(action==='create'){
 const name=cleanName(body?.name);if(!name)throw Error('Enter a nickname');
 for(let i=0;i<12;i++){const c=code();const {room,p}=createRoom(c,name,now);const result=await blobs.setJSON(c,serialize(room),{onlyIfNew:true});if(result.modified)return reply({ok:true,code:c,id:p.id,token:p.token,room:publicState(revive(serialize(room)),now),priv:privateState(revive(serialize(room)),p)});}
 throw Error('Could not reserve a room code');
 }
 const c=String(body?.code||'').trim().toUpperCase();if(!/^[A-Z]{4}$/.test(c))throw Error('Enter a four-letter room code');
 for(let attempt=0;attempt<12;attempt++){
 const entry=await blobs.getWithMetadata(c,{consistency:'strong',type:'json'});if(!entry||!entry.data)throw Error('Room not found');
 const r=revive(entry.data as any);advance(r,now);
 if(now-(r.lastActive||0)>86400000)throw Error('Room expired');
 let p=[...r.players.values()].find(x=>x.token===body?.token&&body.token);
 if(action==='join'){
 if(!p){if(r.phase!=='lobby')throw Error('Game in progress; only returning players can join');if(r.players.size>=8)throw Error('Room is full');const name=cleanName(body?.name);if(!name)throw Error('Enter a nickname');p={id:crypto.randomUUID(),token:crypto.randomUUID(),name,connected:true,score:0,role:null,round:null,input:0,lastSeen:now};r.players.set(p.id,p);}
 p.connected=true;p.lastSeen=now;
 }else{
 if(!p)throw Error('Session expired. Rejoin from the lobby.');
 if(action==='state'){p.lastSeen=now;p.connected=true;}
 else act(r,p,action,body.data,now);
 }
 const result=await blobs.setJSON(c,serialize(r),{onlyIfMatch:entry.etag});
 if(!result.modified)continue;
 return reply({ok:true,code:c,id:p.id,token:p.token,room:publicState(r,now),priv:privateState(r,p)});
 }
 return reply({ok:false,error:'Room is busy; retry',retry:true},409);
 }catch(e:any){return reply({ok:false,error:e?.message||'Unexpected error'},400);}
}
