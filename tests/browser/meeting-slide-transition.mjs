// 3.256 — 미팅 슬라이드 넘김(사용자 2026-11-04 «토큰 색이 막 바뀌고 흔적이 남으면서 이상하게 넘어간다»).
// 편집 화면(운동장 편집 · «전환: 슬라이드») · ←→ · 슬라이드쇼에서, 애니메이션 시계를 붙잡아 넘기는 중 프레임을 본다:
//  · 보이는 토큰은 늘 한 벌(앞 장이 사라진 뒤 다음 장이 나타난다) · 같은 팀 같은 번호만 움직인다 · 보이는 토큰의 색은 바뀌지 않는다
//  · 잔상은 경계에서 그리지 않는다 · 넘기는 도중 다시 눌러도 슬라이드에 섞인 판이 담기지 않는다 · 슬라이드 원문 · 작업 보드 페이지 그대로
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
 const {page,logs}=await openApp(fx,size,{browsers});console.log('slide: app ready');
 await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
 const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await f.waitForFunction(()=>window.__psMeetSlide&&window.__psMeetCover&&window.__psMeetReserve&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&document.getElementById('dfNew'));
 await f.click('#dfNew');await f.locator('.vcc-item').filter({hasText:'미팅 자료'}).click();
 await f.waitForSelector('#psMeetForm.on');await f.click('#psMeetForm [data-start=filled]');await f.click('#psMeetForm .mf-go');
 await f.waitForFunction(()=>anim.slides.length===10&&!window.__ksNav);
 await f.click('#ksStrip .mc-add-cover');await f.waitForFunction(()=>anim.slides.length===11&&!window.__ksNav);
 await f.evaluate(()=>window.__meetingPageEdit());   // 사용자 화면 — 운동장 편집(페이지 보기는 넘김을 움직이지 않는다)
 await f.waitForFunction(()=>window.__meetingPageActive===false&&document.body.classList.contains('meet-mode'));
 const go=async i=>{await f.evaluate(i=>{const t=window.__ksTransition;window.__ksTransition='none';window.__meet.go(i);window.__ksTransition=t;},i);await f.waitForFunction(()=>!window.__ksNav);};
 // 사용자 미팅처럼: 우리 팀 흰색(RESERVE 는 «모든 슬라이드» 유니폼에서 빠지는 장이라 옛 색) · 선발 이름 · 경기에서 온 상대 분석 장(빨강 1001~)
 await go(1);
 await f.evaluate(()=>{
   const names=['가상 일','가상 이','가상 삼','가상 사','가상 오','가상 육','가상 칠','가상 팔','가상 구','가상 십','가상 십일'];
   state.players.filter(p=>p.team==='blue').forEach(p=>{p.name=names[(+p.num-1)%11];syncNameToScenes(p);});renderTokens();window.__meet.saveCur();
   const S=anim.slides;S.forEach(s=>{if(s.snap&&!PSMeetReserve.isReserve(s))s.snap.teamColors=Object.assign({},s.snap.teamColors,{blue:'#ffffff'});});
   const reserve=S.find(s=>PSMeetReserve.isReserve(s));reserve.snap.teamColors=Object.assign({},reserve.snap.teamColors,{blue:'#1a2f5c'});
   [3,4].forEach(i=>S[i].snap.players.forEach(p=>{if(p.team==='blue'&&p.num==='9')p.trail=3;}));
   const opp=JSON.parse(JSON.stringify(S[4]));opp.title='상대 분석';delete opp.thumb;delete opp.frames;
   opp.snap.players=S[4].snap.players.filter(p=>p.team==='red').map((p,i)=>Object.assign({},p,{id:1001+i,x:p.x+30}));   // meetSnapFromPct 처럼 1001 부터
   S.splice(5,0,opp);loadSnap(S[1].snap);window.__ksRender();
 });
 await go(1);
 const slides=()=>f.evaluate(()=>JSON.stringify(anim.slides.map(s=>({t:s.title,p:((s.snap&&s.snap.players)||[]).map(p=>[p.id,p.team,p.num,Math.round(p.x),Math.round(p.y),p.name||'',p.meetingRole||'',p.trail||0])}))));
 const work=await f.evaluate(()=>JSON.stringify(window.__psPages.pg(),(k,v)=>k==='thumb'?undefined:v));
 const base=await slides();
 const info=await f.evaluate(()=>anim.slides.map(s=>s.title));
 assert.deepEqual(info.slice(0,6),['표지','BEST 11','RESERVE','하이블록','미드블록','상대 분석']);
 console.log('slide: meeting ready');
 // 시계 붙잡기 — 넘김 함수의 performance.now · requestAnimationFrame 만 이 프레임 안에서
 const hold=()=>f.evaluate(()=>{
   const q=new Map();let n=0;window.__fakeNow=performance.now();
   window.__clock={raf:window.requestAnimationFrame,caf:window.cancelAnimationFrame,now:performance.now};
   performance.now=()=>window.__fakeNow;window.requestAnimationFrame=cb=>{const id=++n;q.set(id,cb);return id;};window.cancelAnimationFrame=id=>q.delete(id);
   window.__tick=dt=>{window.__fakeNow+=dt;const cbs=[...q.values()];q.clear();cbs.forEach(cb=>cb(window.__fakeNow));};
 });
 const release=()=>f.evaluate(()=>{window.__tick(2000);const c=window.__clock;window.requestAnimationFrame=c.raf;window.cancelAnimationFrame=c.caf;performance.now=c.now;});
 const frame=()=>f.evaluate(()=>{
   const L=document.getElementById('tokenLayer'),op={};[...L.children].forEach(g=>{const id=g.getAttribute('data-id');if(id!=null)op[id]=g.hasAttribute('opacity')?+g.getAttribute('opacity'):1;});
   return {players:state.players.map(p=>({id:String(p.id),team:p.team,num:p.num,role:p.meetingRole||'',x:p.x,y:p.y,op:op[String(p.id)]??1})),
     ball:state.ball?(op.ball??1):null,blue:(state.teamColors||{}).blue||'',trail:(window.__trailLayer&&window.__trailLayer.childNodes.length)||0};});
 const vis=fr=>fr.players.filter(p=>p.op>0.05);
 async function watch(label,act,DUR,check){
   await hold();await act();const out=[];let prev=0;
   for(const u of [0,.25,.5,.75,1]){await f.evaluate(dt=>window.__tick(dt),(u-prev)*DUR);prev=u;out.push({u,...await frame()});
     if(u===.25||u===.75)await page.screenshot({path:path.join(SHOTS,'slide-'+label+'-'+(u*100)+'-'+engine+'.png')});}
   await release();await f.waitForFunction(()=>!window.__ksNav);
   check(out);console.log('slide:',label,'ok');return out;
 }
 const ids=fr=>vis(fr).map(p=>p.id).sort();
 // 1) BEST 11 → RESERVE: 한 벌씩(선발이 사라진 뒤 리저브), 같은 자리에 두 이름이 겹치지 않는다
 await watch('best-reserve',()=>f.evaluate(()=>window.__meet.go(2)),450,fr=>{
   const q=fr[1],t=fr[3];
   assert.ok(vis(q).length===11&&vis(q).every(p=>!p.role),'앞 절반: 선발만 보인다 '+ids(q));
   assert.ok(vis(t).length===11&&vis(t).every(p=>p.role==='reserve'),'뒤 절반: 리저브만 보인다 '+ids(t));
   fr.forEach(x=>assert.ok(vis(x).length<=11,'겹쳐 보이지 않는다 u='+x.u+' '+vis(x).length));
 });
 // 2) RESERVE → 하이블록: 리저브는 사라지고 22명이 나타난다 · 보이는 토큰의 색은 그 장의 유니폼 그대로
 await watch('reserve-high',()=>f.evaluate(()=>window.__meet.go(3)),450,fr=>{
   const q=fr[1],t=fr[3];
   assert.ok(vis(q).every(p=>p.role==='reserve')&&vis(q).length===11,'앞 절반엔 리저브만');assert.equal(q.blue,'#1a2f5c','리저브가 보이는 동안 리저브 색');
   assert.equal(vis(t).length,22,'뒤 절반엔 하이블록 22명');assert.ok(vis(t).every(p=>!p.role));assert.equal(t.blue,'#ffffff','하이블록이 보이는 동안 흰색');
   assert.ok(q.ball===null||q.ball<=0.05,'공도 다음 장과 함께 나타난다');
 });
 // 3) 하이블록 → 미드블록: 같은 팀 · 같은 번호가 움직인다(모두 보임) · 장면 재생이 남긴 잔상 깃발이 있어도 경계에선 잔상 없음
 await f.evaluate(()=>{window.__trailLive=1;});
 await watch('high-mid',()=>f.evaluate(()=>window.__meet.go(4)),450,fr=>{
   fr.forEach(x=>{assert.equal(vis(x).length,22);assert.equal(x.trail,0,'잔상 없음 u='+x.u);});
   const a=fr[0].players.find(p=>p.team==='blue'&&p.num==='9'),m=fr[2].players.find(p=>p.team==='blue'&&p.num==='9'),b=fr[4].players.find(p=>p.team==='blue'&&p.num==='9');
   const d=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
   assert.ok(d(a,b)>50&&d(m,{x:(a.x+b.x)/2,y:(a.y+b.y)/2})<d(a,b)/4,'9번은 앞 자리에서 다음 자리로 가운데쯤을 지난다');
 });
 assert.equal(await f.evaluate(()=>(window.__trailLayer&&window.__trailLayer.childNodes.length)||0),0,'넘긴 뒤에도 잔상 없음');
 // 4) 미드블록 → 상대 분석(빨강 1001~): 흰 1001~ 이 빨강 자리로 날아가 색이 바뀌지 않는다
 const mid=await f.evaluate(()=>Object.fromEntries(anim.slides[4].snap.players.map(p=>[p.team+p.num,[p.x,p.y]])));
 await watch('mid-opp',()=>f.evaluate(()=>window.__meet.go(5)),450,fr=>{
   fr.slice(0,4).forEach(x=>vis(x).filter(p=>p.team==='blue').forEach(p=>{const s=mid['blue'+p.num];assert.ok(Math.abs(p.x-s[0])<.5&&Math.abs(p.y-s[1])<.5,'우리 팀은 제자리에서 사라진다 '+p.num);}));
   fr.slice(0,4).forEach(x=>assert.ok(x.players.filter(p=>p.team==='blue').every(p=>+p.id<0),'흰 토큰은 빨강의 id(1001~)를 쓰지 않는다 u='+x.u));
   const blueOp=x=>Math.max(0,...x.players.filter(p=>p.team==='blue').map(p=>p.op));
   assert.ok(blueOp(fr[1])>blueOp(fr[2])&&blueOp(fr[2])>blueOp(fr[3])&&blueOp(fr[3])<0.2,'우리 팀은 서서히 사라진다(사라지기만 하는 경계는 처음부터 끝까지)');
   assert.equal(vis(fr[3]).filter(p=>p.team==='red'&&p.op>=0.999).length,11,'상대 11명은 번호대로 이어 움직인다');
 });
 // 5) 넘기는 도중 다시 누르기 — 섞인 판(리저브 + 하이블록)이 하이블록에 담기지 않는다
 await go(2);await hold();await f.evaluate(()=>window.__meet.go(3));await f.evaluate(()=>window.__tick(200));await f.evaluate(()=>window.__meet.go(4));await release();await f.waitForFunction(()=>!window.__ksNav);
 await go(1);
 assert.equal(await slides(),base,'슬라이드 원문(선수 id · 자리 · 이름 · 역할) 그대로');
 console.log('slide: rapid click ok');
 // 6) ←→ 와 슬라이드쇼도 같은 길
 await go(2);
 await watch('step-reserve-high',()=>f.evaluate(()=>window.__meetStep(1)),450,fr=>{assert.ok(vis(fr[1]).every(p=>p.role==='reserve'));assert.equal(vis(fr[3]).length,22);});
 await go(2);await f.evaluate(()=>window.__meet.show(false));await f.waitForFunction(()=>document.body.classList.contains('focus-board'));await page.waitForTimeout(300);await f.waitForFunction(()=>!window.__ksNav&&window.__meet.idx()===2);
 await watch('show-reserve-high',()=>f.evaluate(()=>window.__meetStep(1)),450,fr=>{assert.ok(vis(fr[1]).every(p=>p.role==='reserve')&&vis(fr[1]).length===11);assert.ok(vis(fr[3]).every(p=>!p.role)&&vis(fr[3]).length===22);fr.forEach(x=>assert.equal(x.trail,0));});
 await f.evaluate(()=>{const b=document.querySelector('#meetNav .mn-exit');if(b)b.click();});await f.waitForFunction(()=>!document.body.classList.contains('focus-board'));
 await go(1);
 assert.equal(await slides(),base,'슬라이드쇼를 지나도 원문 그대로');
 assert.equal(await f.evaluate(()=>JSON.stringify(window.__psPages.pg(),(k,v)=>k==='thumb'?undefined:v)),work,'작업 보드 페이지 그대로');
 const errs=logs.filter(l=>l.type==='pageerror');assert.deepEqual(errs,[],'페이지 오류 없음');
 console.log('slide: done '+engine);
}finally{
 for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();
}
