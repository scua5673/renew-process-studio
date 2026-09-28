import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,root} from '../fixtures/team-app.mjs';
// 2.903 — 폰 일정 보기 전환(목업 ③, ≤600): 셸이 iframe 안 .apphd 를 숨겨 #psPhBar 가 앱에서 안 보이던 것 →
// #schedule 안(#vtoggle 앞) 두 줄 막대 «‹ 제목 › · 조 · 오늘» / «년 · 월 · 주 · 일», 위에 붙음. 동기화 줄은 «서버 일정 · … 받음» + ⟳.
// 데스크톱은 막대 없이 #vtoggle·원래 문구 그대로. 합성 팀 fixture 에서만 돈다.
// PS_SCHEDULE_SHOTS=1 이면 폰 다크·아이패드 화면도 test-results/schedule-phone/ 에 남긴다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const SHOTS=path.join(root,'test-results/schedule-phone');fs.mkdirSync(SHOTS,{recursive:true});
const fx=await startFixture(),browsers={};
async function openSchedule(sizeName,opts={}){
  const {page,logs,context}=await openApp(fx,sizeName,{browsers,...opts});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button,a')].find(b=>(b.innerText||'').trim()==='팀 운영'&&b.getBoundingClientRect().width>0);if(b)b.click();});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{for(const d of [document,...[...document.querySelectorAll('iframe')].map(f=>{try{return f.contentDocument;}catch(_){return null;}}).filter(Boolean)]){const b=[...d.querySelectorAll('button,a,[role=tab]')].find(b=>(b.innerText||'').trim()==='일정'&&b.getBoundingClientRect().width>0);if(b){b.click();return;}}});
  const f=await (await page.waitForSelector('#fProcess')).contentFrame();
  await f.waitForFunction(()=>document.getElementById('psPhBar')&&document.querySelector('#vtoggle div.on'));
  await page.waitForTimeout(1500);
  return {page,logs,context,f};
}
const look=f=>f.evaluate(()=>{const vis=el=>!!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;
  const bar=document.getElementById('psPhBar'),br=bar.getBoundingClientRect(),ss=document.getElementById('schedSync'),btn=document.getElementById('schedSyncNow');
  const cal=[...document.querySelectorAll('#weekView,#dayViewWrap,#monthViewWrap,#yearViewWrap')].find(vis);
  return {bar:vis(bar),inSchedule:bar.parentNode.id==='schedule'&&bar.parentNode.firstElementChild===bar,barTop:br.top,barBottom:br.bottom,calTop:cal?cal.getBoundingClientRect().top:null,
    label:document.getElementById('psPhLb').textContent,view:(document.querySelector('#vtoggle div.on')||{}).dataset?.v,
    seg:[...bar.querySelectorAll('.sg button')].filter(vis).map(b=>({t:b.textContent,on:b.classList.contains('on'),pressed:b.getAttribute('aria-pressed'),h:b.getBoundingClientRect().height})),
    small:[...bar.querySelectorAll('button,select')].filter(vis).filter(b=>b.getBoundingClientRect().height<40).map(b=>b.className||b.tagName),
    vtoggle:vis(document.getElementById('vtoggle')),weekView:vis(document.getElementById('weekView')),
    sync:ss&&!ss.hidden?{text:ss.querySelector('span').textContent,btn:btn.textContent,aria:btn.getAttribute('aria-label'),title:btn.getAttribute('title'),h:btn.getBoundingClientRect().height}:null,
    fab:(document.querySelector('.schedule-fab')||{}).textContent||'',dark:document.body.classList.contains('fmdark'),
    barBg:getComputedStyle(bar).backgroundColor,onBg:(()=>{const o=bar.querySelector('.sg button.on');return o?getComputedStyle(o).backgroundColor:'';})(),tdBg:getComputedStyle(bar.querySelector('.td')).backgroundColor,
    sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth};});
// 반투명 색은 아래 바탕(under) 위에 얹은 밝기로 본다
const lum=(c,under=0)=>{const m=(c.match(/[\d.]+/g)||[]).map(Number);if(m.length<3)return 1;const L=(0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255,al=m.length>3?m[3]:1;return al*L+(1-al)*under;};
try{
  const {page,logs,f}=await openSchedule(size);let stuck=null;
  const a=await look(f);
  if(size==='desktop'){
    assert.equal(a.bar,false,'데스크톱에는 폰 막대가 없다');assert.equal(a.vtoggle,true,'데스크톱 #vtoggle 그대로');
    if(a.sync){assert.match(a.sync.btn,/^지금 (받아오기|주고받기)$/,'데스크톱 버튼 글자 그대로');assert.match(a.sync.text,/판 받음/,'데스크톱 문구 그대로');}
    await page.screenshot({path:path.join(SHOTS,'desktop.png')});
  }else{
    assert.equal(a.bar,true,'폰 막대가 앱 안에서 보인다');assert.equal(a.inSchedule,true,'막대는 #schedule 맨 앞');
    assert.ok(a.calTop!=null&&a.barBottom<=a.calTop+1,'막대는 달력 위 '+JSON.stringify([a.barBottom,a.calTop]));
    assert.equal(a.view,'month','폰은 월간이 먼저(1.976)');assert.match(a.label,/^\d{4}년 \d{1,2}월$/,'달 제목 '+a.label);
    assert.deepEqual(a.seg.map(s=>s.t),['년','월','주','일'],'세그 네 칸');
    assert.deepEqual(a.seg.filter(s=>s.on).map(s=>s.t+s.pressed),['월true']);
    assert.deepEqual(a.small,[],'막대 조작은 40px 이상');
    assert.match(a.fab,/오늘에 추가/,'FAB 그대로');
    assert.ok(a.sw<=a.cw+1,'가로 넘침 없음 '+a.sw+'>'+a.cw);
    if(a.sync){
      assert.equal(a.sync.btn,'⟳');assert.match(a.sync.aria,/받아오기|주고받기/);assert.equal(a.sync.title,a.sync.aria);
      assert.match(a.sync.text,/^서버 일정 · .+ 받음/,'폰 문구 '+a.sync.text);assert.ok(!a.sync.text.includes('가상 테스트 FC'),'폰에서는 팀 이름을 뺀다');
      assert.ok(a.sync.h>=40,'⟳ 40px');
    }else console.log('schedSync hidden in fixture — phone markup not asserted');
    await page.screenshot({path:path.join(SHOTS,'phone-month.png')});
    // ‹ › 는 제목을 바꾼다
    const m0=a.label;
    await f.locator('#psPhBar .nv[data-d="1"]').click();
    await f.waitForFunction(p=>document.getElementById('psPhLb').textContent!==p,m0);
    const m1=(await look(f)).label;assert.notEqual(m1,m0,'› 다음 달');
    await f.locator('#psPhBar .nv[data-d="-1"]').click();
    await f.waitForFunction(p=>document.getElementById('psPhLb').textContent===p,m0);
    // «주» = #vtoggle 주간
    await f.locator('#psPhBar .sg button[data-sv="week"]').click();
    await f.waitForFunction(()=>document.querySelector('#vtoggle div[data-v="week"]').classList.contains('on'));
    await page.waitForTimeout(300);
    const w=await look(f);
    assert.equal(w.view,'week');assert.equal(w.weekView,true,'주간 화면이 보인다');
    assert.deepEqual(w.seg.filter(s=>s.on).map(s=>s.t),['주']);assert.notEqual(w.label,m0,'제목이 주 범위로');
    await f.locator('#psPhBar .nv[data-d="1"]').click();
    await f.waitForFunction(p=>document.getElementById('psPhLb').textContent!==p,w.label);
    await f.locator('#psPhBar .td').click();
    await f.waitForFunction(p=>document.getElementById('psPhLb').textContent===p,w.label);
    assert.ok(w.sw<=w.cw+1,'주간도 가로 넘침 없음');
    await page.screenshot({path:path.join(SHOTS,'phone-week.png')});
    // 일간: 긴 제목(«9/28 (월) · MD-5»)이어도 첫 줄은 한 줄(«오늘» 이 둘째 줄로 밀리지 않는다)
    await f.locator('#psPhBar .sg button[data-sv="day"]').click();
    await f.waitForFunction(()=>document.querySelector('#vtoggle div[data-v="day"]').classList.contains('on'));
    const row=await f.evaluate(()=>{const t=s=>document.querySelector('#psPhBar '+s).getBoundingClientRect().top;return {nv:t('.nv[data-d="1"]'),td:t('.td'),lb:t('.lb'),label:document.getElementById('psPhLb').textContent};});
    assert.ok(Math.abs(row.td-row.nv)<2&&Math.abs(row.lb-row.nv)<12,'일간 첫 줄 한 줄 '+JSON.stringify(row));
    // 조를 고르면 #schedGrpNote 가 생긴다 — 막대는 그 줄 위(맨 앞)
    const grp=await f.evaluate(()=>[...document.querySelectorAll('#psPhGrp option')].map(o=>o.value));
    if(grp.length>1){
      await f.locator('#psPhGrp').selectOption(grp[1]);
      await f.waitForFunction(()=>document.getElementById('schedGrpNote'));
      const gn=await f.evaluate(()=>({bar:document.getElementById('psPhBar').getBoundingClientRect().bottom,note:document.getElementById('schedGrpNote').getBoundingClientRect().top}));
      assert.ok(gn.bar<=gn.note+1,'조 안내 줄은 막대 밑 '+JSON.stringify(gn));
      await f.locator('#psPhGrp').selectOption(grp[0]);
      await f.waitForFunction(()=>!document.getElementById('schedGrpNote'));
    }
    // 위에 붙는다: 스크롤해도 막대는 맨 위
    await f.locator('#psPhBar .sg button[data-sv="month"]').click();
    await f.waitForFunction(()=>document.querySelector('#vtoggle div[data-v="month"]').classList.contains('on'));
    stuck=await f.evaluate(async()=>{const st=document.querySelector('.stage');st.scrollTop=400;await new Promise(r=>setTimeout(r,120));
      const r=document.getElementById('psPhBar').getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.bottom-10);const y=st.scrollTop;st.scrollTop=0;
      return {top:r.top,y,hitInBar:!!(hit&&hit.closest('#psPhBar'))};});
    if(stuck.y>0){assert.ok(stuck.top>=-1&&stuck.top<=8,'스크롤해도 막대가 위에 '+JSON.stringify(stuck));assert.equal(stuck.hitInBar,true,'달력이 막대를 덮지 않는다');}
    // 2.904 — 폰은 마지막에 본 보기로 연다: 주간을 보고 다른 탭에 갔다 오면 주간(처음은 월간 — 위에서 확인)
    await f.locator('#psPhBar .sg button[data-sv="week"]').click();
    await f.waitForFunction(()=>document.querySelector('#vtoggle div[data-v="week"]').classList.contains('on'));
    const tabTo=t=>page.evaluate(t=>{const b=[...document.querySelectorAll('button,a')].find(b=>(b.innerText||'').trim()===t&&b.getBoundingClientRect().width>0);if(b)b.click();return !!b;},t);
    assert.ok(await tabTo('오늘'),'오늘 탭');await page.waitForTimeout(800);
    assert.ok(await tabTo('일정'),'일정 탭');await page.waitForTimeout(1500);
    assert.equal(await f.evaluate(()=>document.querySelector('#vtoggle div.on').dataset.v),'week','마지막에 본 주간으로 돌아온다');
    // 다크: 막대 바탕·켜진 칸이 어둡다
    const d=await openSchedule('phone',{dark:true});
    const dk=await look(d.f);
    assert.equal(dk.dark,true,'fmdark');assert.equal(dk.bar,true);
    assert.ok(lum(dk.barBg)<0.3,'다크 막대 바탕 '+dk.barBg);assert.ok(lum(dk.onBg,lum(dk.barBg))<0.5,'다크 켜진 칸 '+dk.onBg);assert.ok(lum(dk.tdBg,lum(dk.barBg))<0.5,'다크 «오늘» '+dk.tdBg);
    await d.page.screenshot({path:path.join(SHOTS,'phone-dark.png')});
    logs.push(...d.logs);
    if(process.env.PS_SCHEDULE_SHOTS){const i=await openSchedule('ipad');const ia=await look(i.f);assert.equal(ia.bar,false,'아이패드는 그대로');assert.equal(ia.vtoggle,true);await i.page.screenshot({path:path.join(SHOTS,'ipad.png')});logs.push(...i.logs);}
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,label:a.label,sync:a.sync,stuck}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
