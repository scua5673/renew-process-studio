import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.135 — 제보 738f37d1 «팀 불러오기 시, 모든 장면에 적용»: «저장 팀 불러오기»는 지금 페이지에만 이름을 넣었다(PSTeamLoad.frames 는 같은 페이지의 장면만).
// 이제 다른 페이지의 같은 쪽 토큰에도 — 같은 id(복제한 페이지)는 그대로, 아니면 포지션으로. 알림 «이 페이지만»이 다른 페이지를 되돌린다.
// 미팅이면 다른 슬라이드에. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||'desktop';
const fx=await startFixture(),browsers={};
let cur='';
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&typeof openAnalysisTeamLibrary==='function'&&window.PSTeamLoad&&window.PSTeamLoad.__psAll,null,{timeout:30000});
  await page.waitForTimeout(800);
  const TEAM=[['1','골키퍼','GK'],['2','오른쪽 풀백','RB'],['3','왼쪽 풀백','LB'],['4','센터백 하나','CB'],['5','센터백 둘','CB'],['6','수비형','CDM'],['7','왼쪽 윙','LW'],['8','공격형','CAM'],['9','중앙 공격','ST'],['10','왼쪽 중앙','LCM'],['11','오른쪽 윙','RW']].map(([no,name,pos],i)=>({id:'tp'+i,no,name,pos}));
  await f.evaluate(TEAM=>{localStorage.setItem(PSTeamLibrary.key,JSON.stringify([{id:'lib-pos',name:'가상 FC',players:TEAM,kit:{main:'#aa2244',pattern:'v'}}]));},TEAM);
  const place=()=>f.evaluate(()=>{state.players=[];FORM['433'].forEach((s,i)=>{const u=n2u(s[0],s[1]);state.players.push({id:uid++,team:'blue',num:i+1,pos:s[3]||'',x:u.x,y:u.y});});
    const r=n2u(.8,.5);state.players.push({id:uid++,team:'red',num:1,pos:'GK',x:r.x,y:r.y});renderTokens();boardSaveLive();});
  const addPage=async()=>{await f.evaluate(()=>{[...document.querySelectorAll('#boardPageStrip button')].find(b=>/＋ 페이지/.test(b.textContent)).click();});await page.waitForTimeout(500);await place();await page.waitForTimeout(300);};
  const load=async()=>{await f.evaluate(()=>openAnalysisTeamLibrary());await f.waitForSelector('#alLoad',{timeout:10000});await f.evaluate(()=>document.getElementById('alLoad').click());await f.waitForFunction(()=>!document.getElementById('alLoad'),null,{timeout:10000});};
  const named=()=>f.evaluate(()=>(window.__psPages.forSave()||[]).map(p=>({blue:(p.snap.players||[]).filter(q=>q.team==='blue'&&q.name).length,red:(p.snap.players||[]).filter(q=>q.team==='red'&&q.name).length,gk:((p.snap.players||[]).find(q=>q.team==='blue'&&q.pos==='GK')||{}).name||null})));

  cur='pages';
  await place();   // 1 페이지(토큰 id 1~)
  await addPage();await addPage();   // 2 · 3 페이지는 새 id — 포지션으로 맞춘다
  await f.evaluate(()=>window.__psPages.pageNav(-1));await page.waitForTimeout(400);   // 2 페이지에서 불러오기
  assert.equal((await f.evaluate(()=>window.__psPages.pageInfo())).idx,1);
  await load();
  await page.waitForTimeout(900);   // 600ms 뒤 «다른 페이지 2장에도» 알림
  let st=await named();
  assert.deepEqual(st,[{blue:11,red:0,gk:'골키퍼'},{blue:11,red:0,gk:'골키퍼'},{blue:11,red:0,gk:'골키퍼'}],'모든 페이지의 우리 팀에 이름 — 상대는 그대로 '+JSON.stringify(st));
  const toast=await f.evaluate(()=>{const t=document.getElementById('cs-ftoast');return {txt:t&&t.textContent,btn:!!(t&&t.querySelector('.ftoast-act'))};});
  assert.match(toast.txt,/다른 페이지 2장에도 이름을 넣었어요/,'알림 '+toast.txt);assert.equal(toast.btn,true,'«이 페이지만» 단추');
  await page.screenshot({path:path.join(SHOTS,`team-load-all-pages-${engine}-${size}.png`)});
  await f.evaluate(()=>document.querySelector('#cs-ftoast .ftoast-act').click());
  await page.waitForTimeout(500);
  st=await named();
  assert.deepEqual(st.map(p=>p.blue),[0,11,0],'«이 페이지만» — 다른 페이지는 되돌린다 '+JSON.stringify(st));
  // 복제한 페이지(같은 id)도 — 같은 토큰에 그대로. 되돌린 뒤 다시 불러오면 또 모든 페이지에
  await load();await page.waitForTimeout(900);
  assert.deepEqual((await named()).map(p=>p.blue),[11,11,11]);

  cur='meeting';
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>document.getElementById('dfNew'),null,{timeout:30000});
  await f.evaluate(()=>document.getElementById('dfNew').click());
  await f.waitForSelector('.vcc-item');
  await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
  await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===9,null,{timeout:15000});
  await f.waitForFunction(()=>{const o=document.getElementById('psMeetForm');return o&&o.classList.contains('on');},null,{timeout:10000});
  await f.click('#psMeetForm .mf-skip');
  await f.waitForFunction(()=>!document.querySelector('#psMeetForm.on'),null,{timeout:10000});
  await page.waitForTimeout(800);
  await load();await page.waitForTimeout(900);
  const sl=await f.evaluate(()=>({idx:window.__meet.idx(),named:anim.slides.map(s=>(s.snap.players||[]).filter(q=>q.team==='blue'&&q.name).length),cur:state.players.filter(q=>q.team==='blue'&&q.name).length,toast:(document.getElementById('cs-ftoast')||{}).textContent}));
  assert.equal(sl.cur,11,'지금 슬라이드');
  assert.ok(sl.named.every((n,i)=>i===sl.idx||n>0),'다른 슬라이드의 우리 팀에도 이름 '+JSON.stringify(sl));
  assert.match(sl.toast,/다른 슬라이드 \d+장에도/,'미팅 알림 '+sl.toast);
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'오류 없음');
  console.log('team-load-all-pages ok');
}catch(e){ console.error('team-load-all-pages failed at',cur); throw e; }
finally{ for(const b of Object.values(browsers))await b.close(); await fx.close(); }
