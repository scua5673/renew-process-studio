// 데스크톱 탭 종료 기록(studio/crash-breadcrumb.js · 제보 de2e508c): 맥 크롬 설치 앱이 «앗, 이런! 오류 코드: 5»로 거듭 꺼졌는데 서버엔 boot_after_crash 가 없었다
// (app.html 3.034 표식은 폰 · 아이패드만). 실제 앱(합성 팀 · 합성 서버)에서 ① 멀쩡히 닫기 · 새로고침 · 스스로 새로고침은 보내지 않고
// ② 렌더러를 죽이면(CDP Page.crash) 다음 부팅 — 같은 저장소의 새 창 — 이 boot_after_crash 한 줄을 보낸다: 화면 · 누른 단추 이름 · 힙 · 보관함 크기(내용 없음, 12칸).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,ready,A,WT} from '../fixtures/team-app.mjs';

const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps-crash-breadcrumb-browser';
fs.mkdirSync(out,{recursive:true});
const fx=await startFixture(),browsers={};let app;
/* 보관함 셋 — 하나는 크다(가장 큰 자료 KB 가 표식에 남는지) */
[400000,30000,30000].forEach((sz,i)=>{const it={libId:'CB'+i,type:'board',name:'가상 보관 자료 '+(i+1),folder:'',tags:[],savedAt:Date.now()-i*1000,createdBy:A,snap:{players:[]},overview:'x'.repeat(sz)};
  fx.lib.set(WT+'|'+it.libId,{workspace_id:WT,lib_id:it.libId,type:'board',name:it.name,folder:'',tags:[],pin:false,item:it,saved_at:it.savedAt,deleted_at:null,owner_id:A,private:false});});
const rows=()=>fx.calls.flatMap(c=>c.p==='/rest/v1/ps_events'&&Array.isArray(c.body)?c.body:[]).filter(r=>r.event_name==='boot_after_crash');
const marks=page=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ps_crash_crumb_v1:')));
const settle=async page=>{await ready(page);await page.evaluate(()=>PSCrashCrumb.checked);await page.waitForTimeout(2500);};
try{
  app=await openApp(fx,'desktop',{browsers});
  let {page}=app;const {context}=app;
  assert.equal(await page.evaluate(()=>typeof PSCrashCrumb&&document.documentElement.getAttribute('data-ps-device')),'desktop','the shell loads the module on desktop');
  await settle(page);
  if(engine==='chromium'){
    /* ── ① 표식: 탭 하나에 한 줄 · 잠금을 쥔다 · 작다 ── */
    const first=await page.evaluate(async()=>{PSCrashCrumb.flush();const k=Object.keys(localStorage).filter(k=>k.startsWith('ps_crash_crumb_v1:'));
      const held=(await navigator.locks.query()).held.map(l=>l.name).filter(n=>n.startsWith('ps-crash-alive:'));return {k,held,raw:localStorage.getItem(k[0])||'',id:PSCrashCrumb.id};});
    assert.deepEqual(first.k,['ps_crash_crumb_v1:'+first.id],'one marker for this tab');
    assert.deepEqual(first.held,['ps-crash-alive:'+first.id],'the tab holds its alive lock');
    assert.ok(first.raw.length<700,'the marker stays tiny: '+first.raw.length);
    assert.equal(rows().length,0,'a first boot reports nothing');

    /* ── ② 멀쩡히 떠나기는 죽음이 아니다: 새로고침 · 다른 문서로 떠났다 돌아오기 · 스스로 새로고침(__psBootMarkDone) ── */
    await page.reload({waitUntil:'domcontentloaded'});await settle(page);
    assert.equal((await marks(page)).length,1,'reload leaves only the new tab marker');
    await page.goto(fx.base+'/manifest.json',{waitUntil:'domcontentloaded'});
    assert.deepEqual(await marks(page),[],'leaving the app removes the marker');
    await page.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});await settle(page);
    await page.evaluate(()=>{window.__psBootMarkDone();location.reload();});
    await page.waitForFunction(()=>window.PSCrashCrumb&&document.readyState==='complete');await settle(page);
    assert.equal(rows().length,0,'reload · leave · self-reload are not crashes '+JSON.stringify(rows().map(r=>r.meta)));

    /* ── ③ 쓰는 중에 죽는다: 보관함을 열고(큰 목록 읽기) 단추를 누른 뒤 렌더러 종료 ── */
    await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
    const board=await (await page.$('#fBoard')).contentFrame();
    await board.waitForFunction(()=>((document.getElementById('dfCount')||{}).textContent||'').trim()==='3개',null,{timeout:20000});
    await page.waitForTimeout(1300);
    const before=await page.evaluate(()=>{PSCrashCrumb.flush();return PSCrashCrumb.state();});
    assert.match(before.v,/^design /,'the marker knows the open app: '+before.v);
    assert.match(before.v,/ f:fBoard /,'and the visible frame: '+before.v);
    assert.equal(before.n,3,'vault item count from the text the board already read');
    assert.ok(before.k>=440&&before.k<700,'vault KB '+before.k);
    assert.ok(before.g>=380&&before.g<=before.k,'largest item KB '+before.g);
    assert.ok(before.a.some(a=>/design/.test(a[0])),'the last pressed control is named: '+JSON.stringify(before.a));
    const deadId=await page.evaluate(()=>PSCrashCrumb.id);
    const cdp=await context.newCDPSession(page);
    const crashed=new Promise(r=>page.once('crash',r));
    cdp.send('Page.crash').catch(()=>{});
    await Promise.race([crashed,new Promise((_,j)=>setTimeout(()=>j(new Error('renderer did not crash')),15000))]);
    await page.close().catch(()=>{});

    /* ── ④ 다음 부팅(같은 저장소 · 새 창)이 한 줄을 보낸다 ── */
    const t0=Date.now();
    page=await context.newPage();page.setDefaultTimeout(45000);
    const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));
    await page.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});
    await ready(page);
    for(let i=0;i<80&&!rows().length;i++)await page.waitForTimeout(250);
    await page.waitForTimeout(2000);
    const got=rows();
    fs.writeFileSync(path.join(out,engine+'-results.json'),JSON.stringify({engine,before,rows:got},null,2));
    assert.equal(got.length,1,'exactly one boot_after_crash reaches the server');
    const ev=got[0],m=ev.meta;
    assert.deepEqual([ev.status,ev.feature,ev.device,ev.error_code],['error','app','desktop','D:design']);
    assert.match(String(ev.app_version),/^3\.\d{3}$/);
    assert.deepEqual(Object.keys(m).sort(),['age','heap','kb','lim','maxKb','min','mode','msg','n','peak','reason','stage'],'the twelve slots safeEventMeta keeps');
    for(const [k,v] of Object.entries(m))assert.ok(typeof v==='number'||['stage','msg','reason','mode'].includes(k),'numbers, and text only in step-name slots: '+k);
    assert.ok(m.age>=0&&m.age<=Math.ceil((Date.now()-t0)/1000)+5,'seconds since the dead tab last wrote '+m.age);
    assert.ok(m.min>=0&&m.min<10,'minutes the dead tab had been open '+m.min);
    assert.match(m.stage,/^load/,'boot stage of the dead tab: '+m.stage);
    assert.match(m.reason,/^design .*f:fBoard/,'what was on screen: '+m.reason);
    assert.match(m.msg,/design[^,]*~\d+/,'last pressed controls with seconds before the last write: '+m.msg);
    assert.match(m.mode,/^(browser|standalone|fullscreen|minimal-ui) \d+x\d+@[\d.]+ c\d+ m[\d.]+ (mac|win|linux|cros|other) (cr|ed)\d+$/,'display mode · screen · cores · memory · browser: '+m.mode);
    assert.deepEqual([m.n,m.kb,m.maxKb],[before.n,before.k,before.g],'vault size as last measured');
    assert.ok(m.heap>0&&m.peak>=m.heap&&m.lim>=m.heap,'JS heap MB (chromium) '+JSON.stringify([m.heap,m.peak,m.lim]));
    assert.ok(!/가상|보관 자료|example\.invalid/.test(JSON.stringify(ev)),'no names, titles or addresses');
    assert.ok(!(await marks(page)).includes('ps_crash_crumb_v1:'+deadId),'the dead marker is cleared');
    /* 다시 열어도 또 보내지 않는다 */
    await page.reload({waitUntil:'domcontentloaded'});await settle(page);
    assert.equal(rows().length,1,'no second row after another boot');
    assert.deepEqual(errors,[],'no runtime error');
    console.log(JSON.stringify({engine,passed:true,error_code:ev.error_code,meta:m}));
  }else{
    /* WebKit 실행기: Page.crash 가 없다 — 모듈이 조용히 돌고(오류 없음) 멀쩡한 새로고침을 죽음으로 세지 않는지만 본다 */
    await page.reload({waitUntil:'domcontentloaded'});await settle(page);
    assert.equal(rows().length,0,'a clean reload is not a crash');
    assert.deepEqual(app.logs.filter(x=>x.type==='pageerror'),[],'no runtime error');
    console.log(JSON.stringify({engine,passed:true,crash:'not simulated on this engine'}));
  }
}finally{
  if(app)await app.context.close().catch(()=>{});for(const browser of Object.values(browsers))await browser.close().catch(()=>{});await fx.close();
}
