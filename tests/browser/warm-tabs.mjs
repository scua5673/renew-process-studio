import assert from 'node:assert/strict';
import {startFixture,openApp,build} from '../fixtures/team-app.mjs';
// 3.004 — 미리 띄우기는 기기를 본다. 데스크톱은 탭 아홉을 전부(2.252 그대로), 폰·아이패드는 이 기기에서 최근에 연 탭만(처음이면 팀 허브와 일정).
// 미리 띄우지 않은 탭도 누르면 열리고, 그 탭에 건네는 말(공용어의 «뒤로» 이름)은 뜬 뒤에 닿는다.
// 3.034 — 폰·아이패드는 그중 최근 둘까지. 보이던 채 강제 종료된 뒤의 부팅은 셸 안전장치가 가볍게(미리 띄우기 없음 · 작전판 평면).
// 3.058 — 아이패드는 미리 띄우지 않는다(오류 제보 10/16 «경기 준비 열기 → 문제가 반복적으로 발생»). 폰은 3.034 대로 최근 둘(시험 엔진은 webkit=아이패드).
// 3.036 — 가벼운 부팅마저 죽으면 안전 모드: 작전판을 미리 열지 않고 안내 판(«작전판 열기» · «평소대로 열기»), 서버에 boot_after_crash(멈춘 뒤 다시 연 기록).
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
    assert.deepEqual(now,['fBoard'],'3.058 — 아이패드는 미리 띄우지 않는다: 작전판만(팀 허브·일정도 누를 때)');
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
    assert.deepEqual(now,['fBoard'],'3.058 — 다음 부팅에도 아이패드는 미리 띄우지 않는다(연 탭 기록은 남는다 — 폰은 그 기록으로 최근 둘)');
    // 14일이 지난 기록은 버린다 → 다시 처음과 같다
    await page.evaluate(()=>localStorage.setItem('ps_warm_tabs_v1',JSON.stringify({community:Date.now()-15*24*60*60*1000,terms:Date.now()+60000,evil:Date.now()})));
    await page.reload();
    await settle();
    assert.deepEqual(await loaded(),['fBoard'],'낡은·앞선·모르는 기록이어도 아이패드는 작전판만');
    // 3.034 — 아홉을 다 썼어도 최근에 연 둘만(아이패드 «문제가 반복적으로 발생했습니다»)
    await page.evaluate(()=>{ const n=Date.now(),o={}; ['scout','process','idp','community','scouting','terms','analysis','gamemodel'].forEach((k,i)=>{ o[k]=n-(i+2)*3600000; }); o.learning=n-60000; o.idp=n-120000; localStorage.setItem('ps_warm_tabs_v1',JSON.stringify(o)); });
    await page.reload();
    await settle();
    assert.deepEqual(await loaded(),['fBoard'],'3.058 — 아홉을 다 썼어도 아이패드는 작전판만(3.034 의 «최근 둘»은 폰)');
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
    assert.match(await page.evaluate(()=>sessionStorage.getItem('ps_boot_alive_v1')||''),/^\d+\|1\|(?:sync|load)w0(?:t\d+)?\|1$/,'이번 부팅도 지켜본다(다 떴다) — 3.036: 단계 · 미리 띄운 수 0 · 안전 단계 1');
    // 정상으로 다시 열면(pagehide 가 표시를 지운다) 다시 평소 부팅 — 최근 둘 · 3D 그대로
    await page.reload();
    await settle();
    assert.equal(await page.evaluate(()=>window.__psSafeBoot),false);
    bf=await (await page.waitForSelector('#fBoard')).contentFrame();
    assert.equal(await bf.evaluate(()=>document.body.classList.contains('bc-tilt3d')),true,'다음 부팅은 3D 그대로');
    assert.deepEqual(await loaded(),['fBoard'],'다음은 평소 부팅(아이패드는 미리 띄우지 않는다 · 3.058)');
    assert.equal(await page.evaluate(()=>window.__psSafeLevel),0);
    // 3.036 — 가벼운 부팅(안전 단계 1, 단계 t10 까지 갔다)마저 보이던 채 죽었다 → 안전 모드(단계 2):
    // 작전판을 미리 열지 않고 안내 판 · 셸은 작전판을 기다리지 않고 바로 보인다 · 다른 탭은 누르면 열린다 · 서버에 boot_after_crash · «작전판 열기»로 작전판(이번만 평면)
    await context.addInitScript(()=>{ if(window.top!==window)return; try{ if(sessionStorage.getItem('ps_test_crash2')!=='1')return; sessionStorage.removeItem('ps_test_crash2');
      sessionStorage.setItem('ps_boot_alive_v1',(Date.now()-8000)+'|1|t10|1'); }catch(_){} });
    const evFrom=fx.calls.length;
    await page.evaluate(()=>{ sessionStorage.setItem('ps_test_crash2','1'); });
    await page.reload();
    await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
    assert.equal(await page.evaluate(()=>window.__psSafeLevel),2,'가벼운 부팅이 죽은 것을 안다');assert.equal(await page.evaluate(()=>window.__psSafeBoot),true);
    assert.equal(await page.evaluate(()=>document.getElementById('fBoard').getAttribute('src')),null,'안전 모드: 작전판을 미리 열지 않는다');
    assert.equal(await page.locator('#psSafePanel').isVisible(),true,'안내 판');assert.equal(await page.locator('#psSafePanel h2').innerText(),'안전 모드로 열었어요');
    assert.equal(await page.locator('#psBootRetry').isVisible(),false,'«다시 열기»는 뜨지 않는다');
    await page.waitForTimeout(7600);
    assert.deepEqual(await loaded(),[],'안전 모드: 아무 탭도 미리 띄우지 않는다');
    assert.equal(await page.evaluate(()=>document.getElementById('fBoard').getAttribute('src')),null,'7초 뒤에도 작전판은 그대로 닫혀 있다');
    await page.evaluate(()=>window.__psShowApp('community'));
    const c2=await (await page.waitForSelector('#fComm')).contentFrame();await c2.waitForSelector('#prSeg');
    assert.equal(await page.locator('#psSafePanel').isVisible(),false,'다른 탭은 제 프레임을 보인다');
    await page.evaluate(()=>window.__psShowApp('board'));
    assert.equal(await page.locator('#psSafePanel').isVisible(),true,'작전판 탭으로 오면 다시 안내 판');
    for(let i=0;i<60&&!fx.calls.slice(evFrom).some(c=>c.p==='/rest/v1/ps_events'&&JSON.stringify(c.body||'').includes('boot_after_crash'));i++)await page.waitForTimeout(250);
    const crash=fx.calls.slice(evFrom).flatMap(c=>c.p==='/rest/v1/ps_events'&&Array.isArray(c.body)?c.body:[]).filter(r=>r.event_name==='boot_after_crash');
    assert.equal(crash.length,1,'멈춘 뒤 다시 연 기록 한 건');const ev=crash[0];
    assert.deepEqual([ev.status,ev.feature,ev.error_code,ev.device,ev.app_version],['error','app','L2','tablet',build]);
    assert.deepEqual([ev.meta.stage,ev.meta.loaded,ev.meta.prevLevel,ev.meta.level,ev.meta.w,ev.meta.h,ev.meta.standalone],['t10',1,1,2,1100,820,false]);
    assert.ok(ev.meta.age>=8&&ev.meta.age<60,'죽은 표시 뒤 초: '+ev.meta.age);assert.match(ev.meta.ua,/^Mozilla\/5\.0 \(iPad/);assert.equal(typeof ev.meta.dpr,'number');
    await page.locator('#psSafeOpen').click();
    assert.equal(await page.locator('#psSafeOpen').innerText(),'여는 중…','뜨는 동안 판은 남는다');
    bf=await (await page.waitForSelector('#fBoard[src]')).contentFrame();
    await page.waitForFunction(()=>document.getElementById('psSafePanel').hidden===true,null,{timeout:30000});
    await bf.waitForFunction(()=>typeof renderTokens==='function'&&typeof window.__setTilt==='function'&&window.__boardReady!==false,null,{timeout:30000});
    await page.waitForTimeout(800);
    assert.equal(await bf.evaluate(()=>document.body.classList.contains('bc-tilt3d')),false,'단추로 연 작전판은 이번만 평면');
    assert.equal(await page.evaluate(()=>localStorage.getItem('ps_board_tilt3d')),'1','3D 설정은 그대로');
    assert.deepEqual(await loaded(),['fBoard','fComm']);
    assert.match(await page.evaluate(()=>sessionStorage.getItem('ps_boot_alive_v1')||''),/^\d+\|1\|(?:board|boardload|sync|load)w0(?:t\d+)?\|2$/,'표시: 안전 단계 2');
    // 정상으로 다시 열면 평소 부팅(단계 0) — 3D 그대로 · 최근 둘(안전 모드에서 연 커뮤니티가 최근)
    await page.reload();
    await settle();
    assert.equal(await page.evaluate(()=>window.__psSafeLevel),0);assert.equal(await page.evaluate(()=>window.__psSafeBoot),false);
    assert.equal(await page.locator('#psSafePanel').isVisible(),false);
    bf=await (await page.waitForSelector('#fBoard')).contentFrame();
    assert.equal(await bf.evaluate(()=>document.body.classList.contains('bc-tilt3d')),true,'다음 부팅은 3D 그대로');
    assert.deepEqual(await loaded(),['fBoard'],'평소 부팅(아이패드는 미리 띄우지 않는다 · 3.058)');
    // «평소대로 열기» = app.html?safe=0 — 표시를 지우고 평소 부팅. 셸이 읽은 뒤 주소에서 safe 를 지운다(남기면 사파리가 강제 종료 뒤
    // 같은 주소로 다시 열 때마다 안전장치가 꺼진 채 반복된다)
    await page.evaluate(()=>{ sessionStorage.setItem('ps_test_crash2','1'); });
    await page.reload();
    await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
    assert.equal(await page.evaluate(()=>window.__psSafeLevel),2);
    await page.locator('#psSafeNormal').click();
    await page.waitForFunction(()=>window.__psSafeLevel===0&&!/safe=/.test(location.search));
    await settle();
    assert.equal(await page.evaluate(()=>[window.__psSafeLevel,window.__psSafeBoot,location.search,(sessionStorage.getItem('ps_boot_alive_v1')||'').split('|')[3]].join()),'0,false,,0','평소 부팅 · 주소에서 safe 지움 · 이번 표시는 단계 0');
    // 손 실험: ?safe=2 도 이번 부팅에만 — 주소에서 지운다
    await page.goto(page.url().split('?')[0]+'?safe=2',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
    assert.equal(await page.evaluate(()=>[window.__psSafeLevel,location.search].join()),'2,','safe=2 는 안전 모드로, 주소는 비움');
    assert.equal(await page.locator('#psSafePanel').isVisible(),true);
    await page.goto(page.url().split('?')[0]+'?safe=0',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
    await settle();
    assert.equal(await page.evaluate(()=>[window.__psSafeLevel,location.search].join()),'0,');
    bf=await (await page.waitForSelector('#fBoard')).contentFrame();
    assert.equal(await bf.evaluate(()=>document.body.classList.contains('bc-tilt3d')),true,'평소대로: 3D');
    assert.equal(await page.locator('#psSafePanel').isVisible(),false);
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,loaded:await loaded()}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
