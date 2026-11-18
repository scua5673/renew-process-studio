import assert from 'node:assert/strict';
import {startFixture,openApp,A} from '../fixtures/team-app.mjs';
/* 저장 계층 정리 — 작업 보드 «보관 사본»(ps_private_board_draft_v1:<uid>:kept:…) 정리(studio/storage-kept.js · storage.js keptPrune)가 실제 저장소와 optimize 길에서 도는지.
   경계 밖(14일 · 주인마다 최신 8)은 IndexedDB 에서 지워지고, 작은 저장소 사본은 IndexedDB 로 옮겨진 뒤 걷히며(같은 자리에 다른 값이 있으면 :ls-<지문> 자리),
   지금 초안과 같은 원문은 남고, 지우기 전 ps_events storage_kept_pruned 가 이름 · 개수 · KB 만 싣고 나간다. 두 번째 optimize 는 할 일이 없다.
   고치기 전 코드(3.319)는 PSStorageKept 가 없어 첫 기다림에서 떨어진다. */
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={},fx=await startFixture();
try{
  const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
  fx.setStep('boot');
  await page.waitForFunction(()=>window.PSStorage&&window.PSStorageKept&&typeof PSStorage.sharedReady==='function'&&typeof PSStorage.optimize==='function');
  await page.evaluate(()=>PSStorage.sharedReady());
  /* 부팅 12초 뒤의 자동 정리(storage.js 끝)가 심기 전에 돌지 않게 — 오늘 돈 것으로 표시한다 */
  await page.evaluate(()=>{localStorage.setItem('ps_opt_board_recovery_v1','1');localStorage.setItem('ps_opt_auto_at',String(Date.now()));});
  fx.setStep('seed');
  const seeded=await page.evaluate(async({A})=>{
    const base='ps_private_board_draft_v1:'+encodeURIComponent(A),P=base+':kept:',now=Date.now(),H=3600000,DAY=86400000;
    const body=x=>JSON.stringify({view:'board',snap:{players:[{id:'synthetic',x}]},pad:'X'.repeat(20000)});
    const rec=(x,at)=>JSON.stringify({v:1,uid:A,wid:'synthetic-personal',raw:body(x),at});
    const idb={},ls={};
    idb[P+'unsaved-split-old']=rec(1,now-20*DAY);                                   /* 14일 넘음 — 지운다 */
    idb[P+'unsaved-split-new']=rec(2,now-2*H);                                      /* 남는다 */
    for(let i=0;i<10;i++)idb[P+'unsaved-'+(now-(3+i)*H)+'-r'+i]=rec(10+i,now-(3+i)*H);   /* 3~12시간 전 열 — 2시간 것 넷과 함께 최신 여덟만 */
    const draft=rec(7,now-1000);await storage.set(base+':unsaved',draft);           /* 지금 초안 */
    idb[P+'unsaved-split-protected']=JSON.stringify({v:1,uid:A,wid:'synthetic-personal',raw:JSON.parse(draft).raw,at:now-30*DAY});   /* 오래됐지만 지금 초안과 같은 원문 — 남는다 */
    ls[P+'lsold-x-1']=rec(100,now-30*DAY);                                          /* 작은 저장소 · 오래됨 */
    ls[P+'lstwin-x-2']=rec(101,now-2*H);idb[P+'lstwin-x-2']=rec(102,now-2*H);         /* 작은 저장소 · 같은 자리에 다른 값 → :ls-<지문> 자리로 */
    ls[P+'lsfree-x-3']=rec(103,now-2*H);                                            /* 작은 저장소 · 빈 자리 → 그 자리로 */
    for(const [k,v] of Object.entries(idb))await storage.set(k,v);
    for(const [k,v] of Object.entries(ls))localStorage.setItem(k,v);
    return {base,P,twin:ls[P+'lstwin-x-2'],twinIdb:idb[P+'lstwin-x-2'],free:ls[P+'lsfree-x-3'],draft,mark:PSStorageKept.mark(ls[P+'lstwin-x-2']),
      ls:Object.keys(localStorage).filter(k=>k.startsWith(P)).length,idb:(await storage.keys(P)).length};
  },{A});
  assert.equal(seeded.ls,3);assert.equal(seeded.idb,14);
  fx.setStep('optimize');
  const r=await page.evaluate(async()=>{const r=await PSStorage.optimize();return r.keptPruned;});
  console.log(JSON.stringify({engine,keptPruned:r}));
  assert.ok(r&&r.stage==='ps_private_board_draft_v1:kept','optimize 결과에 보관 사본 정리 통계');
  assert.equal(r.n,8,'20일 · 30일 것 둘 + 최신 여덟 밖의 여섯(3.124 옛 사본 정리가 먼저 옮긴 작은 저장소 사본도 IndexedDB 에서 센다)');
  assert.equal(r.ls+r.idb,8);assert.equal(r.left,9);assert.ok(r.mv>=1&&r.mv<=3,'작은 저장소 사본 옮김(같은 자리에 다른 값이 있던 것은 꼭 여기서)');
  fx.setStep('after');
  const after=await page.evaluate(async({base,P,twin,twinIdb,free,draft,mark})=>{
    const keys=(await storage.keys(P)).sort(),get=async k=>{const v=await storage.get(k);return v&&v.value;};
    return {keys,ls:Object.keys(localStorage).filter(k=>k.startsWith(P)),
      twinKept:(await get(P+'lstwin-x-2'))===twinIdb,twinMoved:(await get(P+'lstwin-x-2:ls-'+mark))===twin,freeMoved:(await get(P+'lsfree-x-3'))===free,
      draftKept:(await get(base+':unsaved'))===draft,protectedKept:keys.includes(P+'unsaved-split-protected'),newKept:keys.includes(P+'unsaved-split-new'),oldGone:!keys.includes(P+'unsaved-split-old')&&!keys.includes(P+'lsold-x-1')};
  },seeded);
  assert.deepEqual(after.ls,[],'작은 저장소의 보관 사본은 전부 걷혔다');
  assert.equal(after.keys.length,9,JSON.stringify(after.keys));
  for(const k of ['twinKept','twinMoved','freeMoved','draftKept','protectedKept','newKept','oldGone'])assert.equal(after[k],true,k);
  assert.deepEqual(after.keys.filter(k=>/-r[0-9]$/.test(k)).map(k=>k.slice(-2)).sort(),['r0','r1','r2','r3'],'열 중 최신 넷(2시간 것 넷과 함께 여덟)');
  fx.setStep('event');
  const rows=()=>fx.calls.flatMap(c=>c.p==='/rest/v1/ps_events'&&Array.isArray(c.body)?c.body:[]).filter(x=>x.event_name==='storage_kept_pruned');
  for(let i=0;i<40&&!rows().length;i++)await page.waitForTimeout(250);
  const ev=rows();
  assert.equal(ev.length,1,'지우기 전 한 줄');
  assert.equal(ev[0].status,'ok');assert.equal(ev[0].feature,'storage');
  assert.deepEqual(Object.keys(ev[0].meta).sort(),['idb','kb','leftKb','left','ls','mv','mvKb','n','stage'].sort());
  assert.equal(ev[0].meta.stage,'ps_private_board_draft_v1:kept');assert.equal(ev[0].meta.n,8);
  const flat=JSON.stringify(ev[0].meta);
  for(const bad of [A,'synthetic','XXXX','lstwin','unsaved-split'])assert.ok(!flat.includes(bad),'보내지 않는다: '+bad);
  fx.setStep('again');
  const again=await page.evaluate(async()=>{const r=await PSStorage.optimize();return r.keptPruned;});
  assert.equal(again.n,0);assert.equal(again.mv,0);
  await page.waitForTimeout(1500);
  assert.equal(rows().length,1,'두 번째는 할 일이 없어 기록도 없다');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);
  console.log(JSON.stringify({engine,passed:true,left:after.keys.length,event:ev[0].meta}));
  await context.close();
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
