import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.309 — 작전판 위쪽 띠는 운동장 밖 제 줄(헤더)이다(사용자 11/17 «도구들을 운동장과 겹치지 않게» · 목업 A안, 합성 팀 fixture 에서만).
//  ① 띠는 position:relative 의 한 줄 · 운동장 SVG 는 띠 아래부터(띠 bottom ≤ svg top) · 띠 안 단추 어느 것도 운동장 선 · 골대와 안 겹친다
//     (고치기 전 코드(3.078 겹)는 svg 가 띠 밑 6px 부터라 ① 에서 떨어진다)
//  ② «도구 접기» → 띠 줄이 사라져 운동장이 위로 커진다 → «도구 펼치기» → 제자리
//  ③ 왼쪽 글: 빈 작업 보드는 «작업 보드», 페이지를 더하면 «2 / 2»
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
    where:brand?brand.querySelector('.tb-where').textContent:null,page:brand?brand.querySelector('.tb-page').textContent:null,tabs:[...strip.querySelectorAll('.bp-tab')].filter(e=>e.getClientRects().length).length};});
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
  assert.equal(open0.inset,0,'가로 판은 예약 0');assert.ok(open0.doorInset>0&&open0.doorInset<80,'세로 판이라면 빈 판의 «포메이션으로 시작» 문 높이만 예약(3.078 의 띠 몫은 없다): '+open0.doorInset);
  assert.equal(open0.where,'작업 보드');assert.equal(open0.page,'','페이지 하나면 n / m 없음');

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

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,passed:true}));
}catch(e){console.error('board-header-row-3309 failed at '+cur);console.error(e);process.exitCode=1;}
finally{try{for(const b of Object.values(browsers))await b.close();}catch(_){}try{await fx.close();}catch(_){}process.exit(process.exitCode||0);}
