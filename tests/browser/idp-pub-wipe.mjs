import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES,WT,A} from '../fixtures/team-app.mjs';
/* 3.077 — 닫을 때 지운 코치 피드백(cs_idp_pub_v1_<uid>)을 다시 받기 전에 쓰면 서버본이 한 항목짜리로 덮이던 길(가상 팀 재현 9 → 1).
   진짜 앱 · 진짜 동기화(sync.js) · 진짜 닫기 정리(PSSync.cache.wipe = pagehide 가 부르는 wipeTeamCacheSoft)로 본다.
   ① 열기 → 받기 ② 닫으며 지우기 ③ 다시 열되 받기를 붙잡는다(fx.holdKvPull) ④ 그 틈에 코치가 한 줄 — 페이지 저장 함수
   (idp.html pubPushAt)가 로컬 문서가 없을 때 하는 그대로 {} 에서 쓴다 — 그 사이 다른 코치도 서버본에 목표 하나
   ⑤ 받기를 풀면: 서버본 · 다른 코치 목표 · 새 한 줄이 모두 남는다 ⑥ 그 뒤의 평소 삭제는 되살아나지 않는다.
   가상 fixture(루프백 서버)만 쓴다 — 운영 Supabase · 실계정 없음. */
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
SIZES.ipad.engine=engine;
const P='22222222-2222-4222-8222-222222222222',PUB='cs_idp_pub_v1_'+P,DOC='cs_idp_v1_'+P;
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
const put=(k,v,cupd=1000)=>fx.db.set(WT+'|'+k,{workspace_id:WT,k,v:JSON.stringify(v),cupd,updated_by:A});
put('cs_perms_v1',{members:{[A]:{role:'executive'},[P]:{role:'player',playerId:'vp01'}},defaultRole:'player'});
put(DOC,{v:1,profile:{name:'가상 선수 1'},selfEval:{levels:{}},trainings:[],log:{}});
const seed={v:1,
  reviews:[{id:'r1',at:'2026-09-01',by:'가상 코치',strengths:['가상 강점']},{id:'r2',at:'2026-09-15',by:'가상 코치',strengths:['가상 강점 2']},{id:'r3',at:'2026-10-01',by:'가상 코치',strengths:['가상 강점 3']}],
  goals:[{id:'g1',t:'가상 목표 1',by:'가상 코치',at:1},{id:'g2',t:'가상 목표 2',by:'가상 코치',at:2}],
  talk:[{id:'t1',t:'가상 대화 1',by:'가상 코치',at:3},{id:'t2',t:'가상 대화 2',by:'가상 코치',at:4}],
  reacts:{'day:2026-10-01':{h:1,by:'가상 코치',at:5},'day:2026-10-02':{h:1,t:'가상 답글',by:'가상 코치',at:6}}};
put(PUB,seed);
const srv=()=>JSON.parse(fx.db.get(WT+'|'+PUB).v);
const ids=d=>({reviews:(d.reviews||[]).map(x=>x.id),goals:(d.goals||[]).map(x=>x.id),talk:(d.talk||[]).map(x=>x.id),reacts:Object.keys(d.reacts||{}).sort()});
async function settle(page,pred,label){
  for(let i=0;i<20;i++){await page.evaluate(()=>PSSync.syncNow('idp-pub-wipe-test')).catch(()=>{});if(pred())return;await page.waitForTimeout(500);}
  assert.fail('서버가 기대 상태가 되지 않았다: '+label+' — '+JSON.stringify(ids(srv())));
}
try{
  step('open');
  const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
  await page.waitForFunction(k=>!!localStorage.getItem(k),PUB,{timeout:30000});
  assert.deepEqual(ids(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),PUB))),ids(seed),'처음 받은 사본');

  step('close-wipe');
  await page.waitForTimeout(15500);   /* 열자마자의 닫기는 지우지 않는다(wipeAllowedNow — 연 지 15초) */
  const wiped=await page.evaluate(()=>PSSync.cache.wipe());
  assert.ok(wiped>0,'닫기 정리가 팀 사본을 지웠다');
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),PUB),null,'공개 피드백 사본도 지워졌다');

  step('reopen-gap');
  const release=fx.holdKvPull();
  await page.close();
  const p2=await context.newPage();p2.setDefaultTimeout(45000);
  p2.on('pageerror',e=>logs.push({step:cur,type:'pageerror',text:String(e.message)}));
  await p2.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  await p2.waitForFunction(()=>window.PSSync&&PSSync.dataUnlocked()&&PSSync.activeWs(),null,{timeout:30000});
  await p2.waitForTimeout(1500);
  const gap=await p2.evaluate(([a,b])=>({pub:localStorage.getItem(a),doc:localStorage.getItem(b),flag:!!localStorage.getItem('ps_cache_wiped_v1')}),[PUB,DOC]);
  assert.equal(gap.pub,null,'받기 전 — 공개 피드백 사본이 없다');assert.ok(gap.flag,'닫기 정리 표시');
  /* idp.html pubPushAt(kk,'talk',item) 과 같은 일 — 로컬 문서가 없으면 {} 에서 시작해 한 줄을 넣고 저장한다 */
  await p2.evaluate(k=>{var r=JSON.parse(localStorage.getItem(k)||'null')||{};if(!Array.isArray(r.talk))r.talk=[];r.talk.push({id:'t-gap',t:'받기 전에 쓴 피드백',by:'가상 코치',at:Date.now()});localStorage.setItem(k,JSON.stringify(r));},PUB);
  /* 그 사이 다른 코치가 같은 선수에게 목표 하나(서버 판 1000 → 2000) */
  put(PUB,Object.assign({},seed,{goals:seed.goals.concat([{id:'g-other',t:'다른 코치 목표',by:'가상 코치 B',at:7}])}),2000);

  step('release');
  release();
  await settle(p2,()=>ids(srv()).talk.includes('t-gap'),'새 한 줄이 올라간다');
  assert.deepEqual(ids(srv()),{reviews:['r1','r2','r3'],goals:['g1','g2','g-other'],talk:['t1','t2','t-gap'],reacts:['day:2026-10-01','day:2026-10-02']},'서버본 · 다른 코치 목표 · 새 한 줄이 모두 남는다');
  assert.ok(!fx.writes.some(w=>w.k===PUB&&w.v&&JSON.parse(w.v).reviews===undefined),'한 항목짜리 문서는 한 번도 올라가지 않았다');
  await p2.waitForFunction(([k,n])=>{try{return JSON.parse(localStorage.getItem(k)).talk.length===n;}catch(_){return false;}},[PUB,3],{timeout:15000});
  assert.deepEqual(ids(JSON.parse(await p2.evaluate(k=>localStorage.getItem(k),PUB))),ids(srv()),'이 기기 사본도 합친 판');

  step('normal-delete');
  /* 합친 판이 확정된 뒤의 평소 삭제(코치 목표 지우기 — cgSetAt 처럼 지금 문서에서 하나를 뺀다)는 그대로 올라간다 */
  await p2.evaluate(k=>{var r=JSON.parse(localStorage.getItem(k));r.goals=r.goals.filter(function(g){return g.id!=='g1';});localStorage.setItem(k,JSON.stringify(r));},PUB);
  await settle(p2,()=>!ids(srv()).goals.includes('g1'),'지운 목표가 서버에서 빠진다');
  assert.deepEqual(ids(srv()).goals,['g2','g-other'],'지운 목표는 되살아나지 않는다');
  assert.equal(await p2.evaluate(k=>{var m=JSON.parse(localStorage.getItem('ps_sync_meta')||'{}');return !!(m.w&&m.w[k]);},PUB),false,'닫기 표가 걷혔다');
  const pe=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(pe,[],JSON.stringify(pe.slice(0,3)));
  console.log(JSON.stringify({engine,test:'idp-pub-wipe',ok:true,wiped,gap:{pub:'missing',playerDoc:gap.doc===null?'missing':'present'}}));
}catch(e){console.error('[idp-pub-wipe] step='+cur);throw e;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
