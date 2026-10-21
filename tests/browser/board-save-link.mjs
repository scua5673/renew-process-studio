import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.135 — 제보 0917a39f «저장 누르면 연결된 보관함에 저장이 된다고 했는데 그런 설정이 없고 보관함에 작성한 보드가 저장이 안됩니다».
// «저장»의 저장 창에서 «계속 편집»을 누르면(3.077) 새로고침 전까지 다시 묻지 않는데 «보관함 저장» 단추는 숨어 담을 길이 없었다 →
// «보드 ▾ › 보관함에 담기…». «저장» 단추 설명은 «보드 가져오기»로 가져온 자료라고 말한다. 저장 창 · 덮어쓰기 규칙(board-vault-save)은 그대로. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||'desktop';
const fx=await startFixture(),browsers={};
let cur='';
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.boardManualStatus&&window.boardManualStatus.__psTip,null,{timeout:30000});
  await page.waitForTimeout(800);
  const put=(team,num,nx,ny)=>f.evaluate(([team,num,nx,ny])=>{const u=n2u(nx,ny);state.players.push({id:uid++,team,num,x:u.x,y:u.y});renderTokens();boardSaveLive();},[team,num,nx,ny]);
  const save=()=>f.evaluate(()=>document.getElementById('boardManualSave').click());
  const libItem=name=>f.evaluate(async name=>{const lib=(await boardStore.get('cs_drill_lib_v1'))||[];const it=lib.find(x=>x.name===name);return it?{n:(it.snap.players||[]).length,libId:it.libId}:null;},name);
  await f.evaluate(()=>{state.players=[];renderTokens();});
  await put('blue',1,.2,.5);await put('blue',2,.3,.4);

  cur='tip';
  const tip=await f.evaluate(()=>document.getElementById('boardManualSave').title);
  assert.match(tip,/«보드 가져오기»로 가져온 자료가 있으면 그 자료에도 저장해요/,'설명 '+tip);
  assert.match(tip,/보관함에 담기…/);assert.doesNotMatch(tip,/이어져 있으면/,'«이어져 있으면»은 설정을 찾게 했다');

  cur='decline';
  await save();
  await f.waitForSelector('#pssCancel',{timeout:10000});
  await f.evaluate(()=>document.getElementById('pssCancel').click());
  await page.waitForTimeout(800);
  assert.equal(await f.evaluate(()=>window._boardVaultDeclined),true,'«계속 편집» — 거절 표식');
  await put('red',9,.7,.5);
  await save();await page.waitForTimeout(1500);
  assert.equal(await f.evaluate(()=>!!document.getElementById('pssOk')),false,'거절한 뒤의 «저장»은 묻지 않는다(3.077 그대로)');
  assert.equal(await libItem('내 전술 1'),null);

  cur='menu';
  await f.evaluate(()=>document.getElementById('tbBrand').click());
  await f.waitForFunction(()=>{const b=document.getElementById('tbVaultSave');return b&&b.offsetParent!==null;},null,{timeout:5000});
  const menu=await f.evaluate(()=>[...document.querySelectorAll('#ps-tb-menu>button')].map(b=>b.textContent.trim()));
  assert.ok(menu.indexOf('보관함에 담기…')>menu.indexOf('팀 유니폼'),'메뉴 맨 끝 '+menu.join('|'));
  await page.screenshot({path:path.join(SHOTS,`board-save-link-${engine}-${size}-menu.png`)});
  await f.evaluate(()=>document.getElementById('tbVaultSave').click());
  await f.waitForSelector('#pssOk',{timeout:10000});
  assert.equal(await f.evaluate(()=>document.getElementById('ps-tb-menu').classList.contains('on')),false,'메뉴는 닫힌다');
  await f.evaluate(()=>{document.getElementById('pssName').value='내 전술 1';document.getElementById('pssOk').click();});
  await f.waitForFunction(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).some(x=>x.name==='내 전술 1'),null,{timeout:10000});
  assert.equal((await libItem('내 전술 1')).n,3,'메뉴로 담은 자료 = 지금 판');
  assert.equal(await f.evaluate(()=>window._boardVaultDeclined),false,'담았으니 거절 표식은 푼다');
  // 다시 «저장» — 3.077 규칙 그대로: 저장 창에 «‘내 전술 1’에 덮어쓰기»(저절로 잇지 않는다 — 2.907)
  await put('red',10,.8,.4);
  await save();
  await f.waitForSelector('#pssOver',{timeout:10000});
  assert.equal(await f.evaluate(()=>document.getElementById('pssOver').textContent),'‘내 전술 1’에 덮어쓰기');
  assert.deepEqual(await f.evaluate(()=>window.__psPages.linkAll()),[],'새로 담은 자료와 페이지를 저절로 잇지 않는다');
  await f.evaluate(()=>document.getElementById('pssCancel').click());
  // 메뉴 항목은 띠를 다시 그려도 남는다
  await f.evaluate(()=>{window.__psPages.refresh();});await page.waitForTimeout(600);
  assert.equal(await f.evaluate(()=>!!document.querySelector('#ps-tb-menu>#tbVaultSave')),true,'다시 그린 메뉴에도');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'오류 없음');
  console.log('board-save-link ok');
}catch(e){ console.error('board-save-link failed at',cur); throw e; }
finally{ for(const b of Object.values(browsers))await b.close(); await fx.close(); }
