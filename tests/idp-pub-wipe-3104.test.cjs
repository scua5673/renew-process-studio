'use strict';
/* 3.104 — 닫을 때 지운 코치 피드백(cs_idp_pub_v1_<uid>)을 받기 전에 새로 쓰면 서버본이 한 항목짜리로 덮이던 길.
   ① 모듈(studio/idp-pub-wipe.js)의 표 규칙 ② 실제 동기화 회차(team-data-consistency 의 가상 서버 · sync.js 원문)로 본다.
   가상 자료만 쓴다 — 실서버 · 실계정 없음. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const W=require('../studio/idp-pub-wipe.js');
const full=path.join(__dirname,'team-data-consistency.test.cjs'),fixture=fs.readFileSync(full,'utf8');
const box={require:createRequire(full),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(fixture.slice(0,fixture.indexOf('\nconst pushed='))+'\nmodule.exports={harness};',box);
const raw=JSON.stringify,parse=JSON.parse,KEY='cs_idp_pub_v1_player-a';
const hashOf=s=>'h:'+s.length+':'+s;   // 모듈 시험용 — 실제 회차는 sync.js hash 를 쓴다

const original={v:1,
  reviews:[{id:'r1',at:'2026-09-01',by:'가상 코치',strengths:['가상 강점']},{id:'r2',at:'2026-09-15',by:'가상 코치',strengths:['가상 강점 2']}],
  goals:[{id:'g1',t:'가상 목표 1',by:'가상 코치',at:1},{id:'g2',t:'가상 목표 2',by:'가상 코치',at:2}],
  talk:[{id:'t1',t:'가상 대화 1',by:'가상 코치',at:3}],
  reacts:{'day:2026-10-01':{h:1,by:'가상 코치',at:5},'day:2026-10-02':{h:1,t:'가상 답글',by:'가상 코치',at:6}}};
const newTalk={id:'t-gap',t:'받기 전에 쓴 피드백',by:'가상 코치',at:9};
/* idp.html pubPushAt 이 로컬 문서가 없을 때 만드는 모양 그대로 — {} 에서 한 항목 */
const rebuiltRaw=raw({talk:[newTalk]});
const ids=doc=>({reviews:(doc.reviews||[]).map(x=>x.id),goals:(doc.goals||[]).map(x=>x.id),talk:(doc.talk||[]).map(x=>x.id),reacts:Object.keys(doc.reacts||{}).sort()});

test('표는 확정본이 있는 공개 피드백 키에만, 지운 순간의 판(h · c)으로 남는다',()=>{
  const m={h:{[KEY]:'H1','cs_idp_v1_player-a':'H2','cs_idp_pub_v1_local':'H3','cs_idp_pub_v1_never':''},c:{[KEY]:7}};
  assert.equal(W.mark(m,KEY),true);
  assert.deepEqual(m.w[KEY],{h:'H1',c:7});
  for(const k of ['cs_idp_v1_player-a','cs_idp_pub_v1_local','cs_idp_pub_v1_never','cs_idp_pub_v1_missing','scout_tool_v1'])assert.equal(W.mark(m,k),false,k);
  assert.deepEqual(Object.keys(m.w),[KEY]);
});
test('받기 전: 없으면 missing, 새로 쓴 문서는 rebuilt, 서버본 그대로면 표를 걷는다',()=>{
  const conf=raw(original),m={h:{[KEY]:hashOf(conf)},c:{[KEY]:3}};W.mark(m,KEY);
  assert.equal(W.state(m,KEY,null,hashOf),'missing');
  assert.equal(W.state(m,KEY,rebuiltRaw,hashOf),'rebuilt');
  assert.equal(W.state(m,KEY,rebuiltRaw),'rebuilt','hash 를 못 받으면 합치는 쪽(안전한 쪽)');
  assert.equal(W.state(m,KEY,conf,hashOf),'stale');
  assert.equal(W.settle(m,KEY,conf,hashOf),'');assert.equal(Object.keys(m.w).length,0,'settle 이 표를 걷는다');
});
test('그 뒤 확정이 바뀌면(받았거나 올렸다) 표는 낡은 것 — 평소 편집은 평소대로',()=>{
  for(const change of [m=>{m.h[KEY]='other';},m=>{m.c[KEY]=99;},m=>{delete m.h[KEY];}]){
    const m={h:{[KEY]:'H1'},c:{[KEY]:3}};W.mark(m,KEY);change(m);
    assert.equal(W.state(m,KEY,rebuiltRaw,hashOf),'stale');assert.equal(W.settle(m,KEY,rebuiltRaw,hashOf),'');assert.equal(m.w[KEY],undefined);
  }
  assert.equal(W.state({h:{[KEY]:'H1'},c:{[KEY]:3}},KEY,rebuiltRaw,hashOf),'','확정 판이 있고 표가 없으면 평소 편집');
  assert.equal(W.state({h:{},c:{}},KEY,rebuiltRaw,hashOf),'rebuilt','확정 판 없이 있는 공개본(팀 전환 뒤) — 서버본과 조상 없이 합친다');
  assert.equal(W.state({h:{},c:{}},KEY,null,hashOf),'','로컬도 없으면 평소처럼 받는다');
  assert.equal(W.state({h:{},c:{}},'cs_idp_v1_player-a',rebuiltRaw,hashOf),'','선수 개인 문서는 해당 없음');
  assert.equal(W.clear({h:{}},KEY),false);
});

/* ── 실제 회차 ── 코치 기기 · 팀 공간 · 공개 피드백 키 하나 */
function wiped({server=raw(original),cupd=1,local=rebuiltRaw,guard=true,...opt}={}){
  const h=box.module.exports.harness({key:KEY,dynamic:true,localOnly:true,uid:'coach-a',server,cupd,mirror:local,...opt});
  const conf=raw(original);h.baseline(conf,1);   // 닫기 전 확정본(meta.h · meta.c · 기준본)
  if(guard)h.c.PSIdpPubWipe=W;
  const m=h.c.meta();if(guard)W.mark(m,KEY);h.c.setMeta(m);   // 닫으며 지웠다(wipeTeamCacheSoft 가 같은 줄로 표를 남긴다)
  if(local==null)h.local.delete(KEY);
  return h;
}
const marked=h=>!!(h.c.meta().w||{})[KEY];
test('받기 전에 쓴 한 줄은 서버본에 더해진다 — 서버본이 한 항목으로 덮이지 않는다',async()=>{
  const h=wiped();await h.mark();
  const r=await h.run();assert.equal(r.error,undefined,raw(h.errors));
  const saved=parse(h.server.get(KEY).v),local=parse(h.local.get(KEY));
  assert.deepEqual(ids(saved),{reviews:['r1','r2'],goals:['g1','g2'],talk:['t1','t-gap'],reacts:['day:2026-10-01','day:2026-10-02']});
  assert.deepEqual(local,saved,'이 기기 사본도 합친 판');
  /* 합친 판이 확정된 뒤의 평소 삭제는 되살아나지 않는다 */
  const del=Object.assign({},saved,{goals:saved.goals.filter(g=>g.id!=='g1')});h.local.set(KEY,raw(del));await h.mark();
  const r2=await h.run();assert.equal(r2.error,undefined,raw(h.errors));
  assert.deepEqual(ids(parse(h.server.get(KEY).v)).goals,['g2']);assert.equal(marked(h),false,'표가 걷혔다');
});
test('그 사이 다른 코치가 서버본을 고쳤어도 셋 다 남는다(기준본과 3-way 로 합치면 «지움»으로 읽힌다)',async()=>{
  const other=Object.assign({},original,{goals:original.goals.concat([{id:'g-other',t:'다른 코치 목표',by:'가상 코치 B',at:8}])});
  const h=wiped({server:raw(other),cupd:3});await h.mark();
  const r=await h.run();assert.equal(r.error,undefined,raw(h.errors));
  const saved=ids(parse(h.server.get(KEY).v));
  assert.deepEqual(saved.goals,['g1','g2','g-other']);assert.deepEqual(saved.talk,['t1','t-gap']);assert.deepEqual(saved.reviews,['r1','r2']);
});
test('평소 길: 아무것도 안 쓰고 받으면 서버본이 그대로 돌아오고 표가 걷힌다 — 다음 삭제는 그대로 올라간다',async()=>{
  const h=wiped({local:null});
  const r=await h.run();assert.equal(r.error,undefined,raw(h.errors));
  assert.equal(h.local.get(KEY),raw(original));assert.equal(marked(h),false);
  const del=Object.assign({},original,{talk:[]});h.local.set(KEY,raw(del));await h.mark();
  const r2=await h.run();assert.equal(r2.error,undefined,raw(h.errors));
  assert.deepEqual(parse(h.server.get(KEY).v).talk,[],'받은 뒤의 삭제는 서버본과 다시 합치지 않는다');
});
test('서버 원문이 이 회차에 없으면 올리지 않고 기다린다',async()=>{
  const h=wiped({missingBody:true});await h.mark();
  await h.run();
  assert.equal(h.server.get(KEY).v,raw(original),'서버본 그대로');assert.equal(h.local.get(KEY),rebuiltRaw,'쓴 줄도 그대로');
  assert.ok(h.errors.some(e=>e.stage==='idp-public-rebuilt-wait'),raw(h.errors));assert.equal(marked(h),true,'다음 회차가 다시 합친다');
});
test('동기화 진단 제보에 자동 저장 · 다시 쓴 공개본 대기 단계가 이름으로 남는다',()=>{
  const D=require('../studio/support-diagnostics.js');
  for(const stage of ['autosave','autosave-archive-list','idp-public-rebuilt-wait'])assert.equal(D.sanitizeLog('sync',{name:'Error',stage},null,0).stage,stage);
  assert.equal(D.sanitizeLog('sync',{name:'Error',stage:'autosave:PRIVATE_KEY'},null,0).stage,'','모르는 꼬리는 버린다');
});
/* 팀 전환 — 돌아오는 팀의 받기가 전환 안에서 끝나지 못하면(15초) 동기화 기록(meta)이 빈 채로 다시 열린다.
   공개본은 전환 때 늘 지워지고 확인까지 받으니, 확정 판 없이 이 기기에 있는 공개본은 받기 전에 새로 쓴 문서다.
   그 팀에서 예전에 확정한 기준본은 보조 저장소에 남아 있어 3-way 로 합치면 «없는 항목 = 지움»이 된다(가상 팀 재현 9 → 1). */
test('팀 전환 뒤 기록 없이 쓴 한 줄도 서버본에 더해진다 — 남아 있던 옛 기준본으로 지움을 추측하지 않는다',async()=>{
  const h=box.module.exports.harness({key:KEY,dynamic:true,localOnly:true,uid:'coach-a',server:raw(original),cupd:1,mirror:rebuiltRaw});
  h.c.PSIdpPubWipe=W;h.base.set(KEY,raw(original));   // meta 는 비었고(전환이 지웠다) 옛 기준본만 있다
  await h.mark();
  const r=await h.run();assert.equal(r.error,undefined,raw(h.errors));
  assert.deepEqual(ids(parse(h.server.get(KEY).v)),{reviews:['r1','r2'],goals:['g1','g2'],talk:['t1','t-gap'],reacts:['day:2026-10-01','day:2026-10-02']});
  /* 합친 판이 확정된 뒤의 평소 삭제는 그대로 올라간다 */
  const saved=parse(h.server.get(KEY).v);h.local.set(KEY,raw(Object.assign({},saved,{goals:saved.goals.filter(g=>g.id!=='g2')})));await h.mark();
  const r2=await h.run();assert.equal(r2.error,undefined,raw(h.errors));
  assert.deepEqual(ids(parse(h.server.get(KEY).v)).goals,['g1']);
});
