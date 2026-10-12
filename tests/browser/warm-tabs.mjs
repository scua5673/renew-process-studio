import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.004 — 미리 띄우기는 이 기기에서 최근에 연 탭만(처음이면 팀 허브와 일정). 3.008 — 데스크톱은 팀 허브·일정은 늘 + 쓰던 탭(전부 띄우기는 처음 온 사람에게도 탭 아홉을 받게 했다).
// 미리 띄우지 않은 탭도 누르면 열리고, 그 탭에 건네는 말(공용어의 «뒤로» 이름)은 뜬 뒤에 닿는다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop',lean=size!=='desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  const loaded=()=>page.evaluate(()=>[...document.querySelectorAll('iframe')].filter(f=>f.getAttribute('src')).map(f=>f.id).sort());
  const settle=async()=>{ await page.waitForFunction(()=>!document.body.classList.contains('ps-booting')); await page.waitForTimeout(7600); };
  await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-ps-device')),size);
  let now=await loaded();
  {
    assert.deepEqual(now,['fBoard','fProcess','fScout'],size+' 처음: 작전판 + 팀 허브·일정만');
    // 안 띄운 탭을 누르면 그때 읽는다
    await page.evaluate(()=>window.__psShowApp('community'));
    const c=await (await page.waitForSelector('#fComm')).contentFrame();
    await c.waitForSelector('#prSeg');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('fComm')).display),'block');
    // 안 띄운 탭에 건네는 말은 뜬 뒤에 닿는다 — 일정에서 공용어를 열면 «뒤로»의 이름이 «일정»
    await page.evaluate(()=>window.postMessage({source:'process',type:'openTerms'},location.origin));
    const t=await (await page.waitForSelector('#fTerms')).contentFrame();
    await t.waitForFunction(()=>{ const l=document.getElementById('tmBackLbl'); return !!l&&l.textContent==='일정'; });
    assert.deepEqual(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('ps_warm_tabs_v1')||'{}')).sort()),['community','terms'],'연 탭을 적어 둔다');
    // 다음에 열면 쓰던 탭을 미리 띄운다(팀 허브·일정은 쓰지 않았으니 누를 때)
    await page.reload();
    await settle();
    now=await loaded();
    assert.deepEqual(now,lean?['fBoard','fComm','fTerms']:['fBoard','fComm','fProcess','fScout','fTerms'],lean?'다음 부팅: 쓰던 탭만':'다음 부팅: 팀 허브·일정 + 쓰던 탭');
    // 14일이 지난 기록은 버린다 → 다시 처음과 같다
    await page.evaluate(()=>localStorage.setItem('ps_warm_tabs_v1',JSON.stringify({community:Date.now()-15*24*60*60*1000,terms:Date.now()+60000,evil:Date.now()})));
    await page.reload();
    await settle();
    assert.deepEqual(await loaded(),['fBoard','fProcess','fScout'],'낡은·앞선·모르는 기록은 세지 않는다');
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,loaded:await loaded()}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
