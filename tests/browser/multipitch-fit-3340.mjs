/* 3.340 — 운동장 여럿 «모양 그대로»(B안 · 사용자 11/20 «운동장 4개 · 여백을 최대한 줄이고 · 3개 2개 6개도»).
   실제 작전판(board.html — 셸이 없으니 카드는 PSMultiPitch.apply 를 셸처럼 직접 부른다)에서 세 폭(데스크톱 · 아이패드 가로 · 폰)마다:
   ① 옛 판(표식 mpFit 없는 스냅 · 4개) — 카드 · 기준 틀이 예전 계산(아래 legacy — 3.339 까지의 board-multipitch.js 와 같은 식) 그대로,
      예전 카드 위에 둔 선수가 그대로 카드 위 · 저장 사본에 표식이 생기지 않는다
   ② 같은 개수를 다시 누르면 새 배치 + 알림 · 되돌리기로 옛 배치(표식도)
   ③ 새 배치 2 · 3 · 4 · 6 — 카드 = PSMultiPitch.layout · 방향(2 · 3 세로, 4 · 6 가로) · 실제 비율 · 판 안 · 예전보다 큰 운동장(4개는 1.5배 넘게)
   ④ 가로 카드 골대는 좌 · 우 — 3D 골대(__tiltGoalsGeo)가 바깥을 향하고 높이가 있다(예전 식은 세로 입구의 높이가 0)
   ⑤ 저장 사본 왕복 · 장면 · 새 페이지에 표식 · 세로 판(돌린 world) · 그림 내보내기 · 훈련 격자 · 3D 경기장(가로 카드 띠는 돌리지 않음)
   고치기 전 코드는 ② 에서 떨어진다(새 배치가 없다). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/multipitch-fit-3340');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://multipitch-fit-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222',RO='ResizeObserver loop completed with undelivered notifications';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
const VIEWS=[{name:'desktop',viewport:{width:1440,height:900}},{name:'ipad',viewport:{width:1024,height:768},touch:true},{name:'phone',viewport:{width:390,height:844},touch:true,mobile:true}];
let cur='';
try{
  for(const V of VIEWS){
    const context=await browser.newContext({viewport:V.viewport,serviceWorkers:'block',hasTouch:!!V.touch,...(V.mobile&&engine==='chromium'?{isMobile:true}:{})}),errors=[],log={view:V.name,engine,steps:[]};
    const step=s=>{cur=V.name+':'+s;};
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
      step('boot');
      await page.goto(base+'/studio/board.html');
      await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window.PSMultiPitch&&window.PSMultiPitch.layout);
      /* 셸이 하는 일: 카드 그리기(apply) — 개수 고르기 = __setPitchN 뒤 apply */
      await page.evaluate(()=>{
        window.__mpApply=()=>{try{PSMultiPitch.apply(document,state.pitchN||1);}catch(e){window.__mpErr=String(e);}};
        window.__applyPitchN=n=>PSMultiPitch.apply(document,n!=null?n:(state.pitchN||1));
        window.__mpToasts=[];const t=window.toast;window.toast=function(m){window.__mpToasts.push(String(m));return t.apply(this,arguments);};
        /* 예전 계산(3.339 까지) — 시험의 기준. __baseVB 의 world 틀에서 세로 카드 rows × cols */
        window.__mpLegacy=(n,F,s)=>{
          const vm=Math.max(16,Math.round(F[3]*.035)),rows=n>3?2:1,cols=Math.ceil(n/rows),rg=Math.max(22,Math.round(F[3]*.03));
          let ph=(F[3]-2*vm-rg*(rows-1))/rows;const cg=Math.max(30,Math.round(F[2]*(cols>=3?.028:.05))),sm=Math.max(10,Math.round(F[2]*.013));
          let cw=(F[2]-2*sm-cg*(cols-1))/cols;const c=PSMultiPitch.fit({x:0,y:0,w:cw,h:ph},s);cw=c.w;ph=c.h;
          const x0=F[0]+(F[2]-cols*cw-(cols-1)*cg)/2,y0=F[1]+(F[3]-rows*ph-(rows-1)*rg)/2,o=[];
          for(let i=0;i<n;i++){const r=Math.floor(i/cols),k=i%cols;o.push({x:x0+k*(cw+cg),y:y0+r*(ph+rg),w:cw,h:ph});}
          return o;};
      });
      const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const settle=async()=>{await frame();await page.evaluate(()=>window.__mpApply());await frame();};
      /* 화면에서 잰 운동장 몫(카드 화면 넓이 ÷ 판 화면 넓이) · 카드가 판 안인가 */
      const measure=()=>page.evaluate(()=>{const svg=document.getElementById('board'),sr=svg.getBoundingClientRect();
        const cs=[...document.querySelectorAll('#ps-multipitch [data-pitch-rect]')].map(g=>{const b=g.querySelector('rect').getBoundingClientRect();return [b.left,b.top,b.width,b.height];});
        return {fill:cs.reduce((a,c)=>a+c[2]*c[3],0)/(sr.width*sr.height),inside:cs.every(c=>c[0]>=sr.left-1&&c[1]>=sr.top-1&&c[0]+c[2]<=sr.right+1&&c[1]+c[3]<=sr.bottom+1),
          rects:window.__psPitchRects,base:window.__baseVB.slice(),vb:svg.getAttribute('viewBox'),err:window.__mpErr||null};});
      const close=(a,b,t)=>Math.abs(a-b)<(t||0.01);
      const sameRects=(a,b,t)=>a.length===b.length&&a.every((r,i)=>close(r.x,b[i].x,t)&&close(r.y,b[i].y,t)&&close(r.w,b[i].w,t)&&close(r.h,b[i].h,t));

      /* ① 옛 판 — 표식 없는 4개 스냅. 예전 카드 가운데마다 선수 */
      step('legacy');
      const legacy=await page.evaluate(()=>{
        autoOrient=false;boardShowDefault();const s=captureSnap();Object.assign(s,{players:[],equipment:[],drawings:[],ball:null,pitchN:4,pitchSpec:'fifa',orientation:'h',spFlip:false,pitchView:'full',area:'full'});delete s.mpFit;
        loadSnap(s);applyView();window.__mpApply();
        const exp=window.__mpLegacy(4,[0,0,1110,740],pitchSpec());
        s.players=exp.map((r,i)=>({id:900+i,team:'blue',num:String(i+1),x:r.x+r.w/2,y:r.y+r.h*.3}));window.__mpLegacySnap=JSON.parse(JSON.stringify(s));
        loadSnap(s);applyView();window.__mpApply();renderTokens();
        return {exp,flag:!!window.__psMpFit,cap:captureSnap()};});
      await settle();
      const lm=await measure();
      assert.equal(legacy.flag,false,'옛 판은 표식 없음');assert.equal(legacy.cap.mpFit,undefined,'저장 사본에 표식이 생기지 않는다');
      assert.deepEqual(lm.base.map(Math.round),[0,0,1110,740],'옛 판의 기준 틀 그대로 '+JSON.stringify(lm.base));
      assert.ok(sameRects(lm.rects,legacy.exp),'옛 판 카드 = 예전 계산 '+JSON.stringify({got:lm.rects,exp:legacy.exp}));
      assert.ok(lm.rects.every(r=>r.dir==='v'),'옛 판은 세로 카드');
      const onCards=await page.evaluate(()=>state.players.every(p=>window.__psPitchRects.some(r=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)));
      assert.equal(onCards,true,'옛 판 선수가 그대로 카드 위');
      log.steps.push({legacyFill:+lm.fill.toFixed(3)});

      /* ② 같은 개수를 다시 누르면 새 배치 + 알림, 되돌리기로 옛 배치 */
      step('same-count');
      await page.evaluate(()=>{window.__mpToasts.length=0;window.__setPitchN(4);window.__mpApply();});
      await settle();
      const sw=await measure(),sw2=await page.evaluate(()=>({flag:window.__psMpFit,toasts:window.__mpToasts.slice(),cap:captureSnap().mpFit,players:state.players.map(p=>[p.x,p.y])}));
      assert.equal(sw2.flag,true,'같은 개수를 눌러도 새 배치');assert.equal(sw2.cap,1,'저장 사본에 표식');
      assert.ok(sw2.toasts.some(t=>/새 배치/.test(t)),'알림 '+JSON.stringify(sw2.toasts));
      assert.ok(sw.rects.every(r=>r.dir==='h'),'4개는 가로 카드');
      assert.deepEqual(sw2.players,legacy.exp.map(r=>[r.x+r.w/2,r.y+r.h*.3]),'선수는 그 자리 그대로');
      /* 폰 작전판은 보기 전용(3.230 — 되돌리기도 막힌다) — 되돌리기는 편집하는 기기에서만 */
      await page.evaluate(ph=>{if(ph)loadSnap(window.__mpLegacySnap);else undoLast();applyView();window.__mpApply();},V.name==='phone');await settle();
      const un=await measure(),unFlag=await page.evaluate(()=>window.__psMpFit);
      assert.equal(unFlag,false,'되돌리기 — 표식도');assert.ok(sameRects(un.rects,legacy.exp),'되돌리기 — 옛 배치');
      /* 같은 개수 · 이미 새 배치면 아무 일 없음(되돌리기 기록 · 알림 없음) */
      await page.evaluate(()=>{window.__setPitchN(4);window.__mpApply();});await settle();
      const stack=await page.evaluate(()=>{window.__mpToasts.length=0;const u=typeof undoStack!=='undefined'?undoStack.length:-1;window.__setPitchN(4);return {before:u,after:typeof undoStack!=='undefined'?undoStack.length:-1,toasts:window.__mpToasts.slice()};});
      assert.equal(stack.after,stack.before,'다시 눌러도 되돌리기 기록이 늘지 않는다');assert.deepEqual(stack.toasts.filter(t=>/새 배치/.test(t)),[]);

      /* ③ 새 배치 2 · 3 · 4 · 6 */
      for(const spec of ['fifa','u12','futsal'])for(const n of [2,3,4,6]){
        step('fit-'+spec+'-'+n);
        if(spec!=='fifa'&&V.name==='phone')continue;
        const old=await page.evaluate(({spec,n})=>{const s=JSON.parse(JSON.stringify(window.__mpLegacySnap));Object.assign(s,{players:[],pitchN:n,pitchSpec:spec});delete s.mpFit;loadSnap(s);applyView();window.__mpApply();return 1;},{spec,n});
        await settle();const before=await measure();
        await page.evaluate(n=>{window.__setPitchN(n);window.__mpApply();},n);await settle();
        const m=await measure(),exp=await page.evaluate(n=>PSMultiPitch.layout(n,pitchSpec()),n),tag=JSON.stringify({view:V.name,spec,n,base:m.base,vb:m.vb});
        assert.equal(m.err,null,'그리기 오류 '+m.err);
        assert.ok(sameRects(m.rects,exp.cards,0.001),'카드 = layout '+tag);
        assert.ok(m.rects.every(r=>r.dir===(n>=4?'h':'v')),'방향 '+tag);
        const sp=await page.evaluate(()=>pitchSpec());
        m.rects.forEach(r=>assert.ok(close(r.dir==='h'?r.w/r.h:r.h/r.w,sp.len/sp.wid,0.001),'실제 비율 '+tag));
        assert.ok(m.inside,'카드가 판 안 '+tag);
        if(spec==='fifa'){assert.ok(m.fill>=before.fill-0.02,'예전보다 작아지지 않는다 '+JSON.stringify({before:before.fill,now:m.fill})+tag);
          if(n===4&&V.name!=='phone')assert.ok(m.fill>1.5*before.fill,'4개는 1.5배 넘게 '+JSON.stringify({before:before.fill,now:m.fill}));
          await page.locator('#boardStage').screenshot({path:path.join(out,`${engine}-${V.name}-${n}.png`)});}
        log.steps.push({spec,n,before:+before.fill.toFixed(3),now:+m.fill.toFixed(3)});
        /* ④ 골대 — 가로 카드는 좌 · 우, 3D 골대는 바깥 · 높이 */
        const g=await page.evaluate(()=>{const rs=window.__psPitchRects,sides=[...document.querySelectorAll('#ps-multipitch .ps-pitch-goal')].map(e=>e.getAttribute('data-side'));
          const geo=window.__tiltGoalsGeo().goals,map=(x,y)=>state.orientation==='v'?(state.spFlip?[H-y,x]:[y,W-x]):[x,y];
          const centers=rs.map(r=>map(r.x+r.w/2,r.y+r.h/2));
          return {sides,geo:geo.map(q=>{const mid=[(q.a[0]+q.b[0])/2,(q.a[1]+q.b[1])/2];let best=centers[0],bd=1e9;centers.forEach(c=>{const d=Math.hypot(c[0]-mid[0],c[1]-mid[1]);if(d<bd){bd=d;best=c;}});
            return {h:q.h,out:q.n[0]*(mid[0]-best[0])+q.n[1]*(mid[1]-best[1])};})};});
        assert.equal(g.sides.length,2*n,'골대 '+tag);
        assert.deepEqual([...new Set(g.sides)].sort(),n>=4?['left','right']:['bottom','top'],'골대 쪽 '+tag);
        assert.equal(g.geo.length,2*n,'3D 골대 '+tag);
        g.geo.forEach(q=>{assert.ok(q.h>1,'3D 골대 높이 '+q.h+' '+tag);assert.ok(q.out>0,'3D 그물은 바깥 '+tag);});
      }
      {
        /* ⑤ 세로 판(폰의 기본) — world 가 돌아도 카드 전체가 판 안 · 기준 틀이 돈 상자 · 예전보다 작아지지 않는다 */
        step('vertical');
        for(const n of [2,3,4,6]){
          await page.evaluate(n=>{const s=JSON.parse(JSON.stringify(window.__mpLegacySnap));Object.assign(s,{players:[],pitchN:n,pitchSpec:'fifa',orientation:'v',spFlip:false});delete s.mpFit;loadSnap(s);applyView();window.__mpApply();},n);await settle();
          const before=await measure();
          await page.evaluate(n=>{window.__setPitchN(n);applyView();window.__mpApply();},n);await settle();
          const m=await measure(),exp=await page.evaluate(n=>PSMultiPitch.layout(n,pitchSpec()).frame,n);
          assert.ok(m.inside,'세로 판 카드가 판 안 '+JSON.stringify(m));
          assert.ok(close(m.base[2],exp[3],0.01)&&close(m.base[3],exp[2],0.01),'세로 판 기준 틀은 돈 상자 '+JSON.stringify({base:m.base,exp}));
          assert.ok(m.fill>=before.fill-0.02,'세로 판도 예전보다 작아지지 않는다 '+JSON.stringify({n,before:before.fill,now:m.fill}));
          log.steps.push({o:'v',n,before:+before.fill.toFixed(3),now:+m.fill.toFixed(3)});
          await page.locator('#boardStage').screenshot({path:path.join(out,`${engine}-${V.name}-v${n}.png`)});
        }
        await page.evaluate(()=>{state.orientation='h';applyView();window.__mpApply();});await settle();
      }
      /* ⑤ 저장 사본 왕복 · 장면 · 새 페이지 */
      step('roundtrip');
      const rt=await page.evaluate(()=>{window.__setPitchSpec('fifa');window.__setPitchN(4);window.__mpApply();const s=captureSnap();
        loadSnap(window.__mpLegacySnap);applyView();window.__mpApply();const a=window.__psPitchRects.map(r=>r.dir).join('');
        loadSnap(s);applyView();window.__mpApply();const b=window.__psPitchRects.map(r=>r.dir).join('');
        return {mp:s.mpFit,a,b,flag:window.__psMpFit,keys:_VIEW_KEYS.count.slice()};});
      assert.equal(rt.mp,1);assert.equal(rt.a,'vvvv','옛 사본을 열면 옛 배치');assert.equal(rt.b,'hhhh','새 사본을 다시 열면 새 배치');assert.equal(rt.flag,true);
      assert.deepEqual(rt.keys,['pitchN','mpFit'],'개수를 바꾸면 장면에도 표식');
      log.steps.push({roundtrip:rt});
      /* 그림 내보내기 — 카드 전체 · 가로 카드 표식 */
      step('export');
      const ex=await page.evaluate(()=>{const vb=__exportVB(),rs=window.__psPitchRects,x=boardImageXML();const xml=typeof x==='string'?x:x.xml;
        return {inside:rs.every(r=>r.x>=vb[0]-.5&&r.y>=vb[1]-.5&&r.x+r.w<=vb[0]+vb[2]+.5&&r.y+r.h<=vb[1]+vb[3]+.5),dir:(xml.match(/data-pitch-dir="h"/g)||[]).length};});
      assert.equal(ex.inside,true,'내보내기 틀에 카드 전체');assert.equal(ex.dir,4,'내보내기에 가로 카드 넷');
      /* 훈련 격자 — 가로 카드도 네 변 · 가운데가 격자선 위 */
      step('train-grid');
      const tg=await page.evaluate(()=>{_setPitch('train');buildPitch();applyView();window.__mpApply();
        const g=document.querySelector('#world>#trainGrid'),ls=g?[...g.querySelectorAll('line')].map(l=>['x1','y1','x2','y2'].map(k=>+l.getAttribute(k))):[];
        const has=(x,v)=>ls.some(a=>(v?a[0]===a[2]&&Math.abs(a[0]-x)<.01:a[1]===a[3]&&Math.abs(a[1]-x)<.01));
        return {fit:g&&g.getAttribute('data-ps-fit'),ok:window.__psPitchRects.every(r=>[r.x,r.x+r.w/2,r.x+r.w].every(x=>has(x,true))&&[r.y,r.y+r.h/2,r.y+r.h].every(y=>has(y,false)))};});
      assert.deepEqual(tg,{fit:'cards',ok:true},'훈련 격자 '+JSON.stringify(tg));
      await page.evaluate(()=>{_setPitch('grass');buildPitch();applyView();window.__mpApply();});await settle();
      if(V.name==='desktop'){
        /* 3D 경기장 — 가로 카드 띠는 돌리지 않는다(카드 하프라인에서 x 로) */
        step('tilt');
        const t=await page.evaluate(async()=>{window.__setGrassM(4);window.__setTilt(true);const t0=Date.now();let src='';
          while(Date.now()-t0<15000){const h=document.querySelector('#tiltSurface .tilt-stadium');src=h?decodeURIComponent(h.getAttribute('src')||''):'';if(/ps-mow-card/.test(src))break;await new Promise(r=>setTimeout(r,200));}
          const rs=window.__psPitchRects,pats=rs.map((_,i)=>{const m=new RegExp('<pattern id="psStMowC'+i+'"([^>]*)>').exec(src);return m?m[1]:'';});
          window.__setTilt(false);
          return {cards:(src.match(/class="ps-mow-card"/g)||[]).length,rot:pats.map(p=>/patternTransform/.test(p)),x:pats.map((p,i)=>{const m=/ x="([-\d.]+)"/.exec(p);return m?+m[1]-(rs[i].x+rs[i].w/2):null;})};});
        assert.equal(t.cards,4,'카드마다 띠 '+JSON.stringify(t));
        assert.deepEqual(t.rot,[false,false,false,false],'가로 카드 띠는 돌리지 않는다');
        t.x.forEach(d=>assert.ok(d!==null&&Math.abs(d)<.06,'띠는 카드 하프라인에서 '+JSON.stringify(t)));
      }
      const real=errors.filter(e=>!e.includes(RO));
      assert.deepEqual(real,[],'페이지 오류 '+JSON.stringify(errors));
      log.passed=true;fs.writeFileSync(path.join(out,`${engine}-${V.name}.json`),JSON.stringify(log,null,2));
      console.log(JSON.stringify({test:'multipitch-fit-3340',engine,view:V.name,passed:true,steps:log.steps}));
    }finally{await context.close();}
  }
}catch(e){console.error('multipitch-fit-3340 실패 단계:',cur);console.error(e);process.exitCode=1;}
finally{await browser.close();}
