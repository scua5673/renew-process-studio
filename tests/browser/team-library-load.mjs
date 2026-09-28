import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.903 — 제보 «팀명단 설정에서 만든 팀을 불러올시 11명만 불러오게 되어있음»: 저장 팀 불러오기는 인원 제한이 없다.
// 11명은 4-3-3 자리, 나머지는 아래 대기 줄. 기본은 전원 선택. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(3000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof openAnalysisTeamLibrary==='function'&&window.PSTeamLibrary);
  await page.waitForTimeout(1200);
  const POS=['GK','CB','CB','LB','RB','DM','CM','CM','LW','RW','CF','GK','CB','CM','CM','LW','CF','RB'];
  await f.evaluate(POS=>{localStorage.setItem(PSTeamLibrary.key,JSON.stringify([{id:'lib-t1',name:'가상 명단 FC',players:POS.map((p,i)=>({no:String(i+1),name:'명단 선수 '+(i+1),pos:p}))}]));},POS);
  await f.evaluate(()=>{state.players=[];renderTokens();openAnalysisTeamLibrary();});
  await f.waitForSelector('#alLoad');
  const checked=await f.evaluate(()=>document.querySelectorAll('#alPlayers input:checked').length);
  assert.equal(checked,18,'기본은 전원 선택');
  await f.evaluate(()=>document.getElementById('alLoad').click());
  await page.waitForTimeout(500);
  const r=await f.evaluate(()=>{const ps=state.players.filter(p=>p.team==='blue');const keys=new Set(ps.map(p=>Math.round(p.x)+','+Math.round(p.y)));
    return {n:ps.length,distinct:keys.size,inside:ps.every(p=>p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H),names:ps.map(p=>p.name)};});
  assert.equal(r.n,18,'18명 모두 불러온다');
  assert.equal(r.distinct,18,'겹치는 자리 없음');
  assert.ok(r.inside,'모두 운동장 안');
  assert.ok(r.names.includes('명단 선수 18'));
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,loaded:r.n,distinct:r.distinct}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
