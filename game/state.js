import {makeRound,phaseNext,tick,applyInput,useRepair,sabotage,inSabotageWindow,leaderboard} from './engine.js';
export const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ';
export const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(4)),b=>alphabet[b%alphabet.length]).join('');
export const cleanName=s=>String(s??'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,18);
export function createRoom(c,name,now=Date.now()){const id=crypto.randomUUID(),token=crypto.randomUUID();const p={id,token,name,connected:true,score:0,role:null,round:null,input:0,lastSeen:now};return {room:{code:c,host:id,players:[p],phase:'lobby',round:0,totalRounds:5,phaseEnd:0,charge:0,stability:50,echoes:[],success:false,lastActive:now},p};}
export function revive(r){r.players=new Map(r.players.map(p=>[p.id,p]));return r;}
export function serialize(r){return {...r,players:[...r.players.values()]};}
export function advance(r,now){let count=0;while(r.phaseEnd&&r.phaseEnd<=now&&count++<20){const end=r.phaseEnd;if(r.phase==='live'){// simulate elapsed time in bounded chunks before leaving phase
  simulate(r,end);
 }phaseNext(r,end);if(r.phase==='reveal'&&r.round>r.totalRounds){r.phase='finished';r.phaseEnd=0;}}
 if(r.phase==='live')simulate(r,now);
 for(const p of r.players.values()){p.connected=now-(p.lastSeen||0)<45000;if(!p.connected)p.input=0;}
 if(!r.players.has(r.host)||!r.players.get(r.host)?.connected){r.host=[...r.players.values()].find(p=>p.connected)?.id??r.host;}
 return r;
}
export function simulate(r,now){if(r.phase!=='live')return;let last=r.simulatedAt||r.liveStarted||now;const stop=Math.min(now,r.phaseEnd||now);if(stop<=last)return;while(last<stop){const next=Math.min(last+250,stop);tickAt(r,next,next-last);last=next;}r.simulatedAt=stop;}
function tickAt(r,at,dt){ // Engine uses Date.now internally; temporarily use a pure approximation by offsetting event timestamps.
 const liveElapsed=at-r.liveStarted;r.liveElapsed=liveElapsed;
 const active=[...r.players.values()].filter(p=>p.connected&&p.role!=='controller');
 const avg=active.length?active.reduce((s,p)=>s+(at-(p.lastInputAt||0)<2200?p.input:0),0)/active.length:0;
 let echo=0;r.echoes=r.echoes.filter(e=>{if(at>=e.at){echo+=e.strength;return false;}return true;});
 const target=Math.max(0,Math.min(100,22+avg*82-echo));r.stability=Math.max(0,Math.min(100,r.stability+(target-r.stability)*Math.min(1,dt/1100)));
 if(r.stability>=65)r.charge=Math.min(100,r.charge+dt/900);else if(r.stability<25)r.charge=Math.max(0,r.charge-dt/1800);
 if(r.charge>=100){r.success=true;r.phaseEnd=Math.min(r.phaseEnd,at+800);}
}
export function publicState(r,now){return {code:r.code,host:r.host,phase:r.phase,round:r.round,totalRounds:r.totalRounds,phaseEnd:r.phaseEnd,serverTime:now,charge:Math.round(r.charge),stability:Math.round(r.stability),success:r.success,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,connected:p.connected,score:p.score})),leaderboard:['results','finished'].includes(r.phase)?leaderboard(r):undefined,thiefMode:r.players.size>=4};}
export function privateState(r,p){return {playerId:p.id,token:p.token,role:p.role,channel:p.channel,repairs:p.round?.repairs??0,sabotages:p.round?.sabotages??0,canSabotage:p.role==='thief'&&inSabotageWindow(r),vote:p.round?.vote??null};}
export function act(r,p,action,data,now){p.lastSeen=now;p.connected=true;r.lastActive=now;switch(action){case 'start':if(r.host!==p.id)throw Error('Only the host can start');if(!['lobby','finished'].includes(r.phase))throw Error('Already running');if([...r.players.values()].filter(x=>x.connected).length<2)throw Error('At least two players required');r.totalRounds=[3,5].includes(Number(data?.rounds))?Number(data.rounds):5;for(const q of r.players.values())q.score=0;r.round=0;makeRound(r,now);return;
 case 'input':applyInput(r,p,data);return;
 case 'repair':if(!useRepair(r,p))throw Error('Repair unavailable');return;
 case 'sabotage':if(!sabotage(r,p))throw Error('Sabotage unavailable');return;
 case 'vote':if(r.phase!=='investigation'||r.players.size<4||p.round?.vote||!r.players.has(data?.target)||data.target===p.id)throw Error('Invalid vote');p.round.vote=data.target;return;
 default:throw Error('Unknown action');}}
