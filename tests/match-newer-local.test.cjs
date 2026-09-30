'use strict';
/* 2.917 — 경기 저장이 서버에 확인된 **뒤** 코치가 또 입력하면,
   예전엔 회차가 match_not_ready 로 실패하며 기기 기록(meta)을 회차 전으로 되돌렸고,
   다음 회차가 자기 저장끼리 «자료 확인» 충돌을 만들었다(2026-09-30 재현). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const fixture=path.join(__dirname,'team-data-consistency.test.cjs'),source=fs.readFileSync(fixture,'utf8');
const declarations=source.slice(0,source.indexOf('\nconst pushed='));
const {harness}=new Function('require','__dirname',declarations+'\nreturn {harness};')(createRequire(fixture),__dirname);
const MATCH='cs_team_matches_v1';
const BASE=JSON.stringify({version:1,matches:[{id:'m1',phaseBoards:{cur:'atk',boards:{atk:{us:[],opp:[]}}}}]});
const DRAFT=JSON.stringify({version:1,matches:[{id:'m1',squad:{start:['p1']},phaseBoards:{cur:'atk',boards:{atk:{us:[],opp:[]}}}}]});
const NEWER=DRAFT.replace('p1','p2');
async function setup(){
  const h=harness({key:MATCH,server:BASE,cupd:1,mirror:DRAFT,idb:DRAFT});
  h.baseline(BASE);h.local.set('ps_sync_session','{"uid":"coach-a"}');
  const meta=h.c.meta();meta.r[MATCH]={w:'team-a',present:true,h:h.c.hash(BASE)};h.c.setMeta(meta);
  await h.mark();return h;
}
function typeAfterAck(h,value){
  let typed=false;const fetch=h.c.syncFetch;
  h.c.syncFetch=async(stage,url,init)=>{const r=await fetch(stage,url,init);
    if(!typed&&stage.startsWith('kv_push')&&!stage.endsWith('_verify')){typed=true;h.local.set(MATCH,value);h.idb.set(MATCH,value);}
    return r;};
  return ()=>{h.c.syncFetch=fetch;};
}
test('서버가 받은 뒤의 새 입력은 회차를 실패시키지 않고, meta 는 서버가 받은 판에 둔다',async()=>{
  const h=await setup(),restore=typeAfterAck(h,NEWER);
  const r=await h.run();restore();
  assert.equal(r.error,undefined,JSON.stringify(h.errors));
  assert.equal(h.server.get(MATCH).v,DRAFT,'서버는 방금 올린 판');
  const m=h.c.meta();
  assert.equal(m.h[MATCH],h.c.hash(DRAFT),'meta 해시 = 서버가 받은 판');
  assert.equal(m.c[MATCH],h.server.get(MATCH).cupd,'meta 판본 = 서버가 준 판본');
  assert.equal(h.ready(),false,'새 입력이 확인되기 전까지 준비표는 닫혀 있다');
  assert.equal(h.queue.length,1,'새 입력은 아직 올릴 것으로 남는다');
  assert.equal(h.local.get(MATCH),NEWER);assert.equal(h.idb.get(MATCH),NEWER);
  assert.ok(h.errors.some(e=>e.stage==='match-local-newer'));
});
test('다음 회차는 충돌 없이 새 입력을 올리고 준비표를 연다',async()=>{
  const h=await setup(),restore=typeAfterAck(h,NEWER);
  await h.run();restore();h.c.busy=false;
  const r2=await h.run();
  assert.equal(r2.error,undefined,JSON.stringify(h.errors));
  assert.equal(h.server.get(MATCH).v,NEWER);
  assert.equal(h.c.holdList().length,0,'자기 저장끼리 «자료 확인»이 생기지 않는다');
  assert.equal(h.queue.length,0);assert.equal(h.ready(),true);
});
test('서버가 받기 전(확인 없음)의 불일치는 예전처럼 실패하고 meta 를 되돌린다',async()=>{
  const h=await setup();const fetch=h.c.syncFetch;
  h.c.syncFetch=async(stage,url,init)=>{if(stage.startsWith('kv_push')&&!stage.endsWith('_verify')){h.local.set(MATCH,NEWER);h.idb.set(MATCH,NEWER);return {ok:true,status:200,json:async()=>[],text:async()=>'[]'};}return fetch(stage,url,init);};
  const r=await h.run();h.c.syncFetch=fetch;
  assert.ok(r.error,'확인 못 받은 저장은 성공으로 치지 않는다');
  assert.equal(h.c.meta().h[MATCH],h.c.hash(BASE));assert.equal(h.ready(),false);
});
test('IDB 와 거울이 서로 다르면(한쪽만 새 입력) 예전처럼 실패한다',async()=>{
  const h=await setup();let typed=false;const fetch=h.c.syncFetch;
  h.c.syncFetch=async(stage,url,init)=>{const r=await fetch(stage,url,init);if(!typed&&stage.startsWith('kv_push')&&!stage.endsWith('_verify')){typed=true;h.local.set(MATCH,NEWER);}return r;};
  const r=await h.run();h.c.syncFetch=fetch;
  assert.equal(r.code,'match_not_ready');assert.equal(h.ready(),false);
});
