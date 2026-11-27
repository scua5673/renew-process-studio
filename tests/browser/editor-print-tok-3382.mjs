// 3.382 — 훈련 만들기 화면과 인쇄의 토큰이 한 크기(사용자 11/27 «출력될때와 보관함 훈련만들기 보드에서는 선수 토큰 크기가 다르게 보여» → «화면 크기로»).
// 편집기는 2.705 부터 토큰을 화면에서만 ×0.68 로 그리고 썸네일 · 인쇄 · 내보내기는 ×1 이라, 같은 훈련이 종이에서 운동장 대비 1.46 배 컸다.
// 편집기 화면 · 썸네일 · 인쇄 미리보기(훈련 하나 · 둘)의 토큰 지름을 운동장 단위로 재어 같다고 본다 + 불러오기 크기는 [3]×0.68(3.381 에 화면에서 보이던 크기).
// 폰은 작전판이 보기 전용이라 편집기가 없다 — 크롬 데스크톱 · 웹킷 아이패드. 고치기 전 코드는 첫 단정(편집기 29.6 · 인쇄 43.2 단위)에서 떨어진다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const sizes=(process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop')).split(',').map(s=>s.trim()).filter(Boolean);
const out=path.join(process.cwd(),'test-results','editor-print-tok-3382');fs.mkdirSync(out,{recursive:true});
const fx=await startFixture(),browsers={};
try{
  for(const size of sizes){
    const {page}=await openApp(fx,size,{browsers});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{const b=document.querySelector('#appSeg [data-app="board"]:not([data-train])');if(b)b.click();});
    const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
    await f.waitForFunction(()=>typeof applySquadToBoard==='function'&&typeof printDrill==='function'&&window.__boardReady&&window.__boardRestoreDone,null,{timeout:30000});
    await f.evaluate(()=>{window.__psNoDraft=true;openEditor(null);});
    await f.waitForFunction(()=>document.body.classList.contains('editing'),null,{timeout:15000});
    await page.waitForTimeout(1000);
    // ① 편집기 — 선수 불러오기 → 화면의 토큰 지름(운동장 단위)
    const ed=await f.evaluate(()=>{
      squad.players=[['GK',1],['RB',2],['CB',4],['CB',5],['LB',3],['CM',6],['CM',8],['AM',10],['RW',7],['LW',11],['ST',9]].map(([pos,num],i)=>({id:'s'+i,name:'선수'+(i+1),pos,num}));
      const L=tokScaleLevels();state.players=[];state.tokenScale=L[0];applySquadToBoard({});renderTokens();
      const ctm=document.querySelector('#board').getScreenCTM(),c=[...document.querySelectorAll('#tokenLayer [data-id] .tok-c')].map(e=>e.getBoundingClientRect().width);
      return {scale:state.tokenScale,want:Math.round(L[3]*0.68*100)/100,n:c.length,u:Math.max(...c)/ctm.a,thumb:boardThumbSVG(),snap:JSON.parse(JSON.stringify(captureSnap()))};});
    assert.ok(ed.n>=11,'선수가 올라갔다 '+ed.n);
    assert.equal(ed.scale,ed.want,'불러오기는 [3]×0.68(3.381 에 화면에서 보이던 크기)');
    assert.ok(!/scale\(1\.47/.test(ed.thumb),'썸네일에 ×1/0.68 보정이 없다');
    await page.screenshot({path:path.join(SHOTS,`editor-print-tok-3382-${size}-1-editor.png`)});
    // ② 인쇄 미리보기 — 훈련 하나(세로 한 장) · 훈련 둘(현장 시트)
    const tr={name:'론도 4v2',minutes:12,sets:1,snap:ed.snap,thumb:ed.thumb};
    const log={size,editor:{scale:ed.scale,u:Math.round(ed.u*10)/10}};
    for(const [tag,trs] of [['one',[tr]],['two',[tr,Object.assign({},tr,{name:'패스 앤 무브'})]]]){
      await f.evaluate(trs=>{try{localStorage.setItem('ps_pdf_per_page','4');}catch(_){};printDrill({name:'화요일',trainings:trs});},trs);
      await f.waitForFunction(()=>{const d=document.getElementById('ppbFrame').contentDocument;return !!d&&d.readyState==='complete'&&!!d.querySelector('.page svg .tok-c');},null,{timeout:10000});
      await page.waitForTimeout(500);
      const pr=await f.evaluate(()=>{const d=document.getElementById('ppbFrame').contentDocument,sv=d.querySelector('.page svg');const ctm=sv.getScreenCTM();const c=[...sv.querySelectorAll('.tok-c')].map(e=>e.getBoundingClientRect().width);return {n:c.length,u:Math.max(...c)/ctm.a};});
      log[tag]=Math.round(pr.u*10)/10;
      assert.ok(pr.n>=11,'인쇄에 선수가 있다 '+tag);
      assert.ok(Math.abs(pr.u-ed.u)/ed.u<0.03,'인쇄의 토큰 = 편집기 화면의 토큰('+tag+') '+JSON.stringify({print:pr.u,editor:ed.u}));
      await (await f.$('#ppbFrame')).screenshot({path:path.join(SHOTS,`editor-print-tok-3382-${size}-2-print-${tag}.png`)});
      await f.click('#ppbClose');await page.waitForTimeout(300);
    }
    // ③ 작전판(편집기 밖)에서 같은 판 — 같은 저장 크기면 운동장 대비 같은 지름
    const bd=await f.evaluate(snap=>{document.body.classList.remove('editing');loadSnap(snap);renderTokens();const ctm=document.querySelector('#board').getScreenCTM(),c=[...document.querySelectorAll('#tokenLayer [data-id] .tok-c')].map(e=>e.getBoundingClientRect().width);const u=Math.max(...c)/ctm.a;document.body.classList.add('editing');renderTokens();return u;},ed.snap);
    log.board=Math.round(bd*10)/10;
    assert.ok(Math.abs(bd-ed.u)/ed.u<0.03,'작전판도 같은 지름 '+JSON.stringify({board:bd,editor:ed.u}));
    log.passed=true;fs.writeFileSync(path.join(out,size+'.json'),JSON.stringify(log,null,2));
    console.log(JSON.stringify({test:'editor-print-tok-3382',engine,...log}));
  }
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
