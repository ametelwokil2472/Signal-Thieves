import { CHANNELS,PHASE_MS,TOTAL_ROUNDS } from './constants.js';
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const round2=n=>Math.round(n*100)/100;
export function assignRoles(players,round){
 const ids=players.map(p=>p.id); const controller=ids[(round-1)%ids.length];
 const eligible=ids.filter(id=>id!==controller); const thiefCount=ids.length<4?0:ids.length<7?1:2;
 // Deterministic rotation distributes secret roles across rounds without exposing them to clients.
 const rotated=[...eligible.slice((round-1)%eligible.length),...eligible.slice(0,(round-1)%eligible.length)];
 const thieves=new Set(rotated.slice(0,thiefCount));
 for(const p of players){p.role=p.id===controller?'controller':thieves.has(p.id)?'thief':'operator';p.channel=CHANNELS[(ids.indexOf(p.id)+round-1)%CHANNELS.length];p.round={accuracySum:0,samples:0,challenge:false,repairs:0,repairPoints:0,sabotages:0,thiefSuccess:false,vote:null,precision:0};p.input=0;p.lastInputAt=0;p.lastTapAt=0;p.tapIntervals=[];p.lastRepairAt=0;p.lastSabotageAt=0;}
 return controller;
}
export function makeRound(room,now=Date.now()){
 room.round+=1;assignRoles([...room.players.values()].filter(p=>p.connected),room.round);
 room.charge=0;room.stability=50;room.echoes=[];room.liveElapsed=0;room.sabotageWindows=[{start:18000,end:31000},{start:49000,end:63000}];room.success=false;room.roundSettled=false;room.phase='reveal';room.phaseEnd=now+PHASE_MS.reveal;
}
export function phaseNext(room,now=Date.now()){
 if(room.phase==='reveal'){room.phase='calibration';room.phaseEnd=now+PHASE_MS.calibration;}
 else if(room.phase==='calibration'){room.phase='live';room.phaseEnd=now+PHASE_MS.live;room.liveStarted=now;room.liveElapsed=0;}
 else if(room.phase==='live'){room.phase='investigation';room.phaseEnd=now+PHASE_MS.investigation;}
 else if(room.phase==='investigation'){settle(room);room.phase='results';room.phaseEnd=now+PHASE_MS.results;}
 else if(room.phase==='results'){
   if(room.round>=(room.totalRounds||TOTAL_ROUNDS)||room.players.size<2){room.phase='finished';room.phaseEnd=0;}
   else makeRound(room,now);
 }
}
export function inSabotageWindow(room){return room.phase==='live'&&room.sabotageWindows.some(w=>room.liveElapsed>=w.start&&room.liveElapsed<=w.end);}
export function applyInput(room,p,payload){
 if(room.phase!=='live'||p.role==='controller'||!p.connected)return;
 const now=Date.now();if(now-p.lastInputAt<65)return;
 const value=Number(payload?.value);if(!Number.isFinite(value))return;
 p.lastInputAt=now;
 if(p.channel==='rhythm'){
  if(payload?.kind!=='tap'||now-p.lastTapAt<120)return;
  if(p.lastTapAt)p.tapIntervals.push(now-p.lastTapAt);
  p.tapIntervals=p.tapIntervals.slice(-6);p.lastTapAt=now;
  const interval=p.tapIntervals.at(-1)??650;p.input=clamp(1-Math.abs(interval-650)/650,0,1);
 }else p.input=clamp(value,0,1);
 p.round.accuracySum+=p.input;p.round.samples++;
 if(p.input>=.8&&p.round.samples>=12)p.round.challenge=true;
 if(p.channel==='tilt'&&p.input>.8&&Math.random()<.08)room.echoes.push({at:now+3500,strength:4});
}
export function useRepair(room,p){
 const now=Date.now();if(room.phase!=='live'||p.role!=='controller'||p.round.repairs>=2||now-p.lastRepairAt<8000)return false;
 p.lastRepairAt=now;p.round.repairs++;const before=room.stability;room.stability=clamp(room.stability+18,0,100);if(room.stability>before+1){p.round.repairPoints+=40;}return true;
}
export function sabotage(room,p){
 const now=Date.now();if(p.role!=='thief'||!inSabotageWindow(room)||p.round.sabotages>=1||now-p.lastSabotageAt<10000)return false;
 p.lastSabotageAt=now;p.round.sabotages++;room.echoes.push({at:now+2600,strength:21});return true;
}
export function tick(room,dt){
 if(room.phase!=='live')return;
 const now=Date.now();room.liveElapsed=now-room.liveStarted;
 const operators=[...room.players.values()].filter(p=>p.connected&&p.role!=='controller');
 const average=operators.length?operators.reduce((s,p)=>s+(now-p.lastInputAt<2200?p.input:0),0)/operators.length:0;
 let echo=0;room.echoes=room.echoes.filter(e=>{if(now>=e.at){echo+=e.strength;return false;}return true;});
 const target=clamp(22+average*82-echo,0,100);
 room.stability=clamp(room.stability+(target-room.stability)*Math.min(1,dt/1100),0,100);
 if(room.stability>=65)room.charge=clamp(room.charge+dt/900,0,100);
 else if(room.stability<25)room.charge=clamp(room.charge-dt/1800,0,100);
 if(room.charge>=100){room.success=true;room.phaseEnd=Math.min(room.phaseEnd,now+800);}
}
export function settle(room){
 if(room.roundSettled)return;room.roundSettled=true;
 const players=[...room.players.values()];const votes=players.filter(p=>p.round?.vote).map(p=>p.round.vote);
 for(const p of players){if(!p.round)continue;const r=p.round;
 const accuracy=r.samples?Math.round(r.accuracySum/r.samples*100):0;
 let points=(r.challenge?100:0)+accuracy+(room.success?75:0)+r.repairPoints;
 if(p.role==='thief'){
   // Sabotage replaces ordinary challenge completion; the reactor must survive.
   if(r.challenge)points-=100;
   if(room.success&&r.sabotages>0){points+=150;r.thiefSuccess=true;}
   if(room.success&&r.sabotages>0&&!votes.includes(p.id))points+=50;
 }
 if(room.players.size>=4){if(r.vote){const target=room.players.get(r.vote);points+=target?.role==='thief'?75:-25;}}
 else points+=Math.round(75*accuracy/100);
 r.precision=accuracy;r.earned=points;p.score+=points;
 }
}
export function leaderboard(room){return [...room.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,earned:p.round?.earned??0,role:room.phase==='results'||room.phase==='finished'?p.role:undefined,connected:p.connected})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));}
