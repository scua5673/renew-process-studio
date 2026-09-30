'use strict';
/* 2.921 — 기준본 두 사본(localStorage·IDB)이 다르고 어느 쪽도 확정 hash 로 증명되지 않으면(StorageConflictError)
   예전엔 syncBasePrimeAll 이 회차 전체를 막았다. 현재 팀 기준본은 매 회차 다시 읽으므로 그 기기는 영구히 멈췄다.
   이제 그 키의 기준본만 «모름»으로 두고 회차는 계속한다 — 어느 사본도 고르지도 지우지도 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module'),J=require('../studio/autosave-journal.js');
const full=path.join(__dirname,'team-data-consistency.test.cjs'),fixture=fs.readFileSync(full,'utf8');
const box={require:createRequire(full),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(fixture.slice(0,fixture.indexOf('\nconst pushed='))+'\nmodule.exports={harness};',box);
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const helpers=source.slice(source.indexOf('var syncBaseMem='),source.indexOf('function normalizeCoachDocument('));
const raw=JSON.stringify,privateKey='cs_idp_v1_player-a';
const doc=values=>raw({v:1,log:values,imgNotes:[]});
const conflict=()=>Object.assign(new Error('legacy and IndexedDB values differ'),{name:'StorageConflictError'});
async function setup({withHistory=true,withMeta=true,legacy='LEGACY-COPY',disk='DISK-COPY'}={}){
  const key=privateKey,original=doc({}),local=doc({local:{memo:'SYNTHETIC local',t:'SYNTHETIC local'}}),remote=doc({remote:{memo:'SYNTHETIC remote',t:'SYNTHETIC remote'}});
  const h=box.module.exports.harness({key,dynamic:true,localOnly:true,uid:'player-a',server:remote,cupd:3,mirror:local});
  if(withMeta)h.baseline(original,1);
  vm.runInContext(helpers,h.c);
  const ctx=()=>({uid:h.c.getSess().uid,wid:h.c.activeWs(),seal:h.local.get('ps_cache_owner_v1'),epoch:0});
  Object.assign(h.c,{autosaveEnabled:()=>true,autosaveContext:ctx,isMergeBaseKey:k=>k===key});
  const auxKey=h.c.syncBaseKey(key,'team-a'),disks=new Map([[auxKey,disk]]),auxCalls=[];
  h.local.set(auxKey,legacy);
  /* 실제 auxGet 처럼: 두 사본이 다르면 resolveConflict 를 묻고, 어느 쪽도 아니면 던진다(디스크는 그대로). */
  h.c.PSStorage.auxGet=async(k,resolve)=>{
    auxCalls.push(k);const lv=h.local.get(k)??null,iv=disks.get(k)??null;
    if(lv==null||lv===iv)return iv;
    const chosen=typeof resolve==='function'?resolve(lv,iv):null;
    if(chosen===lv||chosen===iv)return chosen;
    throw conflict();
  };
  h.c.PSStorage.auxSet=async(k,v)=>{disks.set(k,v);h.local.delete(k);return true;};
  const journal=J.create({storage:h.c.storage,context:ctx,hash:h.c.hash});h.c.autosaveJournal=()=>journal;
  if(withHistory)await journal.capture(ctx(),key,original,h.c.hash(original),1);
  return {h,key,original,local,remote,auxKey,disks,auxCalls,journal};
}
test('어긋난 두 사본이 회차를 막지 않는다 — 일지의 정확한 기준본으로 병합',async()=>{
  const f=await setup();await f.h.mark();
  await f.h.c.syncBasePrimeAll('team-a',f.h.c.meta());
  assert.equal(f.h.c.syncBaseGet(f.key,'team-a'),f.original,'일지에서 같은 hash·판본의 기준본을 찾는다');
  assert.ok(f.h.errors.some(x=>x.stage==='sync-base-copies-differ'));
  const r=await f.h.run();assert.equal(r.error,undefined,JSON.stringify({r,errors:f.h.errors}));
  const saved=JSON.parse(f.h.server.get(f.key).v);
  assert.ok(saved.log.local,'내 편집이 올라감');assert.ok(saved.log.remote,'서버 편집도 남음');
  assert.equal(f.h.queue.length,0);
});
test('일지가 없으면 그 키만 건너뛰고, 두 사본·내 편집은 그대로 남는다',async()=>{
  const f=await setup({withHistory:false});await f.h.mark();
  const r=await f.h.run();
  assert.notEqual(r.code,'sync_conflict','회차 전체가 저장소 충돌로 멈추지 않는다');
  assert.equal(f.h.c.syncBaseHas(f.key,'team-a'),true,'«있지만 믿을 수 없음»');
  assert.equal(f.h.c.syncBaseGet(f.key,'team-a'),null);
  assert.ok(f.h.errors.some(x=>x.stage==='idp-private-base-untrusted'),'추측해서 병합하지 않는다');
  assert.equal(f.h.local.get(f.key),f.local);assert.equal(f.h.server.get(f.key).v,f.remote);assert.equal(f.h.queue.length,1);
  assert.equal(f.h.local.get(f.auxKey),'LEGACY-COPY','legacy 사본을 지우지 않는다');
  assert.equal(f.disks.get(f.auxKey),'DISK-COPY','IDB 사본을 덮지 않는다');
});
test('처음 여는 팀(확정 meta 없음)은 기준본 없음으로 — 추측한 사본을 쓰지 않는다',async()=>{
  const f=await setup({withMeta:false,withHistory:false});
  await f.h.c.syncBasePrimeAll('team-a',f.h.c.meta());
  assert.equal(f.h.c.syncBaseHas(f.key,'team-a'),false);assert.equal(f.h.c.syncBaseGet(f.key,'team-a'),null);
  assert.equal(f.h.local.get(f.auxKey),'LEGACY-COPY');assert.equal(f.disks.get(f.auxKey),'DISK-COPY');
});
test('진단은 키마다 한 번만 남긴다(매 회차 다시 읽어도)',async()=>{
  const f=await setup({withHistory:false});
  await f.h.c.syncBasePrimeAll('team-a',f.h.c.meta());await f.h.c.syncBasePrimeAll('team-a',f.h.c.meta());
  assert.ok(f.auxCalls.length>=2,'현재 팀 기준본은 매번 다시 읽는다');
  assert.equal(f.h.errors.filter(x=>x.stage==='sync-base-copies-differ').length,1);
});
test('일정 기준본이 어긋나면 기준본 없음 — 병합 대신 둘 다 보관하고, 멈추지 않는다',async()=>{
  const f=await setup({withHistory:false});const key=f.h.c.syncBaseKey('process_coach_v1','team-a');
  f.h.local.set(key,'LEGACY-SCHEDULE');f.disks.set(key,'DISK-SCHEDULE');
  const m=f.h.c.meta();m.h.process_coach_v1='not-either';m.c.process_coach_v1=4;
  await f.h.c.syncBasePrimeAll('team-a',m);
  assert.equal(f.h.c.syncBaseGet('process_coach_v1','team-a'),null);
  assert.equal(f.h.c.syncBaseHas('process_coach_v1','team-a'),false);
  assert.equal(f.h.local.get(key),'LEGACY-SCHEDULE');assert.equal(f.disks.get(key),'DISK-SCHEDULE');
});
test('사본이 읽는 도중 바뀐 것(StorageOwnerChangedError)은 예전처럼 회차를 멈춘다',async()=>{
  const f=await setup();
  f.h.c.PSStorage.auxGet=async()=>{throw Object.assign(new Error('auxiliary source changed'),{name:'StorageOwnerChangedError'});};
  await assert.rejects(f.h.c.syncBasePrimeAll('team-a',f.h.c.meta()),e=>e.name==='StorageOwnerChangedError');
});
