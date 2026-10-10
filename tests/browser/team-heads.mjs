import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.981 — 디자인 판정 이어서: 선수단 머리(넓은 화면 두 줄 · 폰은 그대로) · 경기 목록(전적 한 줄 · 줄의 더보기 · 기록 줄).
// 합성 팀 fixture 에서만 돈다. 크롬 = 데스크톱 1280, 웹킷 = 폰 375.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop',phone=size==='phone';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  const press=async sel=>{const l=page.locator(sel).first();if(phone)await l.tap();else await l.click();};
  const go=key=>press(phone?'#teamBottom [data-tb="'+key+'"]':'#teamNav .tn-seg [data-team-key="'+key+'"]');
  await press('#appSeg [data-team-hub]');
  await page.locator('body.ps-team-open').waitFor();
  const f=await (await page.waitForSelector('#fScout')).contentFrame();

  // ── 선수단
  const shown=id=>f.waitForFunction(i=>{const v=document.getElementById(i);return !!v&&v.getBoundingClientRect().width>0;},id,{timeout:15000});
  await go('players');await shown('teamView');
  await f.waitForFunction(()=>document.querySelectorAll('#teamList .tm-row').length>0);
  // 권한표(구성원)가 온 뒤에야 «IDP 미연결» 버튼이 선다
  await f.waitForFunction(()=>{const b=document.getElementById('tmStatUnlinkBtn');return !!b&&getComputedStyle(b).display!=='none';},null,{timeout:15000});
  const sq=await f.evaluate(()=>{const q=s=>document.querySelector(s),r=e=>{const b=e.getBoundingClientRect();return {l:b.left,t:b.top,w:b.width,h:b.height,b:b.bottom,r:b.right};};
    const vis=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0;const hero=q('#teamView .tm-hero'),de=document.documentElement;
    return {title:r(q('#teamView .tm-titlebox')),hero:r(hero),acts:r(q('#teamView .tm-head-actions')),work:r(q('#teamView .tm-workbar')),head:r(q('#teamView .tm-head')),
      heroClip:hero.scrollWidth>hero.clientWidth+1,count:q('#teamCount').textContent,unlink:vis(q('#tmStatUnlinkBtn')),zero:q('#tmStatUnavailable').parentNode.classList.contains('zero'),
      zeroColor:getComputedStyle(q('#tmStatUnavailable')).color,share:vis(q('#tmShareLine'))?q('#tmShareLine').innerText:'',sw:de.scrollWidth,cw:de.clientWidth};});
  assert.ok(sq.sw<=sq.cw+1,'선수단: 가로 넘침 없음');
  assert.equal(sq.share.includes('편집은 팀 권한'),false,'늘 같은 공유 안내 문장은 줄에 없다');
  assert.equal(sq.unlink,true);assert.equal(/계정 연결/.test(sq.count),false,'«IDP 미연결»이 서 있으면 인원 옆 «계정 연결»은 접는다: '+sq.count);
  assert.equal(sq.zero,true,'못 뛰는 인원 0 은 조용한 숫자');
  if(!phone){
    assert.ok(Math.abs((sq.hero.t+sq.hero.h/2)-(sq.title.t+sq.title.h/2))<8,'숫자 띠는 제목과 같은 줄');
    assert.ok(sq.hero.l>=sq.title.r-1&&sq.hero.r<=sq.acts.l+1,'제목 · 숫자 띠 · 버튼이 서로 겹치지 않는다');
    assert.equal(sq.heroClip,false,'숫자 띠가 잘리지 않는다');
    assert.ok(sq.work.t>=sq.hero.b-1,'컨트롤 줄은 그 아래 제 줄');
    assert.ok(sq.head.h<=100,'머리는 두 줄(≈90px): '+sq.head.h);
    assert.notEqual(sq.zeroColor,'rgb(212, 64, 58)','0 을 빨강으로 칠하지 않는다');
  }else{
    assert.ok(sq.hero.t>=sq.title.b-1,'폰은 예전처럼 제목 아래에 숫자 띠');
  }

  // ── 경기
  await go('match');await shown('matchView');
  await f.waitForFunction(()=>document.querySelectorAll('#matchList .mrow').length>=2);
  await page.waitForTimeout(1500);   // 일정에서 온 경기 병합·첫 동기화가 자리 잡은 뒤에 적는다
  const ins=f.locator('#matchList [data-msc]');
  await ins.nth(0).fill('3');await ins.nth(1).fill('1');await ins.nth(2).fill('1');await ins.nth(3).fill('1');
  await page.waitForTimeout(500);
  const mt=await f.evaluate(()=>{const q=s=>document.querySelector(s),r=e=>{const b=e.getBoundingClientRect();return {l:b.left,t:b.top,w:b.width,h:b.height,b:b.bottom,r:b.right};};
    const de=document.documentElement,more=q('#matchList .mr-more');
    return {lines:[...document.querySelectorAll('#matchRecord .mrec-ln')].map(e=>({t:e.textContent.replace(/\s+/g,''),r:r(e)})),cards:document.querySelectorAll('#matchRecord .mrec-b').length,
      row:r(q('#matchView .mrec-row')),head:r(q('#matchView .match-head')),q:r(q('#matchListQ')),more:r(more),moreOpacity:getComputedStyle(more).opacity,
      del:document.querySelectorAll('#matchList [data-mdel],#matchList [data-medit]').length,sw:de.scrollWidth,cw:de.clientWidth};});
  assert.ok(mt.sw<=mt.cw+1,'경기: 가로 넘침 없음');
  assert.equal(mt.cards,0);assert.equal(mt.lines.length,2,'전적은 정식·친선 한 줄씩');
  assert.equal(mt.lines[0].t,'정식1승1무0패승률50%·4득2실·+2');assert.equal(mt.lines[1].t,'친선등록된경기없음');
  assert.equal(mt.del,0,'줄마다 «편집 · 삭제»는 없다');assert.equal(mt.moreOpacity,'1','더보기는 늘 보인다');
  assert.ok(Math.min(mt.more.w,mt.more.h)>=(phone?40:32),'더보기 누르는 면: '+mt.more.w+'x'+mt.more.h);
  assert.ok(mt.q.r<=mt.head.r+1,'검색칸이 머리 밖으로 나가지 않는다');
  if(!phone)assert.ok(mt.row.h<=28,'전적은 한 줄(카드 두 장 64px → 24px): '+mt.row.h);
  // 더보기 → 열기 · 삭제. 삭제는 확인창을 거친다(취소하면 그대로)
  const more=f.locator('#matchList .mr-more').first();if(phone)await more.tap();else await more.click();
  await f.waitForSelector('#psPickPop');
  const menu=await f.evaluate(()=>{const p=document.getElementById('psPickPop'),b=p.getBoundingClientRect();return {items:[...p.querySelectorAll('button')].map(x=>x.textContent),l:b.left,r:b.right,iw:innerWidth};});
  assert.deepEqual(menu.items,['열기','삭제']);assert.ok(menu.l>=0&&menu.r<=menu.iw,'메뉴가 화면 안에 선다');
  const before=await f.evaluate(()=>matchLoad().matches.length);
  const delBtn=f.locator('#psPickPop button',{hasText:'삭제'});if(phone)await delBtn.tap();else await delBtn.click();
  await page.waitForTimeout(400);
  const asked=await f.evaluate(()=>{const t=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/기록을 삭제할까요\?/.test(e.textContent||'')&&e.getBoundingClientRect().width>0);return t.length;});
  assert.ok(asked>=1,'삭제는 확인창을 띄운다');
  assert.equal(await f.evaluate(()=>matchLoad().matches.length),before,'확인 전에는 지워지지 않는다');
  const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errors,[],'페이지 오류 없음');
  console.log(JSON.stringify({ok:true,size,squadHead:Math.round(sq.head.h),matchRecordRow:Math.round(mt.row.h)}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
