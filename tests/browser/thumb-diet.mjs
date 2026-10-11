import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {startFixture,openApp,A,WT,WP,root} from '../fixtures/team-app.mjs';
// 3.005 — 옛 자료의 장면별 썸네일 정리. 실제 동기화(syncNow)로 본다:
//  ① 서버의 옛 줄(장면마다 썸네일)을 받으면 이 기기에는 장면 0 의 썸네일만 남는다
//  ② 옛 판이 받아 둔 무거운 사본(지난 회차에 확인한 그대로)은 정리하되 서버로 올리지 않는다 — 시각·순서 그대로, 다음 회차에도 조용하다
//  ③ 정말 고친 자료는 예전대로 올라가고, 가벼운 모습으로 올라간다
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const src=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8');
const cut=(from,to)=>{const a=src.indexOf(from),b=src.indexOf(to,a+from.length);assert.ok(a>0&&b>a,from);return src.slice(a,b);};
const ctx=vm.createContext({});
vm.runInContext(cut('function hash(s){','\n')+'\n'+cut('function libShareCopy(it){','\nfunction libHash(it)')+'\nthis.libHash=function(it){return hash(JSON.stringify(libShareCopy(it)));};',ctx);
const libHash=it=>ctx.libHash(JSON.parse(JSON.stringify(it)));
const TH=k=>'<svg xmlns="http://www.w3.org/2000/svg" data-k="'+k+'">'+'<rect width="9" height="9"/>'.repeat(60)+'</svg>';
const snap=k=>({pitchSpec:'fifa',players:[{id:101,team:'blue',num:'6',pos:'',x:400+k*10,y:300},{id:102,team:'red',num:'4',pos:'',x:520,y:330}],equipment:[],drawings:[],ball:{x:410,y:310,scale:.62},lines:true});
const T=Date.now()-40*24*60*60*1000;
const serverItem=(name,t)=>({type:'board',name,savedAt:t,snap:snap(0),frames:[0,1,2,3].map(k=>({snap:snap(k),hold:.6,dur:1,cap:'장면 '+k,thumb:TH('f'+k)}))});
const row=(wid,id,name,t)=>({workspace_id:wid,lib_id:id,type:'board',name,folder:'',tags:[],pin:false,item:serverItem(name,t),saved_at:t,deleted_at:null,owner_id:A,private:wid===WT});
const fx=await startFixture(),browsers={};
try{
  for(const wid of [WT,WP]){ fx.lib.set(wid+'|Lold1',row(wid,'Lold1','서버의 옛 자료 1',T)); fx.lib.set(wid+'|Lold2',row(wid,'Lold2','서버의 옛 자료 2',T+1000)); }
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
  const local=()=>page.evaluate(async()=>{const r=await storage.get('cs_drill_lib_v1');return JSON.parse((r&&r.value)||'[]');});
  const metaOf=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ps_sync_meta')||'{}'));
  const sync=async()=>{ await page.evaluate(()=>PSSync.syncNow('test')).catch(()=>{}); await page.waitForTimeout(2500); };
  let WID=WT,mark=0;
  const libWrites=()=>fx.writes.slice(mark).filter(w=>String(w.k).startsWith('ps_library:'));
  const shape=it=>({f:it.frames.map(f=>typeof f.thumb==='string'&&f.thumb?(/data-k="(\w+)"/.exec(f.thumb)||[])[1]:null),caps:it.frames.map(f=>f.cap),x:it.frames.map(f=>f.snap.players[0].x)});

  // 팀 공간과 개인 공간 둘 다 본다 — 팀 공간은 시각이 그대로인 지문 차이를 원래 조용히 넘기지만(v271), 개인 공간은 «고친 자료»로 보고 지금 시각을 찍어 올린다
  for(const wid of [WT,WP]){
  WID=wid; mark=fx.writes.length;
  if(wid===WP){
    await page.evaluate(k=>{ const o=JSON.parse(localStorage.getItem('ps_vault_px_v1')||'{}'); o[k]=1; localStorage.setItem('ps_vault_px_v1',JSON.stringify(o)); },A+'|'+WP);   // 보관함 예시(3.001)를 이미 받은 사용자로
    await page.evaluate(w=>{ window.__sw=null; PSSync.switchWorkspace(w).then(r=>{window.__sw=r||'ok';}).catch(e=>{window.__sw={error:String(e&&e.message||e)};}); },WP).catch(()=>{});
    await page.waitForFunction(w=>{ try{ return !!window.PSSync&&PSSync.activeWs()===w&&!document.body.classList.contains('ps-booting')&&PSSync.dataUnlocked()===true; }catch(_){ return false; } },WP,{timeout:60000});
    await page.waitForTimeout(1500);
  }

  // ① 받기 — 서버의 옛 줄은 그대로 두고, 이 기기에는 장면 0 의 썸네일만
  let lib=[];
  for(let i=0;i<40&&lib.length<2;i++){ await sync(); lib=await local(); }
  assert.deepEqual(lib.map(d=>d.libId).sort(),['Lold1','Lold2']);
  for(const d of lib)assert.deepEqual(shape(d),{f:['f0',null,null,null],caps:['장면 0','장면 1','장면 2','장면 3'],x:[400,410,420,430]},d.libId+': 장면 0 의 썸네일만 · 판과 자막은 그대로');
  assert.deepEqual(libWrites(),[],'받기만 했다 — 서버에 쓴 것이 없다');
  // 보관함 화면이 카드 그림(지문 밖 · 서버에 올리지 않는 것)을 채워 넣을 수 있다 — 그 쓰기가 가라앉은 뒤에 다음 걸음으로
  await page.waitForTimeout(3000); await sync(); lib=await local();
  assert.equal(JSON.stringify(fx.lib.get(WID+'|Lold1').item.frames.map(f=>!!f.thumb)),'[true,true,true,true]','서버의 줄은 그대로');
  let m=await metaOf();
  assert.equal(m.ld,1,'이 공간은 정리를 마쳤다');
  const slimHash=m.li.Lold1.h;
  assert.equal(slimHash,libHash(lib.find(d=>d.libId==='Lold1')),'기준 지문은 가벼운 모습의 것');

  // ② 옛 판이 받아 둔 무거운 사본 — 지난 회차에 확인한 그대로(지문 일치)인 채로 이 판을 처음 만난다
  const refatten=async(edit)=>page.evaluate(async({TH,edit})=>{
    const r=await storage.get('cs_drill_lib_v1'),list=JSON.parse(r.value),m=JSON.parse(localStorage.getItem('ps_sync_meta'));
    const it=list.find(d=>d.libId==='Lold1'); it.frames.forEach((f,k)=>{ if(k)f.thumb=TH.replace('KEY','f'+k); });
    if(edit){ it.name=edit; it.editedAt=Date.now(); }
    await storage.set('cs_drill_lib_v1',JSON.stringify(list));
    const rev=String(Math.max(Date.now(),(+localStorage.getItem('cs_lib_rev')||0)+1)); localStorage.setItem('cs_lib_rev',rev);
    return {it,rev,ls:m.ls||null};
  },{TH:TH('KEY'),edit:edit||''});
  const order0=(await local()).map(d=>d.libId);
  let fat=await refatten('');
  assert.deepEqual(shape(fat.it).f,['f0','f1','f2','f3']);
  const fatHash=libHash(fat.it);
  assert.notEqual(fatHash,slimHash);
  await page.evaluate(({fatHash,rev})=>{ const m=JSON.parse(localStorage.getItem('ps_sync_meta')); m.li.Lold1.h=fatHash; delete m.ld; if(m.ls)m.ls.rev=rev; localStorage.setItem('ps_sync_meta',JSON.stringify(m)); },{fatHash,rev:fat.rev});
  const before0=fx.writes.length;
  await sync();
  lib=await local();
  const one=lib.find(d=>d.libId==='Lold1');
  assert.deepEqual(shape(one).f,['f0',null,null,null],'무거운 사본이 정리됐다(서버 서명이 그대로여도 한 번은 다 본다)');
  assert.deepEqual([one.savedAt,one.editedAt,one.name],[fat.it.savedAt,fat.it.editedAt,fat.it.name],'시각·이름은 그대로');
  assert.deepEqual(lib.map(d=>d.libId),order0,'보관함의 순서도 그대로');
  assert.deepEqual(fx.writes.slice(before0).filter(w=>String(w.k).startsWith('ps_library:')).map(w=>[w.m,w.k]),[],(wid===WT?'팀':'개인')+' 공간: 정리한 것을 서버로 올리지 않는다');
  m=await metaOf();
  assert.deepEqual([m.li.Lold1.h,m.ld],[slimHash,1],'기준 지문만 가벼운 모습의 것으로 옮겼다');
  const raw1=await page.evaluate(async()=>(await storage.get('cs_drill_lib_v1')).value);
  await sync();
  assert.equal(await page.evaluate(async()=>(await storage.get('cs_drill_lib_v1')).value),raw1,'다음 회차는 아무것도 바꾸지 않는다');
  assert.deepEqual(libWrites(),[]);

  // ③ 정말 고친 자료 — 예전대로 올라가고, 가벼운 모습으로 올라간다
  fat=await refatten('코치가 고친 이름');
  await sync();
  const sent=libWrites().filter(w=>w.k==='ps_library:Lold1');
  assert.ok(sent.length>=1,'고친 자료는 올라간다 '+JSON.stringify(fx.writes.slice(-3).map(w=>[w.m,w.k])));
  const up=JSON.parse(sent[sent.length-1].v);
  assert.equal(up.name,'코치가 고친 이름');
  assert.deepEqual(up.frames.map(f=>!!f.thumb),[true,false,false,false],'올라가는 모습도 장면 0 의 썸네일만');
  assert.deepEqual(up.frames.map(f=>f.snap.players[0].x),[400,410,420,430],'판은 그대로');
  assert.deepEqual(libWrites().filter(w=>w.k==='ps_library:Lold2'),[],'손대지 않은 자료는 끝까지 올라가지 않는다');
  assert.deepEqual(shape((await local()).find(d=>d.libId==='Lold1')).f,['f0',null,null,null]);
  }

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,spaces:['team','personal'],cases:['pull-slim','local-slim-no-push','idempotent','edited-pushes-slim']}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
