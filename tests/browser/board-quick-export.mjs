import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.115 — 오류 제보 0077af18 «화면 캡쳐했을때 걸리적 거려요»: 캡처하면 위쪽 막대(평면 · 3D · 선수 모양)가 판 가운데 찍혔다.
// 위쪽 막대 오른쪽 «내보내기» → PNG 이미지 · PDF 문서(A4 한 장)가 바로 받아진다. 장면 막대 «내보내기 ▾»에도 PDF.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=path.join(SHOTS,'quick-export-'+engine);fs.mkdirSync(out,{recursive:true});
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!!document.getElementById('tbExport'),null,{timeout:30000});
  // 저장 창(showSaveFilePicker)이 없는 브라우저처럼 — 바로 내려받기로 받는다
  /* 헤드리스 크로미움은 iframe 안 내려받기 이름을 «download»로만 알린다 — 링크에 붙은 이름을 직접 적어 둔다 */
  await f.evaluate(()=>{ try{ delete window.showSaveFilePicker; }catch(_){} window.showSaveFilePicker=undefined;
    const click=HTMLAnchorElement.prototype.click;window.__qxNames=[];HTMLAnchorElement.prototype.click=function(){if(this.download)window.__qxNames.push(this.download);return click.call(this);};
    pushUndo();state.players.push({id:'qx1',team:'blue',num:'9',name:'가상 공격수',x:420,y:300},{id:'qx2',team:'red',num:'4',x:640,y:330});renderTokens(); });
  await page.waitForTimeout(400);

  // 1) 단추는 위쪽 막대 오른쪽 덩어리, «저장» 앞. 글자가 보인다
  const bar=await f.evaluate(()=>{const b=document.getElementById('tbExport'),r=b.getBoundingClientRect(),R=b.parentElement;
    return {inRight:R.classList.contains('tb-r'),order:[...R.children].map(n=>n.id).filter(Boolean),text:b.textContent.trim(),w:r.width,h:r.height,disp:getComputedStyle(b).display};});
  assert.ok(bar.inRight,'오른쪽 덩어리 '+JSON.stringify(bar));
  assert.ok(bar.order.indexOf('tbExport')<bar.order.indexOf('boardManualSave'),'«저장» 앞 '+JSON.stringify(bar));
  assert.equal(bar.text,'내보내기');assert.ok(bar.w>50&&bar.h>=24,'글자 단추 '+JSON.stringify(bar));assert.match(bar.disp,/flex/,'아이콘과 글자가 한 줄');

  // 2) 누르면 PNG · PDF 메뉴, 바깥을 누르거나 Esc 면 닫힌다
  const menu=()=>f.evaluate(()=>{const m=document.getElementById('ps-tb-export');return {on:m.classList.contains('on'),items:[...m.querySelectorAll('[data-qx]')].map(b=>b.querySelector('.qx-l').textContent),exp:document.getElementById('tbExport').getAttribute('aria-expanded')};});
  await f.click('#tbExport');
  let m=await menu();assert.deepEqual([m.on,m.items,m.exp],[true,['PNG 이미지','PDF 문서'],'true'],JSON.stringify(m));
  await page.screenshot({path:path.join(out,'menu.png')});
  await f.press('#tbExport','Escape');m=await menu();assert.equal(m.on,false,'Esc');
  await f.click('#tbExport');await f.click('#tbBrand');m=await menu();assert.equal(m.on,false,'다른 단추를 누르면 닫힌다');
  await f.press('#tbBrand','Escape');

  // 3) PNG — 판 그림 한 장(예전 exportPNG 그대로)
  await f.click('#tbExport');
  let pending=page.waitForEvent('download');
  await f.click('#ps-tb-export [data-qx="png"]');
  let dl=await pending,dest=path.join(out,'board.png');await dl.saveAs(dest);
  let bytes=fs.readFileSync(dest);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.length>10000,'PNG '+bytes.length);
  assert.equal((await menu()).on,false,'고른 뒤 메뉴가 닫힌다');

  // 4) PDF — A4 가로 한 장, 판 그림(JPEG)
  await f.click('#tbExport');
  pending=page.waitForEvent('download');
  await f.click('#ps-tb-export [data-qx="pdf"]');
  dl=await pending;dest=path.join(out,'board.pdf');await dl.saveAs(dest);
  bytes=fs.readFileSync(dest);
  assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.4');
  assert.ok(bytes.includes(Buffer.from('/MediaBox [0 0 841.89 595.28]')),'가로 A4');assert.ok(bytes.includes(Buffer.from('/Count 1 ')),'한 장');
  assert.ok(bytes.includes(Buffer.from('/Filter /DCTDecode')),'판 그림');assert.ok(bytes.length>30000,'PDF '+bytes.length);

  const names=await f.evaluate(()=>window.__qxNames.slice());
  assert.equal(names.length,2,JSON.stringify(names));assert.match(names[0],/\.png$/);assert.match(names[1],/\.pdf$/);assert.equal(names[0].replace(/\.png$/,''),names[1].replace(/\.pdf$/,''),'같은 이름(작전판 · 페이지)');
  // 5) 로그인 전에는 받지 않고 알려 준다
  await f.evaluate(()=>{window.__qxUnlocked=window.psVaultUnlocked;window.psVaultUnlocked=()=>false;});
  let fired=false;const onDl=()=>{fired=true;};page.on('download',onDl);
  await f.click('#tbExport');await f.click('#ps-tb-export [data-qx="pdf"]');await page.waitForTimeout(800);
  assert.equal(fired,false,'로그인 전 — 파일 없음');
  assert.match(await f.evaluate(()=>document.getElementById('hint').textContent),/로그인하면 PNG · PDF 로 내보낼 수 있어요/);
  page.off('download',onDl);await f.evaluate(()=>{window.psVaultUnlocked=window.__qxUnlocked;});

  // 6) 장면 막대 «내보내기 ▾»: GIF · MP4 · PNG 아래 PDF
  await f.evaluate(()=>{ if(typeof ensureAnimMode==='function')ensureAnimMode(true); });
  await f.waitForFunction(()=>!!document.getElementById('cmd-export-btn'),null,{timeout:10000});
  await f.evaluate(()=>document.getElementById('cmd-export-btn').click());
  await f.waitForFunction(()=>{const p=document.getElementById('cmd-export-pop');return p&&p.classList.contains('on')&&!!document.getElementById('pdfBtn');});
  const pop=await f.evaluate(()=>[...document.getElementById('cmd-export-pop').querySelectorAll('.cmd-export-item')].map(b=>b.id));
  assert.deepEqual(pop.slice(-2),['pngBtn','pdfBtn'],JSON.stringify(pop));
  await page.screenshot({path:path.join(out,'dock-menu.png')});
  pending=page.waitForEvent('download');
  await f.evaluate(()=>document.getElementById('pdfBtn').click());
  dl=await pending;
  assert.match(await f.evaluate(()=>window.__qxNames.slice(-1)[0]),/\.pdf$/);
  assert.equal(await f.evaluate(()=>document.getElementById('cmd-export-pop').classList.contains('on')),false,'고른 뒤 닫힌다');
  // 다시 열어도 PDF 줄은 하나
  await f.evaluate(()=>document.getElementById('cmd-export-btn').click());await page.waitForTimeout(200);
  assert.equal(await f.evaluate(()=>document.querySelectorAll('#pdfBtn').length),1);

  const bad=logs.filter(l=>/quick-export|PSQuickExport|tbExport/i.test([l.url,l.text,l.stack].join(' ')));
  assert.deepEqual(bad,[],'오류 기록 없음');
  console.log(JSON.stringify({ok:true,engine,png:fs.statSync(path.join(out,'board.png')).size,pdf:fs.statSync(path.join(out,'board.pdf')).size}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close?.();
}
