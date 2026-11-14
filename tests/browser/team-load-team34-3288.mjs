/* 3.288 — 저장 팀을 팀 3 · 팀 4 에도(제보 29c97fc5 «저장된 팀을 불러올 때 팀 1 과 팀 2 에만 … 팀 3, 팀 4 에도»).
   판에 그 팀 토큰이 있으면 팀 1 · 2 와 같은 규칙(자리 그대로, 포지션이 맞는 토큰에 이름 · 번호), 남는 선수와 판에 없는 팀은 대기 줄의 둘째 줄부터 —
   팀 1 · 2 의 포메이션 자리 · 첫 대기 줄을 덮지 않는다. 팀 4 는 팀 2 쪽 구석(오른쪽 팀). 합성 팀 fixture 에서만 돈다. */
import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&typeof w.openAnalysisTeamLibrary==='function'&&w.PSTeamLibrary&&w.PSTeamLoad;},null,{timeout:60000});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await page.waitForTimeout(1200);
  const TEAM=[['9','중앙 공격','ST'],['1','골키퍼','GK'],['4','센터백 하나','CB'],['5','센터백 둘','CB'],['3','왼쪽 풀백','LB'],['2','오른쪽 풀백','RB'],['8','공격형','CAM'],
    ['6','수비형','CDM'],['7','왼쪽 윙','LW'],['11','오른쪽 윙','RW'],['10','왼쪽 중앙','LCM'],['12','후보 공격','ST'],['13','후보 수비','CB']].map(([no,name,pos],i)=>({id:'tp'+i,no,name,pos}));
  await f.evaluate(TEAM=>{localStorage.setItem(PSTeamLibrary.key,JSON.stringify([{id:'lib-34',name:'가상 셋째 FC',players:TEAM,kit:{main:'#aa2244',pattern:'v'}}]));},TEAM);
  /* 판: 팀 1 · 2 는 4-3-3 자리(이름 있음), 팀 3 은 코치가 놓은 토큰 셋, 팀 4 는 없음 */
  await f.evaluate(()=>{
    try{stopAnim();}catch(_){}
    state.players=[];
    FORM['433'].forEach((s,i)=>{const a=n2u(s[0],s[1]),b=n2u(1-s[0],1-s[1]);
      state.players.push({id:uid++,team:'blue',num:i+1,pos:s[3]||'',name:'청 '+(i+1),x:a.x,y:a.y});
      state.players.push({id:uid++,team:'red',num:i+1,pos:s[3]||'',name:'홍 '+(i+1),x:b.x,y:b.y});});
    [[.5,.2,'GK'],[.5,.5,'CB'],[.5,.8,'ST']].forEach(([nx,ny,pos],i)=>{const u=n2u(nx,ny);state.players.push({id:uid++,team:'yellow',num:i+1,pos,x:u.x,y:u.y});});
    pushUndo();renderTokens();
  });
  const snap=()=>f.evaluate(()=>state.players.map(p=>({id:p.id,team:p.team,num:String(p.num),pos:p.pos||'',name:p.name||null,x:p.x,y:p.y})));
  const openDlg=async side=>{
    await f.evaluate(()=>{openAnalysisTeamLibrary();});await f.waitForSelector('#alLoad');
    const opts=await f.evaluate(()=>[...document.querySelectorAll('#alSide option')].map(o=>[o.value,o.textContent]));
    await f.evaluate(side=>{const s=document.getElementById('alSide');s.value=side;s.dispatchEvent(new Event('change'));},side);
    return opts;
  };
  const load=async()=>{await f.evaluate(()=>document.getElementById('alLoad').click());await f.waitForFunction(()=>!document.getElementById('alLoad'));};
  const benchAt=(from,n,flip)=>f.evaluate(({from,n,flip})=>Array.from({length:n},(_,k)=>{const b=PSTeamLoad.bench(from+k),u=n2u(flip?1-b[0]:b[0],flip?1-b[1]:b[1]);return Math.round(u.x)+','+Math.round(u.y);}),{from,n,flip});
  const cell=p=>Math.round(p.x)+','+Math.round(p.y);

  /* ① 먼저 팀 1 에 13명 — 둘은 첫 대기 줄(예전 그대로) */
  assert.deepEqual(await openDlg('blue'),[['blue','팀 1'],['red','팀 2'],['yellow','팀 3'],['green','팀 4']],'불러올 팀은 넷');
  await load();
  const s1=await snap();
  assert.deepEqual(s1.filter(p=>p.team==='blue').slice(11).map(cell).sort(),(await benchAt(0,2,false)).sort(),'팀 1 의 남는 둘은 첫 대기 줄');

  /* ② 팀 3 — 판의 토큰 셋은 자리 그대로 이름 · 번호, 나머지 열은 둘째 줄 */
  await openDlg('yellow');await load();
  const s2=await snap(),y0=s1.filter(p=>p.team==='yellow'),y2=s2.filter(p=>p.team==='yellow'),by=Object.fromEntries(y2.map(p=>[p.id,p]));
  assert.equal(y2.length,13);
  for(const b of y0){const a=by[b.id];assert.ok(a,'놓아 둔 팀 3 토큰 '+b.pos);assert.deepEqual([a.x,a.y,a.pos],[b.x,b.y,b.pos],b.pos+' 자리 그대로');}
  assert.deepEqual(Object.fromEntries(y0.map(b=>[b.pos,[by[b.id].name,by[b.id].num]])),{GK:['골키퍼','1'],CB:['센터백 하나','4'],ST:['중앙 공격','9']},'포지션이 맞는 선수가 그 자리에');
  const yb=y2.filter(p=>!y0.some(b=>b.id===p.id));
  assert.deepEqual(yb.map(cell).sort(),(await benchAt(16,10,false)).sort(),'남는 열 명은 대기 줄의 둘째 줄');
  assert.equal(new Set(s2.map(cell)).size,s2.length,'어느 토큰과도 겹치지 않는다(팀 1 의 첫 대기 줄 포함)');
  assert.deepEqual(s2.filter(p=>p.team!=='yellow'),s1.filter(p=>p.team!=='yellow'),'다른 팀은 그대로');
  const kit=await f.evaluate(()=>({y:state.teamColors&&state.teamColors.yellow,yp:state.teamPattern&&state.teamPattern.yellow,b:state.teamColors&&state.teamColors.blue,r:state.teamColors&&state.teamColors.red||null}));
  assert.deepEqual([kit.y,kit.yp,kit.r],['#aa2244','v',null],'유니폼은 고른 팀에만 '+JSON.stringify(kit));
  /* ③ 되돌리기 한 번 — 팀 3 불러오기 전 */
  await f.evaluate(()=>undoLast());
  assert.deepEqual(await snap(),s1,'되돌리면 불러오기 전');
  await f.evaluate(()=>redoLast());
  assert.deepEqual(await snap(),s2,'다시 하기');

  /* ④ 팀 4 — 판에 없는 팀: 포메이션 대신 대기 줄(팀 2 쪽 구석, 둘째 줄), 아무도 덮지 않는다 */
  await openDlg('green');await load();
  const s3=await snap(),g=s3.filter(p=>p.team==='green');
  assert.equal(g.length,13);
  assert.deepEqual(g.map(cell).sort(),(await benchAt(16,13,true)).sort(),'팀 4 는 오른쪽 팀 구석의 둘째 줄');
  assert.deepEqual(g.map(p=>p.name).sort(),TEAM.map(p=>p.name).sort(),'이름 열셋');
  assert.equal(new Set(s3.map(cell)).size,s3.length,'겹치는 자리 없음');
  assert.deepEqual(s3.filter(p=>p.team!=='green'),s2,'다른 팀은 그대로');
  assert.equal(await f.evaluate(()=>state.teamColors.green),'#aa2244');
  const pr=await f.evaluate(()=>{const r=PR();return {L:r.L,T:r.T,PW:r.PW,PH:r.PH};});
  assert.ok(s3.every(p=>p.x>pr.L&&p.x<pr.L+pr.PW&&p.y>pr.T&&p.y<pr.T+pr.PH),'모두 운동장 안');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'작전판 오류 없음 '+JSON.stringify(errs));
  if(process.env.PS_SHOT_DIR){await page.screenshot({path:process.env.PS_SHOT_DIR+'/team34-board.png'});
    await openDlg('yellow');await page.screenshot({path:process.env.PS_SHOT_DIR+'/team34-dialog.png'});await f.evaluate(()=>document.getElementById('alCancel').click());}
  console.log(JSON.stringify({passed:true,engine,size,yellow:y2.length,green:g.length}));
}catch(e){console.error(e);process.exitCode=1;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}
