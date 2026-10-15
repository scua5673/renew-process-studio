import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.038 — 커뮤니티에 작전판을 작전판으로 올린다(사용자 «엘미하 페이지 작전판으로 업로드 할 수 있게» · 박수빈 코치 «지금은 '훈련'으로만 업로드가 가능한 것 같아서요!
// 작전판을 업로드해도 빈 작전판으로 열리더라구요»). 예전에는 pages 를 버려 첫 페이지 판만 올라갔고, 최상위 장면은 저장할 때 보던 페이지(여기서는 3)의 것이라
// 판(페이지 1)과 장면(페이지 3)이 어긋났다. 이제: 올리기 목록이 종류를 말하고 · 엘미하 칸에서는 작전판부터 · 페이지 전부(이름 · 사진 정리)가 올라가고 ·
// 뷰어는 페이지를 골라 보며 · «내 보관함에 담기»는 페이지 전부를 담는다. 합성 팀 fixture 에서만 돈다(서버 답은 아래 route 가 흉내 낸다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const ELM='33a9d4e2-1868-40f4-8f82-3ebb4ecf011e';
const P=(id,num,x,y,team='blue',name='')=>({id,team,num:String(num),pos:'',name,x,y});
const snap=players=>({pitchSpec:'fifa',players,equipment:[],drawings:[],ball:{x:525,y:340,scale:.62},lines:true,gridType:'off',tokenScale:.6,label:'num',tokShape:'circle',
  orientation:'h',area:'full',pitchView:'full',pitchN:1,tokV:2,customImages:[{src:'data:image/png;base64,QUFB'}]});
const frame=(players,cap)=>({snap:snap(players),hold:.6,dur:1.2,cap,thumb:'<svg><text>김가상</text></svg>'});
// 페이지 1: 7번 · 3번(장면 셋) · 페이지 2: 9번 하나(장면 없음) · 페이지 3: 10번 · 4번(장면 셋) — 앱이 «페이지 3을 보던 채 저장»한 모양 그대로
const pg1=[0,1,2].map(s=>frame([P(901,7,300+s*120,370,'blue','김가상'),P(902,3,420,300,'red')],s?'페이지 1 움직임 '+s:''));
const pg3=[0,1,2].map(s=>frame([P(911,10,900,200+s*40),P(912,4,800,500-s*60,'red'),P(913,'',200,200,'img')],s?'페이지 3 움직임 '+s:''));
const BOARD={libId:'Vboard3038',type:'board',name:'가상 전술노트 — 세 장',folder:'',tags:['가상'],savedAt:Date.now(),overview:'가상 설명 — 페이지마다 움직임',
  thumb:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"><rect width="80" height="60" fill="#1e8c4c"/></svg>',
  snap:pg1[0].snap,frames:pg3,   /* 대표 판은 첫 페이지, 최상위 장면은 저장할 때 보던 페이지 3 의 것 */
  pages:[{name:'공격 형태',snap:pg1[2].snap,thumb:'<svg><text>김가상</text></svg>',anim:{frames:pg1,active:2,hold:.6},vlink:{libId:'Vother'}},
    {name:'',snap:snap([P(905,9,500,300)]),thumb:''},
    {name:'수비 블록',snap:pg3[2].snap,thumb:'',anim:{frames:pg3,active:2,hold:.6}}]};
const TRAIN={libId:'Vtrain3038',type:'train',name:'가상 론도',focus:'tech',minutes:15,folder:'',tags:[],savedAt:Date.now()-1000,snap:snap([P(1,8,300,300)])};
const fx=await startFixture(),browsers={};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  const shot=n=>page.screenshot({path:path.join(SHOTS,`community-board-${engine}-${size}-${n}.png`)});
  const cors={'access-control-allow-origin':'*'};let posted=null;const writes=[];
  await context.route('**/rest/v1/ps_handles**',r=>r.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify([{handle:'가상엘미하'}])}));
  await context.route('**/rest/v1/rpc/ps_comm_**',r=>r.fulfill({status:200,contentType:'application/json',headers:cors,body:'null'}));
  await context.route('**/rest/v1/ps_community**',route=>{const r=route.request(),u=new URL(r.url());
    if(r.method()==='POST'){posted=JSON.parse(r.postData());return route.fulfill({status:201,headers:cors,body:''});}
    if(r.method()!=='GET')return route.fallback();
    const json=b=>route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(b)});
    if(!posted)return json([]);
    if(u.searchParams.get('select')==='item')return json([{item:posted.item}]);
    const {item,...meta}=posted;return json([{...meta,owner:ELM,views:0,copies:0,likes:0,created_at:'2026-10-15T12:00:00Z'}]);});   /* 올린 글 = 엘미하 글(이 칸에 모인다) */
  page.on('request',r=>{const u=r.url();if(/ps_community|ps_comm_/.test(u)&&r.method()!=='GET')writes.push(r.method()+' '+u.replace(/^.*\/rest\/v1\//,'').replace(/\?.*$/,''));});
  await page.waitForTimeout(1500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>{ try{ return psVaultUnlocked()&&!!psMyUid(); }catch(_){ return false; } },null,{timeout:20000});
  await bf.evaluate(async items=>{ const lib=await libGet(); items.forEach(d=>{ stampCreator(d); lib.unshift(d); }); await libWrite(lib); libTouch(); },[TRAIN,BOARD]);

  await page.evaluate(()=>window.__psShowApp('community'));
  const c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#prSeg');
  await c.click('#prTabElm');
  await c.waitForFunction(()=>/아직 올라온 전술노트가 없어요/.test(document.getElementById('grid').textContent));

  // 1) 엘미하 칸에서 연 올리기 — 종류 고르기는 «작전판»부터, 줄마다 종류 · 페이지 수. 보관함 미리보기 «커뮤니티에 올리기»처럼 항목을 고른 채 연다
  await c.evaluate(()=>window.postMessage({type:'openUpload',libId:'Vboard3038'},'*'));
  await c.waitForSelector('#upGo');
  const sheet=()=>c.evaluate(()=>({kind:[...document.querySelectorAll('#upKind button')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':'')),
    rows:[...document.querySelectorAll('#upPick .pk')].map(r=>[r.querySelector('.pn').textContent,r.querySelector('.pk-k').textContent,(r.querySelector('.pm')||{}).textContent||'',r.classList.contains('on')]),
    title:document.getElementById('upTitle').value,hint:document.querySelector('#modal .hint').textContent,vw:innerWidth,docW:document.documentElement.scrollWidth}));
  let s=await sheet();
  assert.deepEqual(s.kind,['전체 2','작전판 1*','훈련 1'],'엘미하 칸에서는 작전판부터');
  assert.deepEqual(s.rows,[['가상 전술노트 — 세 장','작전판','페이지 3',true]],'고른 채 들어온 작전판 — 훈련처럼 «기술·개인»이라고 적지 않는다');
  assert.equal(s.title,'가상 전술노트 — 세 장');
  assert.match(s.hint,/작전판이나 훈련을 골라/);
  assert.equal(s.docW,s.vw,'가로로 넘치지 않는다');
  await shot('1-sheet');
  await c.click('#upKind button[data-kind="train"]');
  s=await sheet();
  assert.deepEqual(s.rows,[['가상 론도','훈련','기술·개인 · 15\'',false]]);
  await c.click('#upKind button[data-kind="all"]');
  s=await sheet();
  assert.deepEqual(s.rows.map(r=>r[0]+':'+r[3]),['가상 전술노트 — 세 장:true','가상 론도:false'],'종류를 바꿔도 고른 것은 그대로');
  await c.evaluate(()=>document.querySelector('#upCats button').click());
  await c.click('#upGo');
  for(let i=0;i<80&&!posted;i++)await page.waitForTimeout(100);
  assert.ok(posted,'올렸다');

  // 2) 올라간 글 — 페이지 셋 전부 · 대표 판과 장면은 첫 페이지의 것 · 이름 · 사진 · 페이지 그림 · 보관함 연결은 빠진다
  const it=posted.item,json=JSON.stringify(posted);
  assert.equal(it.type,'board');
  assert.deepEqual(it.pages.map(p=>[p.name,p.snap.players.map(q=>q.num).join(','),((p.anim||{}).frames||[]).length,p.thumb,'vlink' in p]),
    [['공격 형태','7,3',3,'',false],['','9',0,'',false],['수비 블록','10,4,',3,'',false]]);
  assert.deepEqual([it.snap.players.map(q=>q.num).join(','),it.frames.length,it.frames.map(f=>f.snap.players[0].x)],['7,3',3,[300,420,540]],'대표 장면은 페이지 1 의 것(전에는 페이지 3)');
  for(const bad of ['김가상','data:image','QUFB'])assert.equal(json.includes(bad),false,'올라간 글에 «'+bad+'» 가 없다');
  assert.equal(it.pages[2].snap.players[2].team,'blue','사진 토큰은 보통 토큰으로');
  assert.equal(it.overview,'가상 설명 — 페이지마다 움직임');

  // 3) 엘미하 칸의 카드 → 뷰어: «커뮤니티 작전판», 페이지 고르기 줄, 페이지마다 그 판과 그 장면
  await c.waitForFunction(()=>document.querySelectorAll('#grid .card').length===1,null,{timeout:15000});
  if(await c.evaluate(()=>getComputedStyle(document.getElementById('commPreview')).display!=='none')){
    await c.click('#grid .card');
    await c.waitForFunction(()=>/작전판페이지 3개/.test((document.querySelector('#commPreview .cp-summary')||{}).textContent||''));
    await c.click('#cpOpen');
  }else await c.click('#grid .card');
  await c.waitForSelector('#cvMask.on');
  const viewer=async()=>{ const v=await (await c.waitForSelector('#cvFrame')).contentFrame();
    await v.waitForFunction(()=>!!document.getElementById('commCopyBtn')&&!document.documentElement.classList.contains('comm-boot'));
    return v; };
  const look=async v=>({tabs:await c.evaluate(()=>{const b=document.getElementById('prCvTabs');return {hidden:b.hidden,label:b.getAttribute('aria-label'),btn:[...b.querySelectorAll('button')].map(x=>x.textContent+(x.getAttribute('aria-pressed')==='true'?'*':''))};}),
    ...(await v.evaluate(()=>({title:document.getElementById('modalTitle').textContent,banner:document.getElementById('epRoBanner').textContent,nums:state.players.map(p=>p.num).join(','),
      frames:(anim.frames||[]).length,play:!!document.getElementById('commPlayControls'),doc:[...document.querySelectorAll('.ep-ro-label')].map(x=>x.textContent)})))});
  let v=await viewer(),L=await look(v);
  assert.deepEqual(L.tabs,{hidden:false,label:'이 작전판의 페이지',btn:['1공격 형태장면 3*','2페이지 2','3수비 블록장면 3']});
  assert.deepEqual([L.title,L.banner,L.nums,L.frames,L.play],['커뮤니티 작전판','커뮤니티 작전판 — @가상엘미하님이 공유했어요 · 페이지 3개 · 보기 전용내 보관함에 담기신고',L.nums,3,true]);
  assert.ok(/^7,3/.test(L.nums),'페이지 1 의 판 '+L.nums);
  assert.deepEqual(L.doc,['설명'],'작전판의 설명은 «훈련 방법»이 아니라 «설명»');
  await page.waitForTimeout(500);await shot('2-viewer-page1');
  await c.click('#prCvTabs button:nth-child(3)');
  await page.waitForTimeout(300);
  v=await viewer();L=await look(v);
  assert.deepEqual([L.tabs.btn[2],L.frames,L.play],['3수비 블록장면 3*',3,true]);
  assert.ok(/^10,4/.test(L.nums),'페이지 3 의 판과 장면 '+L.nums);
  await page.waitForTimeout(500);await shot('3-viewer-page3');
  await c.click('#prCvTabs button:nth-child(2)');
  await page.waitForTimeout(300);
  v=await viewer();L=await look(v);
  assert.deepEqual([L.nums,L.frames>1,L.play],['9',false,false],'장면이 없는 페이지는 판 하나');

  // 4) «내 보관함에 담기» — 어느 페이지를 보고 있든 페이지 전부를 작전판으로 담는다
  await v.click('#commCopyBtn');
  let saved=null;
  for(let i=0;i<60&&!saved;i++){
    saved=await c.evaluate(async()=>{ const r=await window.storage.get('cs_drill_lib_v1'); const lib=r?JSON.parse(r.value):[];
      const d=(Array.isArray(lib)?lib:[]).find(d=>d&&d.srcComm&&d.srcComm.id&&d.srcComm.id.startsWith('C'));
      return d?{type:d.type,name:d.name,pages:(d.pages||[]).map(p=>p.name),snap:d.snap.players.map(q=>q.num).join(','),frames:(d.frames||[]).length}:null; });
    if(!saved)await page.waitForTimeout(100);
  }
  assert.deepEqual(saved,{type:'board',name:'가상 전술노트 — 세 장',pages:['공격 형태','','수비 블록'],snap:'7,3',frames:3},'담은 작전판도 페이지 셋');
  await c.click('#cvClose');
  await c.waitForFunction(()=>!document.getElementById('cvMask').classList.contains('on'));
  assert.deepEqual(writes,['POST ps_community','POST rpc/ps_comm_view','POST rpc/ps_comm_copied'],'올리기 한 번 · 조회 한 번 · 담김 한 번');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,pages:it.pages.length,bytes:JSON.stringify(posted).length}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
