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
  await page.evaluate(()=>{window.showSaveFilePicker=async()=>{const e=new Error('Cross origin sub frames');e.name='SecurityError';throw e;};});   // 3.206 — 창은 맨 위 창에서 연다
  const dl=page.waitForEvent('download',{timeout:20000});
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');
  await dl;
  assert.match(await hint(),/저장 위치 창을 열지 못해 다운로드 폴더에 받아요 \(SecurityError\)|PDF 저장됨/);
  const ev=await f.evaluate(()=>window.__ev.filter(x=>x[0]==='pdf_picker_failed'));
  assert.deepEqual(ev,[['pdf_picker_failed','SecurityError']]);
  assert.equal((await f.evaluate(()=>window.__dlNames)).length,1);

  // 3) 취소(AbortError) → 아무것도 받지 않고 기록도 없다
  await f.evaluate(()=>{window.showSaveFilePicker=async()=>{const e=new Error('cancel');e.name='AbortError';throw e;};});
  await page.evaluate(()=>{window.showSaveFilePicker=async()=>{const e=new Error('cancel');e.name='AbortError';throw e;};});
  const before=downloads;
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');await page.waitForTimeout(1500);
  assert.equal(downloads,before,'취소하면 내려받지 않는다');
  assert.equal((await f.evaluate(()=>window.__ev.filter(x=>x[0]==='pdf_picker_failed'))).length,1,'취소는 기록하지 않는다');

  // 4) 3.205 — 저장 창이 뜨는 사이 한 번 더 눌러도(맥 크롬 «File picker already active») 창은 하나 · 알림만 · 내려받기 · 기록 없음, 고른 곳에 한 번 쓴다
  // (3.206 — 창은 맨 위 창에서 열리므로 가짜 저장 창과 셈은 맨 위 창에; 창이 뜬 것처럼 blur 를 보낸다)
  await page.evaluate(()=>{window.__pickCalls=0;window.__written=[];window.showSaveFilePicker=()=>{window.__pickCalls++;window.dispatchEvent(new Event('blur'));return new Promise(r=>{window.__pickResolve=r;});};});
  await f.evaluate(()=>{window.showSaveFilePicker=()=>window.top.showSaveFilePicker();});
  const dl0=downloads;
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');
  await page.waitForFunction(()=>window.__pickCalls===1,null,{timeout:5000});
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>window.__pickCalls),1,'저장 창은 한 번만 연다');
  assert.match(await hint(),/저장 창이 이미 열려 있어요/);
  await page.evaluate(()=>{window.__pickResolve({name:'한 번.pdf',createWritable:async()=>({write:async b=>{window.__written.push(b.size);},close:async()=>{}})});});
  await page.waitForFunction(()=>window.__written.length===1,null,{timeout:20000});
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>window.__written.length),1,'고른 곳에 한 번만 쓴다');
  assert.equal(downloads,dl0,'두 번째 누름이 내려받기를 만들지 않는다');
  assert.equal((await f.evaluate(()=>window.__ev.filter(x=>x[0]==='pdf_picker_failed'))).length,1,'«이미 열림»은 기록하지 않는다');
  // 크롬이 두 번째 창을 거절한 꼴(NotAllowedError … active)도 같다
  await page.evaluate(()=>{window.showSaveFilePicker=async()=>{const e=new Error("Failed to execute 'showSaveFilePicker' on 'Window': File picker already active.");e.name='NotAllowedError';throw e;};});
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');await page.waitForTimeout(1500);
  assert.equal(downloads,dl0,'거절을 «창 없음»으로 읽어 내려받지 않는다');
  assert.match(await hint(),/저장 창이 이미 열려 있어요/);
  assert.equal((await f.evaluate(()=>window.__ev.filter(x=>x[0]==='pdf_picker_failed'))).length,1);

  // 5) 3.206 — 저장 창은 같은 출처의 맨 위 창에서 연다(작전판은 iframe 안). 창이 떠서 초점을 잃으면(blur) 고를 때까지 기다린다
  await page.evaluate(()=>{window.__topCalls=0;window.__topWritten=[];window.showSaveFilePicker=async()=>{window.__topCalls++;window.dispatchEvent(new Event('blur'));
    return {name:'맨 위.pdf',createWritable:async()=>({write:async b=>{window.__topWritten.push(b.size);},close:async()=>{}})};};});
  await f.evaluate(()=>{window.__frameCalls=0;window.showSaveFilePicker=async()=>{window.__frameCalls++;throw new Error('frame picker must not be used');};});
  const dl5=downloads;
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');
  await page.waitForFunction(()=>window.__topWritten.length===1,null,{timeout:20000});
  assert.deepEqual(await page.evaluate(()=>[window.__topCalls,window.__topWritten.length]),[1,1]);
  assert.equal(await f.evaluate(()=>window.__frameCalls),0,'iframe 의 저장 창은 부르지 않는다');
  assert.equal(downloads,dl5,'맨 위 창의 손잡이에 썼으니 내려받기 없음');
  await page.waitForTimeout(600);
  // 6) 3.206 — 창이 안 뜨면(초점 그대로) 감시 시간 뒤 다운로드 폴더로 받고 알리며 silent 를 기록, 같은 창에서는 다시 묻지 않는다
  await page.evaluate(()=>{window.__topCalls=0;window.showSaveFilePicker=()=>{window.__topCalls++;return new Promise(()=>{});};});
  await f.evaluate(()=>{window.__psPdfSilentMs=700;});
  const dl6=page.waitForEvent('download',{timeout:20000});
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');
  await dl6;
  assert.equal(await page.evaluate(()=>window.__topCalls),1);
  assert.match(await hint(),/저장 창이 열리지 않아 다운로드 폴더에 받았어요|PDF 저장됨/);
  const silent=await f.evaluate(()=>window.__ev.filter(x=>x[0]==='pdf_picker_failed'));
  assert.deepEqual(silent.map(x=>x[1]),['SecurityError','silent']);
  assert.equal(await f.evaluate(()=>window.__psPdfPickerSilent),true);
  const dl7=page.waitForEvent('download',{timeout:20000});
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');
  await dl7;
  assert.equal(await page.evaluate(()=>window.__topCalls),1,'다음부터는 창을 부르지 않고 바로 받는다');
  console.log(JSON.stringify({ok:true,engine}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
