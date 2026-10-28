// 3.204 — 작전판 PDF 저장 위치(board-pdf-save.js): 아이패드 사파리처럼 저장 창이 없고 공유가 되면 다 만든 뒤 «파일에 저장»(공유 시트),
// 저장 창이 있는데 열지 못하면 까닭 알림 + ps_events + 내려받기, 취소(AbortError)는 아무것도 받지 않는다.
import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page}=await openApp(fx,'desktop',{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!!document.getElementById('tbExport')&&!!window.PSPdfSave,null,{timeout:30000});
  await f.evaluate(()=>{pushUndo();state.players.push({id:'ps1',team:'blue',num:'9',name:'가상 공격수',x:420,y:300});renderTokens();
    const click=HTMLAnchorElement.prototype.click;window.__dlNames=[];HTMLAnchorElement.prototype.click=function(){if(this.download)window.__dlNames.push(this.download);return click.call(this);};
    window.__ev=[];const S=window.PSSync||(window.PSSync={});const orig=S.event;S.event=function(n,p){window.__ev.push([n,p&&p.error_code]);return orig?orig.apply(this,arguments):undefined;};});
  await page.waitForTimeout(400);
  const hint=()=>f.evaluate(()=>(document.getElementById('hint')||{}).textContent||'');
  let downloads=0;page.on('download',()=>{downloads++;});

  // 1) 아이패드 사파리처럼: 저장 창 없음 · 터치 · 애플 UA · 공유 가능 → 진행 카드 «파일에 저장» → 공유 시트에 PDF 파일
  await f.evaluate(()=>{try{delete window.showSaveFilePicker;}catch(_){}window.showSaveFilePicker=undefined;
    Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get(){return 5;}});
    Object.defineProperty(navigator,'userAgent',{configurable:true,get(){return 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari';}});
    window.__shared=[];navigator.canShare=()=>true;navigator.share=(d)=>{window.__shared.push((d.files||[]).map(x=>[x.name,x.type,x.size]));return Promise.resolve();};});
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');
  await f.waitForFunction(()=>{const c=document.getElementById('psExpProg');return !!c&&[...c.querySelectorAll('button')].some(b=>b.textContent.trim()==='파일에 저장');},null,{timeout:20000});
  const card=await f.evaluate(()=>{const c=document.getElementById('psExpProg');return {t:c.querySelector('.pep-t').textContent,sub:c.querySelector('.pep-sub').textContent,acts:[...c.querySelectorAll('button')].map(b=>b.textContent.trim())};});
  assert.equal(card.t,'다 만들었어요');assert.match(card.sub,/파일에 저장.*폴더/);assert.deepEqual(card.acts.slice(0,2),['파일에 저장','내려받기']);
  await f.evaluate(()=>{[...document.querySelectorAll('#psExpProg button')].find(b=>b.textContent.trim()==='파일에 저장').click();});
  await f.waitForFunction(()=>window.__shared.length===1,null,{timeout:5000});
  const shared=await f.evaluate(()=>window.__shared[0]);
  assert.equal(shared.length,1);assert.match(shared[0][0],/\.pdf$/);assert.equal(shared[0][1],'application/pdf');assert.ok(shared[0][2]>30000,'PDF 크기 '+shared[0][2]);
  assert.equal(downloads,0,'공유 시트 길에서는 내려받지 않는다');assert.deepEqual(await f.evaluate(()=>window.__dlNames),[]);
  await f.waitForFunction(()=>!document.getElementById('psExpProg')||!document.getElementById('psExpProg').isConnected||getComputedStyle(document.getElementById('psExpProg')).display==='none',null,{timeout:8000}).catch(()=>{});

  // 2) 저장 창이 있는데 열지 못함(SecurityError) → 까닭 알림 · ps_events pdf_picker_failed · 다운로드 폴더로
  await f.evaluate(()=>{Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get(){return 0;}});
    window.showSaveFilePicker=async()=>{const e=new Error('Cross origin sub frames');e.name='SecurityError';throw e;};});
  const dl=page.waitForEvent('download',{timeout:20000});
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');
  await dl;
  assert.match(await hint(),/저장 위치 창을 열지 못해 다운로드 폴더에 받아요 \(SecurityError\)|PDF 저장됨/);
  const ev=await f.evaluate(()=>window.__ev.filter(x=>x[0]==='pdf_picker_failed'));
  assert.deepEqual(ev,[['pdf_picker_failed','SecurityError']]);
  assert.equal((await f.evaluate(()=>window.__dlNames)).length,1);

  // 3) 취소(AbortError) → 아무것도 받지 않고 기록도 없다
  await f.evaluate(()=>{window.showSaveFilePicker=async()=>{const e=new Error('cancel');e.name='AbortError';throw e;};});
  const before=downloads;
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');await page.waitForTimeout(1500);
  assert.equal(downloads,before,'취소하면 내려받지 않는다');
  assert.equal((await f.evaluate(()=>window.__ev.filter(x=>x[0]==='pdf_picker_failed'))).length,1,'취소는 기록하지 않는다');
  console.log(JSON.stringify({ok:true,engine}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
