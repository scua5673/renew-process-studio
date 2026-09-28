import assert from 'node:assert/strict';
import {startFixture,openApp,WT,A} from '../fixtures/team-app.mjs';
// 2.903 — 제보 9/23 «게임모델 작전판에는 애니메이션 저장이 안 되는 거죠?»: 국면에 첨부한 작전판이 장면(애니메이션)까지 남고,
// «▶ 보기»로 다시 열면 장면이 돌아온다. 첨부 중에는 아무 일도 하지 않던 «저장»·«보관함 저장»을 숨긴다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
fx.db.set(WT+'|cs_gamemodel_v1',{workspace_id:WT,k:'cs_gamemodel_v1',cupd:1000,updated_by:A,v:JSON.stringify({identity:'가상 팀',moments:[{key:'ao',name:'공격',tag:'IN POSSESSION',main:'',phases:[{id:'ph1',name:'전개',principles:['가상 원칙'],snap:null}]}]})});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const boardFrame=async page=>(await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
const gmFrame=async page=>(await page.waitForSelector('#fGameModel',{state:'attached'})).contentFrame();
const hidden=sel=>`(()=>{const e=document.querySelector('${sel}');if(!e)return true;const cs=getComputedStyle(e),r=e.getBoundingClientRect();return cs.display==='none'||cs.visibility==='hidden'||r.width===0;})()`;
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await wait(3000);
  await page.evaluate(()=>document.querySelector('#teamSub [data-team-key="settings"]').click());await wait(3500);
  let gm=await gmFrame(page);await gm.waitForSelector('.attachbtn',{timeout:20000});
  await gm.evaluate(()=>[...document.querySelectorAll('.attachbtn')].find(b=>b.textContent.includes('작전판 첨부')).click());await wait(2500);
  let f=await boardFrame(page);
  assert.equal(await f.evaluate(()=>document.body.classList.contains('ps-capturing')),true,'첨부 모드 표식');
  assert.equal(await f.evaluate(hidden('#boardManualSave')),true,'첨부 중 «저장» 숨김');
  assert.equal(await f.evaluate(hidden('#vaultSave')),true,'첨부 중 «보관함 저장» 숨김');
  const made=await f.evaluate(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    state.players=[{id:'g1',team:'blue',num:'9',x:300,y:300}];renderTokens();ensureAnimMode(true);await sleep(200);
    for(let i=0;i<2;i++){document.getElementById('animAdd').click();await sleep(200);state.players[0].x+=120;renderTokens();autoSaveAnimFrame();await sleep(200);}
    return anim.frames.map(fr=>Math.round(fr.snap.players[0].x));});
  assert.equal(made.length,3,'장면 3개를 만든다');
  await f.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/첨부 완료/.test(b.textContent)).click());await wait(2500);
  const stored=await page.evaluate(()=>{const m=JSON.parse(localStorage.getItem('cs_gamemodel_v1')||'null');const ph=m&&m.moments[0].phases[0];return ph&&ph.snap?{keys:Object.keys(ph.snap),frames:(ph.snap.frames||[]).map(fr=>Math.round(fr.snap.players[0].x))}:null;});
  assert.ok(stored&&stored.keys.includes('thumb')&&stored.keys.includes('snap'),'정지 그림도 그대로');
  assert.deepEqual(stored.frames,made,'장면이 국면에 저장된다');
  assert.equal(await f.evaluate(()=>document.body.classList.contains('ps-capturing')),false,'첨부가 끝나면 표식 해제');
  gm=await gmFrame(page);
  await gm.evaluate(()=>[...document.querySelectorAll('.attachbtn')].find(b=>b.textContent.includes('보기')).click());await wait(2500);
  f=await boardFrame(page);
  const view=await f.evaluate(()=>({n:anim.frames.length,xs:anim.frames.map(fr=>Math.round(fr.snap.players[0].x)),bar:document.getElementById('animBar').classList.contains('on')}));
  assert.equal(view.n,3,'«▶ 보기»로 장면이 돌아온다');assert.deepEqual(view.xs,made);assert.equal(view.bar,true);
  await f.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/첨부 완료/.test(b.textContent));[...b.parentElement.querySelectorAll('button')].find(x=>x.textContent.trim()==='취소').click();});await wait(1200);
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,made,stored:stored.frames,view}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
