// 3.356 — 미리 만든 시즌에서 «스카우팅에서 불러오기»: 그 시즌 예상 명단에만 담기고 지금 시즌 명단은 그대로
// (사용자 11/21 «27시즌에 스카우트 선수들 불러오기 했는데 2026에도 추가 돼 — 그렇게 안 되게»). 빼기 · 되돌리기 · 새 시즌 시작 때 신입. PS_SIZE=desktop|ipad|phone
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startFixture,openApp,SHOTS,WT,A,SIZES} from '../fixtures/team-app.mjs';
import {addMenu} from '../fixtures/roster-ui.mjs';
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
  await page.locator(phone?'#teamBottom [data-tb="players"]':'#teamNav [data-team-key="players"]').click();
  frame=await (await page.waitForSelector('#fScout')).contentFrame();
  await frame.locator('#pwTeam [data-pw-view="list"]').waitFor();
  await frame.getByRole('button',{name:'명단',exact:true}).click();
  await frame.locator('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').first().waitFor();
  const seed=await frame.evaluate(()=>{const o=data.players.filter(p=>p.type!=='target');o.forEach((p,i)=>{if(i<4)p.schoolYear='3';else if(i<9)p.schoolYear='2';else if(i<13)p.schoolYear='1';});save({skipTargets:true});renderTeam();return {cur:PSRosterSeason.current(data.meta),ours:tmOurs().length};});
  const cur=seed.cur,n1=String(+cur+1),n0=seed.ours;
  const pick=async text=>{await frame.locator('#teamView [data-pw-action="season"]').click();await frame.locator('#psPickPop').waitFor();await frame.locator('#psPickPop button',{hasText:text}).click();};
  const toastText=()=>frame.evaluate(()=>{const t=document.getElementById('toast');return t&&t.classList.contains('on')?t.textContent:'';});
  const scReady=async()=>{for(let i=0;i<40;i++){if(await frame.evaluate(()=>{try{scStore().check();return true;}catch(e){return false;}}))return;await page.waitForTimeout(400);}throw new Error('후보 문서 준비 안 됨');};
  const state=()=>frame.evaluate(n=>({ours:tmOurs().length,joined:data.players.filter(p=>p.type!=='target'&&p.joinedFrom).map(p=>p.name).sort(),joins:PSRosterSeason.joins(data.meta,n).map(x=>x.cid).sort(),cur:PSRosterSeason.current(data.meta)}),n1);
  await frame.waitForFunction(c=>{const b=document.querySelector('#teamView [data-pw-action="season"]');return b&&b.textContent.indexOf(c+' 시즌')>=0;},cur);

  // ① 미리 만든 시즌에서 불러오기 → 그 시즌에만
  step='import';
  await pick(n1+' 시즌 미리 만들기');
  await frame.locator('#pwTeam .pw-proj').waitFor();
  const base=await frame.locator('#pwTeam .pw-past tbody tr').count();
  await scReady();
  await addMenu(frame,'스카우팅에서 불러오기');
  const dlg=frame.locator('#pwImport');await dlg.waitFor();
  const head=await dlg.innerText();
  assert.match(head,new RegExp('스카우팅에서 불러오기 · '+n1+' 시즌'));assert.match(head,new RegExp(n1+' 시즌 예상 명단에만 담습니다'));
  await dlg.getByRole('button',{name:/^전체/}).click();
  await dlg.getByRole('checkbox',{name:'배준혁 명단에 넣기',exact:true}).check();
  const okBtn=dlg.locator('[data-pwi-ok]');assert.equal((await okBtn.innerText()).trim(),'3명 '+n1+' 시즌에 담기');
  const dm=await frame.evaluate(()=>{const r=document.getElementById('pwImport').getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(innerWidth-r.right),over:document.documentElement.scrollWidth-innerWidth};});
  assert.ok(dm.l>=0&&dm.r>=0&&dm.over<=1,'창이 화면 안 '+JSON.stringify(dm));
  await page.screenshot({path:shots+'/roster-future-import-dialog-'+size+'.png'});
  await okBtn.click();
  await frame.waitForFunction(()=>!document.getElementById('pwImport'));
  assert.match(await toastText(),new RegExp('3명을 '+n1+' 시즌에 담았습니다 · 지금 시즌 명단은 그대로입니다'));
  let s=await state();
  assert.equal(s.ours,n0,'지금 시즌 명단 수 그대로');assert.deepEqual(s.joined,[],'선수를 만들지 않는다');assert.equal(s.joins.length,3);
  await frame.waitForFunction(n=>document.querySelectorAll('#pwTeam .pw-past tbody tr').length===n,base+3);
  assert.equal(await frame.locator('#pwTeam .pw-past tr.pw-join').count(),3);
  let txt=await frame.locator('#pwTeam').innerText();
  assert.match(txt,/스카우팅 합류 예정 3명/);assert.match(txt,/서지훈/);assert.match(txt,new RegExp(n1+' 시즌 합류 · 1학년'));
  const fm=await frame.evaluate(()=>({over:document.documentElement.scrollWidth-innerWidth,hit:[...document.querySelectorAll('#pwTeam .pw-join-drop')].map(b=>{const r=b.getBoundingClientRect(),c=b.closest('td').getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),r.right<=c.right+1&&r.left>=c.left-1];})}));
  assert.ok(fm.over<=1,'넘침 '+fm.over);for(const h of fm.hit)assert.ok(h[0]>=36&&h[1]>=36&&h[2],'«빼기» 36px 이상 · 칸 안 '+h);
  await page.screenshot({path:shots+'/roster-future-import-'+size+'.png'});

  // ② 지금 시즌 명단에는 없다
  step='current';
  await frame.getByRole('button',{name:'지금 시즌으로',exact:true}).click();
  await frame.waitForFunction(n=>document.querySelectorAll('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').length===n,n0);
  txt=await frame.locator('#pwTeam .pw-table tbody').innerText();
  for(const n of ['서지훈','오태양','배준혁'])assert.doesNotMatch(txt,new RegExp(n),'지금 시즌 명단에 '+n+' 없음');
  await page.screenshot({path:shots+'/roster-future-import-current-'+size+'.png'});

  // ③ 다시 열면 이미 담은 후보는 흐림 · 빼기 · 되돌리기
  step='again';
  await pick(n1+' 시즌 · 미리');
  await frame.locator('#pwTeam .pw-proj').waitFor();
  await scReady();
  await addMenu(frame,'스카우팅에서 불러오기');await dlg.waitFor();
  await dlg.getByRole('button',{name:/^전체/}).click();
  assert.equal(await dlg.getByRole('checkbox',{name:'서지훈 명단에 넣기',exact:true}).isDisabled(),true);
  assert.match(await dlg.innerText(),new RegExp(n1+' 시즌에 담았습니다'));
  assert.equal(await dlg.getByRole('checkbox',{name:'문건우 명단에 넣기',exact:true}).isDisabled(),false);
  await dlg.getByRole('button',{name:'취소',exact:true}).click();
  await frame.waitForFunction(()=>!document.getElementById('pwImport'));
  step='drop';
  await frame.getByRole('button',{name:'배준혁 '+n1+' 시즌에서 빼기',exact:true}).click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwTeam .pw-past tr.pw-join').length===2);
  assert.equal((await state()).joins.length,2);
  const undo=frame.locator('.pw-undo');await undo.waitFor();
  await undo.getByRole('button',{name:'되돌리기'}).click();
  await frame.waitForFunction(()=>document.querySelectorAll('#pwTeam .pw-past tr.pw-join').length===3);
  assert.equal((await state()).joins.length,3);
  // 담아 둔 사람이 있는 시즌은 지우지 않는다
  await frame.getByRole('button',{name:'이 시즌 지우기',exact:true}).click();
  await frame.waitForFunction(()=>{const t=document.getElementById('toast');return t&&t.classList.contains('on')&&/합류 예정 3명을 먼저/.test(t.textContent);});
  assert.equal((await state()).joins.length,3);

  // ④ 새 시즌 시작 — 담아 둔 후보가 신입으로(단계와 상관없이 미리 켜짐)
  step='start';
  await frame.getByRole('button',{name:'지금 시즌으로',exact:true}).click();
  await frame.waitForFunction(n=>document.querySelectorAll('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').length===n,n0);
  await scReady();
  await pick(n1+' 시즌 시작');
  const sd=frame.locator('#pwSeason');await sd.waitFor();
  const st=await sd.innerText();
  assert.match(st,/스카우팅에서 3명/);assert.match(st,/배준혁 · 담아 둠/);assert.match(st,/서지훈 · 담아 둠/);
  await sd.getByRole('button',{name:n1+' 시즌 시작',exact:true}).click();
  await frame.waitForFunction(()=>!document.getElementById('pwSeason'));
  s=await state();
  assert.equal(s.cur,n1);assert.deepEqual(s.joined,['배준혁','서지훈','오태양']);assert.equal(s.ours,n0-4+3);assert.deepEqual(s.joins,[],'시작하면 담아 둔 줄을 걷는다');
  step='undo';
  const u2=frame.locator('.pw-undo');await u2.waitFor();
  await u2.getByRole('button',{name:'되돌리기'}).click();
  await frame.waitForFunction(n=>tmOurs().length===n,n0);
  s=await state();
  assert.equal(s.cur,cur);assert.deepEqual(s.joined,[]);assert.equal(s.joins.length,3,'되돌리면 담아 둔 사람도 돌아온다');
  assert.deepEqual(errors,[],'페이지 오류 없음');
  console.log(JSON.stringify({test:'roster-future-import-3356',size,engine,passed:true}));
}catch(e){
  console.error('[roster-future-import-3356] step '+step);
  try{if(frame)console.error(JSON.stringify(await frame.evaluate(()=>({toast:(document.getElementById('toast')||{}).textContent,scope:document.querySelector('#teamView [data-pw-action="season"]')&&document.querySelector('#teamView [data-pw-action="season"]').textContent,season:data.meta.season,ours:tmOurs().length}))));}catch(_){}
  console.error(e);process.exitCode=1;
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close().catch(()=>{});
}
