import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.137 — 오류 제보 738f37d1 «보드 설정에서 팀 불러오기를 통해 등록된 팀을 불러올 때, 선택된 장면에만 팀이 불러와지고 … 모든 장면에 적용되야».
// 저장 팀 불러오기는 지금 페이지의 다른 장면을 같은 id 로만 찾아, 포메이션을 다시 놓은 장면(새 id)엔 이름이 안 들어갔고 다른 페이지 · 미팅의 다른 슬라이드는 그대로였다.
// 이제 판 전체(board-tweaks.js 8 · team-load.js who · wear): 같은 선수(id, 아니면 불러오기 전 번호 · 미팅은 번호 먼저)를 모든 장면 · 페이지(미팅은 슬라이드)에.
// 알림의 «이 장면만» · «이 슬라이드만»이 지금 장면만 남기고 되돌린다. 대기 줄 선수는 지금 페이지의 장면에만. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
// 6초짜리 알림의 단추는 붙는 순간을 적는다(3.102)
const watch=f=>f.evaluate(()=>{window.__ftSeen=null;try{window.__ftMo&&window.__ftMo.disconnect();}catch(_){}const old=document.querySelector('#cs-ftoast .ftoast-act');
  window.__ftMo=new MutationObserver(()=>{const b=document.querySelector('#cs-ftoast .ftoast-act');if(b&&b!==old&&!window.__ftSeen)window.__ftSeen={btn:b,label:b.textContent,text:document.getElementById('cs-ftoast').textContent};});
  window.__ftMo.observe(document.body,{childList:true,subtree:true});});
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  // 3.101 — 내 작업판을 다 불러온 뒤에
  await f.waitForFunction(()=>typeof openAnalysisTeamLibrary==='function'&&window.PSTeamLibrary&&window.PSTeamLoad&&PSTeamLoad.frames.__psTeamAll&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
  await page.waitForTimeout(1000);
  // 13명: 판 위 11명 + 대기 2명(대기 번호 7 은 판의 옛 번호(왼윙 자리)와 일부러 겹친다 — 포지션이 자리를 빼앗지 않게 CF · CB)
  const TEAM=[['1','골키퍼','GK'],['4','센터백1','CB'],['5','센터백2','CB'],['3','왼풀백','LB'],['2','오른풀백','RB'],['6','수미','DM'],['8','중미1','CM'],['10','중미2','CM'],['11','왼윙','LW'],['77','오른윙','RW'],['9','원톱','ST'],['7','후보7','CF'],['33','후보33','CB']].map(([no,name,pos],i)=>({id:'tp'+i,no,name,pos}));
  await f.evaluate(TEAM=>{localStorage.setItem(PSTeamLibrary.key,JSON.stringify([{id:'lib-t1',name:'가상 명단 FC',players:TEAM}]));},TEAM);
  const load=async()=>{await watch(f);await f.evaluate(()=>openAnalysisTeamLibrary());await f.waitForSelector('#alLoad');await f.evaluate(()=>document.getElementById('alLoad').click());
    await f.waitForFunction(()=>window.__ftSeen,null,{timeout:10000});return f.evaluate(()=>({label:window.__ftSeen.label,text:window.__ftSeen.text}));};
  // 1페이지: 4-3-3 · 장면 셋 · 장면 1은 다시 배치(새 id — 예전 불러오기 · «배치»가 만든 모양)
  await f.evaluate(()=>{applyFormationTo('blue','433');applyFormationTo('red','433');if(!window.__animLive())document.getElementById('animToggle').click();document.getElementById('animAdd').click();document.getElementById('animAdd').click();
    selectAnimFrame(0);applyFormationTo('blue','433');autoSaveAnimFrame();});
  await page.waitForTimeout(300);
  // 2페이지 = 복제(같은 id), 3페이지 = 새 배치(새 id · 같은 번호)
  await f.evaluate(()=>{try{window.__psPages.refresh();}catch(_){}document.querySelector('.bpx[title="이 페이지 복제"]').click();});
  await page.waitForTimeout(500);
  await f.evaluate(()=>document.querySelector('#boardPageStrip .tb-add,#boardPageStrip .bp-add').click());await page.waitForTimeout(500);
  await f.evaluate(()=>applyFormationTo('blue','433'));await page.waitForTimeout(200);
  await f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[0].click());await page.waitForTimeout(600);
  await f.evaluate(()=>{if(animActive!==1)selectAnimFrame(1);});await page.waitForTimeout(200);
  const setup=await f.evaluate(()=>({pages:window.__psPages.pg().length,idx:window.__psPages.book.idx(),active:animActive,frames:anim.frames.length,ids:anim.frames.map(fr=>fr.snap.players.filter(p=>p.team==='blue')[0].id)}));
  assert.deepEqual([setup.pages,setup.idx,setup.active,setup.frames],[3,0,1,3],JSON.stringify(setup));
  assert.notEqual(setup.ids[0],setup.ids[1],'장면 1은 id 가 다르다 '+JSON.stringify(setup));
  const before=await f.evaluate(()=>({frames:anim.frames.map(fr=>JSON.stringify(fr.snap.players)),pages:window.__psPages.pg().map(p=>JSON.stringify([p.snap.players,((p.anim&&p.anim.frames)||[]).map(x=>x.snap.players)]))}));

  const toast=await load();
  await page.waitForTimeout(300);
  assert.equal(toast.label,'이 장면만',JSON.stringify(toast));
  assert.match(toast.text,/장면 3개 모두 · 다른 페이지 2개에도 넣었어요/,toast.text);
  // 같은 자리(포지션 표시)에는 모든 장면 · 페이지에서 같은 선수
  const cur=await f.evaluate(()=>Object.fromEntries(state.players.filter(p=>p.team==='blue'&&p.pos&&!/후보/.test(p.name||'')).map(p=>[p.pos,p.name])));
  assert.equal(Object.keys(cur).length>=9,true,JSON.stringify(cur));
  const where=await f.evaluate(()=>{const S=[];anim.frames.forEach((fr,k)=>S.push(['1페이지 장면 '+k,fr.snap]));
    window.__psPages.pg().forEach((p,i)=>{if(i===window.__psPages.book.idx())return;S.push([(i+1)+'페이지',p.snap]);((p.anim&&p.anim.frames)||[]).forEach((fr,k)=>S.push([(i+1)+'페이지 장면 '+k,fr.snap]));});
    return S.map(([n,s])=>[n,s.players.filter(p=>p.team==='blue').map(p=>[p.pos,p.name||null]),s.players.filter(p=>p.team==='red'&&p.name).length]);});
  for(const [n,list,redNamed] of where){
    for(const [pos,name] of list){ if(cur[pos]!==undefined&&!/후보/.test(name||''))assert.equal(name,cur[pos],n+' '+pos+' '+JSON.stringify(list)); }
    assert.ok(list.filter(([,nm])=>nm&&!/후보/.test(nm)).length>=11,n+' 열한 명 모두 이름 '+JSON.stringify(list));
    assert.equal(redNamed,0,n+' 상대 팀은 그대로');
  }
  // 대기 줄 선수는 지금 페이지의 장면마다 한 번씩(번호가 옛 번호와 겹쳐도 다른 선수로 바뀌지 않는다)
  const bench=await f.evaluate(()=>anim.frames.map(fr=>fr.snap.players.filter(p=>/후보/.test(p.name||'')).map(p=>p.name).sort().join(',')));
  assert.deepEqual(bench,['후보33,후보7','후보33,후보7','후보33,후보7'],JSON.stringify(bench));
  // «이 장면만» — 다른 장면 · 페이지는 불러오기 전 그대로, 지금 장면은 이름이 남는다
  await f.evaluate(()=>window.__ftSeen.btn.click());
  await page.waitForTimeout(300);
  const after=await f.evaluate(b=>({frames:anim.frames.map((fr,k)=>k===animActive?null:JSON.stringify(fr.snap.players)===b.frames[k]),
    pages:window.__psPages.pg().map((p,i)=>i===window.__psPages.book.idx()?null:JSON.stringify([p.snap.players,((p.anim&&p.anim.frames)||[]).map(x=>x.snap.players)])===b.pages[i]),
    keep:state.players.filter(p=>p.team==='blue'&&p.name).length,msg:document.getElementById('cs-ftoast').textContent}),before);
  assert.deepEqual(after.frames,[true,null,true],'다른 장면은 되돌렸다 '+JSON.stringify(after));
  assert.deepEqual(after.pages,[null,true,true],'다른 페이지는 되돌렸다 '+JSON.stringify(after));
  assert.ok(after.keep>=11,'지금 장면은 그대로');
  assert.match(after.msg,/이 장면만 바꾸고 다른 곳은 되돌렸어요/);

  // 미팅 — 모든 슬라이드에, 작업 보드의 페이지는 그대로(3.122)
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>document.getElementById('dfNew'));await f.evaluate(()=>document.getElementById('dfNew').click());
  await f.waitForSelector('.vcc-item');await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
  await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length>=2,null,{timeout:15000});
  await f.waitForSelector('#psMeetForm.on');await f.click('#psMeetForm [data-start=filled]');await f.click('#psMeetForm .mf-go');await page.waitForTimeout(500);
  await f.evaluate(()=>{ if(window.__meetingPageActive)window.__meetingPageEdit(); });await f.waitForFunction(()=>!window.__meetingPageActive);await page.waitForTimeout(500);
  // 비교는 미팅 안에서 — 보드를 떠날 때 지금 페이지를 담는 것(capture)은 정상 동작이다
  const workPages=await f.evaluate(()=>JSON.stringify(window.__psPages.pg().map(p=>[p.snap.players,((p.anim&&p.anim.frames)||[]).map(x=>x.snap.players)])));
  const mt=await load();
  assert.equal(mt.label,'이 슬라이드만',JSON.stringify(mt));
  assert.match(mt.text,/다른 슬라이드 \d+장에도 넣었어요/,mt.text);
  await page.waitForTimeout(800);
  const slides=await f.evaluate(()=>anim.slides.map(s=>s.snap.players.filter(p=>p.team==='blue'&&p.name).length));
  assert.ok(slides.length>=6&&slides.every(n=>n>=10),'모든 슬라이드에 이름 '+JSON.stringify(slides));
  assert.equal(await f.evaluate(w=>JSON.stringify(window.__psPages.pg().map(p=>[p.snap.players,((p.anim&&p.anim.frames)||[]).map(x=>x.snap.players)]))===w,workPages),true,'미팅에서 불러와도 작업 보드 페이지는 그대로(3.122)');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('team-load-all-scenes ok',engine,JSON.stringify({toast:toast.text,meet:mt.text,slides}));
}finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} try{await fx.close();}catch(_){}}
