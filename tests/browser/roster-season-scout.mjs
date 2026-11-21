// 미리 만든 시즌 · 예상 명단 · 스카우팅 시즌: 시즌 칩 → «＋ 시즌 미리 만들기» → 예상 명단(지금 선수가 올라간 학년) →
// 스카우팅에서 후보를 골라 «시즌 옮기기»(미리 만든 시즌에 담기 · 시즌 사이로) → «새 시즌 시작»이 지금 후보를 끝난 시즌 목록으로,
// 새 시즌에 담아 둔 후보를 지금 목록으로 → 되돌리기 → 다시 시작. 후보는 지우지 않는다(보관 + 꼬리표 archiveSeason). PS_SIZE=desktop|ipad|phone
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startFixture,openApp,SHOTS,WT,A,SIZES} from '../fixtures/team-app.mjs';
const require=createRequire(import.meta.url),store=require('../../studio/scouting-store.js');
const size=process.env.PS_SIZE||'desktop',engine=process.env.PS_BROWSER_ENGINE||SIZES[size].engine,shots=process.env.PS_SHOTS_DIR||SHOTS;
SIZES[size].engine=engine;
const phone=size==='phone';
const cands=[['sc-1','서지훈','CF','9','done'],['sc-2','오태양','RW','7','done'],['sc-4','문건우','CM','8','go'],['sc-5','배준혁','LB','3','rep']];
const target=store.reconcile(null,{v:1,players:cands.map(([id,name,pos,num,st])=>({id,dbId:id,type:'target',name,posId:'pos_'+pos,num,club:'가상 유나이티드',grade:'B',scoutSt:st,foot:'R',levels:{},profile:{}}))});
const fx=await startFixture(),browsers={};
fx.db.set(WT+'|cs_scout_targets_v1',{workspace_id:WT,k:'cs_scout_targets_v1',v:JSON.stringify(target),cupd:1000,updated_by:A});
let step='open',frame=null;
try{
  const app=await openApp(fx,size,{browsers}),{page}=app,errors=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  await page.locator('#appSeg [data-team-hub]').click();
  const tab=async k=>{await page.locator(phone?'#teamBottom [data-tb="'+k+'"]':'#teamNav [data-team-key="'+k+'"]').click();};
  await tab('players');
  frame=await (await page.waitForSelector('#fScout')).contentFrame();
  await frame.locator('#pwTeam [data-pw-view="list"]').waitFor();
  await frame.getByRole('button',{name:'명단',exact:true}).click();
  await frame.locator('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').first().waitFor();
  const seed=await frame.evaluate(()=>{const o=data.players.filter(p=>p.type!=='target');o.forEach((p,i)=>{if(i<4)p.schoolYear='3';else if(i<9)p.schoolYear='2';else if(i<13)p.schoolYear='1';});save({skipTargets:true});renderTeam();return {cur:PSRosterSeason.current(data.meta)};});
  const cur=seed.cur,n1=String(+cur+1),n2=String(+cur+2);
  const pick=async(host,text)=>{await frame.locator(host+' [data-pw-action="season"]').click();await frame.locator('#psPickPop').waitFor();await frame.locator('#psPickPop button',{hasText:text}).click();};
  const toastText=()=>frame.evaluate(()=>{const t=document.getElementById('toast');return t&&t.classList.contains('on')?t.textContent:'';});
  /* 후보 문서는 동기화 회차마다 잠깐 «확인 중»이 된다 — 풀릴 때까지 기다린다 */
  const scReady=async()=>{for(let i=0;i<40;i++){if(await frame.evaluate(()=>{try{scStore().check();return true;}catch(e){return false;}}))return;await page.waitForTimeout(400);}throw new Error('후보 문서 준비 안 됨');};
  const tagsOnce=()=>frame.evaluate(()=>{const C=scStore().read().scoutRegistry.candidates,o={};Object.keys(C).forEach(id=>{o[C[id].info.name]=C[id].archivedAt?String(C[id].archiveSeason||'보관'):'';});return o;});
  /* 3.357 — 동기화 회차 동안 후보 문서 읽기(read)도 «확인 중»으로 거절된다(CI 웹킷 `start`) — 풀릴 때까지 다시 읽는다 */
  const tags=async()=>{let err=null;for(let i=0;i<40;i++){try{return await tagsOnce();}catch(e){err=e;await page.waitForTimeout(400);}}throw err;};
  await frame.waitForFunction(c=>{const b=document.querySelector('#teamView [data-pw-action="season"]');return b&&b.textContent.indexOf(c+' 시즌')>=0;},cur);

  // ① 시즌 미리 만들기 → 예상 명단
  step='future';
  await pick('#teamView',n1+' 시즌 미리 만들기');
  await frame.locator('#pwTeam .pw-proj').waitFor();
  assert.match(await toastText(),new RegExp(n1+' 시즌을 만들었어요'));
  assert.deepEqual(await frame.evaluate(()=>data.meta.season.future),[n1]);
  assert.equal(await frame.locator('#pwTeam .pw-past tbody tr').count(),14,'3학년 넷은 그 전에 졸업');
  let proj=await frame.locator('#pwTeam').innerText();
  assert.match(proj,/미리 만든 시즌 · 예상 명단/);assert.match(proj,/그 전에 졸업 4명/);assert.match(proj,/1학년 → 2학년/);assert.match(proj,/2학년 → 3학년/);assert.match(proj,/GK \d+/);
  await pick('#teamView',n2+' 시즌 미리 만들기');
  await frame.waitForFunction(()=>document.querySelectorAll('#pwTeam .pw-past tbody tr').length===9);
  proj=await frame.locator('#pwTeam').innerText();assert.match(proj,/그 전에 졸업 9명/);assert.match(proj,/1학년 → 3학년/);
  assert.deepEqual(await frame.evaluate(()=>data.meta.season.future),[n1,n2]);
  const pm=await frame.evaluate(()=>({over:document.documentElement.scrollWidth-innerWidth,quick:document.querySelector('#pwTeam .pw-quickadd').hidden,checks:document.querySelectorAll('#pwTeam [data-pw-select]').length,ours:tmOurs().length}));
  assert.ok(pm.over<=1,'넘침 '+pm.over);assert.equal(pm.quick,true);assert.equal(pm.checks,0);assert.equal(pm.ours,18,'예상은 셈만 — 명단은 그대로');
  await page.screenshot({path:shots+'/roster-season-plan-'+size+'.png'});
  await frame.getByRole('button',{name:'지금 시즌으로',exact:true}).click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').length===18);

  // ② 스카우팅 — 후보를 미리 만든 시즌에 담는다
  step='scout-open';
  await tab('scouting');
  await frame.locator('#pwScout [data-pw-view="list"]').waitFor();
  await frame.locator('#pwScout [data-pw-view="list"]').click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwScout .pw-table tbody tr:not(.pw-grouphead)').length===4);
  assert.match(await frame.locator('#pwScout .pw-result').innerText(),new RegExp(cur+' 시즌'));
  step='scout-move';
  await scReady();
  for(const n of ['문건우','배준혁'])await frame.getByRole('checkbox',{name:n+' 비교 선택',exact:true}).check();
  const sbar=frame.locator('#pwScout .pw-comparebar');
  await sbar.getByRole('button',{name:'시즌 옮기기',exact:true}).click();
  await frame.locator('#psPickPop').waitFor();
  const opts=await frame.locator('#psPickPop').innerText();assert.match(opts,/2명 · 시즌 옮기기/);assert.match(opts,new RegExp(n1+' 시즌 · 미리'));assert.doesNotMatch(opts,new RegExp(cur+' 시즌'),'지금 보는 시즌은 고를 것에 없다');
  await frame.locator('#psPickPop button',{hasText:n2+' 시즌'}).click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwScout .pw-table tbody tr:not(.pw-grouphead)').length===2);
  assert.match(await toastText(),new RegExp('2명을 '+n2+' 시즌 후보로 옮겼어요'));
  assert.deepEqual(await tags(),{'서지훈':'','오태양':'','문건우':n2,'배준혁':n2});

  // ③ 미리 만든 시즌의 후보 목록 → 다른 시즌으로
  step='scout-season';
  await pick('#pwScout',n2+' 시즌');
  await frame.locator('#pwScout .pw-table.pw-past').waitFor();
  assert.equal(await frame.locator('#pwScout .pw-past tbody tr').count(),2);
  assert.match(await frame.locator('#pwScout .pw-result').innerText(),/미리 만든 시즌/);
  const sm=await frame.evaluate(()=>{const h=document.getElementById('pwScout');return {over:document.documentElement.scrollWidth-innerWidth,view:getComputedStyle(h.querySelector('.pw-view')).display,hit:[...h.querySelectorAll('.pw-past .pw-select-hit')].map(x=>{const r=x.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})};});
  assert.ok(sm.over<=1,'넘침 '+sm.over);assert.equal(sm.view,'none');if(phone)for(const h of sm.hit)assert.ok(h[0]>=36&&h[1]>=36,'체크 칸 36px 이상 '+h);
  await page.screenshot({path:shots+'/roster-season-scout-'+size+'.png'});
  await scReady();
  await frame.getByRole('checkbox',{name:'문건우 선택',exact:true}).check();
  await sbar.getByRole('button',{name:'시즌 옮기기',exact:true}).click();
  await frame.locator('#psPickPop').waitFor();
  await frame.locator('#psPickPop button',{hasText:n1+' 시즌'}).click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwScout .pw-past tbody tr').length===1);
  assert.deepEqual(await tags(),{'서지훈':'','오태양':'','문건우':n1,'배준혁':n2});
  await frame.locator('#pwScout').getByRole('button',{name:'지금 시즌으로',exact:true}).click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwScout .pw-table tbody tr:not(.pw-grouphead)').length===2&&!document.querySelector('#pwScout .pw-past'));

  // ④ 새 시즌 시작 — 지금 후보는 끝난 시즌 목록으로, 새 시즌에 담아 둔 후보는 지금 목록으로
  step='start';
  await tab('players');
  await frame.locator('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').first().waitFor();
  await scReady();
  await pick('#teamView',n1+' 시즌 시작');
  const dlg=frame.locator('#pwSeason');await dlg.waitFor();
  const text=await dlg.innerText();
  assert.match(text,new RegExp('스카우팅 후보 2명은 '+cur+' 시즌 목록으로 넘어가요\\. '+n1+' 시즌 스카우팅은 담아 둔 1명으로 시작해요'));
  /* 3.356 — 누르는 순간 후보 문서가 «확인 중»인 길(CI 웹킷에서 흔하다): 넘기기가 미뤄졌다 따라오고, 되돌리기 띠의 글도 따라온다 */
  await frame.evaluate(()=>{scStore().state.verified=false;});
  await dlg.getByRole('button',{name:n1+' 시즌 시작',exact:true}).click();
  await frame.waitForFunction(()=>!document.getElementById('pwSeason'));
  const after=async()=>({tags:await tags(),season:await frame.evaluate(()=>JSON.parse(JSON.stringify({cur:data.meta.season&&data.meta.season.cur,future:data.meta.season&&data.meta.season.future}))),joined:await frame.evaluate(()=>data.players.filter(p=>p.joinedFrom).map(p=>p.name).sort()),ours:await frame.evaluate(()=>tmOurs().length)});
  const settle=async ok=>{for(let i=0;i<60;i++){let t=null;try{t=await tags();}catch(e){}if(t&&ok(t))return;await page.waitForTimeout(400);}};
  await settle(t=>t['서지훈']===cur&&t['문건우']==='');
  let a=await after();
  assert.deepEqual(a.tags,{'서지훈':cur,'오태양':cur,'문건우':'','배준혁':n2});
  assert.equal(a.season.cur,n1);assert.deepEqual(a.season.future,[n2],'시작한 시즌은 미리 만든 목록에서 빠진다');
  assert.deepEqual(a.joined,['서지훈','오태양']);assert.equal(a.ours,16);

  // ⑤ 되돌리기 — 선수단 · 신입 · 스카우팅 · 미리 만든 시즌이 모두 넘기기 전으로
  step='undo';
  const undo=frame.locator('.pw-undo');await undo.waitFor();
  await frame.waitForFunction(c=>{const u=document.querySelector('.pw-undo');return !!u&&u.textContent.indexOf('스카우팅 2명은 '+c+' 시즌 목록으로')>=0;},cur);
  await undo.getByRole('button',{name:'되돌리기'}).click();
  await frame.waitForFunction(()=>tmOurs().length===18);
  await settle(t=>t['서지훈']===''&&t['문건우']===n1);
  a=await after();
  assert.deepEqual(a.tags,{'서지훈':'','오태양':'','문건우':n1,'배준혁':n2});
  assert.equal(a.season.cur,cur);assert.deepEqual(a.season.future,[n1,n2]);assert.deepEqual(a.joined,[]);

  // ⑥ 다시 시작 → 스카우팅 화면
  step='restart';
  for(let i=0;i<60;i++){await scReady();const t=await tags();if(t['서지훈']===''&&t['오태양']===''&&t['문건우']===n1)break;await page.waitForTimeout(400);}   /* 되돌린 스카우팅이 가라앉은 뒤 */
  await pick('#teamView',n1+' 시즌 시작');await dlg.waitFor();
  await dlg.getByRole('button',{name:n1+' 시즌 시작',exact:true}).click();
  await frame.waitForFunction(()=>!document.getElementById('pwSeason')&&tmOurs().length===16);
  {let t=null,ok=false;for(let i=0;i<150&&!ok;i++){t=null;try{t=await tags();}catch(e){}ok=!!(t&&t['서지훈']===cur&&t['문건우']==='');if(!ok)await page.waitForTimeout(400);}assert.ok(ok,'다시 시작한 뒤 스카우팅 넘기기가 60초 안에 따라와야 한다 — 지금 꼬리표 '+JSON.stringify(t));}   /* 스카우팅 넘기기는 후보 문서가 풀린 뒤 따라온다 */
  step='scout-after';
  await tab('scouting');
  await frame.locator('#pwScout [data-pw-view="list"]').click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwScout .pw-table tbody tr:not(.pw-grouphead)').length===1);
  assert.match(await frame.locator('#pwScout .pw-table tbody').innerText(),/문건우/);
  assert.match(await frame.locator('#pwScout .pw-result').innerText(),new RegExp(n1+' 시즌'));
  await pick('#pwScout',cur+' 시즌');
  await frame.locator('#pwScout .pw-table.pw-past').waitFor();
  const pastText=await frame.locator('#pwScout .pw-past tbody').innerText();
  assert.match(pastText,/서지훈[\s\S]*명단에 넣음/);assert.match(pastText,/오태양[\s\S]*명단에 넣음/);
  assert.match(await frame.locator('#pwScout .pw-result').innerText(),/지난 시즌 스카우팅/);
  await page.screenshot({path:shots+'/roster-season-scoutpast-'+size+'.png'});

  // ⑦ 미리 만든 시즌 지우기 — 담아 둔 후보가 있으면 막는다
  step='drop';
  await tab('players');
  await frame.locator('#teamView [data-pw-action="season"]').waitFor();
  await pick('#teamView',n2+' 시즌 · 미리');
  await frame.locator('#pwTeam .pw-proj').waitFor();
  /* 후보 문서가 «확인 중»일 때 그려지면 후보 수 글이 빠진다 — 준비된 뒤 다시 그려 본다(CI 웹킷이 여기서 떨어졌다) */
  let projText='';for(let i=0;i<30;i++){await scReady();await frame.evaluate(()=>renderTeam());projText=await frame.locator('#pwTeam .pw-proj').innerText();if(/이 시즌 스카우팅 후보 1명/.test(projText))break;await page.waitForTimeout(400);}
  assert.match(projText,/이 시즌 스카우팅 후보 1명/);
  let dropToast='';for(let i=0;i<30;i++){await scReady();await frame.getByRole('button',{name:'이 시즌 지우기',exact:true}).click();dropToast=await toastText();if(/먼저 옮겨 주세요/.test(dropToast))break;await page.waitForTimeout(500);}
  assert.match(dropToast,/담아 둔 스카우팅 후보 1명을 먼저 옮겨 주세요/);
  assert.deepEqual(await frame.evaluate(()=>data.meta.season.future),[n2]);

  // ⑧ 서버 — 후보는 하나도 지워지지 않았고 꼬리표가 실려 있다
  step='server';
  let srv=null,last='';
  for(let i=0;i<60&&!srv;i++){await frame.evaluate(async()=>{try{await scoutStore.ready(true);}catch(e){}});await page.evaluate(()=>PSSync.syncNow('roster-season-scout')).catch(()=>{});
    let d=null;try{d=JSON.parse(fx.db.get(WT+'|cs_scout_targets_v1').v);}catch(e){}
    const C=d&&d.scoutRegistry&&d.scoutRegistry.candidates,o={};if(C)Object.keys(C).forEach(id=>{o[C[id].info.name]=C[id].archivedAt?String(C[id].archiveSeason||'보관'):'';});
    last=JSON.stringify(o);if(C&&o['서지훈']===cur&&o['배준혁']===n2&&o['문건우']==='')srv={o,n:Object.keys(C).length,placements:d.players.length};else await page.waitForTimeout(700);}
  assert.ok(srv,'후보 문서가 서버에 '+last);assert.equal(srv.n,4,'후보 넷 그대로');assert.equal(srv.placements,4,'배치 넷 그대로');
  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/.test(e)),[]);
  console.log(JSON.stringify({passed:true,size,engine}));
}catch(e){console.error('[roster-season-scout] failed at '+step);console.error(e);process.exitCode=1;
  if(frame)console.error('[roster-season-scout] state',JSON.stringify(await frame.evaluate(()=>({toast:(document.getElementById('toast')||{}).textContent,pop:(document.getElementById('psPickPop')||{}).innerText,dlg:(document.getElementById('pwSeason')||{}).innerText,team:(document.querySelector('#pwTeam .pw-result')||{}).innerText,scout:(document.querySelector('#pwScout .pw-result')||{}).innerText,scoutRows:document.querySelectorAll('#pwScout .pw-table tbody tr:not(.pw-grouphead)').length,check:(()=>{try{scStore().check();return 'ok';}catch(e){return String(e&&(e.code||e.why||e.message));}})(),st:(()=>{const s=scStore().state;return {verified:s.verified,rawSame:localStorage.getItem('cs_scout_targets_v1')===s.raw,pending:!!s.pending};})(),targets:data.players.filter(p=>p.type==='target').map(p=>[p.name,!!p._scoutHidden]),docPl:(()=>{try{const d=scStore().read();return d.players.map(p=>[p.name||p.id,!!p._scoutHidden,!!d.scoutRegistry.candidates[PSScoutStore.idOf(p)].archivedAt]);}catch(e){return String(e);}})(),season:data.meta&&data.meta.season})).catch(x=>String(x))));
}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
