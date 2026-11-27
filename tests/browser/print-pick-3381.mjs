// 3.381 — 보관함 훈련 파일 PDF «넣을 훈련» 줄(board-print-pick.js · 문서 저장소 목업 UI-보관함-훈련-골라인쇄 A안).
// 훈련 여섯 · 한 장에 4개 = 2쪽 → 칩 1 · 6 끄기 = 1쪽(번호 2 · 3 · 4 · 5 · 머리글 4개) → 한 장에 1개 = 4쪽 → 마지막 하나는 남음 →
// «모두» → PDF 내려받기도 고른 쪽만(데스크톱) → 닫고 다시 열면 전부 → 훈련 하나는 줄 없음. 세 폭(데스크톱 1280 · 아이패드 1100 · 폰 375) 실측.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';   /* 크롬 잡 = 데스크톱 · 웹킷 잡 = 아이패드 · 폰(SIZES 의 엔진 그대로) */
const sizes=(process.env.PS_SIZE||(engine==='webkit'?'ipad,phone':'desktop')).split(',').map(s=>s.trim()).filter(Boolean);
const out=path.join(process.cwd(),'test-results','print-pick-3381');fs.mkdirSync(out,{recursive:true});
const fx=await startFixture(),browsers={};
const TR=[['웜업 론도 4v2',12,1],['패스 앤 무브 삼각형',15,1],['3v2 전환',6,3],['포지션 게임 7v7+3',20,1],['SSG 8v8 하프',24,1],['쿨다운',8,1]]
  .map(([name,minutes,sets],i)=>({name,minutes,sets,focus:'att',rpe:5,setup:'방법 '+(i+1),coaching:'코칭 '+(i+1)}));
try{
  for(const size of sizes){
    const log={size,steps:[]};
    const {page}=await openApp(fx,size,{browsers});
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{const b=document.querySelector('#appSeg [data-app="board"]:not([data-train])');if(b)b.click();});
    const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
    await f.waitForFunction(()=>typeof printDrill==='function'&&window.__boardReady&&window.__boardRestoreDone&&!!window.PSPrintPick,null,{timeout:30000});
    await page.waitForTimeout(500);
    const st=()=>f.evaluate(()=>{
      const row=document.getElementById('ppbPick'),fr=document.getElementById('ppbFrame'),doc=fr&&fr.contentDocument,chips=[...row.querySelectorAll('.ppb-chip')];
      const R=e=>{const r=e.getBoundingClientRect();return {l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)};};
      return {open:document.getElementById('printPrevB').classList.contains('on'),hidden:row.hidden,disp:getComputedStyle(row).display,
        chips:chips.length,on:chips.filter(c=>c.classList.contains('on')).map(c=>+c.dataset.pi),dis:chips.filter(c=>c.getAttribute('aria-disabled')==='true').map(c=>+c.dataset.pi),
        cnt:(row.querySelector('.ppb-cnt')||{}).textContent||'',all:!!row.querySelector('[data-pall]'),
        pages:doc?doc.querySelectorAll('.page').length:-1,nos:doc?[...doc.querySelectorAll('.fsx-no')].map(n=>n.textContent):[],
        head:doc&&doc.querySelector('.fsx-sm')?doc.querySelector('.fsx-sm').textContent:'',
        vw:innerWidth,sw:document.documentElement.scrollWidth,row:R(row),rowSW:row.scrollWidth,rowCW:row.clientWidth,
        chipH:chips.length?Math.min(...chips.map(c=>c.getBoundingClientRect().height)):0,
        nmShown:chips.length?getComputedStyle(chips[0].querySelector('.ppb-nm')).display!=='none':null,
        bar:R(document.querySelector('#printPrevB .ppb-bar')),frame:R(fr)};});
    const pages=n=>f.waitForFunction(n=>{const d=document.getElementById('ppbFrame').contentDocument;return !!d&&d.readyState==='complete'&&d.querySelectorAll('.page').length===n;},n,{timeout:10000});
    const chip=i=>f.click('#ppbPick [data-pi="'+i+'"]');
    const open=d=>f.evaluate(d=>{printDrill(d);},d);

    // ① 열기 — 칩 여섯 · 전부 켜짐 · 2쪽(4 + 2 와 빈 칸 둘 — 고르기 없으면 예전 통번호)
    await f.evaluate(()=>{try{localStorage.setItem('ps_pdf_per_page','4');}catch(_){}});
    await open({name:'화요일 MD-4',trainings:TR});await pages(2);
    let s=await st();log.steps.push({open:s});
    assert.ok(s.open&&!s.hidden&&s.disp==='flex','줄이 보인다 '+JSON.stringify(s));
    assert.equal(s.chips,6);assert.deepEqual(s.on,[0,1,2,3,4,5]);assert.equal(s.all,false);assert.match(s.cnt,/^6\/6 · 97분$/);
    assert.deepEqual(s.nos,['1','2','3','4','5','6','7','8']);assert.match(s.head,/97분.*6개/);
    // 세 폭 실측 — 판 가로 넘침 없음 · 줄은 화면 안 · 누르는 칸 30px 이상 · 폰은 이름 숨김(번호 · 분) · 넓은 화면은 줄바꿈(옆 스크롤 없음)
    assert.ok(s.sw<=s.vw+1,'가로 넘침 '+JSON.stringify(s));assert.ok(s.row.l>=0&&s.row.r<=s.vw+1,'줄이 화면 안 '+JSON.stringify(s.row));
    assert.ok(s.chipH>=30,'칩 높이 '+s.chipH);
    if(s.vw<=640){assert.equal(s.nmShown,false,'폰 칩은 번호 · 분만');}else{assert.equal(s.nmShown,true);assert.ok(s.rowSW<=s.rowCW+1,'넓은 화면은 옆으로 안 민다 '+JSON.stringify(s));}
    assert.ok(s.row.t>=s.bar.b-1&&s.frame.t>=s.row.b-1,'막대 → 줄 → 미리보기 차례 '+JSON.stringify([s.bar,s.row,s.frame]));
    await page.screenshot({path:path.join(SHOTS,`print-pick-3381-${size}-1-open.png`)});

    // ② 1 · 6 끄기 → 1쪽 · 번호 2 · 3 · 4 · 5 · 머리글은 고른 것만
    await chip(0);await pages(2).catch(()=>{});await chip(5);await pages(1);
    s=await st();log.steps.push({off16:s});
    assert.deepEqual(s.on,[1,2,3,4]);assert.equal(s.all,true);assert.match(s.cnt,/^4\/6 · 77분$/);
    assert.deepEqual(s.nos,['2','3','4','5'],'번호는 파일 순서 그대로');assert.match(s.head,/77분.*4개/);
    await page.screenshot({path:path.join(SHOTS,`print-pick-3381-${size}-2-picked.png`)});

    // ③ 한 장에 1개 → 4쪽 · 고른 것 그대로
    await f.click('#ppbPerWrap [data-pp="1"]');await pages(4);
    s=await st();assert.deepEqual(s.on,[1,2,3,4],'한 장에 N개를 바꿔도 고른 것 유지');assert.deepEqual(s.nos,['2','3','4','5']);

    // ④ 셋 더 끄기 → 마지막 하나(5번)는 끌 수 없다
    await chip(1);await pages(3);await chip(2);await pages(2);await chip(3);await pages(1);
    s=await st();assert.deepEqual(s.on,[4]);assert.deepEqual(s.dis,[4]);assert.deepEqual(s.nos,['5']);
    await f.click('#ppbPick [data-pi="4"]',{force:true});await page.waitForTimeout(400);   /* aria-disabled — 눌러도 그대로 */
    s=await st();assert.deepEqual(s.on,[4],'마지막 하나는 남는다');assert.equal(s.pages,1);

    // ⑤ PDF 내려받기도 고른 쪽만(데스크톱 크로미움 — 래스터 길)
    if(size==='desktop'&&engine==='chromium'){
      await chip(1);await pages(2);
      const n=await f.evaluate(async()=>{const fr=document.getElementById('ppbFrame');const b=await _ppbPdfBlobFromDocument(fr.contentDocument,fr.classList.contains('land'));const t=await b.text();return (t.match(/\/Type\s*\/Page(?!s)/g)||[]).length;});
      assert.equal(n,2,'PDF 쪽 수 = 고른 훈련 수(한 장에 1개)');log.steps.push({pdfPages:n});
    }

    // ⑥ «모두» → 여섯 · 6쪽
    await f.click('#ppbPick [data-pall]');await pages(6);
    s=await st();assert.deepEqual(s.on,[0,1,2,3,4,5]);assert.equal(s.all,false);assert.deepEqual(s.nos,['1','2','3','4','5','6']);

    // ⑦ 끄고 닫았다 다시 열면 전부 켜진 채(고른 것은 저장하지 않는다)
    await chip(2);await pages(5);await f.click('#ppbClose');
    await open({name:'화요일 MD-4',trainings:TR});await pages(6);
    s=await st();assert.deepEqual(s.on,[0,1,2,3,4,5],'다시 열면 전부');

    // ⑧ 훈련 하나인 파일은 줄 없음(세로 한 장)
    await f.click('#ppbClose');await open({name:'한 개',trainings:[TR[0]]});await pages(1);
    s=await st();assert.ok(s.hidden&&s.disp==='none'&&s.chips===0,'하나뿐이면 줄 없음 '+JSON.stringify(s));
    await f.click('#ppbClose');
    await f.evaluate(()=>{try{localStorage.setItem('ps_pdf_per_page','4');}catch(_){}});
    log.passed=true;fs.writeFileSync(path.join(out,size+'.json'),JSON.stringify(log,null,2));
    console.log(JSON.stringify({size,passed:true,vw:log.steps[0].open.vw,row:log.steps[0].open.row,chipH:log.steps[0].open.chipH}));
  }
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
