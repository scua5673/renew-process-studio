/* 3.289 — 팀을 넷보다 많이(제보 29c97fc5 «팀 5, 팀 6 등 제한 없이» · 사용자 11/15 «팀 많이 추가할수 있게 해줘», studio/board-teams.js).
   도크 «선수» 칸: 팀 넷 + «팀 추가» → 누르면 팀 5 … 팀 10 이 차례로(쓰는 만큼만 보인다 — 저장 → 새로고침 뒤에는 판에서 쓰는 가장 큰 번호까지).
   새 팀도 기본 색 · 유니폼 꾸미기 · 그림(썸네일) · 저장 팀 불러오기가 된다. 앞의 넷은 그대로. 합성 팀 fixture 에서만 돈다. */
import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  const board=async()=>{
    await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&w.PSTeams&&w.syncTeamDots&&w.syncTeamDots.__psTeams===true&&w.document.body.classList.contains('ps-dock-float');},null,{timeout:60000});
    return (await page.$('#fBoard')).contentFrame();
  };
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  let f=await board();await page.waitForTimeout(1200);
  const pills=()=>f.evaluate(()=>[...document.querySelectorAll('#benchCat .tpill')].map(p=>p.classList.contains('ps-team-add')?'+':p.dataset.cat));
  const KEYS=['blue','red','yellow','green','pink','orange','purple','sky','white','black'];

  /* ① 처음: 팀 넷 + «팀 추가» — 예전 넷은 그대로 */
  assert.deepEqual(await pills(),['blue','red','yellow','green','+']);
  assert.deepEqual(await f.evaluate(()=>[PSTeams.count(),PSTeams.shown(),teamHex('blue'),teamHex('red'),teamHex('yellow'),teamHex('green'),isRightTeam('red'),isRightTeam('green'),isRightTeam('blue'),isRightTeam('yellow')]),
    [4,['blue','red','yellow','green'],'#1a2f5c','#d12f38','#eeff00','#34a56f',true,true,false,false]);
  await f.locator('#ps-df-team').click();await f.locator('#ps-df-tray.on #benchCat .ps-team-add').waitFor();
  const lay=()=>f.evaluate(()=>{const tray=document.getElementById('ps-df-tray').getBoundingClientRect(),dock=document.getElementById('ps-command-dock').getBoundingClientRect(),ps=[...document.querySelectorAll('#benchCat .tpill')].map(p=>p.getBoundingClientRect());
    return {rows:new Set(ps.map(r=>Math.round(r.top))).size,minW:Math.min(...ps.map(r=>Math.round(r.width))),gap:Math.round(dock.top-tray.bottom),top:Math.round(tray.top),inside:ps.every(r=>r.left>=tray.left-1&&r.right<=tray.right+1)};});
  const l0=await lay();assert.equal(l0.rows,1,'팀 넷 + «팀 추가»는 한 줄 — 칸 높이는 예전 그대로 '+JSON.stringify(l0));assert.ok(l0.minW>=56&&l0.inside&&l0.gap>=6&&l0.top>=8,JSON.stringify(l0));
  assert.deepEqual(await f.evaluate(()=>{const a=document.querySelector('#benchCat .ps-team-add');return [a.getAttribute('data-df-label'),a.getAttribute('aria-label'),!!a.querySelector('.ps-kit-pen')];}),['팀 추가','팀 5 추가',false]);

  /* ② «팀 추가» — 팀 5 가 나타나고 골라진다. 라벨 · ✎ · 기본 색 */
  await f.locator('#benchCat .ps-team-add').click();
  await f.waitForFunction(()=>__getBenchCat2()==='pink');
  assert.deepEqual(await pills(),['blue','red','yellow','green','pink','+']);
  assert.deepEqual(await f.evaluate(()=>{const p=document.querySelector('#benchCat .tpill[data-cat="pink"]');return [p.getAttribute('data-df-label'),p.getAttribute('data-df-n'),p.classList.contains('on'),p.getAttribute('aria-pressed'),!!p.querySelector('.ps-kit-pen'),teamHex('pink'),document.querySelector('#benchCat .ps-team-add').getAttribute('aria-label')];}),
    ['팀 5','5',true,'true',true,'#e0569f','팀 6 추가']);
  /* 골라 둔 채 운동장에 놓는다(도크 «한 번에 놓기»와 같은 함수) */
  const placed=await f.evaluate(()=>{const n0=state.players.length;addPlayers('pink',3);const ps=state.players.slice(n0);return {n:ps.length,teams:[...new Set(ps.map(p=>p.team))],col:playerTeamCol(ps[1]),gk:playerTeamCol(ps[0]),drawn:ps.every(p=>!!document.querySelector('#tokens [data-id="'+p.id+'"],[data-pid="'+p.id+'"],#tokenLayer [data-id="'+p.id+'"]'))||null};});
  assert.deepEqual([placed.n,placed.teams,placed.col],[3,['pink'],'#e0569f'],JSON.stringify(placed));

  /* ③ 팀 10 까지 — 두 줄, 칸은 도크 위에 그대로, «팀 추가»는 사라진다 */
  for(let i=6;i<=10;i++){await f.locator('#benchCat .ps-team-add').click();await f.waitForFunction(k=>__getBenchCat2()===k,KEYS[i-1]);}
  assert.deepEqual(await pills(),KEYS);
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#benchCat .tpill')].map(p=>[p.getAttribute('data-df-label'),!!p.querySelector('.ps-kit-pen')])),KEYS.map((_,i)=>['팀 '+(i+1),true]));
  const l1=await lay();assert.equal(l1.rows,2,'열 팀은 두 줄 '+JSON.stringify(l1));assert.ok(l1.inside&&l1.gap>=6&&l1.top>=8&&l1.top<l0.top,'칸이 커지면 도크 위로 다시 놓인다 '+JSON.stringify([l0,l1]));
  assert.deepEqual(await f.evaluate(()=>PSTeams.KEYS.map(k=>[teamHex(k),gkColFor(k),isRightTeam(k)])),await f.evaluate(()=>PSTeams.KEYS.map((k,i)=>[PSTeams.COL[k],PSTeams.GK[k],i%2===1])),'기본 색 · 골키퍼 색 · 오른쪽 팀');

  /* ④ 새 팀의 유니폼 — 팀 6 색을 바꾸면 토큰 · 알약 · 그림이 따라간다. 유니폼 창의 팀 칸은 열 */
  await f.evaluate(()=>{addPlayers('orange',2);addPlayers('purple',2);__setTeamMain('orange','#0aa7b5');});
  assert.deepEqual(await f.evaluate(()=>{const ps=state.players.filter(p=>p.team==='orange');return [teamHex('orange'),playerTeamCol(ps[1]),state.teamColors.orange,(state.teamColors.blue||null)];}),['#0aa7b5','#0aa7b5','#0aa7b5',null]);
  const thumb=await f.evaluate(()=>String(__snapToThumb(captureSnap())).toLowerCase());
  for(const c of ['#e0569f','#0aa7b5','#7c3aed'])assert.ok(thumb.includes(c),'그림에 새 팀 색 '+c);
  await f.evaluate(()=>__psKitOpen({team:'orange'}));
  assert.deepEqual(await f.evaluate(()=>{const b=[...document.querySelectorAll('#psKitEd .ke-teams [data-team]')];return [b.filter(x=>!x.hidden).map(x=>x.textContent.trim()),b.find(x=>x.classList.contains('on')).getAttribute('data-team')];}),[KEYS.map((_,i)=>'팀 '+(i+1)),'orange']);
  await f.locator('#psKitEd .ke-x').click();

  /* ⑤ 저장 → 새로고침: 판에서 쓰는 가장 큰 번호(팀 7)까지만 보이고, 토큰의 팀 · 색은 그대로 */
  const before=await f.evaluate(()=>state.players.map(p=>[p.id,p.team,String(p.num),p.x,p.y]));
  assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true,'보드 저장');
  await page.reload({waitUntil:'domcontentloaded'});f=await board();
  await f.waitForFunction(n=>state.players.length===n,before.length,{timeout:30000});await page.waitForTimeout(800);
  assert.deepEqual(await f.evaluate(()=>state.players.map(p=>[p.id,p.team,String(p.num),p.x,p.y])),before,'판은 그대로');
  assert.deepEqual(await pills(),['blue','red','yellow','green','pink','orange','purple','+'],'쓰는 만큼만 — 팀 8 · 9 · 10 은 다시 접힌다');
  assert.deepEqual(await f.evaluate(()=>[PSTeams.count(),teamHex('orange'),teamHex('pink'),document.querySelector('#benchCat .ps-team-add').getAttribute('aria-label')]),[7,'#0aa7b5','#e0569f','팀 8 추가']);

  /* ⑥ 저장 팀 불러오기 — 보이는 팀 모두. 판에 있는 팀 7 은 자리 그대로, 판에 없는 팀 8 은 대기 줄(팀 둘마다 한 줄 위 · 짝수는 반대쪽 구석) */
  const TEAM=[['1','골키퍼','GK'],['4','수비','CB'],['8','미드','CM'],['9','공격','ST']].map(([no,name,pos],i)=>({id:'mt'+i,no,name,pos}));
  await f.evaluate(TEAM=>{localStorage.setItem(PSTeamLibrary.key,JSON.stringify([{id:'lib-more',name:'가상 여럿 FC',players:TEAM}]));},TEAM);
  const load=async side=>{await f.evaluate(()=>{openAnalysisTeamLibrary();});await f.waitForSelector('#alLoad');
    const opts=await f.evaluate(()=>[...document.querySelectorAll('#alSide option')].map(o=>[o.value,o.textContent]));
    await f.evaluate(side=>{const s=document.getElementById('alSide');s.value=side;s.dispatchEvent(new Event('change'));},side);
    await f.evaluate(()=>document.getElementById('alLoad').click());await f.waitForFunction(()=>!document.getElementById('alLoad'));return opts;};
  const p7=await f.evaluate(()=>state.players.filter(p=>p.team==='purple').map(p=>[p.id,p.x,p.y]));
  assert.deepEqual(await load('purple'),KEYS.slice(0,7).map((k,i)=>[k,'팀 '+(i+1)]),'불러올 팀은 보이는 일곱');
  const a7=await f.evaluate(()=>state.players.filter(p=>p.team==='purple').map(p=>({id:p.id,x:p.x,y:p.y,name:p.name||null})));
  for(const b of p7){const a=a7.find(q=>q.id===b[0]);assert.ok(a&&a.x===b[1]&&a.y===b[2]&&a.name,'팀 7 토큰은 자리 그대로 이름이 들어간다 '+JSON.stringify(a));}
  const cell=p=>Math.round(p.x)+','+Math.round(p.y);
  assert.deepEqual(a7.filter(q=>!p7.some(b=>b[0]===q.id)).map(cell).sort(),(await f.evaluate(()=>[0,1].map(k=>{const b=PSTeamLoad.bench(PSTeams.benchFrom('purple')+k),u=n2u(b[0],b[1]);return Math.round(u.x)+','+Math.round(u.y);}))).sort(),'남는 둘은 팀 7 의 대기 줄');
  await f.locator('#ps-df-team').click().catch(()=>{});await f.evaluate(()=>{PSTeams.reveal();});   /* 팀 8 을 꺼낸다 */
  await load('sky');
  const a8=await f.evaluate(()=>state.players.filter(p=>p.team==='sky').map(p=>({x:p.x,y:p.y,name:p.name})));
  assert.deepEqual(a8.map(p=>p.name).sort(),TEAM.map(p=>p.name).sort());
  assert.deepEqual(a8.map(cell).sort(),(await f.evaluate(()=>[0,1,2,3].map(k=>{const b=PSTeamLoad.bench(PSTeams.benchFrom('sky')+k),u=n2u(1-b[0],1-b[1]);return Math.round(u.x)+','+Math.round(u.y);}))).sort(),'팀 8 은 반대쪽 구석의 제 줄');
  const all=await f.evaluate(()=>state.players.map(p=>Math.round(p.x)+','+Math.round(p.y)));
  assert.equal(new Set(all).size,all.length,'겹치는 자리 없음 — «한 번에 놓기»도 토큰이 있는 칸을 건너뛴다');
  /* ⑦ «한 번에 놓기» — 같은 쪽 팀(1 · 3 · 5 …)이나 같은 팀을 한 번 더 놓아도 겹치지 않는다. 첫 줄 자리는 예전 그대로 */
  const bulk=await f.evaluate(()=>{state.players=[];renderTokens();addPlayers('blue',11);const first=state.players.map(p=>[p.x,p.y]);addPlayers('blue',11);addPlayers('yellow',11);addPlayers('pink',11);addPlayers('red',11);addPlayers('orange',11);
    const cells=state.players.map(p=>Math.round(p.x)+','+Math.round(p.y)),pr=PR();
    return {n:cells.length,uniq:new Set(cells).size,first,want:Array.from({length:11},(_,i)=>[CX-58-(i%5)*46,CY-25+Math.floor(i/5)*50]),nums:state.players.filter(p=>p.team==='blue').map(p=>p.num),inside:state.players.every(p=>p.x>pr.L&&p.x<pr.L+pr.PW&&p.y>pr.T&&p.y<pr.T+pr.PH)};});
  assert.deepEqual(bulk.first,bulk.want,'빈 판의 첫 11명은 예전 자리');
  assert.deepEqual([bulk.n,bulk.uniq,bulk.inside],[66,66,true],'여섯 번 놓아도 겹치지 않고 운동장 안');
  assert.deepEqual(bulk.nums,Array.from({length:22},(_,i)=>i+1),'번호는 이어서');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'작전판 오류 없음 '+JSON.stringify(errs));
  console.log(JSON.stringify({passed:true,engine,size,rows:[l0.rows,l1.rows]}));
}catch(e){console.error(e);process.exitCode=1;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}
