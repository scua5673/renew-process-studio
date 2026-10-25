import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.018 — 커뮤니티 안의 «엘미하» 칸(사용자 «엘미하 페이지를 또 만들어 줘 · 보관함으로 가져오기도 · 엘미하가 애니메이션 만든 거 공유할 수 있게»).
// 엘미하 계정이 «＋ 올리기»로 올린 커뮤니티 글을 계정 번호로 모은다. 카드 → 읽기 전용 뷰어(애니메이션 재생) → «내 보관함에 담기»는 코치 글과 같은 길.
// 합성 팀 fixture 에서만 돈다(서버 답은 아래 route 가 흉내 낸다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const ELM='33a9d4e2-1868-40f4-8f82-3ebb4ecf011e',OTHER='22222222-2222-4222-8222-222222222222';
const snap=s=>({pitchSpec:'fifa',players:[{id:101,team:'blue',num:'6',pos:'',x:400+s*40,y:300},{id:102,team:'red',num:'4',pos:'',x:520,y:330+s*12}],equipment:[],drawings:[],
  ball:{x:410+s*30,y:310,scale:.62},lines:true,gridType:'off',tokenScale:.6,label:'num',tokShape:'circle',orientation:'h',area:'full',pitchView:'full',pitchN:1,tokV:2});
const THUMB='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"><rect width="80" height="60" fill="#15172b"/><circle cx="40" cy="30" r="6" fill="#3a6df0"/></svg>';
const POST={id:'Celm1',owner:ELM,owner_name:'엘미하',title:'가상 전술노트 — 하프스페이스 침투',summary:'',cat:'attack',age:'성인',players:'11',thumb:THUMB,views:4,copies:0,likes:2,created_at:'2026-10-12T00:00:00Z'};
const ITEM={name:'가상 전술노트',type:'train',focus:'bp',minutes:10,snap:snap(0),coaching:'1. 가상 포인트',frames:[0,1,2].map(s=>({snap:snap(s),hold:.6,dur:1.2,cap:s?('가상 움직임 '+s):''}))};
// 같은 이름을 적은 다른 계정의 글 — 서버가 owner 로 거르지만, 받는 쪽도 한 번 더 걸러야 한다
const SPOOF={...POST,id:'Cspoof',owner:OTHER,title:'가짜 엘미하 글'};
const COACH={id:'Ccoach1',owner:OTHER,owner_name:'가상코치',title:'가상 코치 글',summary:'',cat:'rondo',age:'U12',players:'8',thumb:THUMB,views:3,copies:1,likes:0,created_at:'2026-10-01T00:00:00Z'};
const fx=await startFixture(),browsers={};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  const asked=[],writes=[];let elmDown=true;
  await context.route('**/rest/v1/ps_community**',route=>{const r=route.request(),u=new URL(r.url());
    if(r.method()!=='GET')return route.fallback();
    const cors={'access-control-allow-origin':'*'},sel=u.searchParams.get('select')||'',owner=u.searchParams.get('owner');
    if(owner){ asked.push(owner); if(elmDown)return route.fulfill({status:503,headers:cors,body:'busy'}); }
    const body=sel==='item'?[{item:u.searchParams.get('id')==='eq.Celm1'?ITEM:{name:'가상 코치 글',type:'train',snap:snap(0)}}]:owner==='eq.'+ELM?[POST,SPOOF]:[COACH];
    return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(body)});});
  page.on('request',r=>{const u=r.url();if(/ps_community|ps_comm_/.test(u)&&r.method()!=='GET')writes.push(r.method()+' '+u.replace(/^.*\/rest\/v1\//,''));});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>window.__psShowApp('community'));
  let c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#prSeg');
  // 셸은 탭을 미리 띄운다 — 위 흉내보다 먼저 받아 적어 둔 것을 지우고 한 번 새로 연다
  await c.evaluate(()=>{ try{sessionStorage.removeItem('ps_comm_feed_cache_v1');sessionStorage.removeItem('ps_comm_elmiha_v1');}catch(_){} location.reload(); });
  await page.waitForTimeout(400);
  c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#prSeg');
  await c.click('#prTabCoach');   // 3.019 — 처음 여는 칸은 «프로세스»(community-process 가 본다). 이 시험은 코치 자료에서 시작한다
  await c.waitForSelector('#grid .card');
  const until=async(fn,what)=>{ for(let i=0;i<100;i++){ if(await fn())return; await page.waitForTimeout(100); } throw new Error('기다림 초과: '+what); };
  const state=()=>c.evaluate(()=>({elm:document.body.classList.contains('pr-elm'),pressed:[...document.querySelectorAll('#prSeg button')].map(b=>b.getAttribute('aria-pressed')),label:[...document.querySelectorAll('#prSeg button')].map(b=>b.textContent),
    sub:document.getElementById('prSub').textContent,ph:document.getElementById('commSearch').placeholder,count:document.getElementById('commCount').textContent,hero:!document.getElementById('elHero').hidden&&getComputedStyle(document.getElementById('elHero')).display!=='none',
    titles:[...document.querySelectorAll('#grid .card .tt')].map(x=>x.textContent),fab:getComputedStyle(document.getElementById('upBtn')).display,filters:getComputedStyle(document.querySelector('.comm-list .filters')).display,
    grid:document.getElementById('grid').textContent,vw:innerWidth,docW:document.documentElement.scrollWidth,
    pickers:[!document.getElementById('txBar').hidden],   // 3.075 — 공통 분류(주제 · 연령 · 오늘 인원)
    badge:(document.querySelector('#commFiltBtn .n')||{hidden:true}).hidden}));

  // 1) 코치 자료. 엘미하 칸은 화면이 보이면 미리 받는다 — 서버가 안 되면 조용하다(코치 자료 화면은 그대로)
  await until(()=>asked.length>=1,'엘미하 칸 미리 받기');
  let s=await state();
  assert.deepEqual([s.elm,s.pressed,s.label[0],s.label[2],s.hero,s.titles],[false,['true','false','false','false'],'코치 자료1','엘미하',false,['가상 코치 글']]);   // 프로세스 칸의 개수는 앱에 실린 사본 몫
  assert.deepEqual(s.pickers,[true],'코치 자료에는 훈련 주제 · 연령 · 인원 고르개');
  // 3.042 — 코치 자료에서 연령을 골라 둬도 엘미하 칸은 거르지 않는다(엘미하 글은 «성인»)
  await c.evaluate(()=>{ [...document.querySelectorAll('#txBar .tx-chip')].find(b=>b.textContent==='U12').click(); });   // 3.075 — 공통 분류의 연령 칩
  await until(async()=>(await state()).titles.join()==='가상 코치 글','U12 고르기');

  // 2) 엘미하 칸 — 못 받으면 사실대로 말하고 다시 시도를 준다. 유튜브 채널 띠는 그래도 있다
  await c.click('#prTabElm');
  await c.waitForSelector('#elRetry');
  s=await state();
  assert.deepEqual([s.elm,s.pressed,s.sub,s.ph,s.hero,s.titles,s.count],[true,['false','false','true','false'],'엘미하가 만든 전술 애니메이션','제목·내용 검색',true,[],'']);
  assert.match(s.grid,/엘미하의 전술노트를 불러오지 못했어요/);
  const yt=await c.evaluate(()=>{const a=document.getElementById('elYt'),r=a.getBoundingClientRect();return {href:a.href,target:a.target,rel:a.rel,text:a.textContent,l:Math.round(r.left),r:Math.round(r.right),h:Math.round(r.height)};});
  assert.deepEqual([yt.href,yt.target,yt.rel,yt.text],['https://www.youtube.com/@ELMIHA_TacticalNote','_blank','noopener noreferrer','유튜브 채널']);
  assert.ok(yt.l>=0&&yt.r<=s.vw&&yt.h>=(size==='phone'?40:32),'채널 단추가 화면 안 '+JSON.stringify(yt));

  // 3) 다시 시도 → 엘미하 계정의 글만(같은 이름을 적은 다른 계정 글은 빠진다)
  elmDown=false;
  await c.click('#elRetry');
  await c.waitForSelector('#grid .card');
  s=await state();
  assert.deepEqual([s.titles,s.count,s.label[2]],[['가상 전술노트 — 하프스페이스 침투'],'전술노트 1개','엘미하1']);
  assert.equal(asked.every(o=>o==='eq.'+ELM),true,'계정 번호로 묻는다 '+JSON.stringify(asked));
  assert.equal(s.fab,'none','다른 코치에게는 이 칸에 «올리기»가 없다(올리면 코치 자료로 간다)');
  assert.notEqual(s.filters,'none','검색 · 정렬은 코치 자료와 같다');
  assert.equal(s.badge,true,'필터 단추는 엘미하 칸에서 골라 둔 연령을 세지 않는다');
  assert.deepEqual(s.pickers,[false],'3.042 — 엘미하 칸에는 훈련 주제 · 연령 · 인원 고르개가 없다(골라 둔 U12 도 거르지 않는다)');
  assert.equal(s.docW,s.vw,'가로로 넘치지 않는다');
  const foot=await c.evaluate(()=>document.querySelector('#grid .card .foot .who').textContent);
  assert.equal(foot,'@엘미하');

  // 4) 카드 → 읽기 전용 뷰어: 애니메이션 재생 · «내 보관함에 담기» · 신고
  if(await c.evaluate(()=>getComputedStyle(document.getElementById('commPreview')).display!=='none'))await c.click('#cpOpen');
  else await c.click('#grid .card'); await c.waitForTimeout(150); if(await c.$('.tx-sheet'))await c.click('.tx-sheet .tx-btn');
  await c.waitForSelector('#cvMask.on');
  const v=await (await c.waitForSelector('#cvFrame')).contentFrame();
  await v.waitForFunction(()=>!!document.getElementById('commCopyBtn')&&!document.documentElement.classList.contains('comm-boot')&&(document.getElementById('epName')||{}).value==='가상 전술노트');
  const iv=await v.evaluate(()=>({banner:document.getElementById('epRoBanner').textContent,play:!!document.getElementById('commPlayControls'),frames:(anim.frames||[]).length,ro:editorReadOnly,del:!!document.getElementById('commDelBtn')}));
  assert.deepEqual(iv,{banner:'커뮤니티 훈련 — @엘미하님이 공유했어요 · 보기 전용내 보관함에 담기신고',play:true,frames:3,ro:true,del:false},'엘미하의 애니메이션을 그대로 재생');
  await c.click('#cdCopy');
  let saved=[];
  for(let i=0;i<60&&!saved.length;i++){
    saved=await c.evaluate(async()=>{ const r=await window.storage.get('cs_drill_lib_v1'); const lib=r?JSON.parse(r.value):[];
      return (Array.isArray(lib)?lib:[]).filter(d=>d&&d.srcComm&&d.srcComm.id==='Celm1').map(d=>[d.name,d.srcComm.by,(d.frames||[]).length]); });
    if(!saved.length)await page.waitForTimeout(100);
  }
  assert.deepEqual(saved,[['가상 전술노트','엘미하',3]],'내 보관함에 담겼다 — 애니메이션 장면까지');
  await c.click('#cvClose');
  await c.waitForFunction(()=>!document.getElementById('cvMask').classList.contains('on'));
  assert.deepEqual(writes,['POST rpc/ps_comm_view','POST rpc/ps_comm_copied'],'열 때 조회 한 번 · 담을 때 담김 한 번 — 글은 쓰지 않는다');

  // 5) 코치 자료로 돌아가면 지금 화면 그대로
  await c.click('#prTabCoach');
  s=await state();
  assert.deepEqual([s.elm,s.pressed,s.hero,s.titles,s.pickers],[false,['true','false','false','false'],false,['가상 코치 글'],[true]]);
  assert.notEqual(s.fab,'none');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,vw:s.vw,yt:[yt.r-yt.l,yt.h]}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
