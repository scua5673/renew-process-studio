import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.999 — 커뮤니티 안의 «프로세스» 칸(사용자 «만든 훈련들 전부 커뮤니티에 따로 프로세스 페이지 만들어서 올려줘» → 목업 A안: 세션 한 장에 훈련 셋).
// 머리의 두 칸 «코치 자료 | 프로세스». 프로세스 칸은 훈련 세션 사이트의 목록을 읽어 그리고(서버에 글을 쓰지 않는다), 카드를 누르면 읽기 전용 뷰어,
// «보관함에 담기»는 레터와 같은 길(2.997)로 보관함의 확인 창까지 간다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop',phone=size==='phone';
const snap=(k,s)=>({pitchSpec:'fifa',players:[{id:101,team:'blue',num:'6',pos:'',x:400+k*10+(s||0)*30,y:300},{id:102,team:'red',num:'4',pos:'',x:520,y:330+(s||0)*10}],equipment:[],drawings:[],
  ball:{x:410,y:310,scale:.62},lines:true,gridType:'off',tokenScale:.6,label:'num',tokShape:'circle',orientation:'h',area:'full',pitchView:'full',pitchN:1,tokV:2});
const tr=(i,n)=>({type:'train',name:'가상 연습 '+(i+1),minutes:[15,20,25][i],sets:1,rpe:5,focus:'bp',method:'가상 방법 '+(i+1)+'\n1. 첫 걸음',coaching:'1. 가상 포인트 '+(i+1),snap:snap(i),animIdx:0,
  thumb:'<svg xmlns="http://www.w3.org/2000/svg" onload="window.__prHit=1"></svg>',frames:Array.from({length:n},(_,s)=>({snap:snap(i,s),hold:.6,dur:1.2,hl:[101],cap:s?('가상 움직임 '+s):''}))});
const pack=issue=>({type:'process-studio-drillpack',version:1,drills:[{name:'레터 '+issue+'호 · 가상 세션',type:'train',focus:'bp',minutes:60,sets:1,rpe:5,tags:['프로세스 레터'],snap:snap(0),trainings:[tr(0,3),tr(1,2),tr(2,4)],
  letter:{issue,title:'가상 호 제목',session:'가상 세션 '+issue,theme:issue===3?'공격 조직 › 인지':'수비 조직 › 압박',url:'https://process-letter.netlify.app/0'+issue+'/'}}]});
const row=issue=>({n:issue,rev:'0a1b2c3d4e',session:'가상 세션 '+issue,letter:'가상 호 제목',theme:issue===3?'공격 조직 › 인지':'수비 조직 › 압박',minutes:60,
  trainings:[{name:'가상 연습 1',minutes:15,scenes:3},{name:issue===4?'골문 앞 버티기':'가상 연습 2',minutes:20,scenes:2},{name:'가상 연습 3',minutes:25,scenes:4}]});
const INDEX={type:'process-studio-pack-index',version:1,sessions:[row(4),row(3),{n:5,session:'',trainings:[]},{n:'x'}]};
const THUMB='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"><rect width="80" height="60" fill="#15172b"/><circle cx="40" cy="30" r="6" fill="#3a6df0"/></svg>';
const fx=await startFixture(),browsers={};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  const asked=[],askedLocal=[],writes=[];let indexDown=true,localDown=true;
  // 3.002 — 코치 글 하나(훈련 둘: 첫 훈련은 장면 없음 · 둘째는 장면 셋). 훈련이 둘 이상인 코치 글도 뷰어에서 훈련을 골라 본다.
  const coachTr=(i,n,min)=>{const t=tr(i,n);t.name='코치 훈련 '+'AB'[i];t.method='코치 방법 '+'AB'[i];t.coaching='1. 코치 포인트 '+'AB'[i];if(min)t.minutes=min;else delete t.minutes;if(n<2)delete t.frames;return t;};
  const COACH={id:'Cmulti1',owner:'22222222-2222-4222-8222-222222222222',owner_name:'가상코치',title:'가상 코치 글',summary:'',cat:'rondo',age:'U12',players:'8',thumb:THUMB,views:3,copies:1,likes:0,created_at:'2026-10-01T00:00:00Z'};
  const COACH_ITEM={name:'가상 코치 글',type:'train',focus:'bp',minutes:30,snap:snap(0),trainings:[coachTr(0,1,10),coachTr(1,3,0)]};
  await context.route('**/rest/v1/ps_community**',route=>{const r=route.request(),u=new URL(r.url());
    if(r.method()!=='GET')return route.fallback();
    const body=(u.searchParams.get('select')||'')==='item'?[{item:COACH_ITEM}]:[COACH];
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});});
  // 훈련 세션 사이트 흉내 — 나중에 건 route 가 fixture 의 «바깥 주소 막기»보다 먼저 받는다. 목록은 처음에는 내려가 있다(다시 시도 확인).
  await context.route('https://process-letter-sessions.netlify.app/**',route=>{const u=new URL(route.request().url());asked.push(u.pathname+u.search);
    const cors={'access-control-allow-origin':'*'};
    if(u.pathname==='/packs/index.json'){ if(indexDown)return route.fulfill({status:503,headers:cors,body:'busy'});
      return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(INDEX)}); }
    const m=/^\/packs\/(0[34])\.json$/.exec(u.pathname);
    if(m)return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(pack(+m[1]))});
    if(/^\/packs\/thumbs\/0[34]-[123]\.svg$/.test(u.pathname))return route.fulfill({status:200,contentType:'image/svg+xml',headers:cors,body:THUMB});
    return route.fulfill({status:404,headers:cors,body:'not found'});});
  // 3.003 — 앱에 실린 사본(…/studio/packs/) 흉내: 세션 하나(6호). 훈련 세션 사이트가 내려가 있을 때 여기서 읽는다. 처음에는 이것도 내려가 있다.
  await context.route(u=>u.origin===new URL(page.url()).origin&&u.pathname.startsWith('/studio/packs/'),route=>{const u=new URL(route.request().url()),p=u.pathname.replace(/^\/studio/,'');askedLocal.push(p+u.search);
    if(localDown)return route.fulfill({status:404,body:'not found'});
    if(p==='/packs/index.json')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'process-studio-pack-index',version:1,sessions:[row(6)]})});
    if(p==='/packs/06.json')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pack(6))});
    if(/^\/packs\/thumbs\/06-[123]\.svg$/.test(p))return route.fulfill({status:200,contentType:'image/svg+xml',body:THUMB});
    return route.fulfill({status:404,body:'not found'});});
  // 커뮤니티 서버 표에 쓰는 요청(올리기·조회수·담김·신고·좋아요)을 센다
  page.on('request',r=>{const u=r.url();if(/ps_community|ps_comm_/.test(u)&&r.method()!=='GET')writes.push(r.method()+' '+u.replace(/^.*\/rest\/v1\//,''));});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>window.__psShowApp('community'));
  let c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#prSeg');
  // 셸은 탭을 미리 띄운다 — 커뮤니티가 위 흉내보다 먼저 떠서 빈 목록을 적어 뒀을 수 있다. 한 번 새로 연다.
  await c.evaluate(()=>{ try{sessionStorage.removeItem('ps_comm_feed_cache_v1');}catch(_){} location.reload(); });
  await page.waitForTimeout(400);
  c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#grid .card');
  const rect=sel=>c.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),d:getComputedStyle(e).display};},sel);
  const state=()=>c.evaluate(()=>({proc:document.body.classList.contains('pr-proc'),pressed:[...document.querySelectorAll('#prSeg button')].map(b=>b.getAttribute('aria-pressed')),label:[...document.querySelectorAll('#prSeg button')].map(b=>b.textContent),
    sub:document.getElementById('prSub').textContent,lb:document.getElementById('prCatLb').textContent,ph:document.getElementById('commSearch').placeholder,count:document.getElementById('commCount').textContent,
    chips:[...document.querySelectorAll('#catChips .chip')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')),cards:[...document.querySelectorAll('.pr-card')].map(x=>x.getAttribute('data-proc')),coach:document.querySelectorAll('#grid .card').length,
    fab:getComputedStyle(document.getElementById('upBtn')).display,filters:getComputedStyle(document.querySelector('.comm-list .filters')).display,vw:innerWidth,docW:document.documentElement.scrollWidth}));

  let v,pk,iv;
  const view=async name=>{ const v=await (await c.waitForSelector('#cvFrame')).contentFrame();
    await v.waitForFunction(n=>!!document.getElementById('commCopyBtn')&&!document.documentElement.classList.contains('comm-boot')&&(document.getElementById('epName')||{}).value===n,name);
    return v; };
  const pick=()=>c.evaluate(()=>{const b=document.getElementById('prCvTabs'),r=b.getBoundingClientRect();return {hidden:b.hidden,head:document.querySelector('.cv-head b').textContent,l:Math.round(r.left),r:Math.round(r.right),vw:innerWidth,
    btn:[...b.querySelectorAll('button')].map(x=>{const q=x.getBoundingClientRect();return [x.querySelector('.pr-i').textContent,x.querySelector('.pr-nm').textContent,(x.querySelector('.pr-mn')||{}).textContent,x.getAttribute('aria-pressed'),Math.round(q.height),Math.round(q.left)>=0&&Math.round(q.right)<=innerWidth];})};});
  const inside=()=>v.evaluate(()=>({banner:document.getElementById('epRoBanner').textContent,copy:document.getElementById('commCopyBtn').textContent,rep:!!document.getElementById('commRepBtn'),del:!!document.getElementById('commDelBtn'),
    doc:[...document.querySelectorAll('.ep-ro-text')].map(x=>x.textContent),play:!!document.getElementById('commPlayControls'),frames:(anim.frames||[]).length,players:state.players.length,hit:window.__prHit,ro:editorReadOnly,
    hold:animHold,durs:(anim.frames||[]).map(f=>f.dur)}));

  // 1) 처음은 코치 자료 — 지금 화면 그대로. 두 칸이 머리에 있다
  let s=await state();
  assert.deepEqual([s.proc,s.pressed,s.sub,s.lb,s.ph,s.coach],[false,['true','false','false'],'작전판·훈련·경기 분석 탐색','훈련 주제','제목·작성자·내용 검색',1]);   // 3.018 — 칸 셋(엘미하)
  assert.notEqual(s.fab,'none','코치 자료 칸에는 «올리기»가 있다');
  assert.ok(s.chips.includes('론도')&&s.chips[0]==='전체 주제*','코치 자료의 주제 칩 그대로');
  const seg=await rect('#prSeg'),tabs=await c.evaluate(()=>[...document.querySelectorAll('#prSeg button')].map(b=>Math.round(b.getBoundingClientRect().height)));
  assert.ok(seg.l>=0&&seg.l+seg.w<=s.vw,'칸들이 화면 안 '+JSON.stringify(seg));
  assert.ok(tabs.length===3&&tabs.every(h=>h>=(phone?36:30)),'칸 셋의 높이 '+JSON.stringify(tabs));
  assert.equal(s.docW,s.vw,'가로로 넘치지 않는다');

  // 1-2) 3.002 — 훈련이 둘인 코치 글: 뷰어 머리 아래에서 훈련을 골라 본다. 띠·담기·신고는 코치 글 그대로
  await c.click('#grid .card');
  await c.waitForSelector('#cvMask.on');
  v=await view('코치 훈련 A');
  pk=await pick();
  assert.deepEqual([pk.hidden,pk.head],[false,'가상 코치 글']);
  assert.deepEqual(pk.btn.map(b=>b.slice(0,4)),[['1','코치 훈련 A','10분','true'],['2','코치 훈련 B',undefined,'false']],'분이 없는 훈련은 분을 적지 않는다');
  assert.ok(pk.btn.every(b=>b[4]>=36&&b[5]),'훈련 칸이 화면 안 '+JSON.stringify(pk.btn));
  iv=await inside();
  assert.equal(iv.banner,'커뮤니티 훈련 — @가상코치님이 공유했어요 · 보기 전용내 보관함에 담기신고');
  assert.deepEqual([iv.copy,iv.rep,iv.del,iv.ro],['내 보관함에 담기',true,false,true]);
  assert.deepEqual([iv.doc,iv.play],[['코치 방법 A','1. 코치 포인트 A'],false],'첫 훈련 — 장면이 없으면 재생 단추도 없다');
  await c.click('#prCvTabs button:nth-child(2)');
  v=await view('코치 훈련 B');
  iv=await inside();
  assert.deepEqual([iv.doc,iv.play,iv.frames],[['코치 방법 B','1. 코치 포인트 B'],true,3],'둘째 훈련의 글과 장면');
  assert.deepEqual((await pick()).btn.map(b=>b[3]),['false','true']);
  await c.click('#cvClose');
  await c.waitForFunction(()=>!document.getElementById('cvMask').classList.contains('on')&&document.getElementById('prCvTabs').hidden);
  assert.deepEqual(writes,['POST rpc/ps_comm_view'],'코치 글은 열 때 조회수 한 번 — 훈련을 바꿔 봐도 더 세지 않는다');
  writes.length=0;

  // 2) 프로세스 칸 — 목록을 못 받으면 사실대로 말하고 다시 시도를 준다(코치 자료를 보는 동안의 실패는 조용하다)
  const indexAsked=()=>asked.filter(a=>a==='/packs/index.json').length;
  const until=async(fn,what)=>{ for(let i=0;i<100;i++){ if(fn())return; await page.waitForTimeout(100); } throw new Error('기다림 초과: '+what); };
  await until(()=>indexAsked()>=1,'처음 목록 요청');
  await page.waitForTimeout(300);
  assert.deepEqual([(await state()).label,await c.evaluate(()=>!!document.getElementById('prRetry'))],[['코치 자료1','프로세스','엘미하'],false]);   // 3.018 — 엘미하 칸: 엘미하 계정의 글이 없으면 숫자 없음
  const before=indexAsked();
  await c.click('#prTabProc');
  await c.waitForSelector('#prRetry');
  await until(()=>indexAsked()>before,'칸을 열 때의 목록 요청');
  s=await state();
  assert.deepEqual([s.proc,s.pressed,s.sub,s.lb,s.ph,s.cards.length],[true,['false','true','false'],'프로세스가 만든 훈련 세션','세션 주제','세션·훈련 이름 검색',0]);
  assert.match(await c.evaluate(()=>document.getElementById('grid').textContent),/프로세스 훈련을 불러오지 못했어요/);
  assert.deepEqual([s.fab,s.filters],['none','none'],'프로세스 칸은 보는 곳 — 올리기·코치 자료의 고르개는 치운다');
  assert.ok(askedLocal.includes('/packs/index.json'),'사이트가 안 되면 앱에 실린 사본을 본다 '+JSON.stringify(askedLocal));

  // 2-2) 3.003 — 훈련 세션 사이트는 내려가 있고 앱에 실린 사본은 있다: 사본으로 그리고, 열고, 담기까지 간다(사이트를 다시 부르지 않고)
  localDown=false;
  await c.click('#prRetry');
  await c.waitForSelector('.pr-card[data-proc="06"]');
  s=await state();
  assert.deepEqual([s.cards,s.label,s.count],[['06'],['코치 자료1','프로세스1','엘미하'],'세션 1개 · 훈련 3개']);
  assert.deepEqual(await c.evaluate(()=>[...document.querySelectorAll('.pr-card[data-proc="06"] .pr-tri img')].map(i=>i.getAttribute('src'))),[1,2,3].map(k=>'packs/thumbs/06-'+k+'.svg?v=0a1b2c3d4e'),'그림도 사본에서');
  await c.waitForFunction(()=>[...document.querySelectorAll('.pr-card[data-proc="06"] img')].every(i=>i.complete&&i.naturalWidth>0));
  const remoteBefore=asked.length;
  await c.click('.pr-card[data-proc="06"]');
  await c.waitForSelector('#cvMask.on');
  v=await view('가상 연습 1');
  iv=await inside();
  assert.deepEqual([iv.banner,iv.frames,iv.ro],['프로세스 훈련 세션 — 훈련 3개 · 보기 전용보관함에 담기',3,true]);
  await v.click('#commCopyBtn');
  const f0=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f0.waitForSelector('#lpOk');
  assert.match(await f0.evaluate(()=>document.querySelector('#lpOv>div').textContent),/PROCESS LETTER · 6호 · 훈련 세션가상 세션 6훈련 3개 · 60분/,'확인 창까지 사본으로 온다');
  assert.ok(askedLocal.filter(a=>a==='/packs/06.json').length>=2,'뷰어 · 보관함 둘 다 사본의 팩을 읽었다 '+JSON.stringify(askedLocal));
  assert.deepEqual(asked.slice(remoteBefore).filter(a=>a!=='/packs/index.json'),[],'내려간 사이트에는 팩·그림을 묻지 않는다');
  await f0.click('#lpCancel');
  await f0.waitForFunction(()=>!document.getElementById('lpOv'));
  await page.waitForFunction(()=>!sessionStorage.getItem('ps_pack_pending_v1'));
  await page.evaluate(()=>window.__psShowApp('community'));
  await c.waitForSelector('.pr-card[data-proc="06"]');

  // 사이트가 돌아오면 다음에 목록을 받을 때(탭에 적어 둔 10분이 지나거나 화면을 새로 열 때) 사이트 것으로 바뀐다
  indexDown=false;
  await c.evaluate(()=>{ try{sessionStorage.removeItem('ps_comm_proc_index_v1');}catch(_){} location.reload(); });
  await page.waitForTimeout(400);
  c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#grid .card');
  await c.click('#prTabProc');
  await c.waitForSelector('.pr-card[data-proc="03"]');
  const indexDone=indexAsked();

  // 3) 세션 한 장에 훈련 셋 — 호 순서, 이상한 줄은 건너뛴다
  s=await state();
  assert.deepEqual(s.cards,['03','04']);
  assert.deepEqual(s.label,['코치 자료1','프로세스2','엘미하'],'칸 이름 옆의 개수는 사실만');
  assert.equal(s.count,'세션 2개 · 훈련 6개');
  assert.deepEqual(s.chips,['전체 주제2*','공격 조직1','수비 조직1'],'있는 주제만 칩으로');
  const card=await c.evaluate(()=>{const el=document.querySelector('.pr-card[data-proc="03"]'),r=el.getBoundingClientRect();
    return {title:el.querySelector('.pr-tt').textContent,meta:el.querySelector('.pr-meta').textContent,rows:[...el.querySelectorAll('.pr-trs li')].map(li=>[...li.children].map(x=>x.textContent)),foot:el.querySelector('.pr-foot').textContent,
      imgs:[...el.querySelectorAll('.pr-tri img')].map(i=>i.getAttribute('src')),l:Math.round(r.left),r:Math.round(r.right),stats:el.querySelectorAll('.stat,.likebtn').length,
      mins:[...el.querySelectorAll('.pr-mn')].map(x=>Math.round(x.getBoundingClientRect().right)),font:[...new Set([...el.querySelectorAll('.pr-tt,.pr-meta,.pr-trs li,.pr-foot')].map(x=>getComputedStyle(x).fontSize))]};});
  assert.equal(card.title,'가상 세션 3');
  assert.equal(card.meta,'공격 조직인지 · 60분');
  assert.deepEqual(card.rows,[['1','가상 연습 1','15분'],['2','가상 연습 2','20분'],['3','가상 연습 3','25분']]);
  assert.equal(card.foot,'@프로세스 · 레터 3호장면 9');
  assert.deepEqual(card.imgs,[1,2,3].map(k=>'https://process-letter-sessions.netlify.app/packs/thumbs/03-'+k+'.svg?v=0a1b2c3d4e'),'그림 주소는 번호로 짓는다');
  assert.equal(card.stats,0,'좋아요·조회·담김 숫자는 코치 자료에만');
  assert.ok(card.l>=0&&card.r<=s.vw,'카드가 화면 안 '+JSON.stringify(card));
  assert.equal(new Set(card.mins).size,1,'분 숫자는 오른쪽 한 줄에 맞는다 '+JSON.stringify(card.mins));
  assert.ok(card.font.every(f=>['12px','14px','16px'].includes(f)),'글자 크기 '+JSON.stringify(card.font));
  assert.equal(s.docW,s.vw,'가로로 넘치지 않는다');
  await c.waitForFunction(()=>[...document.querySelectorAll('.pr-card[data-proc="03"] img')].every(i=>i.complete&&i.naturalWidth>0));

  // 4) 주제 · 검색(세션 안의 훈련 이름까지)
  await c.locator('#catChips .chip',{hasText:'수비 조직'}).click();
  s=await state();
  assert.deepEqual([s.cards,s.count,s.chips],[['04'],'세션 1개 · 훈련 3개',['전체 주제2','공격 조직1','수비 조직1*']]);
  await c.locator('#catChips .chip',{hasText:'전체 주제'}).click();
  await c.fill('#commSearch','골문 앞');
  await c.waitForFunction(()=>document.querySelectorAll('.pr-card').length===1);
  assert.deepEqual((await state()).cards,['04'],'훈련 이름으로 세션을 찾는다');
  await c.fill('#commSearch','없는 말');
  await c.waitForFunction(()=>document.querySelectorAll('.pr-card').length===0);
  assert.match(await c.evaluate(()=>document.getElementById('grid').textContent),/이 조건의 세션은 0개예요/);
  await c.fill('#commSearch','');
  await c.waitForFunction(()=>document.querySelectorAll('.pr-card').length===2);

  // 5) 카드 → 읽기 전용 뷰어. 훈련 고르는 줄이 머리 아래에 있고, 고르면 그 훈련이 실린다
  await c.click('.pr-card[data-proc="03"]');
  await c.waitForSelector('#cvMask.on');
  v=await view('가상 연습 1');
  pk=await pick();
  assert.deepEqual([pk.hidden,pk.head],[false,'가상 세션 3']);
  assert.deepEqual(pk.btn.map(b=>b.slice(0,4)),[['1','가상 연습 1','15분','true'],['2','가상 연습 2','20분','false'],['3','가상 연습 3','25분','false']]);
  assert.ok(pk.btn.every(b=>b[4]>=36),'훈련 칸의 높이 '+JSON.stringify(pk.btn));
  if(phone)assert.ok(pk.btn.every(b=>b[5]),'폰에서는 훈련 셋이 한 줄에 다 보인다 '+JSON.stringify(pk.btn));
  iv=await inside();
  assert.equal(iv.banner,'프로세스 훈련 세션 — 훈련 3개 · 보기 전용보관함에 담기');
  assert.deepEqual([iv.copy,iv.rep,iv.del,iv.ro],['보관함에 담기',false,false,true],'담기 하나 — 신고·삭제는 코치 자료만');
  assert.deepEqual(iv.doc,['가상 방법 1\n1. 첫 걸음','1. 가상 포인트 1'],'훈련 방법 · 코칭 포인트');
  assert.deepEqual([iv.play,iv.frames,iv.players],[true,3,2],'움직임 재생 · 장면 3');
  // 3.016 — 사용자 «애니메이션들이 너무 짧다 · 더 길게»: 장면 유지 0.6초 → 2초 · 이동 1.2초 → 평균 2.2초(재생은 animHold · 장면마다의 dur 를 쓴다)
  assert.deepEqual([iv.hold,iv.durs],[2,[2.2,2.2,2.2]],'프로세스 훈련은 느린 박자로');
  await c.click('#prCvTabs button:nth-child(3)');
  v=await view('가상 연습 3');
  iv=await inside();
  assert.deepEqual([iv.doc,iv.frames,iv.banner],[['가상 방법 3\n1. 첫 걸음','1. 가상 포인트 3'],4,'프로세스 훈련 세션 — 훈련 3개 · 보기 전용보관함에 담기'],'셋째 훈련의 글과 장면');
  assert.deepEqual((await pick()).btn.map(b=>b[3]),['false','false','true']);
  assert.equal(iv.hit,undefined,'팩 안의 그림은 그려지지 않는다');

  // 6) «보관함에 담기» → 레터와 같은 길: 보관함으로 가서 확인 창 → 카드 한 장(훈련 셋)
  await v.click('#commCopyBtn');
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForSelector('#lpOk');
  await page.waitForFunction(()=>!sessionStorage.getItem('ps_pack_pending_v1'));
  assert.deepEqual(await page.evaluate(()=>({app:document.body.getAttribute('data-ps-app'),hash:location.hash})),{app:'design',hash:''},'보관함으로 왔고 주소는 비워졌다');
  assert.equal(await c.evaluate(()=>document.getElementById('cvMask').classList.contains('on')),false,'뷰어는 닫혔다');
  assert.match(await f.evaluate(()=>document.querySelector('#lpOv>div').textContent),/PROCESS LETTER · 3호 · 훈련 세션가상 세션 3훈련 3개 · 60분/);
  assert.equal(await f.evaluate(async()=>((await store.get('cs_drill_lib_v1'))||[]).filter(d=>d&&d.letter).length),0,'확인 전에는 담기지 않는다');
  await f.click('#lpOk');
  await f.waitForFunction(()=>!document.getElementById('lpOv'));   // 저장이 끝나야 확인 창이 닫힌다
  // 3.000 — 보관함은 여기서 직접 되풀이해 읽는다. waitForFunction 에 async 함수를 주면 약속(Promise) 자체가 참이라 저장 전에 지나갈 수 있다(리눅스 웹킷 CI 에서 빈 목록을 읽었다).
  let saved=[];
  for(let i=0;i<60&&!saved.length;i++){
    saved=await f.evaluate(async()=>((await store.get('cs_drill_lib_v1'))||[]).filter(d=>d&&d.letter).map(d=>[d.name,d.trainings.length,d.letter.issue,d.minutes]));
    if(!saved.length)await page.waitForTimeout(100);
  }
  assert.deepEqual(saved,[['레터 3호 · 가상 세션',3,3,60]],'카드 한 장 · 훈련 셋');
  const pace=await f.evaluate(async()=>{ const d=((await store.get('cs_drill_lib_v1'))||[]).find(x=>x&&x.letter); const fr=d.trainings[0].frames; return [fr[0].__hold,fr.map(x=>[x.hold,x.dur])]; });
  assert.deepEqual(pace,[2,[[2,2.2],[2,2.2],[2,2.2]]],'3.016 — 담은 카드도 커뮤니티에서 본 박자 그대로');

  // 7) 커뮤니티로 돌아오면 프로세스 칸 그대로, 코치 자료로 가면 지금 화면 그대로
  await page.evaluate(()=>window.__psShowApp('community'));
  await c.waitForSelector('.pr-card');
  s=await state();
  assert.deepEqual([s.proc,s.cards],[true,['03','04']]);
  await c.click('#prTabCoach');
  s=await state();
  assert.deepEqual([s.proc,s.pressed,s.lb,s.ph,s.cards.length,s.coach],[false,['true','false','false'],'훈련 주제','제목·작성자·내용 검색',0,1]);
  assert.notEqual(s.fab,'none');assert.notEqual(s.filters,'none');
  assert.ok(s.chips.includes('론도'));

  assert.deepEqual(writes,[],'프로세스 칸은 커뮤니티 서버 표에 아무것도 쓰지 않는다');
  const paths=[...new Set(asked.map(a=>a.replace(/\?.*$/,'')))].sort();
  assert.ok(paths.every(p=>/^\/packs\/(index\.json|03\.json|thumbs\/0[34]-[123]\.svg)$/.test(p)),'읽어 온 것은 정해진 자리의 목록·연 세션의 팩·그림뿐 '+JSON.stringify(paths));
  for(const need of ['/packs/index.json','/packs/03.json','/packs/thumbs/03-1.svg','/packs/thumbs/03-2.svg','/packs/thumbs/03-3.svg'])assert.ok(paths.includes(need),need);
  assert.equal(indexAsked(),indexDone,'목록은 한 번 받은 뒤로는 탭에 적어 둔 것을 쓴다');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,seg:[seg.w,seg.h],cardW:card.r-card.l,vw:s.vw,tabs:pk.btn.map(b=>b[4])}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
