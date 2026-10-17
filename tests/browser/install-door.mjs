import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,ready,SIZES} from '../fixtures/team-app.mjs';
// 3.085 — 홈 화면 설치의 문(studio/install-door.js). 폰: 더보기 «앱» 줄 · 아이패드 · 컴퓨터: 왼쪽 메뉴 앱 설정 위 한 칸 · 셋 다: 다른 날 세 번째로 열 때 한 번 뜨는 안내.
// 누르면 셸의 안내 시트(#psInstallSheet)가 열린다. 설치된 기기(display-mode: standalone)에서는 문도 안내도 없다. 합성 팀 fixture 에서만 돈다.
// 세 크기를 이 잡의 엔진 하나로 돈다(폰 · 아이패드 UA 그대로). PS_INSTALL_SHOTS=1 이면 화면을 남긴다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
for(const s of ['phone','ipad','desktop'])SIZES[s].engine=engine;
const OUT=process.env.PS_TEST_OUTPUT||path.join(process.cwd(),'test-results/install-door');fs.mkdirSync(OUT,{recursive:true});
const shots=!!process.env.PS_INSTALL_SHOTS;
const fx=await startFixture(),browsers={};

const vis=sel=>{const el=document.querySelector(sel);if(!el||el.hidden)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';};
async function sheetOpens(page,how){
  await page.waitForSelector('#psInstallSheet .psi-card',{timeout:5000});
  const t=await page.evaluate(()=>document.querySelector('#psInstallSheet h3').textContent);
  assert.equal(t,'앱으로 설치하면',how+' → 안내 시트');
  await page.click('#psInstallSheet .psi-x');
  await page.waitForFunction(()=>!document.getElementById('psInstallSheet'));
}
async function seedDays(page,daysAgo){
  await page.evaluate(n=>{const d=t=>{const x=new Date(t);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
    localStorage.setItem('ps_install_nudge_v1',JSON.stringify({days:n.map(k=>d(Date.now()-k*864e5)),shown:''}));},daysAgo);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
}
const nudgeShown=page=>page.waitForSelector('#psInstNudge .psn-go',{timeout:20000});
const failures=l=>l.filter(x=>x.type==='pageerror'&&/install|Install/.test(x.text+x.stack));

try{
  /* ── 폰: 더보기 «앱» 줄의 문 · 왼쪽 메뉴 칸은 없다 ── */
  {
    const {page,logs}=await openApp(fx,'phone',{browsers});
    assert.equal(await page.evaluate(vis,'#psInstRail'),false,'폰에는 왼쪽 메뉴 칸이 없다');
    await page.click('#psMoreBtn');
    await page.waitForSelector('#appMoreSheet:not([hidden])');
    const door=await page.evaluate(()=>{const b=document.querySelector('#appMoreSheet [data-install-door]');const r=b.getBoundingClientRect(),cs=getComputedStyle(b);
      return {shown:!b.hidden&&r.width>0,text:b.textContent.trim(),h:r.height,row:b.closest('.tms-g').querySelector('i').textContent,bg:cs.backgroundColor,next:getComputedStyle(b.previousElementSibling).backgroundColor};});
    assert.ok(door.shown,'더보기에 문이 보인다');
    assert.equal(door.text,'홈 화면에 추가'); assert.equal(door.row,'앱');
    assert.ok(door.h>=40,'누르는 자리 40px '+door.h);
    assert.notEqual(door.bg,door.next,'옆 알약과 구별되는 옅은 남색');
    if(shots)await page.screenshot({path:path.join(OUT,'phone-more.png')});
    await page.click('#appMoreSheet [data-install-door]');
    assert.equal(await page.evaluate(()=>document.getElementById('appMoreSheet').hidden),true,'시트는 닫히고');
    await sheetOpens(page,'폰 더보기');
    /* 다른 날 세 번째 — 하단 메뉴 위에 카드, «괜찮아요» 뒤 한 줄은 더보기를 가리킨다 */
    await seedDays(page,[2,1]);
    await nudgeShown(page);await page.waitForTimeout(400);
    const card=await page.evaluate(()=>{const n=document.getElementById('psInstNudge'),r=n.getBoundingClientRect(),bar=[document.getElementById('psMoreBtn'),document.querySelector('#teamBottom [data-tb="more"]')].map(b=>b.getBoundingClientRect()).find(r=>r.height>0);
      return {title:n.querySelector('.psn-t').textContent,bottom:r.bottom,segTop:bar.top,left:r.left,right:innerWidth-r.right};});
    assert.equal(card.title,'홈 화면에 추가해 보세요');
    assert.ok(card.bottom<=card.segTop-6,'하단 메뉴(앱 · 팀) 바로 위 '+JSON.stringify(card));
    if(shots)await page.screenshot({path:path.join(OUT,'phone-nudge.png')});
    await page.click('#psInstNudge .psn-no');
    assert.equal(await page.evaluate(()=>document.getElementById('psInstNudge').textContent),'언제든 더보기 › 홈 화면에 추가에서 다시 볼 수 있어요');
    await page.waitForFunction(()=>!document.getElementById('psInstNudge'),null,{timeout:8000});
    /* 팀 화면의 더보기에도 같은 문 */
    if(!await page.evaluate(vis,'#teamBottom [data-tb="more"]')){await page.click('#appSeg [data-team-hub]');await page.waitForFunction(()=>document.body.classList.contains('ps-team-open'));}
    await page.click('#teamBottom [data-tb="more"]');
    await page.waitForSelector('#teamMoreSheet:not([hidden]) [data-install-door]:not([hidden])');
    assert.equal(await page.evaluate(()=>document.querySelector('#teamMoreSheet [data-install-door]').textContent.trim()),'홈 화면에 추가');
    await page.click('#teamMoreSheet [data-install-door]');
    assert.equal(await page.evaluate(()=>document.getElementById('teamMoreSheet').hidden),true);
    await sheetOpens(page,'팀 더보기');
    assert.deepEqual(failures(logs),[]);
    await page.context().close();
  }

  /* ── 아이패드: 왼쪽 메뉴, 업데이트 · 앱 설정 위 칸 ── */
  {
    const {page,logs}=await openApp(fx,'ipad',{browsers});
    const rail=await page.evaluate(()=>{const b=document.getElementById('psInstRail'),g=document.getElementById('gearBtn');const r=b.getBoundingClientRect(),gr=g.getBoundingClientRect();
      return {text:b.textContent.trim(),above:r.bottom<=gr.top+1,w:Math.round(r.width),gw:Math.round(gr.width),h:Math.round(r.height),inView:r.bottom<=innerHeight};});
    assert.equal(rail.text,'홈 화면에 추가');
    assert.ok(rail.above,'앱 설정 위');
    assert.equal(rail.w,rail.gw,'앱 설정 타일과 같은 폭');
    assert.ok(rail.inView,'화면 안에 있다');
    if(shots)await page.screenshot({path:path.join(OUT,'ipad-rail.png')});
    await page.click('#psInstRail');
    await sheetOpens(page,'아이패드 왼쪽 메뉴');
    assert.deepEqual(failures(logs),[]);
    await page.context().close();
  }

  /* ── 컴퓨터: «앱 설치» · 안내는 오른쪽 아래, 한 번 띄우면 끝 ── */
  {
    const {page,logs}=await openApp(fx,'desktop',{browsers});
    assert.equal(await page.evaluate(()=>document.getElementById('psInstRail').textContent.trim()),'앱 설치');
    await page.click('#psInstRail');
    await sheetOpens(page,'컴퓨터 왼쪽 메뉴');
    await seedDays(page,[1]);
    await page.waitForTimeout(8000);
    assert.equal(await page.evaluate(()=>!!document.getElementById('psInstNudge')),false,'이틀째에는 안 뜬다');
    await seedDays(page,[5,2]);
    await nudgeShown(page);
    await page.waitForTimeout(400);
    const card=await page.evaluate(()=>{const n=document.getElementById('psInstNudge'),r=n.getBoundingClientRect(),cs=getComputedStyle(n);
      return {title:n.querySelector('.psn-t').textContent,right:innerWidth-r.right,top:r.top,bottom:r.bottom,w:Math.round(r.width),opacity:cs.opacity,bg:cs.backgroundColor,h:innerHeight};});
    assert.equal(card.title,'앱으로 설치해 보세요');
    assert.ok(card.right<=24&&card.top<=80&&card.w<=360,'오른쪽 위 작은 카드 '+JSON.stringify(card));
    assert.ok(card.bottom<card.h*0.5,'아래쪽 도구 막대를 가리지 않는다 '+JSON.stringify(card));
    assert.equal(card.opacity,'1'); assert.equal(card.bg,'rgb(255, 255, 255)','불투명한 카드');
    if(shots)await page.screenshot({path:path.join(OUT,'desktop-nudge.png')});
    await page.click('#psInstNudge .psn-go');
    assert.equal(await page.evaluate(()=>!!document.getElementById('psInstNudge')),false,'«방법 보기» 는 카드를 닫고');
    await sheetOpens(page,'컴퓨터 안내 카드');
    const st=await page.evaluate(()=>JSON.parse(localStorage.getItem('ps_install_nudge_v1')));
    assert.ok(st.shown,'띄운 날을 적는다');
    await page.reload({waitUntil:'domcontentloaded'});await ready(page);
    await page.waitForTimeout(8000);
    assert.equal(await page.evaluate(()=>!!document.getElementById('psInstNudge')),false,'한 번 띄우면 다시 안 뜬다');
    /* 설치된 창(display-mode: standalone)에서는 문도 안내도 없다 */
    await page.context().addInitScript(()=>{const mm=window.matchMedia.bind(window);
      window.matchMedia=q=>/display-mode:\s*standalone/.test(q)?{matches:true,media:q,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return false;}}:mm(q);});
    await seedDays(page,[5,2]);
    const inst=await page.evaluate(()=>({rail:!document.getElementById('psInstWrap').hidden,door:[...document.querySelectorAll('[data-install-door]')].some(b=>!b.hidden)}));
    assert.deepEqual(inst,{rail:false,door:false},'설치된 기기');
    await page.waitForTimeout(8000);
    assert.equal(await page.evaluate(()=>!!document.getElementById('psInstNudge')),false,'설치된 기기에는 안내도 없다');
    assert.deepEqual(failures(logs),[]);
    await page.context().close();
  }
  console.log(JSON.stringify({ok:true,engine}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
