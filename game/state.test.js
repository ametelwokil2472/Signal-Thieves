import test from 'node:test';import assert from 'node:assert/strict';import {createRoom,revive,serialize,advance,act,publicState} from './state.js';
test('two players finish three rounds with deterministic scoring and winner',()=>{
 const base=Date.now();const {room:raw,p:a}=createRoom('TEST','Alpha',base);const r=revive(serialize(raw));const b={id:crypto.randomUUID(),token:crypto.randomUUID(),name:'Beta',connected:true,score:0,role:null,round:null,input:0,lastSeen:base};r.players.set(b.id,b);act(r,a,'start',{rounds:3},base);assert.equal(r.round,1);
 for(let i=1;i<=3;i++){
  const start=r.phaseEnd;advance(r,start+1);const liveStart=r.phaseEnd+1;advance(r,liveStart);
  // Player Beta supplies precision samples while Alpha acts as Controller in round 1.
  const operator=[...r.players.values()].find(p=>p.role!=='controller');
  operator.round.samples=20;operator.round.accuracySum=20;operator.round.challenge=true;
  const controller=[...r.players.values()].find(p=>p.role==='controller');controller.round.repairPoints=40;
  const end=r.phaseEnd;advance(r,end+1);assert.equal(r.phase,'investigation');advance(r,r.phaseEnd+1);assert.equal(r.phase,'results');assert.ok(operator.round.earned>=275);assert.ok(controller.round.earned>=40);
  const resultsEnd=r.phaseEnd;advance(r,resultsEnd+1);
  if(i<3)assert.equal(r.round,i+1);
 }
 assert.equal(r.phase,'finished');const leaders=publicState(r,Date.now()).leaderboard;assert.equal(leaders.length,2);assert.ok(leaders[0].score>leaders[1].score);assert.equal(leaders[0].name,'Beta');
});
