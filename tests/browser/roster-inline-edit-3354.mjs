// 3.354 — 선수단 «명단»에서 바로(목업 A안 «칸을 누르면 바로 고르기»): 조별 묶음 머리 · 조/학년 칸 고르개(학년에 «신입생») · 줄 끝 «⋯»(프로필 수정 · 졸업 처리 · 명단에서 빼기).
// 저장은 원래 길(save({skipTargets}) · 졸업 표시 · 삭제 기록). PS_SIZE=desktop|ipad|phone
import assert from 'node:assert/strict';
import {startFixture,openApp,SHOTS,SIZES} from '../fixtures/team-app.mjs';
const size=process.env.PS_SIZE||'desktop',engine=process.env.PS_BROWSER_ENGINE||SIZES[size].engine,shots=process.env.PS_SHOTS_DIR||SHOTS;
SIZES[size].engine=engine;
const phone=size==='phone',fx=await startFixture(),browsers={};
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
  await page.waitForTimeout(900);   /* scout.html 의 늦은 다시 그리기(400ms)가 지난 뒤 */
  const pickPop=async(button,label)=>{for(let i=0;i<6;i++){await button().click();try{await frame.locator('#psPickPop').waitFor({timeout:2500});break;}catch(e){if(i===5)throw e;}}await frame.locator('#psPickPop button',{hasText:label}).first().click();};
  const pl=name=>frame.evaluate(n=>{const p=data.players.find(x=>x.name===n);return p?{grp:p.grp||'',year:p.schoolYear==null?'':String(p.schoolYear),grad:!!p.grad}:null;},name);
  const heads=()=>frame.evaluate(()=>[...document.querySelectorAll('#pwTeam .pw-table tr.pw-grouphead')].map(r=>r.innerText.replace(/\s+/g,' ').trim()));
  const more=name=>()=>frame.getByRole('button',{name:name+' 더 보기',exact:true});

  // ① 조별 묶음 — 조마다 머리 줄(이름 · 인원), 선수 줄은 18 그대로
  step='groups';
  const h0=await heads(),counts=await frame.evaluate(()=>{const m={};tmOurs().forEach(p=>{const g=(p.grp||'').trim();m[g]=(m[g]||0)+1;});return m;});
  assert.equal(await frame.locator('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').count(),18);
  assert.equal(h0.length,Object.keys(counts).length,'조마다 머리 줄 하나 '+JSON.stringify(h0));
  Object.keys(counts).forEach(g=>assert.ok(h0.some(t=>t.indexOf(g||'조 없음')===0&&t.indexOf(counts[g]+'명')>0),g+' 머리 '+JSON.stringify(h0)));
  const order=await frame.evaluate(()=>[...document.querySelectorAll('#pwTeam .pw-table tbody tr')].map(r=>r.classList.contains('pw-grouphead')?'H':'P').join(''));
  assert.match(order,/^(HP+)+$/,'머리 줄 다음에 그 조 선수 '+order);

  // ② 학년 칸 — «신입생»을 고르면 바로 저장(값 0) · 되돌리기
  step='year';
  assert.equal(await frame.locator('#pwTeam [data-pw-cellyear]').count(),0,'학년을 안 쓰는 팀은 학년 칸이 없다');   /* 처음 적는 길은 줄 «⋯ › 학년 바꾸기» */
  await pickPop(more('가상 선수 3'),'학년 바꾸기');await frame.locator('#psPickPop button',{hasText:'신입생'}).click();
  await frame.waitForFunction(()=>{const p=data.players.find(x=>x.name==='가상 선수 3');return p&&String(p.schoolYear)==='0';});
  if(!phone){await frame.getByRole('button',{name:'가상 선수 3 학년 신입생',exact:true}).waitFor();assert.equal(await frame.locator('#pwTeam [data-pw-cellyear]').count(),18,'한 명이라도 적으면 줄마다 학년 칸');}
  else assert.match(await frame.locator('#pwTeam .pw-table tbody tr',{hasText:'가상 선수 3'}).first().innerText(),/신입생/,'폰은 이름 아래 학년');
  assert.match(await frame.locator('.pw-undo').innerText(),/가상 선수 3[\s\S]*신입생/);
  await frame.locator('.pw-undo button').first().click();
  await frame.waitForFunction(()=>{const p=data.players.find(x=>x.name==='가상 선수 3');return p&&!p.schoolYear;});
  await frame.waitForFunction(()=>!document.querySelector('#pwTeam [data-pw-cellyear]'));
  await pickPop(more('가상 선수 3'),'학년 바꾸기');await frame.locator('#psPickPop button',{hasText:'신입생'}).click();
  await frame.waitForFunction(()=>{const p=data.players.find(x=>x.name==='가상 선수 3');return p&&String(p.schoolYear)==='0';});
  if(!phone)await pickPop(()=>frame.getByRole('button',{name:'가상 선수 3 학년 신입생',exact:true}),'2학년');   /* 칸 고르개 */
  else{await pickPop(more('가상 선수 3'),'학년 바꾸기');await frame.locator('#psPickPop button',{hasText:'2학년'}).click();}
  await frame.waitForFunction(()=>{const p=data.players.find(x=>x.name==='가상 선수 3');return p&&String(p.schoolYear)==='2';});

  // ③ 조 칸 — 다른 조를 고르면 그 조 묶음으로 옮겨진다
  step='group';
  const g0=(await pl('가상 선수 3')).grp,g1=g0==='A팀'?'B팀':'A팀';
  if(!phone)await pickPop(()=>frame.getByRole('button',{name:'가상 선수 3 조 '+g0,exact:true}),g1);
  else{await pickPop(more('가상 선수 3'),'조 바꾸기');await frame.locator('#psPickPop button',{hasText:g1}).click();}
  await frame.waitForFunction(g=>{const p=data.players.find(x=>x.name==='가상 선수 3');return p&&p.grp===g;},g1);
  const h1=await heads();assert.ok(h1.some(t=>t.indexOf(g1)===0&&t.indexOf((counts[g1]+1)+'명')>0),'옮긴 조 인원 +1 '+JSON.stringify(h1));
  await page.screenshot({path:shots+'/roster-inline-'+size+'.png'});

  // ④ 줄 끝 «⋯» — 프로필 수정 · 졸업 처리(확인 뒤 표시만 · 명단에 남는다)
  step='row-more';
  await more('가상 선수 5')().click();await frame.locator('#psPickPop').waitFor();
  const menu=await frame.locator('#psPickPop').innerText();
  assert.match(menu,/프로필 수정/);assert.match(menu,/졸업 처리/);assert.match(menu,/명단에서 빼기/);
  await frame.locator('#psPickPop button',{hasText:'졸업 처리'}).click();
  await frame.getByRole('button',{name:'확인',exact:true}).last().click();
  await frame.waitForFunction(()=>tmOurs().length===17);
  assert.equal((await pl('가상 선수 5')).grad,true);assert.equal(await frame.evaluate(()=>data.players.filter(p=>p.type!=='target').length),18,'졸업생은 명단에 남는다');
  await frame.locator('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').nth(16).waitFor();
  assert.equal(await frame.locator('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').count(),17);

  // ⑤ 서버 — 학년 · 조가 선수별 행에 실린다
  step='server';
  let row=null;
  for(let i=0;i<30&&!row;i++){await page.evaluate(()=>PSSync.syncNow('roster-inline-3354')).catch(()=>{});await page.waitForTimeout(500);
    const pid=await frame.evaluate(()=>data.players.find(x=>x.name==='가상 선수 3').id);
    for(const [k,v] of fx.db){if(k.indexOf('sq:'+pid)>=0||String(v&&v.k||'')==='sq:'+pid){try{const o=JSON.parse(v.v);if(o&&String(o.schoolYear)==='2'&&o.grp===g1)row=o;}catch(_){}}}
    if(!row){for(const [k,v] of fx.db){if(String(k).indexOf('scout_tool_v1')>=0){try{const o=JSON.parse(v.v),p=(o.players||[]).find(x=>x.name==='가상 선수 3');if(p&&String(p.schoolYear)==='2'&&p.grp===g1)row=p;}catch(_){}}}}}
  assert.ok(row,'서버에 학년 2 · '+g1);

  // ⑥ 잠긴 명단 — 칸은 글자만, 줄 «⋯»도 없다
  step='locked';
  await frame.evaluate(()=>{document.body.classList.add('ps-roster-locked');renderTeam();});
  await frame.waitForFunction(()=>!document.querySelector('#pwTeam [data-pw-cellgrp],#pwTeam [data-pw-cellyear],#pwTeam [data-pw-rowmore]'));
  assert.equal((await heads()).length>0,true,'묶음 머리는 그대로');
  await frame.evaluate(()=>{document.body.classList.remove('ps-roster-locked');renderTeam();});

  // ⑦ 세 폭 실측 — 넘침 0 · 누르는 자리 36px+
  step='measure';
  const m=await frame.evaluate(()=>{const de=document.documentElement,b=[...document.querySelectorAll('#pwTeam .pw-cellpick,#pwTeam .pw-rowmore')].filter(x=>x.offsetParent).map(x=>{const r=x.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),Math.round(r.right)];});
    return {vw:innerWidth,over:de.scrollWidth-innerWidth,minH:Math.min(...b.map(x=>x[1])),minW:Math.min(...b.map(x=>x[0])),maxR:Math.max(...b.map(x=>x[2])),n:b.length};});
  console.error('[measure] inline',size,JSON.stringify(m));
  assert.ok(m.over<=1,'넘침 '+m.over);assert.ok(m.n>0&&m.minH>=36&&m.minW>=36,'누르는 자리 '+JSON.stringify(m));assert.ok(m.maxR<=m.vw+1,'화면 안 '+JSON.stringify(m));
  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/.test(e)),[]);
  console.log(JSON.stringify({passed:true,size,engine}));
}catch(e){console.error('[roster-inline-edit-3354] failed at '+step);console.error(e);process.exitCode=1;
  if(frame)console.error('[roster-inline-edit-3354] state',JSON.stringify(await frame.evaluate(()=>({toast:(document.getElementById('toast')||{}).textContent,pop:(document.getElementById('psPickPop')||{}).innerText||'',undo:(document.querySelector('.pw-undo')||{}).innerText||'',heads:[...document.querySelectorAll('#pwTeam .pw-grouphead')].map(r=>r.innerText)})).catch(()=>null)));}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
