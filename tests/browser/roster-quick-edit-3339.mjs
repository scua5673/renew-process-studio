// 3.339 — 선수단 «명단» 표에서 바로(목업 A안): 맨 위 줄로 넣기 · 체크 칸으로 여러 명 골라 조 바꾸기 · 명단에서 빼기 · 스카우팅에서 불러오기.
// 저장 길은 원래 것(넣기 save · 빼기 plTombAdd → save({deletedIds}) · 조 save({skipTargets})), 스카우팅 원장은 글자 그대로. PS_SIZE=desktop|ipad|phone
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startFixture,openApp,SHOTS,WT,A,SIZES} from '../fixtures/team-app.mjs';
const require=createRequire(import.meta.url),store=require('../../studio/scouting-store.js');
const size=process.env.PS_SIZE||'desktop',engine=process.env.PS_BROWSER_ENGINE||SIZES[size].engine,shots=process.env.PS_SHOTS_DIR||SHOTS;
SIZES[size].engine=engine;
const phone=size==='phone';
/* 목업과 같은 다섯 후보 — 확정 셋(그중 «가상 선수 1 · 1번»은 이미 명단에 있다) · 영입대상 하나 · 추천 하나 */
const cands=[['sc-1','서지훈','CF','9','done','2010-05-01'],['sc-2','오태양','RW','7','done',''],['sc-3','가상 선수 1','GK','1','done',''],['sc-4','문건우','CM','8','go',''],['sc-5','배준혁','LB','3','rep','']];
const target=store.reconcile(null,{v:1,players:cands.map(([id,name,pos,num,st,dob])=>({id,dbId:id,type:'target',name,posId:'pos_'+pos,num,club:'가상 유나이티드',grade:'B',scoutSt:st,foot:'R',levels:{},profile:dob?{dob}:{}}))});
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
  await frame.locator('#pwTeam [data-pw-view="list"]').waitFor();   /* 폰은 처음 보기가 다르다 — «명단»을 눌러 표로 */
  await frame.getByRole('button',{name:'명단',exact:true}).click();
  await frame.locator('#pwTeam .pw-table tbody tr').first().waitFor();
  const roster=()=>frame.evaluate(()=>data.players.filter(p=>p.type!=='target').map(p=>({id:p.id,name:p.name,num:p.num||'',posId:p.posId||'',grp:p.grp||'',from:p.joinedFrom&&p.joinedFrom.cid||'',foot:p.foot||'',dob:p.profile&&p.profile.dob||'',team:p.profile&&p.profile.team||''})));
  const rows=()=>frame.locator('#pwTeam .pw-table tbody tr');
  const toastText=()=>frame.evaluate(()=>{const t=document.getElementById('toast');return t&&t.classList.contains('on')?t.textContent:'';});
  assert.equal((await roster()).length,18);assert.equal(await rows().count(),18);

  // ① 맨 위 줄로 넣기 — Enter 로 들어가고 줄은 비워진 채 이름 칸에 남는다
  step='quick-add';
  const qa=frame.locator('#pwTeam [data-pw-qa]');await qa.waitFor();
  await qa.getByRole('textbox',{name:'새 선수 등번호'}).fill('30');
  await qa.getByRole('textbox',{name:'새 선수 이름'}).fill('강민재');
  if(!phone){await qa.getByRole('combobox',{name:'새 선수 포지션'}).selectOption('pos_RW');await qa.getByRole('combobox',{name:'새 선수 조'}).selectOption('A팀');}
  else assert.equal(await qa.getByRole('combobox',{name:'새 선수 포지션'}).isVisible(),false,'폰 줄은 번호 · 이름 둘');
  await qa.getByRole('textbox',{name:'새 선수 이름'}).press('Enter');
  await frame.waitForFunction(()=>data.players.some(p=>p.name==='강민재'));
  let r=await roster(),mj=r.find(p=>p.name==='강민재');
  assert.equal(r.length,19);assert.equal(mj.num,'30');
  if(!phone){assert.equal(mj.posId,'pos_RW');assert.equal(mj.grp,'A팀');}
  assert.equal(await qa.getByRole('textbox',{name:'새 선수 이름'}).inputValue(),'','이름 칸은 비워진다');
  assert.equal(await frame.evaluate(()=>document.activeElement&&document.activeElement.getAttribute('aria-label')),'새 선수 이름','다음 선수를 바로 친다');
  assert.equal(await rows().first().locator('.pw-name strong').innerText(),'강민재','방금 넣은 선수는 맨 위');
  assert.equal(await rows().first().evaluate(tr=>tr.classList.contains('is-fresh')),true);
  await qa.getByRole('textbox',{name:'새 선수 이름'}).fill('이서준');await qa.getByRole('textbox',{name:'새 선수 이름'}).press('Enter');
  await frame.waitForFunction(()=>data.players.some(p=>p.name==='이서준'));
  assert.equal(await rows().first().locator('.pw-name strong').innerText(),'이서준','이어서 넣은 선수가 맨 위');
  // 같은 이름 + 번호는 안 늘어난다
  await qa.getByRole('textbox',{name:'새 선수 등번호'}).fill('30');await qa.getByRole('textbox',{name:'새 선수 이름'}).fill('강민재');await qa.getByRole('textbox',{name:'새 선수 이름'}).press('Enter');
  await frame.waitForFunction(()=>/이미 명단에 있어요/.test(document.getElementById('toast').textContent));
  assert.equal((await roster()).length,20);
  await qa.getByRole('textbox',{name:'새 선수 이름'}).fill('');await qa.getByRole('textbox',{name:'새 선수 등번호'}).fill('');
  await page.waitForTimeout(300);   /* 단추 색 전환(0.12s)이 끝난 뒤 찍는다 */
  await page.screenshot({path:path.join(shots,'roster-quick-add-'+size+'.png')});
  /* 세 폭 실측 — 줄이 화면 밖으로 안 나가고(가로 넘침 없음) 누르는 칸은 36px 이상, 폰(≤700)은 번호 · 이름 · 넣기 셋 */
  const qm=await frame.evaluate(()=>{const f=document.querySelector('#pwTeam [data-pw-qa]'),r=f.getBoundingClientRect(),host=document.getElementById('pwTeam');
    return {vw:innerWidth,left:r.left,right:r.right,over:host.scrollWidth-host.clientWidth,doc:document.documentElement.scrollWidth-innerWidth,cells:[...f.querySelectorAll('input,select,button')].filter(x=>x.offsetParent).map(x=>{const b=x.getBoundingClientRect();return [x.getAttribute('aria-label')||x.textContent.trim(),Math.round(b.width),Math.round(b.height)];})};});
  console.error('[measure] quick-add',size,JSON.stringify(qm));
  assert.ok(qm.left>=0&&qm.right<=qm.vw+.5&&qm.over<=1&&qm.doc<=1,'넣기 줄이 화면 안 '+JSON.stringify(qm));
  for(const c of qm.cells)assert.ok(c[2]>=36&&c[1]>=36,'누르는 칸 36px 이상 '+JSON.stringify(c));
  assert.equal(qm.cells.length,phone?3:5);

  // ② 여러 명 골라 조 바꾸기 — 선택은 몇 명이든, 비교는 2~3명
  step='select';
  for(const n of ['강민재','이서준','가상 선수 3','가상 선수 4'])await frame.getByRole('checkbox',{name:n+' 선택',exact:true}).check();
  const bar=frame.locator('#pwTeam .pw-comparebar');await bar.waitFor();
  assert.match(await bar.innerText(),/4명 선택/);
  assert.equal(await bar.getByRole('button',{name:'비교는 3명까지',exact:true}).isDisabled(),true);
  await frame.getByRole('checkbox',{name:'가상 선수 4 선택',exact:true}).uncheck();
  assert.equal(await bar.getByRole('button',{name:'선수 비교',exact:true}).isDisabled(),false,'3명이면 비교');
  await frame.getByRole('checkbox',{name:'가상 선수 3 선택',exact:true}).uncheck();
  step='regroup';
  await bar.getByRole('button',{name:'조 바꾸기',exact:true}).click();
  await frame.locator('#psPickPop').waitFor();
  assert.match(await frame.locator('#psPickPop').innerText(),/2명 · 조 바꾸기/);
  await frame.locator('#psPickPop button',{hasText:'B팀'}).click();
  await frame.waitForFunction(()=>['강민재','이서준'].every(n=>data.players.find(p=>p.name===n).grp==='B팀'));
  const bm=await bar.evaluate(el=>{const r=el.getBoundingClientRect();return {vw:innerWidth,left:r.left,right:r.right,h:Math.round(r.height),btn:[...el.querySelectorAll('button')].map(b=>{const q=b.getBoundingClientRect();return [b.textContent,Math.round(q.width),Math.round(q.height),Math.round(q.right)];})};});
  console.error('[measure] select-bar',size,JSON.stringify(bm));
  assert.ok(bm.left>=0&&bm.right<=bm.vw+.5,'선택 띠가 화면 안');for(const c of bm.btn)assert.ok(c[3]<=bm.vw+.5&&c[2]>=36,'띠 단추 '+JSON.stringify(c));
  await page.waitForTimeout(300);   /* 단추 색 전환(0.12s)이 끝난 뒤 찍는다 */
  await page.screenshot({path:path.join(shots,'roster-select-bar-'+size+'.png')});

  // ③ 명단에서 빼기 — 이름을 보여 주고 확인 · 삭제 기록(plTombAdd)이 먼저
  step='remove';
  await bar.getByRole('button',{name:'명단에서 빼기',exact:true}).click();
  const confirmText=await frame.evaluate(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.textContent==='확인'&&x.offsetParent);return b.length?b[b.length-1].closest('div').parentElement.innerText:'';});
  assert.match(confirmText,/2명을 명단에서 삭제할까요\?/);assert.match(confirmText,/강민재 30번/);assert.match(confirmText,/이서준/);
  const gone=(await roster()).filter(p=>p.name==='강민재'||p.name==='이서준').map(p=>p.id);
  await frame.getByRole('button',{name:'확인',exact:true}).last().click();
  await frame.waitForFunction(()=>!data.players.some(p=>p.name==='강민재'||p.name==='이서준'));
  r=await roster();assert.equal(r.length,18);
  const tombs=await frame.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('cs_player_del_v1')))||'{}'));
  for(const id of gone)assert.ok(tombs[id],'삭제 기록 '+id);
  assert.equal(await bar.isVisible(),false,'빼고 나면 선택이 비워진다');
  assert.match(await toastText(),/2명을 명단에서 지웠어요/);

  // ④ 스카우팅에서 불러오기 — 확정 둘이 먼저 체크 · 이미 있는 선수는 흐리게 · 스카우팅 원장은 그대로
  step='import';
  if(await frame.locator('#pwTeam [data-pw-action="tools"]').isVisible())await frame.locator('#pwTeam [data-pw-action="tools"]').click();
  await frame.getByRole('button',{name:'⇣ 스카우팅에서 불러오기',exact:true}).click();
  const dlg=frame.locator('#pwImport');await dlg.waitFor();
  assert.equal(await dlg.getByRole('button',{name:'확정 3',exact:true}).getAttribute('aria-pressed'),'true','처음은 «확정»');
  assert.equal(await dlg.locator('.pwi-row').count(),3);
  assert.equal(await dlg.getByRole('checkbox',{name:'가상 선수 1 명단에 넣기'}).isDisabled(),true,'같은 이름 + 번호는 흐리게');
  assert.equal(await dlg.getByRole('checkbox',{name:'서지훈 명단에 넣기'}).isChecked(),true);
  assert.equal(await dlg.getByRole('checkbox',{name:'오태양 명단에 넣기'}).isChecked(),true);
  await dlg.getByRole('button',{name:'영입대상 1',exact:true}).click();
  assert.equal(await dlg.locator('.pwi-row').count(),1);
  await dlg.getByRole('checkbox',{name:'문건우 명단에 넣기'}).check();
  await dlg.getByRole('button',{name:'B팀',exact:true}).click();
  assert.deepEqual(await dlg.locator('[data-pwi-grp]').evaluateAll(bs=>bs.map(b=>b.textContent+':'+b.classList.contains('is-on')+':'+b.getAttribute('aria-pressed'))),['A팀:false:false','B팀:true:true','조 없음:false:false'],'고른 조만 진하게');
  assert.equal(await dlg.locator('[data-pwi-ok]').innerText(),'3명 명단에 넣기');
  const dm=await dlg.evaluate(el=>{const r=el.getBoundingClientRect(),ok=el.querySelector('[data-pwi-ok]').getBoundingClientRect(),list=el.querySelector('.pwi-list');return {vw:innerWidth,vh:innerHeight,top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),okBottom:Math.round(ok.bottom),over:Math.max(list.scrollWidth-list.clientWidth,el.querySelector('.pw-detailbody').scrollWidth-el.querySelector('.pw-detailbody').clientWidth,...[...el.querySelectorAll('.pwi-row,.pwi-find,.pwi-bulk,.pwi-lead')].map(x=>Math.round(x.getBoundingClientRect().right-r.right)))};});
  console.error('[measure] import',size,JSON.stringify(dm));
  assert.ok(dm.top>=0&&dm.bottom<=dm.vh+.5&&dm.left>=0&&dm.right<=dm.vw+.5&&dm.okBottom<=dm.vh&&dm.over<=1,'불러오기 창이 화면 안 · 넣기 단추가 보인다 '+JSON.stringify(dm));
  await page.waitForTimeout(300);   /* 단추 색 전환(0.12s)이 끝난 뒤 찍는다 */
  await page.screenshot({path:path.join(shots,'roster-scout-import-'+size+'.png')});
  await dlg.locator('[data-pwi-ok]').click();
  await dlg.waitFor({state:'detached'});
  await frame.waitForFunction(()=>['서지훈','오태양','문건우'].every(n=>data.players.some(p=>p.name===n&&p.type!=='target')));
  r=await roster();assert.equal(r.length,21);
  const sj=r.find(p=>p.name==='서지훈'),ty=r.find(p=>p.name==='오태양'),gw=r.find(p=>p.name==='문건우');
  assert.equal(sj.posId,'pos_CF');assert.equal(sj.num,'9');assert.equal(sj.foot,'R');assert.equal(sj.dob,'2010-05-01');assert.equal(sj.team,'가상 유나이티드');assert.equal(sj.grp,'B팀');
  assert.ok(sj.from&&ty.from&&gw.from,'불러온 표식');
  assert.equal(await frame.evaluate(()=>data.players.filter(p=>p.type==='target').length),5,'후보 배치는 스카우팅에 그대로');
  assert.equal(await rows().count(),21);
  assert.equal(await rows().first().evaluate(tr=>tr.classList.contains('is-fresh')&&!!tr.querySelector('.pw-from-scout')),true,'방금 불러온 줄 — 넓은 화면은 «스카우팅에서» 꼬리표, 폰은 초록 줄만');
  if(!phone)assert.match(await rows().first().innerText(),/스카우팅에서/);
  // 다시 열면 불러온 후보는 «이미 명단에 있어요»
  await frame.getByRole('button',{name:'⇣ 스카우팅에서 불러오기',exact:true}).click();await dlg.waitFor();
  assert.equal(await dlg.getByRole('checkbox',{name:'서지훈 명단에 넣기'}).isDisabled(),true);
  assert.equal(await dlg.locator('[data-pwi-ok]').isDisabled(),true,'넣을 후보가 없으면 단추가 꺼진다');
  await dlg.getByRole('button',{name:'취소',exact:true}).click();await dlg.waitFor({state:'detached'});

  // ⑤ 기기 사본 · 서버 — 명단은 21명(뺀 선수 없음), 스카우팅 원장은 서버에서 글자 그대로
  step='saved';
  let saved=null;
  for(let i=0;i<30&&!saved;i++){saved=await frame.evaluate(async()=>{try{await scoutStore.ready(true);}catch(e){return null;}const d=JSON.parse(localStorage.getItem('scout_tool_v1'));return d.players.filter(p=>p.type!=='target').map(p=>p.id);});if(!saved)await page.waitForTimeout(500);}
  assert.ok(saved,'명단 저장 확인');assert.equal(saved.length,21);assert.ok(!saved.some(id=>gone.includes(id)),'뺀 선수는 기기 사본에서도 빠졌다');
  await page.evaluate(()=>PSSync.syncNow('roster-quick-3339'));
  /* posName 은 선수단 화면이 배경에서 채우는 칸(3.272 «posName 채움» — 이 기능과 무관) — 그것만 빼고 후보 · 배치 · 등록부가 글자 그대로인지 본다 */
  const lean=v=>{const d=JSON.parse(v);(d.players||[]).forEach(p=>{delete p.posName;});return JSON.stringify(d);};
  assert.equal(lean(fx.db.get(WT+'|cs_scout_targets_v1').v),lean(scoutRaw),'스카우팅 원장은 서버에서 그대로');

  // ⑥ 잠긴 명단에서는 넣기 줄 · 불러오기 · 조 바꾸기 · 빼기가 보이지 않는다
  step='locked';
  await frame.evaluate(()=>{document.body.classList.add('ps-roster-locked');renderTeam();});
  await frame.waitForFunction(()=>{const q=document.querySelector('#pwTeam .pw-quickadd');return q&&q.hidden;});
  assert.equal(await frame.locator('#pwTeam [data-pw-action="scoutImport"]').count(),0);
  await frame.getByRole('checkbox',{name:'가상 선수 5 선택',exact:true}).check();
  assert.equal(await bar.getByRole('button',{name:'명단에서 빼기',exact:true}).count(),0);
  assert.equal(await bar.getByRole('button',{name:'조 바꾸기',exact:true}).count(),0);
  await frame.evaluate(()=>{document.body.classList.remove('ps-roster-locked');});

  /* 상태 줄 — 빠르게 이어 고친 동안 동기화 회차가 «변경된 작업을 다시 확인»(sync_local_changed)으로 멈출 수 있다. 다음 회차에 풀려야 한다 */
  step='status';
  let strip='';
  for(let i=0;i<20;i++){await page.evaluate(()=>PSSync.syncNow('roster-quick-3339-settle')).catch(()=>{});strip=await page.evaluate(()=>{const s=document.getElementById('psSyncStrip');return s?s.innerText.replace(/\s+/g,' ').trim():'';});if(!/다시 확인하고 있어요|저장되지|실패/.test(strip))break;await page.waitForTimeout(1000);}
  console.error('[measure] status',size,JSON.stringify(strip));
  assert.doesNotMatch(strip,/다시 확인하고 있어요|저장되지|실패/,'상태 줄이 풀린다');
  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/.test(e)),[]);
  console.log(JSON.stringify({passed:true,size,engine}));
}catch(e){console.error('[roster-quick-edit-3339] failed at '+step);console.error(e);process.exitCode=1;
  if(frame)console.error('[roster-quick-edit-3339] state',JSON.stringify(await frame.evaluate(()=>({toast:(document.getElementById('toast')||{}).textContent,pop:!!document.getElementById('psPickPop'),dlg:!!document.getElementById('pwImport'),sel:[...document.querySelectorAll('#pwTeam [data-pw-select]:checked')].map(x=>x.dataset.pwSelect),bar:(document.querySelector('#pwTeam .pw-comparebar')||{}).innerText,grp:data.players.filter(p=>/강민재|이서준/.test(p.name)).map(p=>p.name+':'+(p.grp||''))})).catch(x=>String(x))));}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
