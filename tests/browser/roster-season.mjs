// 시즌별 선수단(목업 C안): 시즌 칩 → «새 시즌 시작»(3학년 졸업 · 2 · 1학년 진급 · 이름을 끄면 그대로) → 되돌리기 → 다시 시작 →
// 지난 시즌 보기(그날의 줄 · 보기 전용) → 졸업생 전체 → «현재 명단으로» → 선택 띠 «졸업 처리».
// 졸업은 표시 하나다 — 선수 객체 · 선수별 행 · 삭제 기록은 그대로, 가용인원 · 작전판 거울에는 현재 선수만. PS_SIZE=desktop|ipad|phone
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startFixture,openApp,SHOTS,WT,A,SIZES} from '../fixtures/team-app.mjs';
const require=createRequire(import.meta.url),store=require('../../studio/scouting-store.js');
/* 스카우팅 후보 넷 — 확정 둘(미리 켜짐) · 영입대상 하나(꺼짐) · 추천 하나(창에 안 나옴) */
const cands=[['sc-1','서지훈','CF','9','done'],['sc-2','오태양','RW','7','done'],['sc-4','문건우','CM','8','go'],['sc-5','배준혁','LB','3','rep']];
const target=store.reconcile(null,{v:1,players:cands.map(([id,name,pos,num,st])=>({id,dbId:id,type:'target',name,posId:'pos_'+pos,num,club:'가상 유나이티드',grade:'B',scoutSt:st,foot:'R',levels:{},profile:{}}))});
const size=process.env.PS_SIZE||'desktop',engine=process.env.PS_BROWSER_ENGINE||SIZES[size].engine,shots=process.env.PS_SHOTS_DIR||SHOTS;
SIZES[size].engine=engine;
const phone=size==='phone';
const fx=await startFixture(),browsers={};
fx.db.set(WT+'|cs_scout_targets_v1',{workspace_id:WT,k:'cs_scout_targets_v1',v:JSON.stringify(target),cupd:1000,updated_by:A});
const scoutRaw=fx.db.get(WT+'|cs_scout_targets_v1').v;
let step='open',frame=null;
try{
  const app=await openApp(fx,size,{browsers}),{page}=app,errors=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  await page.locator('#appSeg [data-team-hub]').click();
  await page.locator(phone?'#teamBottom [data-tb="players"]':'#teamNav [data-team-key="players"]').click();
  frame=await (await page.waitForSelector('#fScout')).contentFrame();
  await frame.locator('#pwTeam [data-pw-view="list"]').waitFor();
  await frame.getByRole('button',{name:'명단',exact:true}).click();
  await frame.locator('#pwTeam .pw-table tbody tr').first().waitFor();
  const rows=()=>frame.locator('#pwTeam .pw-table tbody tr');
  const state=()=>frame.evaluate(()=>{const o=data.players.filter(p=>p.type!=='target');return {n:o.length,grads:o.filter(p=>p.grad).map(p=>p.name),years:o.map(p=>[p.name,String(p.schoolYear||''),p.grad?p.grad.season:'']),season:data.meta&&data.meta.season?JSON.parse(JSON.stringify(data.meta.season)):null,ours:tmOurs().length,avail:window.__plAvailable().length};});
  const chip=()=>frame.locator('#pwTeam [data-pw-action="season"]');
  const pick=async text=>{await chip().click();await frame.locator('#psPickPop').waitFor();await frame.locator('#psPickPop button',{hasText:text}).click();};
  assert.equal(await rows().count(),18);

  // 학년을 적는다 — 3학년 넷 · 2학년 다섯 · 1학년 넷 · 나머지는 학년 없음
  step='seed';
  const seed=await frame.evaluate(()=>{const o=data.players.filter(p=>p.type!=='target');o.forEach((p,i)=>{if(i<4)p.schoolYear='3';else if(i<9)p.schoolYear='2';else if(i<13)p.schoolYear='1';});save({skipTargets:true});renderTeam();
    return {cur:PSRosterSeason.current(data.meta),y3:o.slice(0,4).map(p=>p.name),y2:o.slice(4,9).map(p=>p.name),y1:o.slice(9,13).map(p=>p.name),ids:o.map(p=>String(p.id)),was:JSON.stringify(o.map(p=>[p.id,p.schoolYear||'',!!p.grad]))};});
  const cur=seed.cur,next=String(+cur+1);
  await frame.waitForFunction(c=>{const b=document.querySelector('#pwTeam [data-pw-action="season"]');return b&&b.textContent.indexOf(c+' 시즌')>=0;},cur);
  assert.match(await frame.locator('#pwTeam .pw-result').innerText(),new RegExp(cur+' 시즌[\\s\\S]*18'));

  // ① 시즌 칩 → «새 시즌 시작…» 창
  step='open-dialog';
  await chip().click();await frame.locator('#psPickPop').waitFor();await page.screenshot({path:shots+'/roster-season-menu-'+size+'.png'});
  await frame.locator('#psPickPop button',{hasText:next+' 시즌 시작'}).click();
  const dlg=frame.locator('#pwSeason');await dlg.waitFor();
  assert.match(await dlg.locator('h2').innerText(),new RegExp(next+' 시즌 시작'));
  const text=await dlg.innerText();
  assert.match(text,/3학년 4명[\s\S]*→ 졸업/);assert.match(text,/2학년 5명[\s\S]*→ 3학년/);assert.match(text,/1학년 4명[\s\S]*→ 2학년/);assert.match(text,/학년 없음 5명은 그대로 둬요/);
  assert.match(await dlg.locator('[data-pws-sum]').innerText(),new RegExp(next+' 시즌 16명[\\s\\S]*졸업 4명[\\s\\S]*신입 2명[\\s\\S]*'+cur+' 시즌 명단은 그대로 남아요'));
  assert.match(text,/스카우팅에서 2명[\s\S]*1학년으로 넣어요/);
  assert.deepEqual(await dlg.locator('[data-pws-join]').evaluateAll(b=>b.map(x=>[x.textContent,x.getAttribute('aria-pressed')])),[['서지훈','true'],['오태양','true'],['문건우 · 영입대상','false']],'확정은 켜진 채 · 영입대상은 꺼진 채 · 추천은 없음');
  const dm=await frame.evaluate(()=>{const d=document.getElementById('pwSeason'),r=d.getBoundingClientRect();return {vw:innerWidth,vh:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,doc:document.documentElement.scrollWidth-innerWidth,small:[...d.querySelectorAll('button,input[type=checkbox]')].filter(x=>x.offsetParent).map(x=>{const b=(x.closest('label')||x).getBoundingClientRect();return [x.getAttribute('aria-label')||x.textContent.trim(),Math.round(b.width),Math.round(b.height)];}).filter(c=>c[1]<36||c[2]<36)};});
  console.error('[measure] season-dialog',size,JSON.stringify(dm));
  assert.ok(dm.left>=-.5&&dm.right<=dm.vw+.5&&dm.top>=-.5&&dm.bottom<=dm.vh+.5&&dm.doc<=1,'창이 화면 안 '+JSON.stringify(dm));
  assert.deepEqual(dm.small,[],'누르는 칸 36px 이상');
  await page.screenshot({path:shots+'/roster-season-dialog-'+size+'.png'});

  // ② 한 명은 남긴다(유급 · 전학) → 시작
  step='keep-one';
  await dlg.getByRole('button',{name:seed.y3[3],exact:true}).click();
  assert.equal(await dlg.getByRole('button',{name:seed.y3[3],exact:true}).getAttribute('aria-pressed'),'false');
  assert.match(await dlg.innerText(),/1명은 3학년 그대로/);
  assert.match(await dlg.locator('[data-pws-sum]').innerText(),new RegExp(next+' 시즌 17명[\\s\\S]*졸업 3명'));
  step='start';
  await dlg.getByRole('button',{name:next+' 시즌 시작',exact:true}).click();
  await frame.waitForFunction(()=>!document.getElementById('pwSeason'));
  let s=await state();
  assert.equal(s.n,20,'선수 18 + 신입 2');assert.deepEqual(s.grads.sort(),seed.y3.slice(0,3).sort());
  assert.equal(s.ours,17);assert.equal(s.season.cur,next);
  const joined=await frame.evaluate(()=>data.players.filter(p=>p.joinedFrom).map(p=>[p.name,p.joinedFrom.cid,String(p.schoolYear||''),p.grp||'']));
  assert.deepEqual(joined.map(j=>[j[0],j[2]]).sort(),[['서지훈','1'],['오태양','1']],'신입은 1학년으로');assert.equal(s.season.past.length,1);assert.equal(s.season.past[0].id,cur);assert.equal(s.season.past[0].rows.length,18);
  for(const n of seed.y2)assert.equal(s.years.find(y=>y[0]===n)[1],'3');for(const n of seed.y1)assert.equal(s.years.find(y=>y[0]===n)[1],'2');
  assert.equal(s.years.find(y=>y[0]===seed.y3[3])[1],'3');assert.equal(s.years.find(y=>y[0]===seed.y3[3])[2],'');
  await frame.waitForFunction(c=>document.querySelector('#pwTeam [data-pw-action="season"]').textContent.indexOf(c+' 시즌')>=0,next);
  assert.equal(await rows().count(),17);

  // ③ 되돌리기 — 넘기기 전 명단 그대로
  step='undo';
  const undo=frame.locator('.pw-undo');await undo.waitFor();
  /* 되돌리기 알림이 떠 있는 동안 선수를 체크해도 선택 띠의 단추를 가리지 않는다 — 실제로 눌리는지 본다 */
  await rows().first().locator('[data-pw-select]').check();
  const lift=await frame.evaluate(()=>{const u=document.querySelector('.pw-undo').getBoundingClientRect(),bar=document.querySelector('#pwTeam .pw-comparebar'),b=bar.getBoundingClientRect(),hit=[...bar.querySelectorAll('button')].filter(x=>x.offsetParent).map(x=>{const r=x.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return [x.textContent.trim(),!!e&&(e===x||x.contains(e))];});return {undo:[Math.round(u.top),Math.round(u.bottom)],bar:[Math.round(b.top),Math.round(b.bottom)],vh:innerHeight,overlap:!(u.bottom<=b.top||u.top>=b.bottom||u.right<=b.left||u.left>=b.right),hit};});
  console.error('[measure] undo-lift',size,JSON.stringify(lift));
  assert.equal(lift.overlap,false,'알림이 선택 띠와 겹치지 않는다');assert.ok(lift.undo[0]>=0,'알림이 화면 안');assert.deepEqual(lift.hit.filter(h=>!h[1]),[],'선택 띠 단추가 다 눌린다');
  await page.screenshot({path:shots+'/roster-season-undo-'+size+'.png'});
  await frame.getByRole('button',{name:'선택 해제',exact:true}).click();
  assert.equal(await frame.evaluate(()=>document.querySelector('.pw-undo').style.bottom),'','띠가 사라지면 알림은 제자리');
  assert.match(await undo.innerText(),new RegExp(next+' 시즌[\\s\\S]*졸업 3명[\\s\\S]*진급 9명[\\s\\S]*신입 2명'));
  await undo.getByRole('button',{name:'되돌리기'}).click();
  await frame.waitForFunction(()=>tmOurs().length===18);
  s=await state();assert.deepEqual(s.grads,[]);assert.equal(s.season,null);
  assert.equal(await frame.evaluate(()=>JSON.stringify(data.players.filter(p=>p.type!=='target').map(p=>[p.id,p.schoolYear||'',!!p.grad]))),seed.was);
  assert.equal(await rows().count(),18);
  assert.equal(await frame.evaluate(()=>data.players.filter(p=>p.joinedFrom).length),0,'되돌리면 신입도 빠진다');
  const undone=await frame.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('cs_player_del_v1')||'{}')));
  assert.equal(undone.length,2,'되돌린 신입은 삭제 기록과 함께');assert.ok(!undone.some(id=>seed.ids.includes(id)),'원래 선수에는 삭제 기록 없음');

  // ④ 다시 시작 — 거울(작전판 · IDP)과 가용인원에는 현재 선수만
  step='restart';
  /* 되돌리기 직후엔 후보 문서가 잠깐 «확인 중» — 풀린 뒤 창을 연다(CI 웹킷이 스카우팅 줄 없는 창에서 떨어졌다) */
  for(let i=0;i<60;i++){if(await frame.evaluate(()=>{try{scStore().check();return scStore().read().players.filter(p=>!p._scoutHidden).length>=3;}catch(e){return false;}}))break;await page.waitForTimeout(400);}
  await pick(next+' 시즌 시작');await dlg.waitFor();
  await dlg.getByRole('button',{name:seed.y3[3],exact:true}).click();
  for(const n of ['서지훈','오태양'])await dlg.getByRole('button',{name:n,exact:true}).click();   /* 이번엔 신입 없이 */
  assert.doesNotMatch(await dlg.locator('[data-pws-sum]').innerText(),/신입/);
  await dlg.getByRole('button',{name:next+' 시즌 시작',exact:true}).click();
  await frame.waitForFunction(()=>!document.getElementById('pwSeason')&&tmOurs().length===15);
  step='mirrors';
  let saved=null;
  for(let i=0;i<30&&!saved;i++){saved=await frame.evaluate(async()=>{try{await scoutStore.ready(true);}catch(e){return null;}const d=JSON.parse(localStorage.getItem('scout_tool_v1')),sq=JSON.parse(localStorage.getItem('cs_squad_v1')||'null'),at=JSON.parse(localStorage.getItem('cs_team_attrs_v1')||'null'),tomb=JSON.parse(localStorage.getItem('cs_player_del_v1')||'{}');
    const o=d.players.filter(p=>p.type!=='target');if(o.filter(p=>p.grad).length!==3)return null;
    return {n:o.length,grad:o.filter(p=>p.grad).map(p=>p.name),squad:sq&&sq.players.map(p=>p.name),roster:at&&at.roster&&at.roster.map(p=>p.name),tombs:Object.keys(tomb||{}),season:d.meta.season.cur};});if(!saved)await page.waitForTimeout(500);}
  assert.ok(saved,'명단 저장 확인');assert.equal(saved.n,18);assert.ok(!saved.tombs.some(id=>seed.ids.includes(id)),'졸업은 삭제 기록을 남기지 않는다');assert.equal(saved.season,next);
  assert.equal(saved.squad.length,15);assert.equal(saved.roster.length,15);
  for(const n of saved.grad){assert.ok(!saved.squad.includes(n),'작전판 거울에 졸업생 없음 '+n);assert.ok(!saved.roster.includes(n),'IDP 거울에 졸업생 없음 '+n);}
  s=await state();assert.ok(s.avail<=15);

  // ⑤ 지난 시즌 보기 — 그날의 줄 18 · 졸업 3 · 보기 전용
  step='past';
  await pick(cur+' 시즌 · 지난 · 18명');
  await frame.locator('#pwTeam .pw-table.pw-past').waitFor();
  assert.equal(await rows().count(),18);assert.equal(await frame.locator('#pwTeam .pw-past tr.is-grad').count(),3);
  assert.match(await frame.locator('#pwTeam .pw-season').innerText(),/지난 시즌 명단 · 보기 전용/);
  const past=await frame.evaluate(n=>{const t=[...document.querySelectorAll('#pwTeam .pw-past tbody tr')].find(r=>r.textContent.indexOf(n)>=0),q=document.querySelector('#pwTeam .pw-quickadd'),h=document.getElementById('pwTeam');return {row:t?t.innerText.replace(/\s+/g,' '):'',quick:!q||q.hidden,checks:h.querySelectorAll('[data-pw-select]').length,bar:h.querySelector('.pw-comparebar').hidden,view:getComputedStyle(h.querySelector('.pw-view')).display,over:document.documentElement.scrollWidth-innerWidth};},seed.y2[0]);
  assert.match(past.row,/2학년/,'지난 시즌 줄은 그때 학년 '+past.row);if(!phone)assert.match(past.row,/이어짐/);   /* 폰 표는 «다음 시즌» 칸을 접는다 — 졸업은 이름 옆 꼬리표로 */
  assert.equal(past.quick,true);assert.equal(past.checks,0);assert.equal(past.bar,true);assert.equal(past.view,'none');assert.ok(past.over<=1,'넘침 '+past.over);
  await page.screenshot({path:shots+'/roster-season-past-'+size+'.png'});
  await frame.getByRole('button',{name:'지금 시즌으로',exact:true}).click();
  await frame.waitForFunction(()=>!document.querySelector('#pwTeam .pw-past'));
  assert.equal(await rows().count(),15);

  // ⑥ 졸업생 전체 → «현재 명단으로»
  step='grads';
  await pick('졸업생 전체');
  await frame.waitForFunction(()=>document.querySelectorAll('#pwTeam .pw-table tbody tr').length===3);
  assert.match(await rows().first().innerText(),new RegExp(cur+' 졸업'));
  await page.screenshot({path:shots+'/roster-season-grads-'+size+'.png'});
  await frame.getByRole('checkbox',{name:seed.y3[0]+' 선택',exact:true}).check();
  const bar=frame.locator('#pwTeam .pw-comparebar');
  assert.equal(await bar.getByRole('button',{name:'조 바꾸기',exact:true}).count(),0);
  await bar.getByRole('button',{name:'현재 명단으로',exact:true}).click();
  await frame.waitForFunction(()=>tmOurs().length===16);
  assert.equal(await rows().count(),2);

  // ⑦ 선택 띠 «졸업 처리»(시즌 중 한 명) — 확인을 받고 표시만
  step='graduate-one';
  await frame.getByRole('button',{name:'지금 시즌으로',exact:true}).click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwTeam .pw-table tbody tr').length===16,null,{timeout:15000});
  await frame.getByRole('checkbox',{name:seed.y3[0]+' 선택',exact:true}).check();
  await page.screenshot({path:shots+'/roster-season-bar-'+size+'.png'});
  await bar.getByRole('button',{name:'졸업 처리',exact:true}).click();
  const confirmText=await frame.evaluate(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.textContent==='확인'&&x.offsetParent);return b.length?b[b.length-1].closest('div').parentElement.innerText:'';});
  assert.match(confirmText,/1명을 졸업 처리할까요\?/);assert.match(confirmText,/기록은 그대로 남아요/);
  await frame.getByRole('button',{name:'확인',exact:true}).last().click();
  await frame.waitForFunction(()=>tmOurs().length===15);
  s=await state();assert.equal(s.grads.length,3);assert.equal(s.years.find(y=>y[0]===seed.y3[0])[2],next,'시즌 중 졸업은 지금 시즌으로 적는다');

  // ⑧ 서버 — 졸업생의 선수별 행은 살아 있고(삭제 표시 없음) grad 를 품는다
  step='server';
  let srv=null,last='';
  for(let i=0;i<60&&!srv;i++){await frame.evaluate(async()=>{try{await scoutStore.ready(true);}catch(e){}});await page.evaluate(()=>PSSync.syncNow('roster-season')).catch(()=>{});
    const got=seed.ids.map(id=>{const r=fx.db.get(WT+'|sq:'+id);try{return r?JSON.parse(r.v):null;}catch(e){return null;}});
    if(got.every(Boolean)&&got.filter(p=>p.grad).length===3)srv=got;else{last=JSON.stringify({rows:got.filter(Boolean).length,grad:got.filter(p=>p&&p.grad).length,strip:await page.evaluate(()=>{const x=document.getElementById('psSyncStrip');return x?x.innerText.replace(/\s+/g,' ').trim():'';}),sync:await page.evaluate(()=>{try{return JSON.stringify(PSSync.state()).slice(0,240);}catch(e){return String(e);}}),box:await frame.evaluate(()=>{try{const o=rosterOutbox(),r=o.read();return {pending:o.pending(),rows:Object.keys(r&&r.rows||{}).length};}catch(e){return String(e&&e.message||e);}})});await page.waitForTimeout(700);}}
  assert.ok(srv,'선수별 행이 서버에 '+last);
  /* 스카우팅 원장 — 새 시즌을 시작하면 지금 후보는 끝난 시즌 목록으로(보관 + 꼬리표). 그 표시만 빼면 후보 · 배치 · 등록부는 글자 그대로(posName 은 배경 채움) */
  const lean=v=>{const d=JSON.parse(v);(d.players||[]).forEach(p=>{delete p.posName;delete p._scoutHidden;delete p._scoutMove;});Object.values(d.scoutRegistry.candidates).forEach(c=>{delete c.archivedAt;delete c.archiveEdit;delete c.archiveSeason;});delete d.scoutRegistry.placementHistory;return JSON.stringify(d);};
  let sdoc=null;for(let i=0;i<40;i++){sdoc=JSON.parse(fx.db.get(WT+'|cs_scout_targets_v1').v);if(Object.values(sdoc.scoutRegistry.candidates).every(c=>c.archivedAt&&c.archiveSeason===cur))break;await page.evaluate(()=>PSSync.syncNow('roster-season-scout-doc')).catch(()=>{});await page.waitForTimeout(700);}
  assert.deepEqual(Object.values(sdoc.scoutRegistry.candidates).map(c=>[c.info.name,c.archiveSeason]),cands.map(c=>[c[1],cur]),'후보 넷은 끝난 시즌 목록으로 · 지운 후보 없음');
  const base=JSON.parse(scoutRaw);delete base.scoutRegistry.placementHistory;
  assert.equal(lean(JSON.stringify(sdoc)),lean(JSON.stringify(base)),'보관 표시 말고는 스카우팅 원장 그대로');

  // ⑨ 잠긴 명단 — 시즌 시작 · 졸업 처리가 보이지 않는다
  step='locked';
  await frame.evaluate(()=>{document.body.classList.add('ps-roster-locked');renderTeam();});
  await frame.getByRole('checkbox',{name:seed.y2[0]+' 선택',exact:true}).check();
  assert.equal(await bar.getByRole('button',{name:'졸업 처리',exact:true}).count(),0);
  await chip().click();await frame.locator('#psPickPop').waitFor();
  assert.equal(await frame.locator('#psPickPop button',{hasText:'시즌 시작'}).count(),0);
  await page.keyboard.press('Escape');
  await frame.evaluate(()=>{document.body.classList.remove('ps-roster-locked');if(typeof psPickClose==='function')psPickClose();});
  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/.test(e)),[]);
  console.log(JSON.stringify({passed:true,size,engine}));
}catch(e){console.error('[roster-season] failed at '+step);console.error(e);process.exitCode=1;
  if(frame)console.error('[roster-season] state',JSON.stringify(await frame.evaluate(()=>({toast:(document.getElementById('toast')||{}).textContent,pop:(document.getElementById('psPickPop')||{}).innerText,dlg:(document.getElementById('pwSeason')||{}).innerText,top:(document.querySelector('#pwTeam .pw-top')||{}).innerText,rows:document.querySelectorAll('#pwTeam .pw-table tbody tr').length,ours:tmOurs().length,season:data.meta&&data.meta.season})).catch(x=>String(x))));
}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
