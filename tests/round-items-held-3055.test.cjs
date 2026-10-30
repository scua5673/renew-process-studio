'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
/* 3.055 — «자료 확인»에 걸린 선수 수정(items_patch_unconfirmed · held)이 동기화 회차 입구(itemsWriteFlush)에서 회차 전체를 멈추지 않는다.
   운영자 아이패드(풋볼A)는 선수 확인 5건을 남긴 채 3.047 내내 회차를 한 번도 못 끝냈고(ps_sync_reports last_round_ack_at 없음),
   회차 맨 끝의 보관함 받기까지 못 가 보관함이 비어 보였다. 그 수정은 계속 재시도 목록에 남고, 다른 실패는 예전처럼 회차를 멈춘다. */
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const fixture=path.join(__dirname,'roster-write-reliability.test.cjs'),source=fs.readFileSync(fixture,'utf8');
const box={require:createRequire(fixture),__dirname,module:{exports:{}},console};
vm.runInNewContext(source.slice(0,source.indexOf("const p=(id,name)"))+'\nmodule.exports={harness};',box,{filename:fixture});
const {harness:actualHarness}=box.module.exports,p=(id,name)=>({id,name}),raw=JSON.stringify;
function harness(){const h=actualHarness();h.basePlayers=[];return h;}
function seed(h,players){h.basePlayers=JSON.parse(raw(players));const idx={};for(const row of players){h.disk.set('sq:'+row.id,raw(row));idx[row.id]=raw(row);}h.local.set('idx:team-a',raw(idx));}
const options=(h,...changedIds)=>({changedIds,basePlayers:h.basePlayers});

/* 회차 입구 — sync.js 의 실제 문장을 그대로 떼어 쓴다 */
const START='return itemsWriteFlush(true).catch(',END='});}).then(function(){return syncBasePrimeAll(';
function roundGate(flush,diag){
  const i=sync.indexOf(START),j=sync.indexOf(END,i);assert.ok(i>0&&j>i,'round gate snippet');
  const body=sync.slice(i+START.length,j+1);
  return new Function('itemsWriteFlush','syncDiagnostic','return itemsWriteFlush(true).catch('+body+');')(flush,diag);
}

test('held player patch no longer stops the sync round, but stays queued and busy',async()=>{
  const h=harness();seed(h,[p('a','A')]);h.c.itemsReviewKeys=()=>({'sq:a':1});
  await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),e=>e.psStage==='items_patch_unconfirmed');
  await assert.rejects(h.c.itemsWriteFlush(),e=>e.psStage==='items_patch_unconfirmed','flush 자체의 뜻은 그대로(성공이라 말하지 않는다)');
  const seen=[];
  assert.equal(await roundGate(()=>h.c.itemsWriteFlush(),(s,e)=>seen.push([s,e.psStage])),true,'회차는 이어 간다');
  assert.deepEqual(seen,[['items-held-round','items_patch_unconfirmed']]);
  assert.equal(h.writes.length,0,'확인 대기 선수는 쓰지 않는다');assert.equal(h.c.itemsWriteBusy(),true,'수정은 재시도 목록에 남는다');
  // 확인을 마치면 다음 회차가 그 수정을 올린다
  h.c.itemsReviewKeys=()=>({});
  assert.equal(await roundGate(()=>h.c.itemsWriteFlush(),()=>{throw Error('no diagnostic expected');}),true);
  assert.equal(JSON.parse(h.disk.get('sq:a')).name,'Mine');assert.equal(h.c.itemsWriteBusy(),false);
});
test('other flush failures still stop the round',async()=>{
  const h=harness();seed(h,[p('a','A')]);h.hooks.write=()=>{throw Error('disk A');};
  await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),/disk A/);
  await assert.rejects(roundGate(()=>h.c.itemsWriteFlush(),()=>{}),/disk A/);
  const h2=harness();h2.unready();
  await assert.rejects(h2.c.itemsWriteReady([p('a','Mine')],options(h2,'a')),e=>e.psCode==='sync_confirm_missing');
  await assert.rejects(roundGate(()=>h2.c.itemsWriteFlush(),()=>{}),e=>e.psCode==='sync_confirm_missing','확인 못 한 수정(held 아님)은 예전처럼 멈춘다');
});
