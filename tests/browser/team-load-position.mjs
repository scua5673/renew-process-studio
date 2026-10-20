import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 제보 5400cd9e — 저장 팀을 불러오면 판에 놓아 둔 토큰은 그 자리 그대로, 포지션이 맞는 토큰에 이름·번호만 들어간다(예전: 지우고 늘 4-3-3).
// 판이 빈 쪽은 보드 포메이션 자리에 새로 놓는다. 되돌리기 한 번이면 예전 판. 제보 4116fc54 — 팀 등록에서 선수 순서를 바꿔 저장하면 그 순서가 남는다. 선수 사진은 이 기기에만(PSImg + 기기 표) — 저장 팀 문서에는 없다.
// 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(3000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof openAnalysisTeamLibrary==='function'&&window.PSTeamLibrary&&window.PSTeamLoad);
  await page.waitForTimeout(1200);
  // 저장 팀 — 목록 순서와 포지션이 판의 자리 순서와 다르다. 13명(2명은 대기 줄)
  const TEAM=[['9','중앙 공격','ST'],['1','골키퍼','GK'],['4','센터백 하나','CB'],['5','센터백 둘','CB'],['3','왼쪽 풀백','LB'],['2','오른쪽 풀백','RB'],['8','공격형','CAM'],
    ['6','수비형','CDM'],['7','왼쪽 윙','LW'],['11','오른쪽 윙','RW'],['10','왼쪽 중앙','LCM'],['12','후보 공격','ST'],['13','후보 수비','CB']].map(([no,name,pos],i)=>({id:'tp'+i,no,name,pos}));
  await f.evaluate(TEAM=>{localStorage.setItem(PSTeamLibrary.key,JSON.stringify([{id:'lib-pos',name:'가상 포지션 FC',players:TEAM,kit:{main:'#aa2244',pattern:'v'}}]));},TEAM);
  // 4-3-3 이 아닌 판(3-4-1-2 비슷하게, 코치가 손으로 옮긴 자리) — 포지션 표시가 있는 토큰 11개
  const SHAPE=[[.05,.5,'GK'],[.16,.3,'LCB'],[.14,.5,'CB'],[.16,.7,'RCB'],[.28,.1,'LWB'],[.27,.42,'DM'],[.29,.6,'RCM'],[.28,.9,'RWB'],[.37,.52,'AM'],[.45,.35,'LM'],[.47,.62,'ST']];
  const before=await f.evaluate(SHAPE=>{state.players=[];SHAPE.forEach(([nx,ny,pos],i)=>{const u=n2u(nx,ny);state.players.push({id:uid++,team:'blue',num:i+1,pos,x:u.x,y:u.y});});renderTokens();return state.players.map(p=>({id:p.id,x:p.x,y:p.y,pos:p.pos}));},SHAPE);
  await f.evaluate(()=>openAnalysisTeamLibrary());
  await f.waitForSelector('#alLoad');
  await f.evaluate(()=>document.getElementById('alLoad').click());
  await f.waitForFunction(()=>!document.getElementById('alLoad'));
  const after=await f.evaluate(()=>state.players.filter(p=>p.team==='blue').map(p=>({id:p.id,x:p.x,y:p.y,pos:p.pos,name:p.name,num:p.num})));
  const byId=Object.fromEntries(after.map(p=>[p.id,p]));
  for(const b of before){const a=byId[b.id];assert.ok(a,'판의 토큰 '+b.pos+' 가 그대로 있다');assert.equal(a.x,b.x,b.pos+' x 그대로');assert.equal(a.y,b.y,b.pos+' y 그대로');assert.equal(a.pos,b.pos,b.pos+' 포지션 표시 그대로');}
  const at=Object.fromEntries(before.map(b=>[b.pos,byId[b.id].name]));
  assert.deepEqual(at,{GK:'골키퍼',LCB:'센터백 둘',CB:'센터백 하나',RCB:'후보 수비',LWB:'왼쪽 풀백',DM:'수비형',RCM:'왼쪽 중앙',RWB:'오른쪽 풀백',AM:'공격형',LM:'왼쪽 윙',ST:'중앙 공격'},'포지션이 맞는 자리에');
  assert.equal(byId[before[0].id].num,'1','등번호도 저장 팀 것');
  const bench=after.filter(p=>!before.some(b=>b.id===p.id));
  assert.deepEqual(bench.map(p=>p.name).sort(),['오른쪽 윙','후보 공격'].sort(),'자리보다 많은 선수는 대기 줄');
  assert.equal(new Set(after.map(p=>Math.round(p.x)+','+Math.round(p.y))).size,after.length,'겹치는 자리 없음');
  assert.equal(await f.evaluate(()=>state.teamColors&&state.teamColors.blue),'#aa2244','유니폼도 그 쪽에');
  // 되돌리기 한 번 — 예전 판(이름 없음 · 대기 줄 없음)
  await f.evaluate(()=>undoLast());
  const undone=await f.evaluate(()=>state.players.filter(p=>p.team==='blue').map(p=>({id:p.id,x:p.x,y:p.y,name:p.name||null})));
  assert.deepEqual(undone.map(p=>[p.id,p.x,p.y,p.name]),before.map(b=>[b.id,b.x,b.y,null]),'되돌리면 불러오기 전');
  // 판이 빈 쪽(팀 2)은 보드 포메이션(4-4-2) 자리에 새로 — 4-3-3 고정이 아니다
  const red=await f.evaluate(async()=>{state.players=state.players.filter(p=>p.team!=='red');renderTokens();document.getElementById('formAway').value='442';
    openAnalysisTeamLibrary();await new Promise(r=>{const t=setInterval(()=>{if(document.getElementById('alLoad')){clearInterval(t);r();}},50);});
    const s=document.getElementById('alSide');s.value='red';s.dispatchEvent(new Event('change'));
    [...document.querySelectorAll('#alPlayers input')].forEach((c,i)=>{c.checked=i<11;});document.getElementById('alLoad').click();
    await new Promise(r=>{const t=setInterval(()=>{if(!document.getElementById('alLoad')){clearInterval(t);r();}},50);});
    const pr=PR(),ps=state.players.filter(p=>p.team==='red');
    return ps.map(p=>[Math.round((1-(p.x-pr.L)/pr.PW)*1000)/1000,Math.round((1-(p.y-pr.T)/pr.PH)*1000)/1000,p.pos]);});
  assert.equal(red.length,11);
  const want=await f.evaluate(()=>FORM['442'].map(s=>Math.round(s[0]*1000)/1000+','+Math.round(s[1]*1000)/1000).sort());
  assert.deepEqual(red.map(r=>r[0]+','+r[1]).sort(),want,'4-4-2 자리(좌우 반전)');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'작전판 오류 없음');

  // 4116fc54 — 팀 등록에서 순서 바꾸기(키보드 · 끌기) 후 저장하면 그 순서가 남고, 작전판 목록도 그 순서
  await f.evaluate(()=>openAnalysisTeamLibrary());await f.waitForSelector('#alManage');await f.click('#alManage');   // 불러오기 창의 «팀·선수 관리»
  const a=await (await page.waitForSelector('#fAnalysis[src]',{state:'attached'})).contentFrame();
  await a.waitForSelector('#teamList button.team');
  await a.click('#teamList button.team');
  await a.waitForSelector('#playerRows .row .grip');
  await a.focus('#playerRows .row:nth-child(2) .grip');
  await page.keyboard.press('ArrowUp');   // 골키퍼를 맨 위로
  assert.equal(await a.evaluate(()=>document.activeElement.getAttribute('aria-label')),'선수 1 순서 바꾸기 — 위·아래 화살표','옮긴 뒤에도 같은 선수의 손잡이에 초점');
  await a.locator('#playerRows .row').nth(2).scrollIntoViewIfNeeded();
  const g2=await a.locator('#playerRows .row').nth(3).locator('.grip').boundingBox(),t2=await a.locator('#playerRows .row').nth(2).boundingBox();
  await page.mouse.move(g2.x+g2.width/2,g2.y+g2.height/2);await page.mouse.down();
  await page.mouse.move(g2.x+g2.width/2,(g2.y+t2.y)/2,{steps:6});await page.mouse.move(g2.x+g2.width/2,t2.y+4,{steps:6});await page.mouse.up();   // 센터백 둘을 한 칸 위로 끌기
  const names=await a.evaluate(()=>[...document.querySelectorAll('#playerRows .row')].map(r=>r.querySelectorAll('input')[1].value));
  assert.deepEqual(names.slice(0,4),['골키퍼','중앙 공격','센터백 둘','센터백 하나'],'키보드 · 끌기로 바꾼 순서');
  await a.click('button[type=submit]');
  await a.waitForFunction(()=>document.getElementById('status').textContent.startsWith('기기에 저장했습니다.'));
  const saved=await a.evaluate(async()=>{const k='cs_analysis_team_library_v1';return {local:JSON.parse(localStorage.getItem(k))[0].players.map(p=>p.name),durable:JSON.parse((await storage.get(k)).value)[0].players.map(p=>p.name)};});
  assert.deepEqual(saved.local.slice(0,4),['골키퍼','중앙 공격','센터백 둘','센터백 하나']);
  assert.deepEqual(saved.durable,saved.local,'기기 저장소에도 같은 순서');
  assert.equal(saved.local.length,13,'선수는 그대로 13명');

  // 선수 사진 — 골키퍼 줄의 «사진»으로 올리고 저장 → PSImg · 기기 표에만, 저장 팀 문서(거울 · IndexedDB)에는 없다
  const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),a.click('#playerRows .row:nth-child(1) .ph')]);
  await chooser.setFiles({name:'gk.png',mimeType:'image/png',buffer:Buffer.from(PNG,'base64')});
  /* 3.125 — 고르면 사진 영역 편집 창(확대 · 좌우 · 위아래)이 뜬다 — 그대로 «적용» */
  await a.waitForSelector('#psCropDlg[open]',{timeout:15000});await a.click('#psCropDlg [data-ok]');
  /* 사진이 안 나타나면 왜인지(안내 줄 · 고른 칸 · 모듈) 메시지에 싣는다 — 파일을 올리는 브라우저 시험은 이것 하나라 웹킷에서 처음 돈다 */
  await a.waitForFunction(()=>document.querySelector('#playerRows .row:nth-child(1) .ph img'),null,{timeout:15000}).catch(async e=>{
    const d=await a.evaluate(()=>({status:document.getElementById('status').textContent,err:document.getElementById('status').getAttribute('data-err'),files:(document.getElementById('photoFile').files||[]).length,mod:!!window.PSTeamPhotos,ph:document.querySelector('#playerRows .row:nth-child(1) .ph').outerHTML.slice(0,160)})).catch(x=>({diagErr:String(x)}));
    throw new Error('선수 사진이 줄에 나타나지 않았다 '+JSON.stringify(d)+' · '+e.message);});
  assert.match(await a.getAttribute('#playerRows .row:nth-child(1) .ph','aria-label'),/사진 바꾸기/);
  assert.ok(await a.evaluate(()=>document.querySelector('.photo-hint').textContent.includes('이 기기에만')),'기기마다 따로라는 안내');
  await a.click('button[type=submit]');
  await a.waitForFunction(()=>/^기기에 저장했습니다\..*이 기기에만/.test(document.getElementById('status').textContent));
  const ph=await a.evaluate(async()=>{const lib='cs_analysis_team_library_v1',map=JSON.parse((await storage.get('cs_team_photos_v1')).value),ref=map.teams['lib-pos']&&map.teams['lib-pos'].tp1;
    const img=ref?(await storage.get(ref.slice(6))):null,local=localStorage.getItem(lib),durable=(await storage.get(lib)).value;
    return {ref,img:img&&img.value.slice(0,23),leak:[local,durable].some(v=>/psimg|data:image\/jpeg|"photo/.test(v)),others:Object.keys(map.teams['lib-pos']||{})};});
  assert.match(ph.ref||'',/^psimg:psimg_/,'선수 id(tp1) 로 기기 표에');
  assert.equal(ph.img,'data:image/jpeg;base64,','사진은 PSImg 에 작은 JPEG');
  assert.equal(ph.leak,false,'동기화되는 저장 팀 문서에는 사진 · 참조가 없다');
  assert.deepEqual(ph.others,['tp1']);
  // 작전판에서 다시 불러오면 골키퍼 토큰에 사진
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  await f.evaluate(()=>openAnalysisTeamLibrary());await f.waitForSelector('#alLoad');
  await f.evaluate(()=>document.getElementById('alLoad').click());
  await f.waitForFunction(()=>!document.getElementById('alLoad'));
  const tok=await f.evaluate(id=>{const t=state.players.find(p=>p.id===id);return {name:t.name,img:(t.img||'').slice(0,23),team:!!t.imgTeam,others:state.players.filter(p=>p.team==='blue'&&p.img).length,drawn:!!document.querySelector('image[href^="data:image/jpeg"]')};},before[0].id);
  assert.deepEqual(tok,{name:'골키퍼',img:'data:image/jpeg;base64,',team:true,others:1,drawn:true},'골키퍼 토큰에 이 기기의 사진');
  // 사진 지우기 → 기기 표 · PSImg 에서 모두 빠진다
  await f.evaluate(()=>openAnalysisTeamLibrary());await f.waitForSelector('#alManage');await f.click('#alManage');
  await a.waitForSelector('#teamList button.team');await a.click('#teamList button.team');
  await a.waitForSelector('#playerRows .row:nth-child(1) .ph img');
  await a.click('#playerRows .row:nth-child(1) .ph');
  await a.waitForSelector('#photoDlg[open]');
  await a.click('#photoRemove');
  await a.click('button[type=submit]');
  await a.waitForFunction(()=>document.getElementById('status').textContent.startsWith('기기에 저장했습니다.'));
  const gone=await a.evaluate(async r=>{const map=JSON.parse((await storage.get('cs_team_photos_v1')).value);return {team:map.teams['lib-pos']||null,img:await storage.get(r.slice(6)),row:!!document.querySelector('#playerRows .row:nth-child(1) .ph img')};},ph.ref);
  assert.deepEqual(gone,{team:null,img:null,row:false},'지우면 기기 표 · PSImg 에서 모두 빠진다');
  const errs2=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs2,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,kept:before.length,bench:bench.length,red:red.length,order:saved.local.slice(0,4),photo:tok.img}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
