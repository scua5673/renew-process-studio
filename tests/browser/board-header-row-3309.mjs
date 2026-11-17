import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.309 — 작전판 위쪽 띠는 운동장 밖 제 줄(헤더)이다(사용자 11/17 «도구들을 운동장과 겹치지 않게» · 목업 A안, 합성 팀 fixture 에서만).
//  ① 띠는 position:relative 의 한 줄 · 운동장 SVG 는 띠 아래부터(띠 bottom ≤ svg top) · 띠 안 단추 어느 것도 운동장 선 · 골대와 안 겹친다
//     (고치기 전 코드(3.078 겹)는 svg 가 띠 밑 6px 부터라 ① 에서 떨어진다)
//  ② «도구 접기» → 띠 줄이 사라져 운동장이 위로 커진다 → «도구 펼치기» → 제자리
//  ③ 왼쪽 글: 빈 작업 보드는 «작업 보드», 페이지를 더하면 «2 / 2»
//  ④ 빈 판의 «포메이션으로 시작» 문(#ehDoor)은 헤더 안(운동장 예약 0 — 세로 판도) · 누르면 보드 설정 › 배치(포메이션 칩 .eh-f — 2.277) · 선수가 놓이면 숨고 운동장 자리는 그대로
//  ⑤ 가운데 덩어리(평면 · 3D · 선수 모양)는 없다 · 오른쪽 «보드 설정»은 글자 단추(톱니 숨김)
//  ⑥ «배치 도구»는 헤더가 아니라 «보드 ▾» 메뉴 안 · 누르면 패널이 뜨고 메뉴는 닫힌다
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-header-row-3309 '+s);};
const READY=()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!w.__boardRestoring;};
const look=f=>f.evaluate(()=>{
  const box=el=>{if(!el)return null;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0?{l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),b:Math.round(r.bottom)}:false;};
  const strip=document.getElementById('boardPageStrip'),svg=document.getElementById('board');
  const pr=PR(),m=document.getElementById('world').getScreenCTM(),pt=(x,y)=>{const p=new DOMPoint(x,y).matrixTransform(m);return [p.x,p.y];},a=pt(pr.L,pr.T),b=pt(pr.R,pr.B);
  const pitch={l:Math.round(Math.min(a[0],b[0])),t:Math.round(Math.min(a[1],b[1])),r:Math.round(Math.max(a[0],b[0])),b:Math.round(Math.max(a[1],b[1]))};
  const controls=[...strip.querySelectorAll(':scope>.tb-g *')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);
  const overlap=controls.filter(r=>r.left<pitch.r&&r.right>pitch.l&&r.top<pitch.b&&r.bottom>pitch.t).length;
  const brand=document.getElementById('tbBrand');
  return {folded:document.body.classList.contains('cmd-dock-folded'),strip:box(strip),pos:getComputedStyle(strip).position,svg:box(svg),pitch,overlap,inset:window.PSTopBar.topInset(svg,state.orientation||'h'),doorInset:window.PSTopBar.topInset(svg,'v'),
    where:brand?brand.querySelector('.tb-where').textContent:null,page:brand?brand.querySelector('.tb-page').textContent:null,tabs:[...strip.querySelectorAll('.bp-tab')].filter(e=>e.getClientRects().length).length,
    door:(()=>{const d=document.getElementById('ehDoor');return {inStrip:!!d&&strip.contains(d),box:box(d)};})(),
    centre:!!strip.querySelector(':scope>.tb-c'),tools:(()=>{const t=document.getElementById('psEditToolsToggle');return {inHeader:!!t&&!!t.closest('#boardPageStrip'),inMenu:!!t&&!!t.closest('#ps-tb-menu'),visible:!!t&&t.getClientRects().length>0};})(),settings:(()=>{const b=document.getElementById('bpBoardSettings');if(!b)return null;const sp=b.querySelector('span'),sv=b.querySelector('svg');return {text:sp?sp.textContent:'',textShown:!!sp&&getComputedStyle(sp).display!=='none',svgShown:!!sv&&getComputedStyle(sv).display!=='none',w:Math.round(b.getBoundingClientRect().width)};})()};});
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForFunction(READY,null,{timeout:60000});
  const f=await (await page.$('#fBoard')).contentFrame();
  assert.equal(await f.evaluate(()=>document.body.classList.contains('ps-dock-float')),true,'떠 있는 도크 화면(데스크톱 · 아이패드)');
  await f.waitForFunction(()=>{const s=document.getElementById('boardPageStrip'),b=document.getElementById('ps-df-fold');return s&&s.classList.contains('ps-tb')&&s.getClientRects().length&&b&&b.offsetWidth>0;},null,{timeout:20000});
  await page.waitForTimeout(600);

  step('row');
  const open0=await look(f);
  assert.equal(open0.pos,'relative','띠는 제 줄(겹 아님) '+JSON.stringify(open0.strip));
  assert.ok(open0.strip&&open0.strip.h>=50&&open0.strip.h<=54,'띠 높이 52 '+JSON.stringify(open0.strip));
  assert.ok(open0.svg&&open0.svg.t>=open0.strip.b,'운동장 SVG 는 띠 아래부터 '+JSON.stringify([open0.strip,open0.svg]));
  assert.ok(open0.pitch.t>=open0.strip.b,'운동장 윗선이 띠 아래 '+JSON.stringify([open0.strip,open0.pitch]));
  assert.equal(open0.overlap,0,'띠 안 단추가 운동장과 겹치지 않는다');
  assert.equal(open0.inset,0,'가로 판은 예약 0');assert.equal(open0.doorInset,0,'세로 판도 예약 0 — 빈 판의 «포메이션으로 시작» 문이 헤더 안이라(3.078 의 띠 몫 · 첫 3.309 의 문 몫 둘 다 없다)');
  assert.ok(open0.door.inStrip&&open0.door.box,'빈 판의 문은 헤더 안에 보인다 '+JSON.stringify(open0.door));
  assert.ok(open0.door.box.t>=open0.strip.t&&open0.door.box.b<=open0.strip.b,'문이 헤더 줄 안에 '+JSON.stringify([open0.strip,open0.door.box]));
  assert.equal(open0.where,'작업 보드');assert.equal(open0.page,'','페이지 하나면 n / m 없음');
  assert.equal(open0.centre,false,'가운데 덩어리(평면 · 3D · 선수 모양)는 없다');
  assert.ok(open0.tools.inMenu&&!open0.tools.inHeader&&!open0.tools.visible,'«배치 도구»는 헤더가 아니라 «보드 ▾» 메뉴에 '+JSON.stringify(open0.tools));
  assert.ok(open0.settings&&open0.settings.text==='보드 설정'&&open0.settings.textShown&&!open0.settings.svgShown&&open0.settings.w>=50,'«보드 설정»은 글자 단추(톱니 숨김) '+JSON.stringify(open0.settings));

  step('fold');
  await f.evaluate(()=>window.__psDockFold('close'));
  await f.waitForFunction(()=>document.body.classList.contains('cmd-dock-folded'),null,{timeout:5000});await page.waitForTimeout(600);
  const fold=await look(f);
  assert.equal(fold.strip,false,'«도구 접기» → 띠 줄이 사라진다');
  assert.ok(fold.svg.t<open0.svg.t-30&&fold.svg.h>open0.svg.h+30,'운동장이 띠 자리까지 올라와 커진다 '+JSON.stringify([open0.svg,fold.svg]));

  step('unfold');
  await f.evaluate(()=>window.__psDockFold('open'));
  await f.waitForFunction(()=>!document.body.classList.contains('cmd-dock-folded'),null,{timeout:5000});await page.waitForTimeout(600);
  const open1=await look(f);
  assert.ok(open1.strip&&open1.pos==='relative','띠가 제 줄로 돌아온다');
  assert.deepEqual(open1.svg,open0.svg,'운동장은 처음 자리 · 크기');assert.equal(open1.overlap,0);

  step('page');
  await f.evaluate(()=>document.querySelector('#boardPageStrip .tb-add').click());
  await f.waitForFunction(()=>document.querySelectorAll('#boardPageStrip .bp-tab').length>=2,null,{timeout:5000});await page.waitForTimeout(400);
  const two=await look(f);
  assert.ok(two.tabs>=2);assert.equal(two.page,'2 / 2','페이지를 더하면 «n / m»');assert.equal(two.where,'작업 보드');
  await f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[0].click());await page.waitForTimeout(400);
  assert.equal((await look(f)).page,'1 / 2','탭을 옮기면 따라온다');
  assert.equal((await look(f)).overlap,0);

  step('door');
  await f.locator('#ehDoor').click();
  await f.locator('.eh-f',{hasText:'4-3-3'}).first().waitFor({state:'visible',timeout:5000});   /* 문을 누르면 보드 설정 › 배치(2.277 — 패널이 서 있으면 그 탭, 아니면 떠 있는 카드)의 포메이션 칩 */
  await f.evaluate(()=>{try{if(window.__psToggleBoardSettings)window.__psToggleBoardSettings('force-close');}catch(_){}try{hideEmptyHint();}catch(_){}});await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>{const e=document.querySelector('.eh-f');return !!e&&e.getClientRects().length>0;}),false,'닫힌다');
  await f.evaluate(()=>{state.players=[{id:9001,team:'blue',num:7,x:300,y:300}];renderTokens();});await page.waitForTimeout(500);
  const placed=await look(f);
  assert.equal(placed.door.box,false,'선수가 놓이면 문이 숨는다 '+JSON.stringify(placed.door));assert.equal(placed.doorInset,0);assert.equal(placed.overlap,0);
  assert.deepEqual(placed.svg,open0.svg,'문이 숨어도 운동장 자리 · 크기 그대로(예약이 없으니) '+JSON.stringify([open0.svg,placed.svg]));

  step('tools');
  await f.locator('#tbBrand').click();await f.waitForFunction(()=>document.getElementById('ps-tb-menu').classList.contains('on'),null,{timeout:5000});
  assert.equal(await f.locator('#ps-tb-menu #psEditToolsToggle').isVisible(),true,'메뉴 안에 «배치 도구»');
  await f.locator('#ps-tb-menu #psEditToolsToggle').click();await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>{const p=document.getElementById('psEditTools');return !!p&&!p.hidden&&p.getClientRects().length>0;}),true,'누르면 배치 도구 패널');
  assert.equal(await f.evaluate(()=>document.getElementById('ps-tb-menu').classList.contains('on')),false,'메뉴는 닫힌다');
  assert.equal((await look(f)).overlap,0);
  await f.locator('#psEditTools [data-close]').click();await page.waitForTimeout(200);
  assert.equal(await f.evaluate(()=>document.getElementById('psEditTools').hidden),true,'닫힌다');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,passed:true}));
}catch(e){console.error('board-header-row-3309 failed at '+cur);console.error(e);process.exitCode=1;}
finally{try{for(const b of Object.values(browsers))await b.close();}catch(_){}try{await fx.close();}catch(_){}process.exit(process.exitCode||0);}
