// 3.359 — 학교급(초 · 중 · 고 · 대 · 성인팀, 사용자 11/22): 선수단 «⋯ › 학교급»에서 고르면 학년 고르개 · 새 시즌 시작의 졸업 학년이 따라간다.
// 성인팀은 학년 칸 · 학년 보기가 사라지고 적혀 있던 값은 그대로. PS_SIZE=desktop|ipad|phone
import assert from 'node:assert/strict';
import {startFixture,openApp,SHOTS,SIZES} from '../fixtures/team-app.mjs';
import {etc} from '../fixtures/roster-ui.mjs';
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
  await page.waitForTimeout(900);
  const pop=frame.locator('#psPickPop');
  const level=()=>frame.evaluate(()=>String(data.meta.level||''));
  const pickLevel=async label=>{for(let i=0;i<6;i++){await etc(frame,'level');try{await pop.waitFor({timeout:2500});break;}catch(e){if(i===5)throw e;}}const t=await pop.innerText();await pop.locator('button',{hasText:label}).first().click();return t;};
  const yearMenu=async name=>{const b=frame.getByRole('button',{name:name+' 더 보기',exact:true});for(let i=0;i<6;i++){await b.click();try{await pop.waitFor({timeout:2500});break;}catch(e){if(i===5)throw e;}}};
  const seasonText=async()=>{await etc(frame,'seasonStart');const d=frame.locator('#pwSeason');await d.waitFor();const t=(await d.innerText()).replace(/\s+/g,' ');await d.getByRole('button',{name:'취소',exact:true}).click();await frame.waitForFunction(()=>{const x=document.getElementById('pwSeason');return !x||!x.open;});return t;};
  await frame.evaluate(()=>{const o=data.players.filter(p=>p.type!=='target');o.forEach((p,i)=>{if(i<2)p.schoolYear='3';else if(i<5)p.schoolYear='2';else if(i<6)p.schoolYear='0';});save({skipTargets:true});renderTeam();});
  await frame.waitForFunction(()=>document.querySelectorAll('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').length===18);

  // ① 고르지 않은 팀 — 3학년제(전과 같다)
  step='default';
  assert.equal(await level(),'');
  let st=await seasonText();assert.match(st,/3학년 2명/);assert.match(st,/→ 졸업/);assert.match(st,/졸업 2명/);

  // ② 초등학교 — 6학년까지 · 3학년은 4학년으로
  step='elem';
  const opts=await pickLevel('초등학교');
  for(const w of ['정하지 않음 · 3학년까지','초등학교 · 6학년까지','중학교 · 3학년까지','고등학교 · 3학년까지','대학교 · 4학년까지','성인팀 · 학년 없음'])assert.ok(opts.indexOf(w)>=0,'고르개에 '+w+' — '+opts);
  await frame.waitForFunction(()=>data.meta.level==='elem');
  assert.match(await frame.locator('.pw-undo').innerText(),/학교급 → 초등학교[\s\S]*6학년이 졸업 학년입니다/);
  await frame.locator('#tmEtcBtn').click();
  assert.equal((await frame.locator('#tmEtcMenu [data-pw-etc="level"]').innerText()).trim(),'학교급 · 초등학교');
  const mm=await frame.evaluate(()=>{const b=document.querySelector('#tmEtcMenu [data-pw-etc="level"]').getBoundingClientRect();return {h:Math.round(b.height),in:b.left>=0&&b.right<=innerWidth+1,over:document.documentElement.scrollWidth-innerWidth};});
  assert.ok(mm.h>=30&&mm.in&&mm.over<=1,'메뉴 항목(다른 «⋯» 항목과 같은 높이) '+JSON.stringify(mm));
  await page.screenshot({path:shots+'/team-level-menu-'+size+'.png'});
  await page.keyboard.press('Escape');
  /* 넓은 화면은 줄의 학년 칸, 폰은 줄 «⋯ › 학년 바꾸기» */
  if(phone){await yearMenu('가상 선수 9');await pop.locator('button',{hasText:'학년 바꾸기'}).click();}
  else{const cell=frame.getByRole('button',{name:'가상 선수 9 학년 미지정',exact:true});for(let i=0;i<6;i++){await cell.click();try{await pop.waitFor({timeout:2500});break;}catch(e){if(i===5)throw e;}}}
  await frame.waitForFunction(()=>{const p=document.getElementById('psPickPop');return p&&/6학년/.test(p.innerText);});const ys=await pop.innerText();
  for(const w of ['미지정','신입생','1학년','4학년','5학년','6학년'])assert.ok(ys.indexOf(w)>=0,'학년 고르개에 '+w+' — '+ys);
  const pm=await frame.evaluate(()=>{const r=document.getElementById('psPickPop').getBoundingClientRect();return {t:r.top>=0,b:r.bottom<=innerHeight+1,l:r.left>=0,r:r.right<=innerWidth+1};});
  assert.ok(pm.t&&pm.b&&pm.l&&pm.r,'학년 고르개가 화면 안 '+JSON.stringify(pm));
  await page.screenshot({path:shots+'/team-level-years-'+size+'.png'});
  await pop.locator('button',{hasText:'6학년'}).click();
  await frame.waitForFunction(()=>{const p=data.players.find(x=>x.name==='가상 선수 9');return p&&String(p.schoolYear)==='6';});
  st=await seasonText();
  assert.match(st,/6학년 1명[^→]*→ 졸업/);assert.match(st,/3학년 2명[^→]*→ 4학년/);assert.match(st,/신입생 1명[^→]*→ 1학년/);assert.match(st,/졸업 1명/);

  // ③ 대학교 — 4학년까지(6학년으로 적힌 선수는 졸업 쪽)
  step='univ';
  await pickLevel('대학교');await frame.waitForFunction(()=>data.meta.level==='univ');
  st=await seasonText();assert.match(st,/3학년 2명[^→]*→ 4학년/);assert.match(st,/졸업 1명/);

  // ④ 성인팀 — 학년 칸 · 학년 보기 없음 · 값은 그대로 · 시즌만 넘어간다
  step='adult';
  await pickLevel('성인팀');await frame.waitForFunction(()=>data.meta.level==='adult');
  assert.match(await frame.locator('.pw-undo').innerText(),/학교급 → 성인팀[\s\S]*학년 없이 씁니다/);
  await frame.waitForFunction(()=>!document.querySelector('#pwTeam [data-pw-cellyear]'));
  const am=await frame.evaluate(()=>({bar:document.querySelectorAll('#tmSchoolYears button').length,txt:document.querySelector('#pwTeam .pw-table').innerText,kept:data.players.filter(p=>p.schoolYear).length,over:document.documentElement.scrollWidth-innerWidth}));
  assert.equal(am.bar,0,'학년 보기 단추 없음');assert.doesNotMatch(am.txt,/학년|신입생/);assert.equal(am.kept,7,'적혀 있던 학년 값은 지우지 않는다');assert.ok(am.over<=1);
  await yearMenu('가상 선수 9');assert.doesNotMatch(await pop.innerText(),/학년 바꾸기/);await page.keyboard.press('Escape');
  st=await seasonText();assert.match(st,/성인팀은 명단 그대로 새 시즌으로 넘어갑니다/);assert.match(st,/졸업 0명/);assert.doesNotMatch(st,/→ 졸업|학년 없음 \d+명/);
  await page.screenshot({path:shots+'/team-level-adult-'+size+'.png'});

  // ⑤ 되돌리기 — 바로 앞 학교급으로
  step='undo';
  await pickLevel('고등학교');await frame.waitForFunction(()=>data.meta.level==='high');
  await frame.locator('.pw-undo').getByRole('button',{name:'되돌리기'}).click();
  await frame.waitForFunction(()=>data.meta.level==='adult');
  await pickLevel('정하지 않음');await frame.waitForFunction(()=>!('level' in data.meta));
  st=await seasonText();assert.match(st,/졸업 3명/,'3학년제로 돌아오면 3학년 둘 + 6학년 하나');
  assert.deepEqual(errors,[],'페이지 오류 없음');
  console.log(JSON.stringify({test:'team-level-3359',size,engine,passed:true}));
}catch(e){
  console.error('[team-level-3359] step '+step);
  try{if(frame)console.error(JSON.stringify(await frame.evaluate(()=>({level:data.meta.level,toast:(document.getElementById('toast')||{}).textContent,pop:(document.getElementById('psPickPop')||{}).innerText}))));}catch(_){}
  console.error(e);process.exitCode=1;
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close().catch(()=>{});
}
