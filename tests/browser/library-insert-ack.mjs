import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.891 — 보관함 새 항목 INSERT 가 저장은 됐는데 빈 응답을 받아도(응답 유실·프록시) 기기와 서버의
// 항목이 지워지지 않는다. 옛 코드는 기기에서 지우고 묘비를 남겨 다음 회차에 서버 행까지 삭제했다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const results=[];
for(const emptyLibraryInsert of [true,false]){
  const fx=await startFixture({emptyLibraryInsert}),browsers={};
  try{
    const {page}=await openApp(fx,size,{browsers});
    await page.waitForTimeout(4000);
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>typeof window.__psOpenFormation==='function');
    /* 2.953 — 폰 보기 전용 작전판엔 «포메이션으로 시작» 문이 없다. 시험은 문 대신 같은 동작(__psOpenFormation)으로 카드를 연다 */
    if(await f.evaluate(()=>{const d=document.getElementById('ehDoor');return !!d&&getComputedStyle(d).display!=='none';}))await f.locator('#ehDoor').click();
    else await f.evaluate(()=>window.__psOpenFormation());await f.locator('.eh-f',{hasText:'4-3-3'}).first().click();
    const go=f.locator('#ehGo');await go.scrollIntoViewIfNeeded();await go.click();await page.waitForTimeout(1500);
    /* 2.939 — 폰에는 «보관함» 저장 버튼이 보이지 않는다. 보관함 저장 경로는 같으므로 숨은 원래 버튼을 코드로 눌러 확인한다 */
    if(await f.evaluate(()=>{const e=document.getElementById('vaultSave');return !!e&&getComputedStyle(e).display!=='none';}))await f.locator('#vaultSave').click();
    else await f.evaluate(()=>document.getElementById('vaultSave').click());await f.getByRole('button',{name:'보관함에 저장',exact:true}).last().click();
    await page.waitForFunction(fx=>true,null);await page.waitForTimeout(3000);
    await page.evaluate(()=>PSSync.syncNow('test')).catch(()=>{});await page.waitForTimeout(6000);
    const local=await page.evaluate(async()=>{const r=await storage.get('cs_drill_lib_v1');return {items:JSON.parse((r&&r.value)||'[]').length,tombs:JSON.parse(localStorage.getItem('ps_tomb_v1')||'[]').length};});
    const server=[...fx.lib.values()];
    assert.equal(local.items,1,'the saved library item stays on the device');
    assert.equal(local.tombs,0,'no deletion tombstone is created');
    assert.equal(server.length,1);assert.ok(!server[0].deleted_at,'the server row is not deleted');
    results.push({emptyLibraryInsert,local,serverRows:server.length});
  }finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
}
console.log(JSON.stringify({engine,passed:true,results}));
