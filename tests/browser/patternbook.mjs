import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.985 — 사용자 «보관함에서 플레이북 만들고 싶어 — 시퀀스별로 애니메이션» · «기존 작전판을 가져올 수도 있게» · «기존 보드를 활용해 만들 수 있게».
// 패턴북 = 여러 페이지 작전판(type:"board") + book:1. 페이지 = 시퀀스, 단계 = 장면에 붙는 이름표(frame.sg). 판·도구·도크는 보드 그대로다.
// 크롬 = 데스크톱, 웹킷 = 폰(보기) → 아이패드(만들기). PS_SIZE 로 하나만 고를 수 있다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',sizes=process.env.PS_SIZE?[process.env.PS_SIZE]:(engine==='webkit'?['phone','ipad']:['desktop']);
for(const size of sizes)await run(size);
async function run(size){
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&typeof renderTokens==='function');
  const shot=n=>page.screenshot({path:path.join(SHOTS,`patternbook-${engine}-${size}-${n}.png`)});
  const tap0=sel=>bf.evaluate(s=>document.querySelector(s).click(),sel);
  const openVault=async()=>{ await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click()); await bf.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:12000}); };
  const noErrors=()=>{ const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(errs,[],JSON.stringify(errs)); };
  const BOOK={libId:'VTESTBOOK',type:'board',book:1,name:'폰에서 보는 패턴북',folder:'',thumb:'',tags:[],savedAt:Date.now()};
  const seedBook=()=>bf.evaluate(async base=>{ const lib=await libGet(),sn=x=>({players:[{id:1,team:'blue',num:8,x:x,y:300}],equipment:[],drawings:[],ball:null,pitchN:1}),fr=(a,o)=>Object.assign({snap:sn(a),dur:1},o||{});
    lib.unshift(Object.assign({},base,{snap:sn(200),frames:[fr(200),fr(500)],pages:[
      {name:'빌드업 A',grp:'공격 조직',snap:sn(200),thumb:'',anim:{frames:[fr(200,{sg:'빌드업'}),fr(500),fr(800,{sg:'전진',cap:'라인 사이로'})],active:0,hold:.6,title:'',titleColor:''}},
      {name:'코너킥 니어',grp:'세트피스',snap:sn(600),thumb:'',anim:{frames:[fr(600),fr(900)],active:0,hold:.6,title:'',titleColor:''}}]}));
    await libWrite(lib); try{libTouch();}catch(_){} try{renderDrillFiles();}catch(_){} },BOOK);
  if(size==='phone'){
    // ── 폰: 기둥 없이 페이지 띠가 시퀀스 고르개다. 판은 화면 폭을 그대로 쓴다 ──
    await openVault(); await seedBook();
    await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes('폰에서 보는 패턴북')),null,{timeout:12000});
    const rowTxt=await bf.evaluate(()=>[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('폰에서 보는 패턴북')).textContent);
    assert.match(rowTxt,/패턴북/); assert.match(rowTxt,/시퀀스 2 · 단계 3 · 장면 5/,rowTxt);
    await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('폰에서 보는 패턴북')); (c.querySelector('.vc-act.view')||[...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='보기')).click(); });
    await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultBook&&window.__psPages.book.count()===2,null,{timeout:12000});
    await page.waitForTimeout(1200);
    const ph=await bf.evaluate(()=>{ const r=document.getElementById('bkRail'),st=document.getElementById('boardStage'),ps=document.getElementById('boardPageStrip'),sv=document.getElementById('board'),ab=document.getElementById('animBar');
      const vis=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;
      return {book:document.body.classList.contains('book-mode'),rail:vis(r),ml:getComputedStyle(st).marginLeft,strip:vis(ps),stripTxt:ps?ps.textContent.replace(/\s+/g,' ').trim():'',tabs:[...document.querySelectorAll('#boardPageStrip .bp-tab')].map(t=>t.textContent.replace(/\s+/g,' ').trim()),
        board:Math.round(sv.getBoundingClientRect().width),vw:innerWidth,sw:document.documentElement.scrollWidth,animBar:vis(ab),frames:anim.frames.length,idx:window.__psPages.book.idx()}; });
    console.log('phone',JSON.stringify(ph));
    await shot('1-view');
    assert.equal(ph.book,true); assert.equal(ph.rail,false,'no rail on a phone'); assert.equal(ph.ml,'0px','the pitch keeps the full width');
    assert.equal(ph.strip,true,'the page strip is the sequence picker'); assert.deepEqual(ph.tabs,['빌드업 A','코너킥 니어'],'read-only: tabs carry no edit handles');
    assert.doesNotMatch(ph.stripTxt,/＋ 시퀀스/,'read-only: nothing to add');
    assert.ok(ph.sw<=ph.vw+1,'no horizontal overflow'); assert.equal(ph.frames,3);
    // 띠가 운동장 배경 위에 있다 — 손가락이 닿는 것은 탭과 재생 단추다(전에는 번진 운동장 배경이 띠를 덮었다)
    const hit=await bf.evaluate(()=>{ const at=e=>{ const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return !!t&&(t===e||e.contains(t)); };
      const tabs=[...document.querySelectorAll('#boardPageStrip .bp-tab')],pp=document.getElementById('bkPhonePlay'),r=pp.getBoundingClientRect();
      return {tab0:at(tabs[0]),tab1:at(tabs[1]),play:at(pp),txt:pp.textContent,h:Math.round(r.height),dis:pp.disabled}; });
    assert.deepEqual(hit,{tab0:true,tab1:true,play:true,txt:'▶ 재생',h:36,dis:false},JSON.stringify(hit));
    await bf.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[1].click()); await page.waitForTimeout(700);
    assert.deepEqual(await bf.evaluate(()=>({i:window.__psPages.book.idx(),n:anim.frames.length,x:state.players[0].x,on:document.querySelectorAll('#boardPageStrip .bp-tab')[1].classList.contains('on')})),{i:1,n:2,x:600,on:true});
    // 재생 단추 — 이 시퀀스를 처음부터. 단계 이름이 자막 앞에 붙는다(기둥이 없어도 같은 규칙)
    await bf.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[0].click()); await page.waitForTimeout(700);
    await bf.evaluate(()=>{ window.__hi=[]; const h=window.highlightFrame; window.highlightFrame=function(i){ window.__hi.push(i); return h.apply(this,arguments); }; document.getElementById('bkPhonePlay').click(); });
    await bf.waitForFunction(()=>animPlaying===true,null,{timeout:4000});
    assert.equal(await bf.evaluate(()=>document.getElementById('bkPhonePlay').textContent),'■ 멈춤');
    const cap0=await bf.evaluate(()=>{ const b=document.getElementById('animCapBar'),e=b&&b.querySelector('.acb-t'); return (b&&getComputedStyle(b).display!=='none'&&e)?e.textContent:''; });
    assert.equal(cap0,'빌드업',cap0);
    await shot('2-play');
    await bf.waitForFunction(()=>animPlaying===false,null,{timeout:30000});
    const pl=await bf.evaluate(()=>({hi:[...new Set(window.__hi)],txt:document.getElementById('bkPhonePlay').textContent,x:state.players[0].x}));
    assert.ok(pl.hi.includes(0)&&pl.hi.includes(2),'the whole sequence played: '+pl.hi.join()); assert.equal(pl.txt,'▶ 재생'); assert.equal(pl.x,200,'back on the first scene');
    assert.equal(await bf.evaluate(()=>window.__bkCapLive('라인 사이로',2)),'전진 — 라인 사이로');
    await tap0('#vCreateCancel');
    await bf.waitForFunction(()=>!document.body.classList.contains('book-mode')&&!window.__vaultBook,null,{timeout:12000});
    noErrors(); console.log('patternbook ok',engine,size);
  }else{
  // 작업 보드(보드 탭의 판)에 선수 둘 — 패턴북 안 «가져오기»에서 «지금 보드»로 보이고, 나온 뒤에도 그대로여야 한다
  await bf.evaluate(()=>{ state.players=[{id:801,team:'blue',num:4,x:220,y:220},{id:802,team:'blue',num:5,x:220,y:520}]; renderTokens(); try{boardSaveLive();}catch(_){} });
  await page.waitForTimeout(500);
  await openVault();
  const tap=sel=>bf.evaluate(s=>document.querySelector(s).click(),sel);
  const type=(sel,v)=>bf.evaluate(([s,val])=>{const e=document.querySelector(s);e.focus();e.value=val;e.dispatchEvent(new Event('input',{bubbles:true}));},[sel,v]);
  const addScene=async move=>{ await bf.evaluate(m=>{ if(m){state.players[0].x+=m;renderTokens();autoSaveAnimFrame();} document.getElementById('animAdd').click(); },move||0); await page.waitForTimeout(280); };
  const rail=()=>bf.evaluate(()=>{ const r=document.getElementById('bkRail'),st=document.getElementById('boardStage'),dk=document.getElementById('ps-command-dock'),sv=document.getElementById('board'),ps=document.getElementById('boardPageStrip');
    const rr=r&&!r.hidden?r.getBoundingClientRect():null,sr=st.getBoundingClientRect(),dr=dk?dk.getBoundingClientRect():null,br=sv.getBoundingClientRect();
    return {book:document.body.classList.contains('book-mode'),rail:rr&&{l:Math.round(rr.left),t:Math.round(rr.top),r:Math.round(rr.right),b:Math.round(rr.bottom),w:Math.round(rr.width)},
      stage:{l:Math.round(sr.left),r:Math.round(sr.right),w:Math.round(sr.width),ml:getComputedStyle(st).marginLeft},dockTop:dr?Math.round(dr.top):null,board:{l:Math.round(br.left),r:Math.round(br.right),w:Math.round(br.width)},
      strip:ps?getComputedStyle(ps).display:'none',vw:innerWidth,sw:document.documentElement.scrollWidth,
      rows:[...document.querySelectorAll('#bkList .bk-row')].map(b=>({t:b.querySelector('.nm').textContent,m:b.querySelector('.mt').textContent,on:b.classList.contains('on')})),
      groups:[...document.querySelectorAll('#bkList .bk-g')].map(g=>g.textContent),
      stages:[...document.querySelectorAll('#bkStg .bk-st')].map(s=>({n:(s.querySelector('.bk-sn')||{}).value??(s.querySelector('.bk-sv')||{}).textContent,rg:s.querySelector('.rg').textContent,on:s.classList.contains('on')})),
      chips:[...document.querySelectorAll('#animFrames .anim-frame')].map(c=>c.classList.contains('sg-start')?'|':'.').join('')}; });

  // ── 1. 만들기 카드에 «패턴북» ──
  await tap('#dfNew'); await bf.waitForSelector('.vcc-item');
  const cards=await bf.evaluate(()=>[...document.querySelectorAll('.vcc-item .vcc-nm')].map(e=>e.textContent));
  assert.ok(cards.includes('패턴북')&&cards.includes('작전판'),cards.join());
  await bf.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>b.querySelector('.vcc-nm').textContent==='패턴북').click());
  await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultPending&&!!window.__vaultBook,null,{timeout:10000});
  await page.waitForTimeout(900);
  let r=await rail(); console.log('start',JSON.stringify(r));
  await shot('1-start');
  assert.equal(r.book,true); assert.ok(r.rail,'rail shown');
  assert.equal(r.rows.length,1); assert.equal(r.rows[0].t,'시퀀스 1');
  assert.equal(r.strip,'none','page strip folded — the rail is the sequence list');
  assert.ok(r.rail.r<=r.stage.l+1,'rail sits left of the stage: '+JSON.stringify([r.rail,r.stage]));
  assert.ok(r.dockTop==null||r.rail.b<=r.dockTop,'rail ends above the dock');
  assert.ok(r.sw<=r.vw+1,'no horizontal overflow');
  // ── 2. 시퀀스 1: 장면 넷 · 이름·묶음 · 단계 나누기 ──
  await bf.evaluate(()=>{ state.players=[{id:901,team:'blue',num:7,x:300,y:370},{id:902,team:'blue',num:9,x:500,y:300}];renderTokens(); });
  await addScene(0); await addScene(120); await addScene(120);
  const nF=await bf.evaluate(()=>anim.frames.length); assert.ok(nF>=4,'scenes '+nF);
  await type('#bkName','빌드업 A'); await type('#bkGrp','공격 조직'); await type('#bkCall','내려'); await type('#bkWhen','상대가 4-4-2 미드블록일 때');
  await bf.evaluate(()=>selectAnimFrame(0)); await page.waitForTimeout(200);
  assert.equal(await bf.evaluate(()=>document.getElementById('bkSplit').disabled),true,'the first scene always starts a stage');
  await bf.evaluate(()=>selectAnimFrame(2)); await page.waitForTimeout(250);
  assert.equal(await bf.evaluate(()=>document.getElementById('bkSplit').disabled),false);
  await tap('#bkSplit'); await page.waitForTimeout(250);
  await type('#bkStg .bk-st[data-k="0"] .bk-sn','빌드업'); await type('#bkStg .bk-st[data-k="1"] .bk-sn','전진'); await type('#bkStg .bk-st[data-k="1"] .bk-note','8번이 받는 순간 풀백이 출발');
  await type('#bkCap','라인 사이의 8번에게'); await bf.evaluate(()=>document.getElementById('bkCap').dispatchEvent(new Event('change',{bubbles:true}))); await page.waitForTimeout(250);
  r=await rail(); console.log('seq1',JSON.stringify({rows:r.rows,groups:r.groups,stages:r.stages,chips:r.chips}));
  assert.deepEqual(r.rows[0],{t:'빌드업 A',m:'2단계 · '+nF+'장면',on:true});
  assert.deepEqual(r.groups,['공격 조직']);
  assert.deepEqual(r.stages.map(x=>[x.n,x.rg,x.on]),[['빌드업','1–2',false],['전진','3–'+nF,true]]);
  assert.equal(r.chips,'..|'+'.'.repeat(nF-3),'the stage start is marked on the scene strip, chips stay one per scene');
  assert.equal(await bf.evaluate(()=>document.querySelectorAll('#animFrames > :not(.anim-frame)').length),0,'no foreign child in the scene strip');
  assert.equal(await bf.evaluate(()=>getComputedStyle(document.querySelector('#animFrames .anim-frame.sg-start')).marginLeft),'12px','a gap in front of the scene that starts a stage');
  await shot('2-stages');

  // 단계 2만 재생 — 장면 3 → 끝 구간만 돌고, 끝나면 재생 전 화면(장면 3)으로 돌아온다. 자막에는 단계 이름이 앞에 붙는다
  await bf.evaluate(()=>{ window.__hi=[]; const h=window.highlightFrame; window.highlightFrame=function(i){ window.__hi.push(i); return h.apply(this,arguments); }; });
  await bf.evaluate(()=>document.querySelector('#bkStg .bk-st[data-k="1"] .bk-ic').click());
  await bf.waitForFunction(()=>animPlaying===true,null,{timeout:4000});
  const capTxt=await bf.evaluate(()=>{ const b=document.getElementById('animCapBar'),e=b&&b.querySelector('.acb-t'); return (b&&getComputedStyle(b).display!=='none'&&e)?e.textContent:''; });
  assert.equal(capTxt,'전진 — 라인 사이의 8번에게',capTxt);
  assert.equal(await bf.evaluate(()=>document.getElementById('bkPlaySeq').textContent),'■ 멈춤');
  await bf.waitForFunction(()=>animPlaying===false,null,{timeout:20000});
  const played=await bf.evaluate(()=>({hi:window.__hi.slice(),end:animRangeEnd,act:animActive,x:state.players[0].x,x2:anim.frames[2].snap.players[0].x}));
  assert.ok(Math.min(...played.hi)>=2&&played.hi.includes(nF-1),'only the stage range played: '+played.hi.join());
  assert.equal(played.end,-1); assert.equal(played.act,2); assert.equal(played.x,played.x2,'back on the pre-play scene');
  // 평소 재생은 처음~끝 그대로(구간이 남아 있지 않다)
  await bf.evaluate(()=>{ window.__hi=[]; selectAnimFrame(0); playAnim(); });
  await bf.waitForFunction(()=>animPlaying===false,null,{timeout:30000});
  const full=await bf.evaluate(()=>window.__hi.slice()); assert.ok(full.includes(0)&&full.includes(nF-1),'full play: '+full.join());

  // 단계 합치기 → 되돌리기(⌘Z)로 돌아온다
  await bf.evaluate(()=>document.querySelector('#bkStg .bk-st[data-k="1"] .bk-tx').click()); await page.waitForTimeout(250);
  assert.equal((await rail()).stages.length,1,'merged');
  await bf.evaluate(()=>undoLast()); await page.waitForTimeout(350);
  r=await rail(); assert.deepEqual(r.stages.map(x=>x.n),['빌드업','전진'],'undo brings the stage back');
  // 단계의 첫 장면을 지우면 이름표가 다음 장면으로 넘어간다 · 복제한 장면은 이름표를 달고 오지 않는다
  const sgAfter=await bf.evaluate(()=>{ duplicateAnimFrame(2,false); const dupSg=typeof anim.frames[3].sg; deleteAnimFrame(3); deleteAnimFrame(2); const out={dup:dupSg,sg:anim.frames.map(f=>typeof f.sg==='string'?f.sg:null)}; undoLast(); return out; });
  assert.equal(sgAfter.dup,'undefined','a duplicated scene carries no stage label');
  assert.equal(sgAfter.sg[2],'전진','the label moved to the next scene: '+JSON.stringify(sgAfter.sg));
  await page.waitForTimeout(300);

  // ── 3. 시퀀스 2: 선수 배치를 첫 장면에서 이어받는다 ──
  await bf.evaluate(()=>selectAnimFrame(anim.frames.length-1)); await page.waitForTimeout(150);
  await tap('#bkAdd'); await page.waitForTimeout(600);
  const s2=await bf.evaluate(()=>({n:state.players.length,frames:anim.frames.length,x:state.players[0]&&state.players[0].x,idx:window.__psPages.book.idx()}));
  assert.deepEqual(s2,{n:2,frames:0,x:300,idx:1},JSON.stringify(s2));
  await type('#bkName','코너킥 니어'); await type('#bkGrp','세트피스');
  await addScene(0); await addScene(60);
  r=await rail(); assert.deepEqual(r.rows.map(x=>[x.t,x.on]),[['빌드업 A',false],['코너킥 니어',true]]); assert.deepEqual(r.groups,['공격 조직','세트피스']);
  await bf.evaluate(()=>document.querySelectorAll('#bkList .bk-row')[0].click()); await page.waitForTimeout(600);
  r=await rail(); assert.deepEqual(r.stages.map(x=>x.n),['빌드업','전진'],'stages survive a sequence switch'); assert.equal(r.rows[0].on,true);
  assert.equal(await bf.evaluate(()=>document.getElementById('bkName').value),'빌드업 A');
  // 전체 재생 — 시퀀스 1 → 2 차례로
  await tap('#bkPlayAll');
  await bf.waitForFunction(()=>window.__psPages.book.idx()===1&&animPlaying===true,null,{timeout:40000});
  await bf.waitForFunction(()=>animPlaying===false&&document.getElementById('bkPlaySeq').textContent!=='■ 멈춤',null,{timeout:40000});
  await bf.evaluate(()=>document.querySelectorAll('#bkList .bk-row')[0].click()); await page.waitForTimeout(500);

  // 내보내기 — 여러 시퀀스 자막은 «시퀀스 · 단계 — 장면 자막», 창 문구는 «시퀀스»
  const caps=await bf.evaluate(()=>animPagesSequence(window.__psPages.exportList().filter(p=>p.frames.length>1)).map(f=>f.cap));
  assert.ok(caps.includes('빌드업 A · 빌드업')&&caps.includes('빌드업 A · 전진 — 라인 사이의 8번에게')&&caps.includes('코너킥 니어'),caps.join(' / '));
  assert.equal(await bf.evaluate(()=>{ const o=window.__bkExportOne(); return o.frames.length===anim.frames.length&&o.frames[0].cap; }),'빌드업 A · 빌드업');
  await bf.evaluate(()=>{ document.getElementById('cmd-export-btn')?.click(); document.getElementById('animExport').click(); }); await bf.waitForSelector('#evSheet #evGo');
  assert.deepEqual(await bf.evaluate(()=>[...document.querySelectorAll('#evSheet .ev-seg[data-key="scope"] .ev-b')].map(b=>b.textContent)),['이 시퀀스','여러 시퀀스']);
  await tap('#evCancel'); await page.waitForTimeout(200);

  // ── 4. 저장 → 보관함 ──
  await tap('#vCreateSave'); await bf.waitForSelector('#pssOk'); await type('#pssName','우리 팀 패턴북'); await tap('#pssOk');
  await bf.waitForFunction(()=>window.__csView==='session'&&!document.body.classList.contains('book-mode'),null,{timeout:12000});
  await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes('우리 팀 패턴북')),null,{timeout:12000});
  const saved=await bf.evaluate(async()=>{ const lib=await libGet(),d=lib.find(x=>x.name==='우리 팀 패턴북'); return d&&{type:d.type,book:d.book,names:d.pages.map(p=>p.name),grp:d.pages.map(p=>p.grp),call:d.pages[0].call,when:d.pages[0].when,
    sg:d.pages[0].anim.frames.map(f=>typeof f.sg==='string'?f.sg:null),note:d.pages[0].anim.frames[2].sgn,top:(d.frames||[]).length,f0:d.pages[0].anim.frames.length,vlink:d.pages.some(p=>'vlink' in p)}; });
  console.log('saved',JSON.stringify(saved));
  assert.equal(saved.type,'board','stored as a multi-page board — older builds open it as one'); assert.equal(saved.book,1);
  assert.deepEqual(saved.names,['빌드업 A','코너킥 니어']); assert.deepEqual(saved.grp,['공격 조직','세트피스']); assert.equal(saved.call,'내려'); assert.equal(saved.when,'상대가 4-4-2 미드블록일 때');
  assert.deepEqual(saved.sg.slice(0,3),['빌드업',null,'전진']); assert.equal(saved.note,'8번이 받는 순간 풀백이 출발');
  assert.equal(saved.top,saved.f0,'the item-level scenes are the first sequence'); assert.equal(saved.vlink,false);
  const rowTxt=await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('우리 팀 패턴북')); return c.textContent; });
  assert.match(rowTxt,/패턴북/); assert.match(rowTxt,/시퀀스 2 · 단계 3 · 장면 \d+/,rowTxt);
  r=await rail(); assert.equal(r.book,false); assert.equal(r.rail,null,'the rail leaves with the pattern book'); assert.equal(r.stage.ml,'0px');
  await shot('3-vault');

  // ── 5. 기존 작전판(두 페이지, 첫 페이지에 장면 둘)을 보관함에 두고 패턴북에서 가져온다 ──
  await bf.evaluate(async()=>{ const lib=await libGet(),sn=x=>({players:[{id:1,team:'blue',num:5,x:x,y:200}],equipment:[],drawings:[],ball:null,pitchN:1});
    lib.unshift({libId:'VTESTBOARD',type:'board',name:'기존 작전판',folder:'',thumb:'',snap:sn(100),tags:[],savedAt:Date.now(),
      pages:[{name:'빌드업 B',snap:sn(100),thumb:'',anim:{frames:[{snap:sn(100),dur:1},{snap:sn(400),dur:1}],active:0,hold:.6,title:'',titleColor:''}},{name:'',snap:sn(700),thumb:''}]});
    await libWrite(lib); try{libTouch();}catch(_){} try{renderDrillFiles();}catch(_){} });
  await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes('기존 작전판')),null,{timeout:12000});
  const kinds=await bf.evaluate(()=>[...document.querySelectorAll('#drillFiles .vcard')].map(c=>[(c.querySelector('.vc-badge')||{}).textContent,/우리 팀 패턴북|기존 작전판/.exec(c.textContent)&&/우리 팀 패턴북|기존 작전판/.exec(c.textContent)[0]]).filter(x=>x[1]));
  assert.deepEqual(kinds.sort((a,b)=>a[1]<b[1]?-1:1),[['작전판','기존 작전판'],['패턴북','우리 팀 패턴북']]);
  await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('우리 팀 패턴북')); [...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click(); });
  await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultBook&&document.body.classList.contains('book-mode')&&document.querySelectorAll('#bkList .bk-row').length===2,null,{timeout:12000});
  await page.waitForTimeout(900);
  r=await rail(); console.log('reopen',JSON.stringify({rows:r.rows,stages:r.stages,chips:r.chips}));
  assert.deepEqual(r.rows.map(x=>x.t),['빌드업 A','코너킥 니어']); assert.deepEqual(r.stages.map(x=>x.n),['빌드업','전진']);
  await tap('#bkImp'); await bf.waitForSelector('#bkImpOv .bk-sheet');
  const imp=await bf.evaluate(()=>[...document.querySelectorAll('#bkImpOv .bk-irow')].map(b=>b.querySelector('.bk-ix b').textContent+' | '+b.querySelector('.bk-igo').textContent));
  console.log('import rows',JSON.stringify(imp));
  assert.ok(imp.includes('기존 작전판 | 시퀀스 2개 가져오기'),imp.join()); assert.ok(!imp.some(t=>t.startsWith('우리 팀 패턴북')),'the open pattern book is not offered to itself');
  assert.equal(imp[0],'지금 보드 | 시퀀스 1개 가져오기','the working board (the board tab) comes first: '+imp.join());
  await shot('4-import');
  await bf.evaluate(()=>[...document.querySelectorAll('#bkImpOv .bk-irow')].find(b=>b.textContent.includes('기존 작전판')).click()); await page.waitForTimeout(700);
  r=await rail(); assert.deepEqual(r.rows.map(x=>[x.t,x.on]),[['빌드업 A',false],['코너킥 니어',false],['빌드업 B',true],['기존 작전판 2',false]]);
  assert.equal(await bf.evaluate(()=>anim.frames.length),2,'the imported page keeps its own scenes');
  await tap('#vCreateSaveOnly'); await page.waitForTimeout(900);
  const after=await bf.evaluate(async()=>{ const lib=await libGet(),b=lib.find(x=>x.name==='우리 팀 패턴북'),o=lib.find(x=>x.libId==='VTESTBOARD'); return {np:b.pages.length,book:b.book,orig:o.pages.length,origName:o.pages[0].name,origBook:o.book||0,origF:o.pages[0].anim.frames.length}; });
  assert.deepEqual(after,{np:4,book:1,orig:2,origName:'빌드업 B',origBook:0,origF:2},'the source board is untouched: '+JSON.stringify(after));
  await shot('5-edit');
  // 나가기 → 기둥이 걷히고 무대가 제자리로
  await tap('#vCreateCancel');
  await bf.waitForFunction(()=>!document.body.classList.contains('book-mode')&&!window.__vaultBook,null,{timeout:12000});
  await page.waitForTimeout(500);
  r=await rail(); assert.equal(r.rail,null); assert.equal(r.stage.ml,'0px');

  // ── 6. «지금 보드» 가져오기 — 작업 보드의 판이 사본으로 들어온다 ──
  await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes('우리 팀 패턴북')),null,{timeout:12000});
  await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('우리 팀 패턴북')); [...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click(); });
  await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultBook&&document.querySelectorAll('#bkList .bk-row').length===4,null,{timeout:12000});
  await page.waitForTimeout(700);
  await tap('#bkImp'); await bf.waitForSelector('#bkImpOv .bk-sheet');
  await bf.evaluate(()=>[...document.querySelectorAll('#bkImpOv .bk-irow')].find(b=>b.querySelector('.bk-ix b').textContent==='지금 보드').click()); await page.waitForTimeout(700);
  const live=await bf.evaluate(()=>({n:window.__psPages.book.count(),idx:window.__psPages.book.idx(),ids:state.players.map(p=>p.id),name:window.__psPages.book.list()[4].label}));
  assert.deepEqual(live,{n:5,idx:4,ids:[801,802],name:'시퀀스 5'},JSON.stringify(live));   // 이름 없는 판은 «시퀀스 n» — 이름은 코치가 붙인다
  await tap('#vCreateSave');
  await bf.waitForFunction(()=>window.__csView==='session'&&!document.body.classList.contains('book-mode'),null,{timeout:12000});

  // ── 7. «보기»(읽기 전용) — 기둥은 읽는 화면: 입력칸·추가·가져오기·메뉴 없이 목록과 단계 ▶ 만 ──
  await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>/우리 팀 패턴북[\s\S]*시퀀스 5/.test(c.textContent)),null,{timeout:12000});
  await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('우리 팀 패턴북')); c.querySelector('.vc-act.view').click(); });
  await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultBook&&!!window.__vaultReadOnly&&document.body.classList.contains('book-mode')&&document.querySelectorAll('#bkList .bk-row').length===5,null,{timeout:12000});
  await page.waitForTimeout(900);
  const rv=await bf.evaluate(()=>({inputs:document.querySelectorAll('#bkRail input,#bkRail textarea').length,add:document.getElementById('bkAdd').hidden,imp:document.getElementById('bkImp').hidden,more:document.querySelectorAll('#bkList .bk-more').length,
    ttl:(document.querySelector('#bkSeqF .bk-ttl')||{}).textContent,stg:[...document.querySelectorAll('#bkStg .bk-st')].map(s=>(s.querySelector('.bk-sv')||{}).textContent),play:document.querySelectorAll('#bkStg .bk-ic').length,split:!!document.getElementById('bkSplit'),
    facts:[...document.querySelectorAll('#bkSeqX .bk-f')].map(f=>f.textContent)}));
  console.log('view',JSON.stringify(rv));
  await shot('6-view');
  assert.deepEqual({inputs:rv.inputs,add:rv.add,imp:rv.imp,more:rv.more,split:rv.split},{inputs:0,add:true,imp:true,more:0,split:false},'read-only rail has nothing to edit');
  assert.equal(rv.ttl,'빌드업 A'); assert.deepEqual(rv.stg,['빌드업','전진']); assert.equal(rv.play,2,'each stage still plays');
  assert.ok(rv.facts.some(t=>t.includes('내려'))&&rv.facts.some(t=>t.includes('4-4-2')),rv.facts.join(' / '));
  r=await rail(); assert.ok(r.rail&&r.rail.r<=r.stage.l+1); assert.ok(r.sw<=r.vw+1);
  await bf.evaluate(()=>document.querySelectorAll('#bkList .bk-row')[1].click()); await page.waitForTimeout(600);
  assert.equal(await bf.evaluate(()=>document.querySelector('#bkSeqF .bk-ttl').textContent),'코너킥 니어');
  await tap('#vCreateCancel');
  await bf.waitForFunction(()=>!document.body.classList.contains('book-mode')&&!window.__vaultBook,null,{timeout:12000});
  // 보드 탭으로 — 작업 보드는 처음 그대로(선수 둘 · 페이지 하나 · 패턴북 표식 없음)
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
  await bf.waitForFunction(()=>(window.__csView||'board')==='board'&&!window.__vaultEdit,null,{timeout:12000});
  await page.waitForTimeout(700);
  const back=await bf.evaluate(()=>({ids:state.players.map(p=>p.id),book:!!window.__vaultBook,mode:document.body.classList.contains('book-mode'),rail:!!(document.getElementById('bkRail')&&!document.getElementById('bkRail').hidden),ml:getComputedStyle(document.getElementById('boardStage')).marginLeft}));
  assert.deepEqual(back,{ids:[801,802],book:false,mode:false,rail:false,ml:'0px'},'the working board is what it was: '+JSON.stringify(back));
  noErrors();
  console.log('patternbook ok',engine,size);
  }
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
}
