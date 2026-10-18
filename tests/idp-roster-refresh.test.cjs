'use strict';
// 오류 제보 8d8daa7e «IDP» — 팀 자료가 오기 전에 받은 빈 명단을 자료가 오면 다시 묻는다.
const test=require('node:test'),assert=require('node:assert/strict');
const {create,players}=require('../studio/idp-roster-refresh.js');
const flush=()=>new Promise(r=>setImmediate(r));
function harness(answers,opts={}){
  const timers=[],asked=[],applied=[];let stale=true;
  const r=create({stale:()=>stale,ask:()=>{asked.push(1);const a=answers.length>1?answers.shift():answers[0];return a instanceof Error?Promise.reject(a):Promise.resolve(a);},
    apply:x=>{applied.push(x);stale=false;},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},delay:100,max:opts.max||5});
  return {r,timers,asked,applied,set stale(v){stale=v;},async fire(){const t=timers.shift();assert.ok(t,'예약된 다시 묻기가 있다');t.fn();await flush();await flush();return t;}};
}
const empty={ok:true,players:[]},full={ok:true,players:[{id:'p1',name:'가상 선수'}]};

test('빈 명단은 반영하지 않고 다시 묻다가, 선수가 든 답이 오면 그것만 반영한다',async()=>{
  const h=harness([empty,empty,full]);assert.equal(h.r.poke(),true);
  await h.fire();await h.fire();assert.equal(h.applied.length,0);
  await h.fire();assert.deepEqual(h.applied,[full]);assert.equal(h.asked.length,3);
  assert.equal(h.timers.length,0,'반영한 뒤엔 더 묻지 않는다');assert.equal(h.r.poke(),false);
});
test('지금 명단이 멀쩡하면(stale 아님) 아무것도 묻지 않는다',async()=>{
  const h=harness([full]);h.stale=false;assert.equal(h.r.poke(),false);assert.equal(h.timers.length,0);assert.equal(h.asked.length,0);
});
test('못 받은 답(오류·ok:false)도 다시 묻되 횟수에 한도가 있다',async()=>{
  const h=harness([new Error('timeout'),{ok:false,err:'timeout'}],{max:3});h.r.poke();
  for(let i=0;i<3;i++)await h.fire();assert.equal(h.asked.length,3);assert.equal(h.timers.length,0,'한도에서 멈춘다');
  assert.equal(h.r.poke(),false,'새 신호 없이는 다시 시작하지 않는다');
  assert.equal(h.r.poke(10,true),true,'팀 자료가 새로 들어오면(fresh) 처음부터 다시 센다');assert.equal(h.timers[0].ms,10);
});
test('묻는 동안 명단이 다른 길로 채워지면 늦게 온 답을 덮어쓰지 않는다',async()=>{
  const h=harness([full]);h.r.poke();const t=h.timers.shift();t.fn();h.stale=false;await flush();await flush();
  assert.equal(h.applied.length,0);
});
test('예약이 이미 있으면 신호가 여러 번 와도 한 번만 묻는다',async()=>{
  const h=harness([full]);h.r.poke(800,true);h.r.poke(800,true);h.r.poke();assert.equal(h.timers.length,1);
  assert.equal(h.r.waiting(),true);await h.fire();assert.equal(h.asked.length,1);assert.equal(h.r.waiting(),false);
});
test('players 는 모양이 틀린 답을 빈 명단으로 읽는다',()=>{
  assert.deepEqual(players(null),[]);assert.deepEqual(players({players:'x'}),[]);assert.equal(players(full).length,1);
});
