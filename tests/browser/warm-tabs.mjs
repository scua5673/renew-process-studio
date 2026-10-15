import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.004 — 미리 띄우기는 기기를 본다. 데스크톱은 탭 아홉을 전부(2.252 그대로), 폰·아이패드는 이 기기에서 최근에 연 탭만(처음이면 팀 허브와 일정).
// 미리 띄우지 않은 탭도 누르면 열리고, 그 탭에 건네는 말(공용어의 «뒤로» 이름)은 뜬 뒤에 닿는다.
// 3.034 — 폰·아이패드는 그중 최근 둘까지. 보이던 채 강제 종료된 뒤의 부팅은 셸 안전장치가 가볍게(미리 띄우기 없음 · 작전판 평면).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop',lean=size!=='desktop';
const ALL=['fAnalysis','fBoard','fComm','fGameModel','fIdp','fLearning','fProcess','fScout','fScouting','fTerms'];
const fx=await startFixture(),browsers={};
try{
  const {page,logs,context}=await openApp(fx,size,{browsers});
  const loaded=()=>page.evaluate(()=>[...document.querySelectorAll('iframe')].filter(f=>f.getAttribute('src')).map(f=>f.id).sort());
  const settle=async()=>{ await page.waitForFunction(()=>!document.body.classList.contains('ps-booting')); await page.waitForTimeout(7600); };
  await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-ps-device')),lean?'ipad':'desktop');
  let now=await loaded();
  if(!lean){
    assert.deepEqual(now,ALL,'데스크톱은 전부 미리 띄운다');
  }else{
    assert.deepEqual(now,['fBoard','fProcess','fScout'],'아이패드 처음: 작전판 + 팀 허브·일정만');
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
    assert.deepEqual(now,['fBoard','fComm','fTerms'],'다음 부팅: 쓰던 탭만');
    // 14일이 지난 기록은 버린다 → 다시 처음과 같다
    await page.evaluate(()=>localStorage.setItem('ps_warm_tabs_v1',JSON.stringify({community:Date.now()-15*24*60*60*1000,terms:Date.now()+60000,evil:Date.now()})));
    await page.reload();
    await settle();
    assert.deepEqual(await loaded(),['fBoard','fProcess','fScout'],'낡은·앞선·모르는 기록은 세지 않는다');
    // 3.034 — 아홉을 다 썼어도 최근에 연 둘만(아이패드 «문제가 반복적으로 발생했습니다»)
    await page.evaluate(()=>{ const n=Date.now(),o={}; ['scout','process','idp','community','scouting','terms','analysis','gamemodel'].forEach((k,i)=>{ o[k]=n-(i+2)*3600000; }); o.learning=n-60000; o.idp=n-120000; localStorage.setItem('ps_warm_tabs_v1',JSON.stringify(o)); });
    await page.reload();
    await settle();
    assert.deepEqual(await loaded(),['fBoard','fIdp','fLearning'],'아홉 중 최근 둘');
    // 3.034 — 보이던 채 강제 종료된 페이지(이 탭의 «살아 있음» 표시가 sessionStorage 에 남음)를 사파리가 다시 열면:
    // 미리 띄우기 없이 · 작전판은 이번만 평면(3D 설정은 그대로) · 작전판에 알림
    await context.addInitScript(()=>{ if(window.top!==window)return; try{ if(sessionStorage.getItem('ps_test_crash')!=='1')return; sessionStorage.removeItem('ps_test_crash');
      sessionStorage.setItem('ps_boot_alive_v1',(Date.now()-8000)+'|1'); }catch(_){} });   /* 다 뜬(|1) 페이지가 8초 전에 죽었다 */
    await page.evaluate(()=>{ sessionStorage.setItem('ps_test_crash','1'); localStorage.setItem('ps_board_tilt3d','1'); localStorage.setItem('ps_tilt3d_touch_reset_v1','1'); });
    await page.reload();
    await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
    assert.equal(await page.evaluate(()=>window.__psSafeBoot),true,'앞 페이지가 죽은 것을 안다');
    let bf=await (await page.waitForSelector('#fBoard')).contentFrame();
    await bf.waitForFunction(()=>{ const t=document.getElementById('cs-ftoast'); return !!t&&/제대로 닫히지 않아 이번엔 가볍게 열었어요.*작전판도 이번만 평면/.test(t.textContent); },null,{timeout:20000});
    await page.waitForTimeout(7600);
    assert.deepEqual(await loaded(),['fBoard'],'가벼운 부팅: 작전판만');
    assert.equal(await bf.evaluate(()=>document.body.classList.contains('bc-tilt3d')),false,'작전판은 이번만 평면');
    assert.equal(await page.evaluate(()=>localStorage.getItem('ps_board_tilt3d')),'1','3D 설정은 그대로');
    assert.match(await page.evaluate(()=>sessionStorage.getItem('ps_boot_alive_v1')||''),/^\d+\|1$/,'이번 부팅도 지켜본다(다 떴다)');
    // 정상으로 다시 열면(pagehide 가 표시를 지운다) 다시 평소 부팅 — 최근 둘 · 3D 그대로
    await page.reload();
    await settle();
    assert.equal(await page.evaluate(()=>window.__psSafeBoot),false);
    bf=await (await page.waitForSelector('#fBoard')).contentFrame();
    assert.equal(await bf.evaluate(()=>document.body.classList.contains('bc-tilt3d')),true,'다음 부팅은 3D 그대로');
    assert.deepEqual(await loaded(),['fBoard','fIdp','fLearning'],'다음은 평소처럼 최근 둘');
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,loaded:await loaded()}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
