import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
// 3.032 — 사용자 «3D 보기에서 빈 곳을 끌어 여러 개 고를 때 선택 네모가 안 보여요(선택은 됨)».
// 3D 는 경기장 그림으로 바꾸려고 «world 바로 밑 id 없는 rect»(잔디 바탕)를 숨기는데, 선택 사각형도 그 모양이라 같이 숨었다.
// ① 3D(가로·세로)와 평면: 빈 곳에서 끄는 동안 #lassoRect 가 보인다 — 계산 스타일만이 아니라 실제 화면 픽셀이 파랗게 바뀐다.
//    누른 점과 지금 손끝이 상자의 마주 보는 두 꼭짓점이다(화면 위치는 판에 붙인 탐침 점으로 잰다 — clientToUnit 을 쓰지 않는 독립 기준).
// ② 놓으면 상자가 사라지고, 화면에 보이는 상자 안의 토큰만(경계 바로 밖은 빼고) 골라진다. ③ 폰(터치)의 3D 도 같다.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/board-3d-marquee');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-marquee-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
// 상자(운동장 좌표): (370,270)–(570,450). 안: A·B·콘. 밖: C(멀리) · D(왼쪽 경계 바로 밖) · E(오른쪽 경계 바로 밖).
const BOX={x0:370,y0:270,x1:570,y1:450},INSIDE=['mq-a','mq-b','mq-cone'],SAMPLE={x:465,y:440};
const results=[],pageErrors=[];
try{for(const device of ['desktop','phone']){
  const viewport=device==='phone'?{width:393,height:852}:{width:1280,height:900};
  const context=await browser.newContext({viewport,serviceWorkers:'block',...(device==='phone'?{hasTouch:true,isMobile:engine==='chromium'}:{})}),errors=[];
  try{
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
    const pix=await context.newPage();   /* 화면 사진의 픽셀을 읽는 빈 페이지(작전판에 손대지 않는다) */
    await page.goto(base+'/studio/board.html?fixture=marquee');
    await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);
    await page.evaluate(()=>{
      boardShowDefault();const s=captureSnap();
      s.players=[{id:'mq-a',team:'blue',num:8,name:'A',x:420,y:320},{id:'mq-b',team:'red',num:9,name:'B',x:520,y:400},{id:'mq-c',team:'blue',num:10,name:'C',x:800,y:560},
        {id:'mq-d',team:'red',num:4,name:'D',x:352,y:440},{id:'mq-e',team:'blue',num:5,name:'E',x:588,y:290}];
      s.equipment=[{id:'mq-cone',team:'cone',x:545,y:300}];s.ball=null;s.drawings=[];loadSnap(s);state.tool='move';
      /* 판(world)에 붙인 아주 작은 점의 화면 위치 = 그 운동장 좌표가 실제로 그려진 곳 */
      window.__probe=(x,y)=>{const c=el('circle',{cx:x,cy:y,r:.01,fill:'none','pointer-events':'none'});world.appendChild(c);const r=c.getBoundingClientRect();c.remove();return {x:r.left+r.width/2,y:r.top+r.height/2};};
      window.__inQuad=(q,p)=>{let s=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(Math.abs(c)<1e-9)continue;if(!s)s=Math.sign(c);else if(Math.sign(c)!==s)return false;}return true;};
    });
    const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,450)))));
    const avg=async clip=>{const png=(await page.screenshot({clip})).toString('base64');
      return pix.evaluate(async src=>{const im=new Image();im.src='data:image/png;base64,'+src;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
        const d=g.getImageData(0,0,c.width,c.height).data;let r=0,gr=0,b=0,n=0;for(let i=0;i<d.length;i+=4){r+=d[i];gr+=d[i+1];b+=d[i+2];n++;}return {r:r/n,g:gr/n,b:b/n};},png);};
    const cases=device==='phone'?[{view:'depth',orientation:'v'},{view:'depth',orientation:'h'}]:[{view:'depth',orientation:'h'},{view:'depth',orientation:'v'},{view:'flat',orientation:'h'},{view:'flat',orientation:'v'}];
    for(const {view,orientation} of cases){
      await page.evaluate(({view,orientation})=>{state.orientation=orientation;buildPitch();window.__setTilt(view==='depth');if(view==='depth')window.__tiltFit();state.tool='move';deselect();renderTokens();},{view,orientation});
      await settle();
      const geo=await page.evaluate(({BOX,SAMPLE})=>{
        const h=document.getElementById('hint');if(h)h.style.visibility='hidden';   /* 3D 켜기 안내가 사라지는 중에 픽셀을 바꾸지 않게 */
        const start=__probe(BOX.x0,BOX.y0),end=__probe(BOX.x1,BOX.y1),sample=__probe(SAMPLE.x,SAMPLE.y),hit=document.elementFromPoint(start.x,start.y);
        return {start,end,sample,tilt:document.body.classList.contains('bc-tilt3d'),onBoard:!!(hit&&svg.contains(hit)&&!hit.closest('.token')),hit:hit&&(hit.id||hit.tagName)};
      },{BOX,SAMPLE});
      const label=JSON.stringify({device,view,orientation});
      assert.equal(geo.tilt,view==='depth',label);
      assert.ok(geo.onBoard,'the drag starts on empty board '+label+' '+JSON.stringify(geo));
      assert.ok(Math.abs(geo.end.x-geo.start.x)>30&&Math.abs(geo.end.y-geo.start.y)>30,'a real box on screen '+label+' '+JSON.stringify(geo));
      const clip={x:geo.sample.x-5,y:geo.sample.y-5,width:10,height:10},before=await avg(clip);
      // 끌기 — 데스크톱은 실제 마우스, 폰은 터치 PointerEvent(빈 곳의 요소에 보내 svg 로 올라간다)
      const fire=(type,p)=>page.evaluate(({type,p})=>{const t=document.elementFromPoint(p.x,p.y)||svg;t.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:71,pointerType:'touch',isPrimary:true,buttons:type==='pointerup'?0:1,clientX:p.x,clientY:p.y}));},{type,p});
      const mid={x:(geo.start.x+geo.end.x)/2,y:(geo.start.y+geo.end.y)/2};
      if(device==='desktop'){await page.mouse.move(geo.start.x,geo.start.y);await page.mouse.down();await page.mouse.move(mid.x,mid.y,{steps:4});await page.mouse.move(geo.end.x,geo.end.y,{steps:6});}
      else{await fire('pointerdown',geo.start);for(let i=1;i<=8;i++)await fire('pointermove',{x:geo.start.x+(geo.end.x-geo.start.x)*i/8,y:geo.start.y+(geo.end.y-geo.start.y)*i/8});}
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const live=await page.evaluate(({geo})=>{
        const r=document.getElementById('lassoRect');if(!r)return {exists:false};
        const cs=getComputedStyle(r),b=r.getBoundingClientRect(),x=+r.getAttribute('x'),y=+r.getAttribute('y'),w=+r.getAttribute('width'),h=+r.getAttribute('height');
        const quad=[__probe(x,y),__probe(x+w,y),__probe(x+w,y+h),__probe(x,y+h)],near=p=>Math.min(...quad.map(q=>Math.hypot(q.x-p.x,q.y-p.y)));
        let shown=true;for(let n=r;n&&n!==document;n=n.parentNode){const s=getComputedStyle(n);if(s.display==='none'||+s.opacity===0)shown=false;}
        /* 지금 화면에서 상자(그려진 사다리꼴/사각형)가 덮는 토큰 — 놓은 뒤 폰은 선택 카드가 올라와 판이 움직이므로 끄는 중에 잰다 */
        const visual=state.players.concat(state.equipment).filter(o=>__inQuad(quad,__probe(o.x,o.y))).map(o=>String(o.id)).sort();
        return {exists:true,count:document.querySelectorAll('#lassoRect').length,visibility:cs.visibility,shown,inWorld:r.parentNode===world,box:{left:b.left,top:b.top,width:b.width,height:b.height},
          startCorner:near(geo.start),endCorner:near(geo.end),visual};
      },{geo});
      const during=await avg(clip);
      assert.equal(live.exists,true,'the selection box exists while dragging '+label);assert.equal(live.count,1);
      assert.equal(live.visibility,'visible','the selection box is not hidden by the 3D pitch rules '+label);assert.equal(live.shown,true,label);
      assert.ok(live.box.width>30&&live.box.height>30,'non-zero size on screen '+label+' '+JSON.stringify(live.box));
      assert.ok(live.startCorner<1.5&&live.endCorner<1.5,'the press point and the finger are opposite corners of the drawn box '+label+' '+JSON.stringify(live));
      const tol=1.5,inBox=p=>p.x>=live.box.left-tol&&p.x<=live.box.left+live.box.width+tol&&p.y>=live.box.top-tol&&p.y<=live.box.top+live.box.height+tol;
      assert.ok(inBox(geo.start)&&inBox(geo.end),'the box covers the dragged screen area '+label);
      // 실제로 화면에 칠해졌다: 상자 안 한 점이 파랗게(채움 rgba(47,168,255,.16)) 바뀐다
      assert.ok(during.b-before.b>8&&during.b-during.r>before.b-before.r+8,'the box is painted on screen '+label+' '+JSON.stringify({before,during}));
      await page.screenshot({path:path.join(out,`${device}-${view}-${orientation}-drag.png`)});
      if(device==='desktop')await page.mouse.up();else await fire('pointerup',geo.end);
      const done=await page.evaluate(()=>({ids:(multiSel||[]).map(o=>String(o.id)).sort(),single:sel&&sel.ref&&String(sel.ref.id),
        gone:!document.getElementById('lassoRect')&&!svg.querySelector('rect[stroke-dasharray="7 5"][stroke="#2fa8ff"]')}));
      assert.equal(done.gone,true,'the box is removed on release '+label);
      assert.deepEqual(done.ids,[...INSIDE].sort(),'exactly the tokens inside are selected '+label+' '+JSON.stringify(done));
      assert.deepEqual(live.visual,done.ids,'what the box covers on screen is what gets selected '+label+' '+JSON.stringify(live.visual));
      if(device==='desktop'){const after=await avg(clip);assert.ok(Math.abs(after.b-before.b)<4,'no box left on screen '+label+' '+JSON.stringify({before,after}));}   /* 폰은 선택 카드가 올라와 판이 움직인다 */
      results.push({device,view,orientation,box:live.box,startCorner:live.startCorner,endCorner:live.endCorner,before,during,selected:done.ids});
      await page.evaluate(()=>{deselect();});
    }
    // 끌지 않고 누르기만(짧게) — 상자가 남지 않고 아무것도 골라지지 않는다(3D)
    const tap=await page.evaluate(async()=>{
      state.orientation='h';buildPitch();__setTilt(true);__tiltFit();deselect();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const p=__probe(470,600),t=document.elementFromPoint(p.x,p.y)||svg,fire=(type,q)=>t.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:72,pointerType:'mouse',isPrimary:true,buttons:type==='pointerup'?0:1,clientX:q.x,clientY:q.y}));
      fire('pointerdown',p);const mid=!!document.getElementById('lassoRect');fire('pointerdown',{x:p.x+2,y:p.y+2});const twice=document.querySelectorAll('#lassoRect').length;fire('pointerup',{x:p.x+2,y:p.y+2});
      return {mid,twice,left:document.querySelectorAll('#lassoRect').length,sel:!!sel,multi:multiSel.length};
    });
    assert.deepEqual(tap,{mid:true,twice:1,left:0,sel:false,multi:0},'a tap leaves no box; a second press never leaves a stray box '+JSON.stringify(tap));
    // 썸네일·내보내기에는 선택 상자가 실리지 않는다(끄는 도중에 찍혀도)
    /* 빈 곳에서 시작한다 — (400,300)은 토큰 A(420,320) 바로 위라, WebKit 은 3D 로 세운 칩의 그림 영역을 누른 것으로 쳐서 상자 대신 A 를 골랐다(CI webkit board).
       위 «누르기만» 과 같은 빈 자리(470,600)에서 끌고, 시작점이 토큰이 아닌 판인지 먼저 확인한다 */
    const pics=await page.evaluate(()=>{
      const p=__probe(470,600),t=document.elementFromPoint(p.x,p.y)||svg,fire=(type,q)=>t.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:73,pointerType:'mouse',isPrimary:true,buttons:type==='pointerup'?0:1,clientX:q.x,clientY:q.y}));
      if(!svg.contains(t)||t.closest('.token'))return {start:'not empty board: '+(t.id||t.tagName)};
      fire('pointerdown',p);svg.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:73,pointerType:'mouse',buttons:1,clientX:p.x+60,clientY:p.y+40}));
      const live=!!document.getElementById('lassoRect'),thumb=boardThumbSVG(),xml=boardImageXML().xml;fire('pointerup',{x:p.x+60,y:p.y+40});
      return {live,thumb:/lassoRect|rgba\(47,168,255,\.16\)/.test(thumb),xml:/lassoRect|rgba\(47,168,255,\.16\)/.test(xml)};
    });
    assert.deepEqual(pics,{live:true,thumb:false,xml:false},'the selection box never reaches pictures '+JSON.stringify(pics));
    // Match the other board suites: retain WebKit's deferred-layout notice as
    // evidence, while pixel, selection, export and every other error still gate.
    assert.deepEqual(errors.filter(e=>!(engine==='webkit'&&e==='ResizeObserver loop completed with undelivered notifications.')),[]);
  }finally{pageErrors.push({device,errors});await context.close();}
}}finally{await browser.close();fs.writeFileSync(path.join(out,'marquee.json'),JSON.stringify({engine,results,pageErrors},null,2));}
console.log(JSON.stringify({test:'board-3d-marquee',engine,cases:results.length,passed:true}));
