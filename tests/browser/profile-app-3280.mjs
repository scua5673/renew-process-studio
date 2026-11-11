/* 3.280 — «프로필» 앱: 왼쪽 메뉴 커뮤니티 밑(폰은 더보기) → 선수 · 코치 프로필 만들기 → 이 기기에 저장 → 다시 열어도 남음 → PDF · 인쇄 창 → 지우기.
   팀 자료(명단)는 건드리지 않는다. 합성 팀 fixture. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS,WT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={};
SIZES.pfDesk={engine,ctx:{viewport:{width:1360,height:860},deviceScaleFactor:1}};
SIZES.pfPhone={engine,ctx:{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:SIZES.phone.ctx.userAgent}};
const fx=await startFixture();
const frameOf=async page=>{const f=await (await page.waitForSelector('#fProfile')).contentFrame();await f.waitForFunction(()=>window.__psProfileApp&&__psProfileApp.loaded(),null,{timeout:30000});return f;};
const stored=f=>f.evaluate(async()=>{await __psProfileApp.flush();const v=await storage.get(__psProfileApp.key);return v&&v.value?JSON.parse(v.value).list.map(p=>({kind:p.kind,name:p.f.name||'',n:Object.keys(p.f).length})):[];});
try{
  const players=()=>JSON.parse(fx.db.get(WT+'|scout_tool_v1').v).players.map(p=>p.id+':'+p.name).join(','),roster=players();   /* 명단 문서는 앱이 배경에서 채워 쓴다(posName 등) — 선수 수 · 이름만 견준다 */
  const {page,logs}=await openApp(fx,'pfDesk',{browsers});
  await page.waitForTimeout(1200);
  /* 메뉴 자리: 커뮤니티 바로 밑 */
  const order=await page.evaluate(()=>[...document.querySelectorAll('#appSeg button')].filter(b=>b.offsetParent).map(b=>({k:b.dataset.app||(b.dataset.teamHub?'team':b.id),y:Math.round(b.getBoundingClientRect().top)})).sort((a,b)=>a.y-b.y).map(x=>x.k));
  assert.equal(order[order.indexOf('community')+1],'profile','커뮤니티 밑에 프로필 '+order.join(','));
  await page.locator('#appSeg button[data-app="profile"]').click();
  let f=await frameOf(page);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('fProfile')).display),'block');
  assert.match(await f.locator('#pfRows').innerText(),/아직 선수 프로필이 없어요/);
  await f.locator('#pfAddPlayer').click();
  for(const [k,v] of [['name','가상 김선수'],['position','RB · 오른발'],['team','가상중학교'],['number','6'],['strengths','오버래핑\n1대1 수비'],['video','javascript:alert(1)']])await f.locator('#pf_'+k).fill(v);
  /* 종이 미리보기: 채운 칸만 · 위험한 주소는 안 실림 */
  const paper=await f.locator('#pfPrev .pf-a4').innerText();
  assert.match(paper,/가상 김선수/);assert.match(paper,/#6/);assert.match(paper,/오버래핑/);assert.doesNotMatch(paper,/javascript|보완할 점/);
  assert.match(await f.locator('#pfRows .pf-row .pf-tag').innerText(),/칸 남음/);
  await f.locator('#pfAddCoach').click();await f.locator('#pf_name').fill('가상 이코치');await f.locator('#pf_role').fill('감독');
  assert.deepEqual((await stored(f)).map(p=>p.kind+':'+p.name).sort(),['coach:가상 이코치','player:가상 김선수']);
  await page.screenshot({path:path.join(SHOTS,'profile-app-'+engine+'-1-desktop.png')});
  /* 다시 열어도 남는다 */
  await page.reload();await page.waitForFunction(()=>window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting'),null,{timeout:60000});
  await page.locator('#appSeg button[data-app="profile"]').click();f=await frameOf(page);
  await f.waitForFunction(()=>document.querySelectorAll('.pf-seg button')[0].textContent==='선수 1'&&document.querySelectorAll('.pf-seg button')[1].textContent==='코치 1');
  assert.equal(await f.locator('#pf_name').inputValue(),'가상 김선수');
  /* PDF · 인쇄 창 */
  await f.locator('#pfPrint').click();
  await f.waitForFunction(()=>document.documentElement.classList.contains('ps-pdfx-open'),null,{timeout:15000});
  const doc=await f.evaluate(()=>{const fr=[...document.querySelectorAll('iframe')].find(x=>x.srcdoc);return fr?fr.srcdoc:'';});
  assert.match(doc,/class="a4 pf-a4"/);assert.match(doc,/가상 김선수/);assert.doesNotMatch(doc,/javascript:/);
  await page.screenshot({path:path.join(SHOTS,'profile-app-'+engine+'-2-pdf.png')});
  await f.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent&&x.textContent.trim()==='닫기');if(b)b.click();});
  await f.waitForFunction(()=>!document.documentElement.classList.contains('ps-pdfx-open'));
  /* 지우기는 두 번 눌러야 */
  await f.locator('#pfDel').click();assert.equal((await stored(f)).length,2,'한 번으론 안 지워진다');
  await f.locator('#pfDel').click();
  assert.deepEqual((await stored(f)).map(p=>p.kind),['coach']);
  /* 팀 명단은 그대로 */
  assert.equal(players(),roster,'팀 명단 선수 그대로');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errs,[],'no page errors');
  /* 폰: 아래 메뉴엔 없고 «더보기» 안에 */
  const ph=await openApp(fx,'pfPhone',{browsers});
  await ph.page.waitForTimeout(1200);
  assert.equal(await ph.page.evaluate(()=>{const b=document.querySelector('#appSeg button[data-app="profile"]');return !!b&&getComputedStyle(b).display==='none';}),true,'폰 아래 메뉴엔 프로필 칸이 없다');
  await ph.page.locator('#psMoreBtn').click();await ph.page.locator('#appMoreSheet [data-am-app="profile"]').click();
  const pf=await frameOf(ph.page);
  await pf.locator('#pfAddPlayer').click();await pf.locator('#pf_name').fill('가상 폰선수');
  assert.equal(await pf.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'폰에서 가로로 넘치지 않는다');
  assert.ok(await pf.locator('.pf-print').first().isVisible(),'폰에서도 PDF · 인쇄 단추가 칸 아래에');
  await ph.page.screenshot({path:path.join(SHOTS,'profile-app-'+engine+'-3-phone.png')});
  const perrs=ph.logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(perrs,[],'no page errors (phone)');
  console.log(JSON.stringify({passed:true,engine}));
}catch(e){console.error(e);process.exitCode=1;}finally{process.exit(process.exitCode||0);}
