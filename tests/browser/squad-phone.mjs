import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.903 — 폰 선수단(목업 ②, ≤600): 조 필터 한 줄(인원 수 + ⋯), «지금 값» 한 줄, 행 두 줄(이름 / 포지션·조·상태),
// 행 탭 = 선수 시트, «선수 삭제»는 시트 맨 아래. 조·상태 버튼은 남아 고르개를 연다. 데스크톱은 그대로. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button,a')].find(b=>(b.innerText||'').trim()==='팀 운영'&&b.getBoundingClientRect().width>0);if(b)b.click();});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{for(const d of [document,...[...document.querySelectorAll('iframe')].map(f=>{try{return f.contentDocument;}catch(_){return null;}}).filter(Boolean)]){const b=[...d.querySelectorAll('button,a,[role=tab]')].find(b=>(b.innerText||'').trim()==='선수단'&&b.getBoundingClientRect().width>0);if(b){b.click();return;}}});
  const f=await (await page.waitForSelector('#fScout')).contentFrame();
  await f.waitForFunction(()=>document.querySelectorAll('#teamList .tm-row').length>0);
  await f.evaluate(()=>{const p=data.players.find(p=>p.name==='가상 선수 5');p.status='injury';renderTeam();});
  await page.waitForTimeout(300);
  const look=await f.evaluate(()=>{const vis=el=>!!el&&getComputedStyle(el).display!=='none';const row=document.querySelector('#teamList .tm-row[data-status="injury"]');
    return {more:vis(document.getElementById('tmGrpMore')),edit:vis(document.querySelector('#grpChips .grp-edit')),bar:vis(document.querySelector('#teamList .tm-grpbar')),
      headSet:vis(document.querySelector('.tm-workbar .tm-head-set')),now:vis(document.getElementById('tmNowLine'))?document.getElementById('tmNowLine').textContent:'',
      count:vis(document.querySelector('#grpChips .grp-n')),rowH:row.getBoundingClientRect().height,
      injury:vis(row.querySelector('.t-injury')),grp:vis(row.querySelector('.t-grp')),sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth};});
  if(size==='desktop'){
    assert.equal(look.more,false,'데스크톱에는 ⋯ 가 없다');assert.equal(look.edit,true,'데스크톱 ✎ 그대로');
    assert.equal(look.count,false);assert.equal(look.now,'','데스크톱에는 «지금 값» 줄이 없다');assert.equal(look.headSet,true);
    assert.ok(look.rowH<50,'데스크톱 행 높이 그대로 '+look.rowH);
  }else{
    assert.equal(look.more,true);assert.equal(look.edit,false);assert.equal(look.bar,false,'아래 조 알약 줄은 숨는다');
    assert.equal(look.headSet,false);assert.equal(look.count,true);assert.match(look.now,/^포메이션 /);
    assert.ok(look.rowH>=56,'행 두 줄 '+look.rowH);assert.equal(look.injury,true,'상태 버튼은 남는다');assert.equal(look.grp,true,'조 버튼은 남는다');
    assert.ok(look.sw<=look.cw+1,'가로 넘침 없음');
    // 상태 글자 버튼은 여전히 상태 고르개를 연다
    await f.evaluate(()=>document.querySelector('#teamList .tm-row[data-status="injury"] .t-injury').click());await page.waitForTimeout(200);
    assert.ok(await f.evaluate(()=>!!document.getElementById('psPickPop')),'상태 고르개가 열린다');
    await f.evaluate(()=>psPickClose());
    // 행 탭 = 선수 시트, 삭제는 시트 맨 아래
    await f.evaluate(()=>{const r=document.querySelector('#teamList .tm-row[data-status="injury"]');const n=r.querySelector('.t-name').getBoundingClientRect();
      const t=document.elementFromPoint(n.left+10,n.top+n.height/2);(t||r).click();});
    await page.waitForTimeout(500);
    const sheet=await f.evaluate(()=>({open:getComputedStyle(document.getElementById('plEditModal')).display!=='none',title:document.getElementById('plEditTitle').textContent,del:document.getElementById('plDelete').parentNode.id}));
    assert.equal(sheet.open,true,'행 탭으로 시트가 열린다');assert.equal(sheet.title,'가상 선수 5');assert.equal(sheet.del,'plFoot','선수 삭제는 시트 맨 아래');
    await f.evaluate(()=>document.getElementById('plClose').click());
    // ⋯ 메뉴
    await f.evaluate(()=>document.getElementById('tmGrpMore').click());await page.waitForTimeout(200);
    const menu=await f.evaluate(()=>[...document.querySelectorAll('#psPickPop button')].map(b=>b.textContent));
    assert.deepEqual(menu.slice(0,3),['조 이름 바꾸기','＋ 조 추가','포메이션']);
    await f.evaluate(()=>{[...document.querySelectorAll('#psPickPop button')].find(b=>b.textContent==='포메이션').click();});await page.waitForTimeout(200);
    const forms=await f.evaluate(()=>[...document.querySelectorAll('#psPickPop button')].length);
    assert.ok(forms>=3,'포메이션 고르개가 열린다');await f.evaluate(()=>psPickClose());
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,look}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
