import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.121 — 유니폼 꾸미기 «토큰 미리보기»(board-kit.js). 사용자 «토큰 유니폼 설정할 때 미리보기 가능하게 해줘 유니폼 설정에서».
// 창을 열면 원형 · 유니폼 토큰이 판과 같은 그림(유니폼 · 무늬 · 번호)으로, 색 · 무늬 · 골키퍼를 바꾸면 바로 따라 바뀐다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  // 3.101 — 판에 손대는 시험은 내 작업판을 다 불러온 뒤에
  await f.waitForFunction(()=>window.__psKitOpen&&window.PSJersey&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
  await page.waitForTimeout(600);

  const read=()=>f.evaluate(()=>[...document.querySelectorAll('#psKitEd .ke-tok')].map(t=>{
    const svg=t.querySelector('svg'),base=svg.querySelector(t.dataset.shape==='shirt'?'path[stroke-width="2.2"]':'circle[r="21"]'),
      sleeve=[...svg.querySelectorAll('path')].find(p=>p.getAttribute('d')===PSJersey.GEO[t.dataset.shape==='shirt'?'s':'c'].sleeve);
    return {shape:t.dataset.shape,on:t.classList.contains('on'),n:svg.children.length,fill:base&&base.getAttribute('fill'),sleeve:sleeve&&sleeve.getAttribute('fill'),num:(svg.querySelector('text')||{}).textContent,vis:t.getBoundingClientRect().width>0};
  }));
  await f.evaluate(()=>{state.teamColors={red:'#d71920'};state.teamColor2={red:'#ffffff'};state.teamPattern={red:'solid'};
    state.players=[{id:'kp1',team:'red',num:'9',x:500,y:330}];setTokShape('circle');renderTokens();window.__psKitOpen({team:'red',gk:false});});
  await f.waitForFunction(()=>document.getElementById('psKitEd')&&document.getElementById('psKitEd').classList.contains('on'));
  let r=await read();
  assert.deepEqual(r.map(t=>t.shape),['circle','shirt'],'원형 · 유니폼 둘');
  assert.ok(r.every(t=>t.vis&&t.n>=15),'유니폼 그림까지 '+JSON.stringify(r));
  assert.deepEqual(r.map(t=>[t.fill,t.sleeve,t.num]),[['#d71920','#d71920','10'],['#d71920','#d71920','10']],'팀 주색 · 10번');
  assert.deepEqual(r.map(t=>t.on),[true,false],'지금 판의 모양(원형)');
  await page.screenshot({path:path.join(SHOTS,'board-kit-preview-'+engine+'.png')});

  // 색 · 무늬를 바꾸면 바로
  await f.evaluate(()=>document.querySelector('#psKitEd .ke-sw [data-c="#1e5bc6"]').click());
  await f.evaluate(()=>document.querySelector('#psKitEd [data-pat="v"]').click());
  r=await read();
  assert.ok(r.every(t=>t.sleeve==='#1e5bc6'),'주색 → 소매 '+JSON.stringify(r));
  assert.ok(r.every(t=>/^url\(#kePv-/.test(t.fill)),'줄무늬 → 무늬 채우기 '+JSON.stringify(r));
  assert.equal(await f.evaluate(()=>!!document.querySelector('#psKitEd #kePv-circle')),true,'무늬 정의가 미리보기 안에');

  // 골키퍼 · 판의 모양
  await f.evaluate(()=>document.querySelector('#psKitEd [data-gk="1"]').click());
  r=await read();
  assert.deepEqual(r.map(t=>t.num),['1','1'],'골키퍼는 1번');
  assert.equal(r[0].sleeve,await f.evaluate(()=>gkColFor('red')),'골키퍼 색');
  await f.evaluate(()=>{setTokShape('shirt');document.querySelector('#psKitEd [data-gk="0"]').click();});
  r=await read();
  assert.deepEqual(r.map(t=>t.on),[false,true],'유니폼 모양이면 유니폼에 «지금 판»');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
