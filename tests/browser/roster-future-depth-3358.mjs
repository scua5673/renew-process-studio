// 3.358 — 미리 만든 시즌에도 «포지션» 보기(사용자 11/21 «2027에도 포지션 보이게»): 읽기 전용 판 · 합류 예정은 스카우팅 포지션 칸 · 보기 이어 가기 · 명단 표 선수 칸 너비. PS_SIZE=desktop|ipad|phone
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

  step='list';
  await pick(n1+' 시즌 미리 만들기');
  await frame.locator('#pwTeam .pw-proj').waitFor();
  const base=await frame.locator('#pwTeam .pw-past tbody tr').count();
  await scReady();
  await addMenu(frame,'스카우팅에서 불러오기');
  const dlg=frame.locator('#pwImport');await dlg.waitFor();
  await dlg.getByRole('button',{name:/^전체/}).click();
  await dlg.getByRole('checkbox',{name:'배준혁 명단에 넣기',exact:true}).check();
  await dlg.locator('[data-pwi-ok]').click();
  await frame.waitForFunction(n=>document.querySelectorAll('#pwTeam .pw-past tbody tr').length===n,base+3);
  // 명단 표 — 선수 칸이 44px 체크 칸 너비에 눌리지 않는다(포지션 글자 한 줄)
  const lm=await frame.evaluate(()=>{const sm=[...document.querySelectorAll('#pwTeam .pw-past tr.pw-join .pw-person small')].map(e=>{const r=e.getBoundingClientRect(),lh=parseFloat(getComputedStyle(e).lineHeight)||18;return [e.textContent,Math.round(r.height),Math.round(lh)];});
    const v=document.querySelector('#pwTeam .pw-view');return {sm,view:v?getComputedStyle(v).display:'',over:document.documentElement.scrollWidth-innerWidth};});
  assert.equal(lm.sm.length,3);for(const x of lm.sm){assert.match(x[0],/스카우팅에서/);assert.ok(x[1]<=x[2]*1.5,'포지션 줄 한 줄 '+x);}
  assert.notEqual(lm.view,'none','미리 만든 시즌에도 «명단 · 포지션» 단추');assert.ok(lm.over<=1,'넘침 '+lm.over);
  await page.screenshot({path:shots+'/roster-future-depth-list-'+size+'.png'});

  step='depth';
  await frame.locator('#pwTeam [data-pw-view="depth"]').click();
  await frame.locator('#pwTeam .pw-depth-solo').waitFor();
  const dm=await frame.evaluate(()=>{const h=document.getElementById('pwTeam'),q=s=>[...h.querySelectorAll(s)];
    return {names:q('.pw-depth-solo .pw-depth-name').length,joins:q('.pw-depth-join').map(e=>[e.querySelector('strong').textContent,e.closest('[data-pw-fslot]').dataset.pwFslot,e.closest('article').querySelector('b').textContent]),panel:!!h.querySelector('.pw-depth-panel'),open:q('.pw-depth-solo [data-pw-open]').length,past:q('.pw-depth-solo [data-pw-past]').length,
      slots:q('.pw-depth-solo .pw-depth-pitch .pw-depth-slot').length,chip:h.querySelector('.pw-proj').textContent,pressed:h.querySelector('[data-pw-view="depth"]').getAttribute('aria-pressed'),over:document.documentElement.scrollWidth-innerWidth,
      cut:q('.pw-depth-solo .pw-depth-name').filter(e=>{const r=e.getBoundingClientRect();return r.width<24||r.height<20;}).length};});
  assert.equal(dm.names,base+3,'예상 명단 전원이 판에 '+JSON.stringify(dm));assert.equal(dm.past,base);assert.equal(dm.open,0,'읽기 전용 — 끌기 · 패널 고리 없음');assert.equal(dm.panel,false);
  assert.deepEqual(dm.joins.map(x=>x[0]).sort(),['배준혁','서지훈','오태양']);
  for(const x of dm.joins)assert.ok(x[1]==='__unplaced'||x[2]==={서지훈:'CF',오태양:'RW',배준혁:'LB'}[x[0]],'합류 예정은 스카우팅 포지션 칸 '+x);
  assert.ok(dm.slots>=4);assert.match(dm.chip,/스카우팅 합류 예정 3명/);assert.equal(dm.pressed,'true');assert.ok(dm.over<=1,'넘침 '+dm.over);assert.equal(dm.cut,0);
  await page.screenshot({path:shots+'/roster-future-depth-'+size+'.png'});
  // 끌어도 아무것도 바뀌지 않는다
  const before=await frame.evaluate(()=>JSON.stringify(data.players.map(p=>[p.id,p.posId])));
  const nm=frame.locator('#pwTeam .pw-depth-solo button.pw-depth-name').first(),bb=await nm.boundingBox();
  if(!phone){await page.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await page.mouse.down();await page.mouse.move(bb.x+bb.width/2+160,bb.y+120,{steps:6});await page.mouse.up();}
  assert.equal(await frame.evaluate(()=>JSON.stringify(data.players.map(p=>[p.id,p.posId]))),before);
  assert.equal(await frame.locator('.pw-depth-drop,.is-dragging').count(),0);
  // 검색은 판에도 먹는다
  await frame.locator('#pwTeam [data-pw-search]').fill('서지훈');
  await frame.waitForFunction(()=>document.querySelectorAll('#pwTeam .pw-depth-solo .pw-depth-name').length===1);
  await frame.locator('#pwTeam [data-pw-search]').fill('');
  await frame.waitForFunction(n=>document.querySelectorAll('#pwTeam .pw-depth-solo .pw-depth-name').length===n,base+3);

  step='keep';   // 지금 시즌(포지션 보기) ↔ 미리 만든 시즌 — 보기를 이어 간다
  await frame.getByRole('button',{name:'지금 시즌으로',exact:true}).click();
  await frame.locator('#pwTeam .pw-depth-panel').waitFor();
  assert.equal(await frame.locator('#pwTeam .pw-depth-solo').count(),0);
  await pick(n1+' 시즌 · 미리');
  await frame.locator('#pwTeam .pw-depth-solo').waitFor();
  await frame.locator('#pwTeam [data-pw-view="list"]').click();
  await frame.locator('#pwTeam .pw-table.pw-past').waitFor();
  assert.deepEqual(errors,[],'페이지 오류 없음');
  console.log(JSON.stringify({test:'roster-future-depth-3358',size,engine,passed:true}));
}catch(e){
  console.error('[roster-future-depth-3358] step '+step);
  try{if(frame)console.error(JSON.stringify(await frame.evaluate(()=>({toast:(document.getElementById('toast')||{}).textContent,scope:document.querySelector('#teamView [data-pw-action="season"]')&&document.querySelector('#teamView [data-pw-action="season"]').textContent,season:data.meta.season,ours:tmOurs().length}))));}catch(_){}
  console.error(e);process.exitCode=1;
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close().catch(()=>{});
}
