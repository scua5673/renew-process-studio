// 큰 보관함(82개 · 20MB — 제보 de2e508c 의 크기)을 열 때의 «통째 읽기» 예산. 보관함은 목록 한 덩어리(cs_drill_lib_v1)라 읽기 한 번마다
// 20MB 글 + 해석한 객체가 새로 생기고, 크로미움 렌더러 메모리(RSS)가 100~140MB 잠깐 오른다. 고치기 전 실측: 다시 연 앱에서 보관함을 열면 작전판이 3번 읽고
// (setView 그리기 · board-vault-lazy flush · 로그인 알림) 335MB 를 만들었으며, 숨은 일정 틀은 목록 전체(40MB)를 앱이 떠 있는 내내 쥐고 저장 때마다 다시 읽었다.
// 이제: 보관함 열기 = 작전판 읽기 2번(읽는 중인 읽기는 같이 쓴다 — 로그인 알림 몫 하나는 그대로) · 만든 양 예산(크로미움 CDP 할당 표본) ·
// 숨은 일정은 보일 때 한 번 읽고 장면 본문은 내려놓는다 · 부팅 뒤 JS 힙 45MB 아래.
// 자료 모양은 실제 저장기를 본떴다: 페이지 × 장면 8, 본 페이지의 장면마다 한글이 든 썸네일 SVG 약 70KB(두 바이트 글). 합성 팀 fixture 에서만 돈다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,A,WT} from '../fixtures/team-app.mjs';

const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps-vault-open-memory-browser';
fs.mkdirSync(out,{recursive:true});
const N=82,LIB='cs_drill_lib_v1',ALLOC_BUDGET_MB=260,BOOT_HEAP_BUDGET_MB=45;
/* ── 합성 보관함 ── */
let seq=0;
const thumb=()=>{const id='th'+(seq++).toString(36).padStart(5,'0');let s='<svg class="board" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1110 740"><g id="world_'+id+'"><rect width="1110" height="740" fill="#15172b"/>';
  for(let i=0;s.length<70000;i++)s+='<path d="M'+(i*7%1100)+' '+(i*13%740)+'l12 3l-4 9z" fill="#2c7" data-k="'+id+i+'"/><text x="'+(i%900)+'" y="'+(i%700)+'">가상'+(i%23)+'</text>';return s+'</g></svg>';};
const snap=k=>({pitchSpec:'fifa',players:Array.from({length:22},(_,i)=>({id:1000+i,team:i%2?'blue':'red',num:String(i%11+1),name:'가상선수'+i,pos:'',x:200+i*35+k*3,y:250+(i*53)%300,color:null})),equipment:[],ball:null,
  drawings:Array.from({length:6},(_,d)=>({type:'pencil',id:'d'+d,color:'#fff',w:3,pts:Array.from({length:40},(_,q)=>[200+q*9+d*3+k,300+Math.round(40*Math.sin(q/3+d))])})),orientation:'h',pitchN:1,tokenScale:1});
function item(i,target){
  const per=JSON.stringify(snap(0)).length+40,P=Math.max(1,Math.min(12,Math.round(target/(8*(per+70100)))));let left=Math.max(0,Math.floor((target-P*9*per)/70100));const pages=[];
  for(let p=0;p<P;p++){const frames=[];for(let k=0;k<8;k++){const f={snap:snap(p*8+k),dur:1,curves:{}};if(left>0){f.thumb=thumb();left--;}frames.push(f);}
    pages.push({name:'페이지 '+(p+1),snap:snap(p*8),thumb:frames[0].thumb?thumb():'',anim:{frames,active:0,title:'',hold:.6,titleColor:'#e23b3b'}});}
  return {libId:'VM'+String(i).padStart(3,'0'),type:'board',name:'합성 작전판 '+(i+1),folder:'',snap:snap(0),tags:[],savedAt:Date.now()-i*60000,frames:pages[0].anim.frames.map(f=>({snap:f.snap,dur:1,curves:{}})),pages,createdBy:A,createdByName:'가상 코치'};
}
const fx=await startFixture(),browsers={};
const big=[3337,2593,1698,1585,1543,1329,1269,1168].map(k=>k*1000),rest=Math.floor((20e6-big.reduce((a,b)=>a+b,0))/(N-8));let total=0;
for(let i=0;i<N;i++){const it=item(i,(i<8?big[i]:rest)*0.83);total+=JSON.stringify(it).length;   /* 0.83 — 페이지 대표 썸네일 몫을 빼 합계를 20MB 로 */
  fx.lib.set(WT+'|'+it.libId,{workspace_id:WT,lib_id:it.libId,type:'board',name:it.name,folder:'',tags:[],pin:false,item:it,saved_at:it.savedAt,deleted_at:null,owner_id:A,private:false});}
assert.ok(total>18e6&&total<23e6,'synthetic vault ≈ 20MB: '+total);
let app;
try{
  app=await openApp(fx,'desktop',{browsers});
  const {page,context,logs}=app;
  const unlocked=()=>page.waitForFunction(()=>window.PSSync&&PSSync.dataUnlocked&&PSSync.dataUnlocked(),null,{timeout:90000});
  const boardFrame=async()=>(await page.$('#fBoard')).contentFrame();
  const openVault=async()=>{const bf=await boardFrame();await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
    await bf.waitForFunction(n=>((document.getElementById('dfCount')||{}).textContent||'').trim()===n+'개',N,{timeout:120000});return bf;};
  await unlocked();await page.waitForTimeout(6000);
  /* 처음 한 번 열어 받은 자료의 대표 썸네일을 기기에 남긴다(받은 자료엔 thumb 이 없다 — 1.526). 그 뒤 «다시 연 앱»을 잰다 */
  await openVault();await page.waitForTimeout(6000);
  /* 프레임마다 window.storage 의 보관함 통째 읽기 · 쓰기를 센다 */
  await context.addInitScript(key=>{
    const who=()=>{try{return (window.frameElement&&window.frameElement.id)||'shell';}catch(_){return '?';}};
    const hook=()=>{const s=window.storage;if(!s||s.__vmCount)return !!s;s.__vmCount=1;const g=s.get,st=s.set;
      const add=op=>{try{const t=window.top;t.__vm=t.__vm||{};const k=op+':'+who();t.__vm[k]=(t.__vm[k]||0)+1;t.__vmAt=Date.now();}catch(_){}};
      s.get=function(k){if(k===key)add('get');return g.apply(this,arguments);};s.set=function(k){if(k===key)add('set');return st.apply(this,arguments);};return true;};
    if(!hook()){const iv=setInterval(()=>{if(hook())clearInterval(iv);},2);setTimeout(()=>clearInterval(iv),20000);}
  },LIB);
  const take=()=>page.evaluate(()=>{const r=window.__vm||{};window.__vm={};return r;});
  const quiet=ms=>page.waitForFunction(ms=>Date.now()-(window.__vmAt||0)>ms,ms,{timeout:120000,polling:250});
  await page.reload({waitUntil:'domcontentloaded'});await unlocked();await page.waitForTimeout(8000);await quiet(2500);
  const bootReads=await take();
  assert.equal(bootReads['get:fBoard']||0,0,'a closed vault is not read by the board (3.146): '+JSON.stringify(bootReads));

  /* ── 일정 사본: 숨은 채 부팅해도 장면 본문은 쥐지 않는다 ── */
  const sched=await page.evaluate(()=>{const w=document.getElementById('fProcess').contentWindow;const c=w.eval('__psLibCache');
    return {n:c.length,anim:c.some(d=>d&&Array.isArray(d.pages)&&d.pages.some(p=>p&&p.anim)),pages:c[0].pages.length,page0:Object.keys(c[0].pages[0]).sort().join(),chars:JSON.stringify(c).length,defer:!!w.__psLibDefer};});
  assert.equal(sched.n,N,'the schedule still lists every vault item');
  assert.equal(sched.anim,false,'without per-page scene lists');
  assert.equal(sched.page0,'name,snap,thumb','pages keep what the schedule reads: '+sched.page0);
  assert.ok(sched.chars<total*0.45,'the schedule copy is well under half the vault text: '+sched.chars+' of '+total);
  assert.equal(sched.defer,true,'hidden-refresh deferral installed');

  let cdp=null,result={engine,total,bootReads,sched};
  if(engine==='chromium'){
    cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.collectGarbage');const boot=(await cdp.send('Runtime.getHeapUsage')).usedSize/1e6;
    result.bootHeapMB=Math.round(boot);
    assert.ok(boot<BOOT_HEAP_BUDGET_MB,'JS heap after boot (vault closed, GC) '+boot.toFixed(0)+'MB — budget '+BOOT_HEAP_BUDGET_MB+'MB (56MB when the schedule kept the whole vault, 28MB now)');
    await cdp.send('HeapProfiler.startSampling',{samplingInterval:65536,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
  }
  /* ── 보관함 열기: 작전판 읽기 한 번 ── */
  const bf=await openVault();await quiet(3000);
  const openReads=await take();result.openReads=openReads;
  if(cdp){const {profile}=await cdp.send('HeapProfiler.stopSampling');let sum=0;(function walk(n){sum+=n.selfSize||0;(n.children||[]).forEach(walk);})(profile.head);
    result.openAllocMB=Math.round(sum/1e6);}
  /* 웹킷 실행기는 다시 보일 때 로그인 알림이 한 번 더 올 수 있다(3.176) — 그 읽기는 늘 새로 읽는 몫이다 */
  assert.ok(openReads['get:fBoard']>=1&&openReads['get:fBoard']<=(engine==='chromium'?2:3),'opening the vault: the first draw and the lazy flush share one read, the login notice reads once (3 before): '+JSON.stringify(openReads));
  assert.equal(openReads['set:fBoard']||0,0,'and writes nothing');
  assert.equal(openReads['get:fProcess']||0,0,'the hidden schedule does not read');
  const share=await bf.evaluate(()=>window.__psVaultShare&&window.__psVaultShare.stats);
  assert.ok(share&&share.shared>=1,'a render request that arrived while reading shared that read: '+JSON.stringify(share));
  const names=await bf.evaluate(()=>document.getElementById('drillFiles').textContent);
  assert.ok(names.includes('합성 작전판 1')&&names.includes('합성 작전판 '+N),'the list is drawn');
  if(cdp)assert.ok(result.openAllocMB<ALLOC_BUDGET_MB,'allocation while opening the vault '+result.openAllocMB+'MB — budget '+ALLOC_BUDGET_MB+'MB (335MB before)');

  /* ── 바뀐 뒤에는 새로 읽는다 · 숨은 일정은 미룬다 ── */
  await bf.evaluate(async()=>{await libTurn(function(){return libGet().then(function(l){l.unshift({libId:'VMNEW',type:'board',name:'방금 담은 자료',folder:'',tags:[],savedAt:Date.now(),snap:{players:[]}});return libWrite(l).then(function(){libTouch();});});});renderDrillFiles();});
  await bf.waitForFunction(n=>((document.getElementById('dfCount')||{}).textContent||'').trim()===n+'개',N+1,{timeout:60000});await quiet(3000);
  const saveReads=await take();result.saveReads=saveReads;
  assert.ok(await bf.evaluate(()=>document.getElementById('drillFiles').textContent.includes('방금 담은 자료')),'the new item is drawn — a changed vault is read again');
  assert.ok(saveReads['get:fBoard']>=3&&saveReads['get:fBoard']<=4,'turn read · write check · redraw (+1 at most): '+JSON.stringify(saveReads));
  assert.equal(saveReads['get:fProcess']||0,0,'the hidden schedule postpones its re-read');
  assert.equal(await page.evaluate(()=>document.getElementById('fProcess').contentWindow.__psLibDefer.pending()),true,'and remembers that it owes one');
  /* 일정을 열면 그때 읽고 새 자료가 보인다 */
  await page.evaluate(()=>document.querySelector('[data-team-key="training"]').click());
  await page.waitForFunction(()=>document.getElementById('fProcess').getClientRects().length>0,null,{timeout:20000});
  await page.waitForFunction(()=>{const w=document.getElementById('fProcess').contentWindow;try{return w.eval('libDrills()').some(d=>d.libId==='VMNEW');}catch(_){return false;}},null,{timeout:60000});
  await quiet(2500);
  const showReads=await take();result.showReads=showReads;
  assert.equal(showReads['get:fProcess'],1,'one read when the schedule is shown: '+JSON.stringify(showReads));
  assert.equal(await page.evaluate(()=>{const w=document.getElementById('fProcess').contentWindow;return w.eval('__psLibCache').some(d=>d&&Array.isArray(d.pages)&&d.pages.some(p=>p&&p.anim));}),false,'still without scene lists');

  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'page errors');
  fs.writeFileSync(path.join(out,engine+'-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({engine,passed:true,vaultMB:+(total/1e6).toFixed(1),bootHeapMB:result.bootHeapMB,openAllocMB:result.openAllocMB,openReads,saveReads,showReads,share}));
}finally{
  if(app)await app.context.close().catch(()=>{});for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();
}
