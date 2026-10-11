import assert from 'node:assert/strict';
import {startFixture,openApp,A} from '../fixtures/team-app.mjs';
// 2.997 — 프로세스 레터의 훈련 세션을 보관함에 담는다(사용자 «훈련들을 보관함에 담으면 3가지 훈련이 보관함에 담아지게»).
// 레터의 «보관함에 담기»는 «app.html#pack=review-03» 같은 주소로 온다. 셸이 보관함으로 데려가고, 작전판이 팩을 받아 확인 창을 띄운 뒤
// 카드 한 장(훈련 셋 · 훈련마다 장면)으로 넣는다. 밖에서 온 그림·사진·주소·남의 도장은 카드에 들어오지 않는다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const snap=k=>({pitchSpec:k===0?'grid30':'fifa',players:[{id:101,team:'blue',num:'6',pos:'',x:400+k*10,y:300,img:'https://outside.invalid/p.png'},{id:102,team:'red',num:'4',pos:'',x:520,y:330}],
  equipment:[{id:900,team:'cone',x:300,y:300,src:'javascript:void(0)',scale:1,rot:0,color:null}],drawings:[{type:'text',text:'A',pts:[{x:320,y:260}],color:'#ffffff',lw:1,op:1,size:16}],
  ball:{x:410,y:310,scale:.62},lines:k!==0,gridType:'off',tokenScale:.6,label:'num',tokShape:'circle',orientation:'h',area:'full',pitchView:'full',pitchN:1,tokV:2,pitchImg:'https://outside.invalid/pitch.jpg'});
const tr=(i,n)=>({type:'train',name:'가상 연습 '+(i+1),minutes:[15,20,25][i],sets:1,rpe:5,focus:['bpo','bpo','없는분류'][i],method:'가상 방법 '+(i+1)+'\n1. 첫 걸음',coaching:'1. 가상 포인트 '+(i+1),createdBy:'someone-else',
  thumb:'<svg xmlns="http://www.w3.org/2000/svg" onload="window.__lpHit=1"><text>밖에서 온 그림</text></svg>',snap:snap(i),animIdx:0,
  frames:Array.from({length:n},(_,s)=>({snap:{...snap(i),players:snap(i).players.map(p=>({...p,x:p.x+s*30}))},hold:.6,dur:1.2,hl:[101],cap:s?('가상 움직임 '+s):''}))});
const pack=issue=>({type:'process-studio-drillpack',version:1,drills:[{name:'레터 '+issue+'호 · 가상 세션',type:'train',focus:'bpo',libId:'Lold',createdBy:'someone-else',folder:'팀 공유',fav:true,tpl:1,matchRef:{mid:'m1'},
  thumb:'<svg onload="window.__lpHit=1"></svg>',snap:snap(0),trainings:[tr(0,3),tr(1,2),tr(2,4)],letter:{issue,title:'가상 호 제목',session:'가상 세션 제목',theme:'가상 주제',url:'https://process-letter.netlify.app/0'+issue+'/'}}]});
const fx=await startFixture(),browsers={};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  const asked=[];
  // 레터 검토본 사이트 흉내 — 03·04 는 있고 09 는 없다. 나중에 건 route 가 fixture 의 «바깥 주소 막기»보다 먼저 받는다.
  await context.route('https://process-letter-sessions.netlify.app/**',route=>{const u=new URL(route.request().url());asked.push(u.pathname);const m=/^\/packs\/(0[34])\.json$/.exec(u.pathname);
    if(!m)return route.fulfill({status:404,headers:{'access-control-allow-origin':'*'},body:'not found'});
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(pack(+m[1]))});});
  await page.waitForTimeout(2500);
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof window.__letterPackOpen==='function'&&typeof renderDrillFiles==='function');
  const lib=()=>f.evaluate(async()=>((await store.get('cs_drill_lib_v1'))||[]).filter(d=>d&&d.letter));
  const go=id=>page.evaluate(h=>{location.hash=h;},'#pack='+id);
  const hint=()=>f.evaluate(()=>(document.getElementById('hint')||{}).textContent||'');
  const shell=()=>page.evaluate(()=>({app:document.body.getAttribute('data-ps-app'),hash:location.hash,pending:sessionStorage.getItem('ps_pack_pending_v1'),note:!!document.getElementById('psPackNote')}));

  // 1) 주소 → 보관함 → 확인 창. 확인하기 전에는 아무것도 담기지 않는다
  await go('review-03');
  await f.waitForSelector('#lpOk');
  await page.waitForFunction(()=>!sessionStorage.getItem('ps_pack_pending_v1'));
  assert.deepEqual(await shell(),{app:'design',hash:'',pending:null,note:false},'보관함으로 왔고 주소·메모는 비워졌다');
  const sheet=await f.evaluate(()=>{const c=document.querySelector('#lpOv>div'),r=c.getBoundingClientRect();return {title:document.getElementById('lpTitle').textContent,rows:[...document.querySelectorAll('#lpList li')].map(li=>li.textContent),
    text:c.textContent,ok:document.getElementById('lpOk').textContent,left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),vw:innerWidth,vh:innerHeight,
    btn:[...c.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().height))};});
  assert.equal(sheet.title,'가상 세션 제목');
  assert.deepEqual(sheet.rows,['1가상 연습 115분 · 장면 3','2가상 연습 220분 · 장면 2','3가상 연습 325분 · 장면 4'],'훈련 셋이 이름·분·장면 수로 보인다');
  assert.match(sheet.text,/PROCESS LETTER · 3호 · 훈련 세션/);
  assert.match(sheet.text,/훈련 3개 · 60분/);
  assert.match(sheet.text,/훈련 3개가 카드 한 장으로 보관함에 들어갑니다/);
  assert.equal(sheet.ok,'보관함에 담기');
  assert.ok(sheet.left>=8&&sheet.right<=sheet.vw-8&&sheet.top>=0&&sheet.bottom<=sheet.vh,'확인 창이 화면 안 '+JSON.stringify(sheet));
  assert.ok(sheet.btn.every(h=>h>=44),'단추는 손가락 크기 '+JSON.stringify(sheet.btn));
  assert.equal((await lib()).length,0,'확인 전에는 담기지 않는다');

  // 2) 담기 — 카드 한 장 · 훈련 셋 · 훈련마다 제 장면
  await f.click('#lpOk');
  await f.waitForFunction(async()=>((await store.get('cs_drill_lib_v1'))||[]).some(d=>d&&d.letter&&d.letter.issue===3));
  await f.waitForFunction(()=>!document.getElementById('lpOv'));
  const c=(await lib())[0];
  assert.deepEqual([c.name,c.type,c.minutes,c.trainings.length],['레터 3호 · 가상 세션','train',60,3]);
  assert.deepEqual(c.trainings.map(t=>[t.name,t.minutes,(t.frames||[]).length]),[['가상 연습 1',15,3],['가상 연습 2',20,2],['가상 연습 3',25,4]]);
  assert.deepEqual(c.trainings.map(t=>[t.method,t.coaching]),[['가상 방법 1\n1. 첫 걸음','1. 가상 포인트 1'],['가상 방법 2\n1. 첫 걸음','1. 가상 포인트 2'],['가상 방법 3\n1. 첫 걸음','1. 가상 포인트 3']],'훈련 방법·코칭 포인트가 훈련마다');
  assert.equal(c.trainings[0].frames[2].cap,'가상 움직임 2','장면 자막');
  assert.equal(c.frames.length,3,'카드 대표 장면 = 첫 훈련');
  assert.deepEqual([c.focus,...c.trainings.map(t=>t.focus)],['bpo','bpo','bpo','bp'],'세션의 주제 분류 그대로 — 모르는 값만 기본값');
  assert.deepEqual([c.createdBy,c.libId!=='Lold',c.folder||'',!!c.fav,!!c.tpl,!!c.matchRef],[A,true,'',false,false,false],'내가 담은 새 카드 — 남의 도장·폴더·표식은 따라오지 않는다');
  assert.ok(c.trainings.every(t=>/^<svg/.test(t.thumb)&&t.thumb.length>500),'그림은 이 판에서 다시 그린다');
  const json=JSON.stringify(c);
  for(const bad of ['onload','밖에서 온 그림','outside.invalid','javascript:','someone-else'])assert.equal(json.includes(bad),false,'카드에 «'+bad+'» 가 없다');
  assert.equal(await f.evaluate(()=>window.__lpHit),undefined,'밖에서 온 그림은 한 번도 그려지지 않았다');
  assert.deepEqual(c.letter,{issue:3,session:'가상 세션 제목',title:'가상 호 제목',theme:'가상 주제',url:'https://process-letter.netlify.app/03/'});
  assert.match(await hint(),/훈련 3개를 보관함에 담았어요/);
  // 담은 카드가 고른 채 보인다
  await f.waitForFunction(()=>{const el=document.querySelector('#drillFiles .vcard.selected');return !!el&&/레터 3호 · 가상 세션/.test(el.textContent);});
  assert.equal(await f.evaluate(()=>window.__csView),'session');
  // 서버(보관함 표)에도 올라간다
  await page.waitForFunction(()=>window.PSSync&&!PSSync.pending().count,null,{timeout:30000}).catch(()=>{});
  assert.ok([...fx.lib.values()].some(r=>r.lib_id===c.libId),'보관함 서버 표에 그 카드가 있다');

  // 3) 열어 보면 훈련 탭 셋, 탭마다 제 장면
  await f.evaluate(id=>openLibDrawEditor(id,false),c.libId);
  await f.waitForFunction(()=>document.getElementById('editorModal').classList.contains('on')&&document.querySelectorAll('#trainingStrip .tr-tab').length===3);
  const tabs=[];
  for(const i of [0,1,2]){ if(i)await f.evaluate(k=>switchTraining(k),i); await page.waitForTimeout(700);
    tabs.push(await f.evaluate(()=>({spec:state.pitchSpec,players:state.players.length,scenes:document.querySelectorAll('#animFrames .anim-frame').length,fields:[...document.querySelectorAll('#epFields textarea')].map(t=>t.value)}))); }
  assert.deepEqual(tabs.map(t=>[t.spec,t.players,t.scenes]),[['grid30',2,3],['fifa',2,2],['fifa',2,4]],'훈련마다 제 판·제 장면 '+JSON.stringify(tabs.map(t=>[t.spec,t.scenes])));
  assert.deepEqual(tabs[2].fields,['가상 방법 3\n1. 첫 걸음','1. 가상 포인트 3'],'훈련 방법 · 코칭 포인트 칸');
  await f.evaluate(()=>{window.__closingEditor=1;try{closeEditor(false);}finally{window.__closingEditor=0;}});
  await f.waitForFunction(()=>!document.getElementById('editorModal').classList.contains('on'));
  assert.equal((await lib()).length,1);

  // 4) 같은 세션을 다시 — 담겨 있다고 말하고, «보관함에서 보기»는 담지 않는다. «한 장 더 담기»는 고를 때만
  await go('review-03');
  await f.waitForSelector('#lpShow');
  assert.match(await f.evaluate(()=>document.getElementById('lpNote').textContent),/‘레터 3호 · 가상 세션’ 카드로 담겨 있어요/);
  assert.equal(await f.evaluate(()=>!!document.getElementById('lpOk')),false);
  await f.click('#lpShow');
  await f.waitForFunction(()=>!document.getElementById('lpOv'));
  assert.equal((await lib()).length,1,'보기는 담지 않는다');
  await go('review-03');
  await f.waitForSelector('#lpAgain');
  await f.click('#lpAgain');
  await f.waitForFunction(async()=>((await store.get('cs_drill_lib_v1'))||[]).filter(d=>d&&d.letter).length===2);
  const two=await lib();
  assert.notEqual(two[0].libId,two[1].libId,'한 장 더 = 새 카드');

  // 5) 취소 · 없는 호 · 목록 밖 주소
  await f.waitForFunction(()=>!document.getElementById('lpOv'));
  await go('review-04');
  await f.waitForSelector('#lpOk');
  await f.click('#lpCancel');
  await f.waitForFunction(()=>!document.getElementById('lpOv'));
  assert.equal((await lib()).length,2,'취소는 담지 않는다');
  await go('review-09');
  await f.waitForFunction(()=>/훈련 세션을 받지 못했어요/.test((document.getElementById('hint')||{}).textContent||''));
  assert.equal(await f.evaluate(()=>!!document.getElementById('lpOv')),false,'없는 호는 알리고 끝');
  const n=asked.length;
  for(const bad of ['evil-03','review-3','review-03x','https://outside.invalid/a.json'])await go(bad);
  await page.waitForTimeout(1200);
  assert.deepEqual([asked.length,(await shell()).pending,await f.evaluate(()=>!!document.getElementById('lpOv'))],[n,null,false],'목록 밖 주소는 아무 일도 하지 않는다');
  assert.equal((await lib()).length,2);
  assert.deepEqual([...new Set(asked)].sort(),['/packs/03.json','/packs/04.json','/packs/09.json'],'읽어 온 것은 정해진 자리의 팩뿐');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,sheet:{w:sheet.right-sheet.left,vw:sheet.vw},tabs:tabs.map(t=>[t.spec,t.scenes]),cards:two.length}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
