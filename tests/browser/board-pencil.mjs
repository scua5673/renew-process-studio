import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
// 3.025 — 사용자 «아이패드 펜슬 사용할 때 더 부드럽게 움직이게 · 터치 펜을 잘 활용할 수 있게».
// 펜슬(pointerType 'pen')로 긋는 선: 손바닥 무시 · 손가락이 먼저 시작한 선은 펜슬이 넘겨받음 · 긋는 중 둘째 손가락 무시 ·
// 펜슬을 쓴 뒤 손가락은 그리지 않고 선수를 옮김 · 중간 점(coalesced) · 프레임당 한 번 그리기 · 예측 점은 저장하지 않음 ·
// 3D 에서도 같은 투영 · 호버 링(내보내기에는 없음). 합성 PointerEvent 로 돈다(실제 펜슬 없이).
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/board-pencil');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-pencil-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
try{
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),errors=[];
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
    const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    return route.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'});
  });
  await context.addInitScript(({UID,WID})=>{
    localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'fixture',rt:'fixture'}));
    localStorage.setItem('ps_active_ws',WID);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:WID}));
    localStorage.setItem('ps_ws_list',JSON.stringify([{id:WID,kind:'personal',role:'owner',owner_id:UID}]));
    localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[UID]:{role:'executive'}},defaultRole:'player'}));
    window.PSSync={session:()=>({uid:UID}),activeWs:()=>WID,activeWsObj:()=>({id:WID,kind:'personal',role:'owner',owner_id:UID}),dataUnlocked:()=>true,keyReady:()=>true,act(){},ping(){},event(){}};
  },{UID,WID});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/studio/board.html?fixture=pencil');
  await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);
  await page.evaluate(()=>{
    boardShowDefault();const s=captureSnap();s.players=[{id:'pa',team:'blue',num:8,name:'A',x:300,y:600}];s.equipment=[];s.drawings=[];loadSnap(s);
    state.tool='free';document.body.classList.add('drawmode');
    window.__pt=(target,type,id,ptype,x,y,extra)=>target.dispatchEvent(new PointerEvent(type,Object.assign({bubbles:true,cancelable:true,pointerId:id,pointerType:ptype,isPrimary:true,buttons:type==='pointerup'||type==='pointercancel'?0:1,clientX:x,clientY:y,pressure:ptype==='pen'?.6:.5},extra||{})));
    window.__mid=()=>{const r=svg.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
    window.__near=(u,cx,cy)=>{const q=clientToUnit(cx,cy);return Math.hypot(u.x-q.x,u.y-q.y)<0.5;};
  });
  const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));

  // 1) 손가락(손바닥)이 먼저 시작한 선 → 펜슬이 닿으면 버리고 펜슬 선 하나만 남는다. (펜슬을 아직 안 쓴 화면)
  const palmFirst=await page.evaluate(()=>{
    _penSeen=false;_penUpAt=0;const n0=state.drawings.length,m=__mid();
    __pt(drawCatch,'pointerdown',21,'touch',m.x-120,m.y+150);for(let i=1;i<=6;i++)__pt(drawCatch,'pointermove',21,'touch',m.x-120+i*8,m.y+150);
    __pt(drawCatch,'pointerdown',22,'pen',m.x-150,m.y-60);
    for(let i=1;i<=20;i++){__pt(drawCatch,'pointermove',22,'pen',m.x-150+i*12,m.y-60+Math.sin(i/2)*10);__pt(drawCatch,'pointermove',21,'touch',m.x-60+i*8,m.y+150);}
    __pt(drawCatch,'pointerup',22,'pen',m.x+90,m.y-60);__pt(drawCatch,'pointerup',21,'touch',m.x+100,m.y+150);
    const d=state.drawings[state.drawings.length-1],u0=clientToUnit(m.x,m.y-60);
    return {added:state.drawings.length-n0,type:d&&d.type,allPen:d.pts.every(p=>p.y<clientToUnit(m.x,m.y+40).y),first:__near(d.pts[0],m.x-150,m.y-60),penSeen:_penSeen,u0};
  });
  assert.equal(palmFirst.added,1,'one stroke '+JSON.stringify(palmFirst));assert.equal(palmFirst.type,'free');
  assert.ok(palmFirst.allPen,'no finger point in the pencil stroke');assert.ok(palmFirst.first,'the stroke starts where the pencil touched');assert.equal(palmFirst.penSeen,true);

  // 2) 펜슬로 긋는 중 손바닥이 닿고 움직여도 선에 섞이지 않는다 · 뗀 직후의 손바닥도 무시
  const palm=await page.evaluate(()=>{
    const n0=state.drawings.length,m=__mid();
    __pt(drawCatch,'pointerdown',5,'pen',m.x-150,m.y-100);
    for(let i=1;i<=12;i++)__pt(drawCatch,'pointermove',5,'pen',m.x-150+i*10,m.y-100);
    __pt(drawCatch,'pointerdown',9,'touch',m.x+50,m.y+200);
    for(let i=1;i<=12;i++){__pt(drawCatch,'pointermove',9,'touch',m.x+50+i*5,m.y+200);__pt(drawCatch,'pointermove',5,'pen',m.x-30+i*10,m.y-100);}
    __pt(drawCatch,'pointerup',9,'touch',m.x+110,m.y+200);
    const live=_draw&&_draw.pts.length;
    __pt(drawCatch,'pointerup',5,'pen',m.x+90,m.y-100);
    __pt(drawCatch,'pointerdown',10,'touch',m.x,m.y+220);for(let i=1;i<=5;i++)__pt(drawCatch,'pointermove',10,'touch',m.x+i*10,m.y+220);__pt(drawCatch,'pointerup',10,'touch',m.x+50,m.y+220);
    const d=state.drawings[state.drawings.length-1],yLine=clientToUnit(m.x,m.y-100).y;
    return {added:state.drawings.length-n0,live,flat:d.pts.every(p=>Math.abs(p.y-yLine)<1)};
  });
  assert.equal(palm.added,1,'palm lifting does not end the pencil stroke and a palm after it draws nothing '+JSON.stringify(palm));
  assert.equal(palm.live,25,'1 + 24 pencil points, none from the palm');assert.ok(palm.flat,'every point lies on the pencil line');

  // 2b) 3.097 — 두 펜슬 이벤트 사이에 판이 다시 놓이면(무대 여백 + applyView — psSelBarLayout · fix · 시작 타이머가 프레임과 상관없이 한다)
  //     뒤의 점은 다시 놓인 판에서 잰다. 예전엔 잰 투영을 다음 프레임까지 다시 써서 옛 판 자리로 바뀌었다 — 느린 WebKit 에서 2) 가 가끔
  //     실패한 까닭(1) 에서 잰 투영이 프레임 없이 2) 까지 남았다). await 한 번 = 다음 이벤트(그 사이 프레임은 없다).
  const relaid=await page.evaluate(async()=>{
    const m=__mid(),st=document.getElementById('boardStage'),pb=st.style.getPropertyValue('padding-bottom'),yAt=()=>clientToUnit(m.x,m.y-100).y;
    __pt(drawCatch,'pointerdown',6,'pen',m.x-150,m.y-100);for(let i=1;i<=6;i++)__pt(drawCatch,'pointermove',6,'pen',m.x-150+i*10,m.y-100);
    const y0=yAt();
    await Promise.resolve();
    st.style.setProperty('padding-bottom','240px','important');applyView();
    const y1=yAt();
    for(let i=7;i<=12;i++)__pt(drawCatch,'pointermove',6,'pen',m.x-150+i*10,m.y-100);
    const ys=_draw.pts.map(p=>p.y);__pt(drawCatch,'pointerup',6,'pen',m.x-30,m.y-100);
    if(pb)st.style.setProperty('padding-bottom',pb,'important');else st.style.removeProperty('padding-bottom');applyView();
    return {moved:Math.abs(y1-y0)>5,n:ys.length,before:ys.slice(0,7).every(y=>Math.abs(y-y0)<1),after:ys.slice(7).every(y=>Math.abs(y-y1)<1),y0,y1,ys};
  });
  assert.ok(relaid.moved&&relaid.n===13,'the board really moved under the pencil '+JSON.stringify(relaid));
  assert.ok(relaid.before,'points before the move are on the old board '+JSON.stringify(relaid));
  assert.ok(relaid.after,'points after the move follow the board — no stale projection '+JSON.stringify(relaid));

  // 3) 펜슬을 쓴 뒤 그리기 도구의 손가락: 빈 곳은 그리지 않고 안내(+«손가락도 그리기» 단추 — 닿는다) · «펜슬 전용» 칩이 켜진 알약으로 보인다
  await page.waitForTimeout(400);
  const finger=await page.evaluate(()=>{
    const n0=state.drawings.length,m=__mid();
    __pt(drawCatch,'pointerdown',31,'touch',m.x,m.y+100);for(let i=1;i<=8;i++)__pt(drawCatch,'pointermove',31,'touch',m.x+i*10,m.y+100);__pt(drawCatch,'pointerup',31,'touch',m.x+80,m.y+100);
    const hint=(document.getElementById('hint')||{}).textContent||'',ft=document.getElementById('cs-ftoast'),act=ft&&ft.querySelector('.ftoast-act');
    const chip=document.getElementById('penOnlyBtn'),cs=getComputedStyle(chip),r=chip.getBoundingClientRect(),lb=chip.querySelector('.po-lb').getBoundingClientRect();
    return {added:state.drawings.length-n0,hint,act:act?act.textContent:'',clickable:!!ft&&ft.style.pointerEvents==='auto',
      chip:{shown:cs.display!=='none',pressed:chip.getAttribute('aria-pressed'),label:chip.textContent.trim(),pill:r.width>60&&Math.round(r.height)===28,labelInside:lb.right<=r.right+1&&lb.left>=r.left-1,bg:cs.backgroundColor,color:cs.color},
      seen:localStorage.getItem('ps_board_pen_seen_v1')};
  });
  assert.equal(finger.added,0,'a finger draws nothing once the pencil is in use');
  assert.match(finger.hint,/펜슬로 그려요 · 손가락으로는 선수를 옮깁니다/);
  assert.equal(finger.act,'손가락도 그리기','the hint carries the way out');assert.ok(finger.clickable,'and can be tapped');
  assert.ok(finger.chip.shown&&finger.chip.pressed==='true'&&finger.chip.label==='펜슬 전용','the «펜슬 전용» chip is visible and on '+JSON.stringify(finger.chip));
  assert.ok(finger.chip.pill&&finger.chip.labelInside,'a pill with its label inside — the dock does not squeeze it to an icon '+JSON.stringify(finger.chip));
  assert.equal(finger.chip.bg,'rgb(20, 33, 61)','on = navy '+JSON.stringify(finger.chip));assert.equal(finger.chip.color,'rgb(255, 255, 255)');
  assert.equal(finger.seen,'1','the device remembers that a pencil was used');

  // 3b) «손가락도 그리기» → 손가락이 그린다 · 칩으로 다시 펜슬 전용 → 다시 막힌다(안내는 12초에 한 번) · 이동 도구에서는 칩이 숨는다
  const sw=await page.evaluate(()=>{
    const m=__mid(),chip=document.getElementById('penOnlyBtn'),lb=()=>chip.querySelector('.po-lb').textContent;
    document.querySelector('#cs-ftoast .ftoast-act').click();
    const off={penOnly:_penOnly,stored:localStorage.getItem('ps_board_pen_only_v1'),label:lb(),pressed:chip.getAttribute('aria-pressed'),bg:getComputedStyle(chip).backgroundColor};
    const n0=state.drawings.length;
    __pt(drawCatch,'pointerdown',33,'touch',m.x,m.y+120);for(let i=1;i<=8;i++)__pt(drawCatch,'pointermove',33,'touch',m.x+i*10,m.y+120);__pt(drawCatch,'pointerup',33,'touch',m.x+80,m.y+120);
    const drew=state.drawings.length-n0;
    chip.click();
    const on={penOnly:_penOnly,stored:localStorage.getItem('ps_board_pen_only_v1'),label:lb(),pressed:chip.getAttribute('aria-pressed')};
    const n1=state.drawings.length;
    __pt(drawCatch,'pointerdown',34,'touch',m.x,m.y+140);for(let i=1;i<=8;i++)__pt(drawCatch,'pointermove',34,'touch',m.x+i*10,m.y+140);__pt(drawCatch,'pointerup',34,'touch',m.x+80,m.y+140);
    const blocked=state.drawings.length-n1;
    const was=state.tool;state.tool='move';document.body.classList.remove('drawmode');const hiddenInMove=getComputedStyle(chip).display==='none';
    state.tool=was;document.body.classList.add('drawmode');
    return {off,drew,on,blocked,hiddenInMove,shownInDraw:getComputedStyle(chip).display!=='none'};
  });
  assert.deepEqual(sw.off,{penOnly:false,stored:'0',label:'손가락도 그리기',pressed:'false',bg:'rgba(0, 0, 0, 0)'},'the hint button turns pencil-only off and the chip says so');
  assert.equal(sw.drew,1,'a finger draws once pencil-only is off');
  assert.deepEqual(sw.on,{penOnly:true,stored:'1',label:'펜슬 전용',pressed:'true'},'the chip turns it back on');
  assert.equal(sw.blocked,0,'and a finger is blocked again');
  assert.ok(sw.hiddenInMove&&sw.shownInDraw,'the chip only shows with a draw tool '+JSON.stringify(sw));

  // 3c) 펜슬 전용인 채 선수 위의 손가락은 (길게 눌러) 옮긴다
  const drag=await page.evaluate(async()=>{
    const p=state.players[0],start={x:p.x,y:p.y},g=tokenLayer.querySelector('[data-id="pa"]'),b=g.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2,n0=state.drawings.length;
    __pt(g,'pointerdown',32,'touch',x,y);await new Promise(r=>setTimeout(r,320));
    for(let i=1;i<=20;i++)__pt(g,'pointermove',32,'touch',x+i*2,y+i);__pt(g,'pointerup',32,'touch',x+40,y+20);
    return {moved:Math.hypot(p.x-start.x,p.y-start.y),added:state.drawings.length-n0};
  });
  assert.ok(drag.moved>8&&drag.added===0,'a finger on a player moves it in a draw tool '+JSON.stringify(drag));

  // 4) 손가락으로 긋는 중 둘째 손가락은 받지 않는다(펜슬을 안 쓴 화면)
  const two=await page.evaluate(()=>{
    _penSeen=false;_penUpAt=0;const n0=state.drawings.length,m=__mid();
    __pt(drawCatch,'pointerdown',41,'touch',m.x-150,m.y-20);
    for(let i=1;i<=10;i++)__pt(drawCatch,'pointermove',41,'touch',m.x-150+i*10,m.y-20);
    __pt(drawCatch,'pointerdown',42,'touch',m.x,m.y+200);
    for(let i=1;i<=10;i++){__pt(drawCatch,'pointermove',42,'touch',m.x+i*6,m.y+200);__pt(drawCatch,'pointermove',41,'touch',m.x-50+i*10,m.y-20);}
    __pt(drawCatch,'pointerup',42,'touch',m.x+60,m.y+200);const live=_draw&&_draw.pts.length;__pt(drawCatch,'pointerup',41,'touch',m.x+50,m.y-20);
    return {added:state.drawings.length-n0,live};
  });
  assert.deepEqual(two,{added:1,live:21},'the second finger neither starts nor feeds nor ends the stroke');

  // 5) 점은 그때그때 쌓고 화면은 프레임마다 한 번 — 예측 점은 그리는 중에만, 저장하지 않는다 · 펜의 중간 점을 모두 받는다
  const batch=await page.evaluate(()=>new Promise(resolve=>{
    _penSeen=true;const m=__mid();let builds=0;const orig=drawingEl;drawingEl=function(d){if(d===_draw)builds++;return orig.apply(this,arguments);};
    __pt(drawCatch,'pointerdown',51,'pen',m.x-150,m.y);const after0=builds;
    for(let i=1;i<=30;i++)__pt(drawCatch,'pointermove',51,'pen',m.x-150+i*5,m.y+i);
    const sync=builds-after0,pts=_draw.pts.length;
    const C=(x,y)=>new PointerEvent('pointermove',{clientX:x,clientY:y,pointerId:51,pointerType:'pen'});
    let coalescedOk=false,predictedOk=false;
    try{const ev=new PointerEvent('pointermove',{bubbles:true,pointerId:51,pointerType:'pen',buttons:1,clientX:m.x+10,clientY:m.y+33,
      coalescedEvents:[C(m.x+2,m.y+31),C(m.x+6,m.y+32),C(m.x+10,m.y+33)],predictedEvents:[C(m.x+14,m.y+34),C(m.x+18,m.y+35)]});
      coalescedOk=!!(ev.getCoalescedEvents&&ev.getCoalescedEvents().length===3);predictedOk=!!(ev.getPredictedEvents&&ev.getPredictedEvents().length===2);drawCatch.dispatchEvent(ev);}catch(_){}
    const ptsC=_draw.pts.length;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const framed=builds-after0,tmpD=(_drawTmp&&_drawTmp.querySelector('path')||{}).getAttribute?.('d')||'';
      __pt(drawCatch,'pointerup',51,'pen',m.x+10,m.y+33);drawingEl=orig;
      const d=state.drawings[state.drawings.length-1];
      resolve({sync,pts,coalescedOk,predictedOk,ptsC,framed,tmpQ:/ Q /.test(tmpD),saved:d.pts.length,lastSaved:d.pts[d.pts.length-1],lastPred:clientToUnit(m.x+18,m.y+35),lastReal:clientToUnit(m.x+10,m.y+33)});
    }));
  }));
  assert.equal(batch.sync,0,'no rebuild per pointermove — the frame redraws '+JSON.stringify(batch));
  assert.equal(batch.pts,31,'every point is kept at once');
  assert.ok(batch.framed>=1&&batch.framed<=3,'one rebuild per frame, not per move: '+batch.framed);
  assert.ok(batch.tmpQ,'the live stroke is a curve');
  if(batch.coalescedOk)assert.equal(batch.ptsC,34,'all three coalesced pencil points are taken');
  else assert.equal(batch.ptsC,32,'without coalesced events the event itself is the point');
  assert.ok(Math.hypot(batch.lastSaved.x-batch.lastReal.x,batch.lastSaved.y-batch.lastReal.y)<0.5,'the saved stroke ends at the real pencil point, never a predicted one');

  // 6) 저장된 점은 그대로 · 그림은 둥근 곡선(평면·내보내기 같은 길)
  const shape=await page.evaluate(()=>{
    const zig=[];for(let i=0;i<=20;i++)zig.push({x:300+i*12,y:300+(i%2?14:-14)});
    const d={type:'free',color:'#fff',lw:1,op:1,pts:zig.map(p=>({...p}))};pushUndo();state.drawings.push(d);renderDrawings();
    const pth=drawLayer.lastChild.querySelector("path").getAttribute("d"),xml=boardImageXML().xml;
    return {same:JSON.stringify(d.pts)===JSON.stringify(zig),starts:pth.startsWith('M 300.0 286.0'),ends:/ L 540\.0 286\.0$/.test(pth),q:(pth.match(/ Q /g)||[]).length,inExport:xml.indexOf(pth)>=0};
  });
  assert.deepEqual(shape,{same:true,starts:true,ends:true,q:19,inExport:true});

  // 7) 3D 보기에서도 펜의 점은 같은 투영(clientToUnit)과 맞는다
  const tilt=await page.evaluate(async()=>{
    __setTilt(true);__tiltFit();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const m=__mid(),xs=[];let ok=true;
    __pt(drawCatch,'pointerdown',71,'pen',m.x-100,m.y);
    for(let i=1;i<=15;i++){const x=m.x-100+i*9,y=m.y+i*3;xs.push([x,y]);__pt(drawCatch,'pointermove',71,'pen',x,y);}
    xs.forEach((c,i)=>{if(!__near(_draw.pts[i+1],c[0],c[1]))ok=false;});
    __pt(drawCatch,'pointerup',71,'pen',m.x+35,m.y+45);__setTilt(false);
    return ok;
  });
  assert.ok(tilt,'perspective points match clientToUnit');
  await frame();

  // 8) 호버 링 — 펜이 닿기 전에만 · 내보내기에는 없다 · 닿으면 사라진다
  const hover=await page.evaluate(()=>new Promise(resolve=>{
    const m=__mid();__pt(drawCatch,'pointermove',81,'pen',m.x,m.y,{buttons:0});
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const h=document.getElementById('penHover'),shown=!!h&&h.style.display!=="none",xml=boardImageXML().xml,thumb=(typeof boardThumbSVG==='function'?boardThumbSVG():'')||'';
      const tr=h&&h.getAttribute('transform')||'',u=clientToUnit(m.x,m.y),at=new RegExp('translate\\('+u.x.toFixed(1)+' '+u.y.toFixed(1)+'\\)').test(tr);
      __pt(drawCatch,'pointerdown',81,'pen',m.x,m.y);const hidden=h.style.display==='none';__pt(drawCatch,'pointerup',81,'pen',m.x,m.y);
      state.tool='move';__pt(drawCatch,'pointermove',82,'pen',m.x,m.y,{buttons:0});
      requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({shown,at,hidden,exp:xml.indexOf('penHover')>=0,thumb:String(thumb).indexOf('penHover')>=0,moveTool:h.style.display==='none'})));
    }));
  }));
  assert.deepEqual(hover,{shown:true,at:true,hidden:true,exp:false,thumb:false,moveTool:true});
  assert.deepEqual(errors,[]);

  // 9) 기기에 남는다 — «손가락도 그리기»로 두고 다시 열어도 그대로 · 펜슬을 쓴 기기라는 것도
  await page.evaluate(()=>_inkPenOnlySet(false,true));
  await page.reload();await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);
  const kept=await page.evaluate(()=>({seen:_penSeen,penOnly:_penOnly,cls:document.body.classList.contains('pen-seen'),label:document.querySelector('#penOnlyBtn .po-lb').textContent,pressed:document.getElementById('penOnlyBtn').getAttribute('aria-pressed')}));
  assert.deepEqual(kept,{seen:true,penOnly:false,cls:true,label:'손가락도 그리기',pressed:'false'},'remembered across a reload');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,test:'board-pencil',coalescedEvents:batch.coalescedOk,predictedEvents:batch.predictedOk,passed:true}));
  await context.close();
}finally{await browser.close();}
