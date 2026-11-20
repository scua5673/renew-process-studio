/* 3.338 — 훈련 격자는 운동장 가운데 기준 · 칸이 딱 맞게(11인제 · 8인제 각각, 운동장 여럿은 카드마다) · 선 골대(목업 B안).
   실제 작전판(board.html)에서 훈련 바탕을 고르고: ① 운동장 하나 11인제 · 8인제 — 골라인 · 터치라인 · 하프라인 · 센터가 격자선 위
   ② 운동장 셋(가로 · 세로 판) — 카드마다 네 변 · 가운데가 격자선 위, 카드 밖엔 격자 없음 · 격자 자석은 놓는 자리의 카드 칸
   ③ 골대 — 둥근 ㄷ 자(Q) · 망 무늬 없음 · 3D 가 읽는 입구 선(카드 셋이면 여섯) ④ 그림 내보내기에 같은 격자.
   고치기 전 코드는 ① 8인제 왼쪽 골라인(격자선이 아님)에서 떨어진다. 셸이 없으니 카드는 PSMultiPitch.apply 를 직접 부른다(셸이 하는 그대로). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/board-train-grid-3338');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-train-grid-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222',RO='ResizeObserver loop completed with undelivered notifications';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
try{
  for(const viewport of [{width:1280,height:900},{width:820,height:1180}]){
    const context=await browser.newContext({viewport,serviceWorkers:'block'}),errors=[],log={viewport,engine,steps:[]};
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
        window.PSSync={session:()=>({uid:UID}),activeWs:()=>WID,activeWsObj:()=>({id:WID,kind:'personal',role:'owner',owner_id:UID}),dataUnlocked:()=>true,keyReady:()=>true,act(){},ping(){},event(){}};
      },{UID,WID});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(base+'/studio/board.html');
      await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);
      await page.addScriptTag({url:base+'/studio/board-multipitch.js'});
      const setup=(spec,n,o)=>page.evaluate(({spec,n,o})=>{
        boardShowDefault();const s=captureSnap();s.players=[];s.equipment=[];s.drawings=[];s.ball=null;loadSnap(s);
        state.orientation=o;window.__setPitchSpec(spec);window.__setPitchN(n);_setPitch('train');buildPitch();applyView();PSMultiPitch.apply(document,n);renderTokens();
      },{spec,n,o});
      const settle=async n=>{await page.evaluate(frame);await page.evaluate(n=>PSMultiPitch.apply(document,n),n);await page.evaluate(frame);};
      const grid=()=>page.evaluate(()=>{const g=document.querySelector('#world>#trainGrid');if(!g)return null;
        const ls=[...g.querySelectorAll('line')].map(l=>['x1','y1','x2','y2'].map(k=>+l.getAttribute(k)));
        return {fit:g.getAttribute('data-ps-fit'),xs:ls.filter(a=>a[0]===a[2]).map(a=>a[0]),ys:ls.filter(a=>a[1]===a[3]).map(a=>a[1]),ls,spec:window.__trainGridSpec};});
      const has=(arr,v)=>arr.some(a=>Math.abs(a-v)<0.01);
      /* ① 운동장 하나 */
      for(const spec of ['fifa','u12']){
        await setup(spec,1,'h');await settle(1);
        const g=await grid(),p=await page.evaluate(()=>{const q=PR();return {L:q.L,R:q.R,T:q.T,B:q.B,CX,CY};});
        const tag=JSON.stringify({viewport,spec,p,spec0:g&&g.spec});
        assert.ok(g&&g.xs.length>10&&g.ys.length>10,'훈련 격자가 있다 '+tag);
        for(const x of [p.L,p.R,p.CX])assert.ok(has(g.xs,x),'세로 격자선이 골라인 · 하프라인에 '+x+' '+tag);
        for(const y of [p.T,p.B,p.CY])assert.ok(has(g.ys,y),'가로 격자선이 터치라인 · 센터에 '+y+' '+tag);
        const goals=await page.evaluate(()=>[...document.querySelectorAll('#lineLayer .pitch-goal')].map(e=>({side:e.getAttribute('data-side'),frame:(e.querySelector('.pitch-goal-frame')||{}).getAttribute?.('d')||'',pattern:!!e.querySelector('[fill^="url("]')})));
        assert.equal(goals.length,2,'골대 둘 '+tag);goals.forEach(q=>{assert.match(q.frame,/Q/,'둥근 ㄷ 자 '+tag);assert.equal(q.pattern,false,'망 무늬 없음 '+tag);});
        await page.locator('#boardStage').screenshot({path:path.join(out,`${engine}-${viewport.width}-${spec}-1.png`)});
        log.steps.push({spec,n:1,cells:[g.xs.length,g.ys.length],spec0:g.spec});
      }
      /* ② 운동장 셋 — 가로 · 세로 판 */
      for(const o of ['h','v'])for(const spec of ['fifa','u12']){
        await setup(spec,3,o);await settle(3);
        const g=await grid(),rects=await page.evaluate(()=>window.__psPitchRects),tag=JSON.stringify({viewport,o,spec,rects});
        assert.equal(g.fit,'cards','카드마다 '+tag);assert.equal(rects.length,3,tag);assert.equal(g.spec.cards.length,3,tag);
        for(const r of rects){
          for(const x of [r.x,r.x+r.w,r.x+r.w/2])assert.ok(g.ls.some(a=>a[0]===a[2]&&Math.abs(a[0]-x)<0.01&&a[1]>=r.y-0.01&&a[3]<=r.y+r.h+0.01),'카드 세로선 '+x+' '+tag);
          for(const y of [r.y,r.y+r.h,r.y+r.h/2])assert.ok(g.ls.some(a=>a[1]===a[3]&&Math.abs(a[1]-y)<0.01&&a[0]>=r.x-0.01&&a[2]<=r.x+r.w+0.01),'카드 가로선 '+y+' '+tag);
        }
        assert.ok(g.ls.every(a=>rects.some(r=>a[0]>=r.x-0.01&&a[2]<=r.x+r.w+0.01&&a[1]>=r.y-0.01&&a[3]<=r.y+r.h+0.01)),'카드 밖엔 격자 없음 '+tag);
        /* 격자 자석 — 둘째 카드 안의 점은 둘째 카드 칸의 교차점으로(편집기 snapDrag = board-training-edit.js) */
        const snap=await page.evaluate(r=>{state.players=[{id:'sn',team:'blue',num:7,x:r.x+5,y:r.y+5}];sel=null;multiSel=[];
          const c=window.__trainGridSpec.cards[1],u={x:r.x+r.w*0.37+1.3,y:r.y+r.h*0.61+0.7},q=window.snapDrag(state.players[0],'player',u);
          return {q,c:{x0:c.x0,y0:c.y0,sx:c.sx,sy:c.sy}};},rects[1]);
        const kx=(snap.q.x-snap.c.x0)/snap.c.sx,ky=(snap.q.y-snap.c.y0)/snap.c.sy;
        assert.ok(Math.abs(kx-Math.round(kx))<1e-6&&Math.abs(ky-Math.round(ky))<1e-6,'둘째 카드 칸의 교차점 '+JSON.stringify(snap));
        /* ③ 골대 — 카드마다 둘 · 둥근 ㄷ 자 · 망 없음 · 3D 가 읽는 입구 여섯 */
        const goals=await page.evaluate(()=>({n:document.querySelectorAll('#ps-multipitch .ps-pitch-goal').length,q:[...document.querySelectorAll('#ps-multipitch .ps-pitch-goal-frame')].every(f=>/Q/.test(f.getAttribute('d'))),pat:document.querySelectorAll('#ps-multipitch pattern').length,geo:window.__tiltGoalsGeo().goals.length}));
        assert.deepEqual(goals,{n:6,q:true,pat:0,geo:6},'골대 '+tag);
        await page.evaluate(()=>{state.players=[];renderTokens();});
        if(spec==='fifa'){
          /* ④ 그림 내보내기에도 같은 격자 */
          const xml=await page.evaluate(()=>boardImageXML().xml);
          assert.match(xml,/data-ps-fit="cards"/,'내보내기에 카드 격자 '+o);
          await page.locator('#boardStage').screenshot({path:path.join(out,`${engine}-${viewport.width}-${spec}-3${o}.png`)});
        }
        log.steps.push({o,spec,n:3,lines:g.ls.length,snap});
      }
      /* 하나로 돌아오면 판 전체 격자(여백까지)로 */
      await setup('fifa',1,'h');await settle(1);
      const back=await grid();assert.equal(back.fit,'pitch');assert.ok(!back.spec.cards,'운동장 하나면 카드 칸 없음');
      const real=errors.filter(e=>!e.includes(RO));
      assert.deepEqual(real,[],'페이지 오류 '+JSON.stringify(errors));
      log.passed=true;fs.writeFileSync(path.join(out,`${engine}-${viewport.width}.json`),JSON.stringify(log,null,2));
      console.log(JSON.stringify({test:'board-train-grid-3338',engine,width:viewport.width,passed:true,steps:log.steps.length}));
    }finally{await context.close();}
  }
}catch(e){console.error(e);process.exitCode=1;}
finally{await browser.close();}
