/* 3.320 — ① 토큰(선수 · 공 · 장비)은 보이는 판(운동장 + 여백) 밖으로 나가지 않는다 — 끌기 · 묶음 끌기 · 방향키, 가로 · 세로 보기.
   ② 훈련 편집기(body.editing)의 «선수 불러오기»(개인 선수단 applySquadToBoard · 팀 공간 PSBoardScoutImport.apply)는 토큰 사다리 [3](3.381 — 3.338 [1] 에서 두 칸 위 · 작전판은 [3]×0.68 — 편집기 화면과 같아 보이게), 장비 놓기도 [1].
   고치기 전 코드는 첫 끌기(토큰 원이 판 밖)에서 떨어진다. 폰(375)은 보기 전용이라 판 상자만 본다. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/board-bounds-3320');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-bounds-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
const EPS=1e-6,TOUCH=1,RO='ResizeObserver loop completed with undelivered notifications';   /* 3.193 — 웹킷의 그 문장만 따로 */
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
const inside=(t,box)=>t.x-t.r>=box[0]-EPS&&t.x+t.r<=box[0]+box[2]+EPS&&t.y-t.r>=box[1]-EPS&&t.y+t.r<=box[1]+box[3]+EPS;
const touching=(t,box)=>Math.abs(t.x-t.r-box[0])<TOUCH||Math.abs(t.x+t.r-(box[0]+box[2]))<TOUCH||Math.abs(t.y-t.r-box[1])<TOUCH||Math.abs(t.y+t.r-(box[1]+box[3]))<TOUCH;
/* 토큰 중심의 화면 자리(이름표가 있으면 g 의 사각형 중심은 토큰 중심이 아니다 — 잡은 자리 보정 _mvGrab 이 0 이어야 가장자리에 정확히 닿는다) */
/* CI(느린 실행기)에서 끌기 직전 판이 자리를 잡는 중이면(상자가 프레임마다 바뀜) 결과가 어긋난다 — 두 프레임 연속 같은 상자가 될 때까지 기다리고, 끌기 전후 상자가 다르면 그 단계만 다시 한다 */
const settle=async page=>{for(let i=0;i<12;i++){const a=await page.evaluate(()=>JSON.stringify(window.__psBoardBox));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const b=await page.evaluate(()=>JSON.stringify(window.__psBoardBox));if(a===b)return;}};
const START={ba:[450,340],ball:[570,350],eq1:[720,340],bc:[300,200]};
const CENTER="(function(g){const pr=el('circle',{cx:0,cy:0,r:.001,fill:'none','pointer-events':'none'});g.appendChild(pr);const b=pr.getBoundingClientRect();pr.remove();return [b.left+b.width/2,b.top+b.height/2];})";
try{
  for(const viewport of [{width:1280,height:900},{width:820,height:1180},{width:375,height:812}]){
    const phone=viewport.width<520,context=await browser.newContext({viewport,serviceWorkers:'block'}),errors=[],log={viewport,engine,steps:[]};
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
      await page.goto(base+'/studio/board.html');
      await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);   /* 모듈 유무는 묻지 않는다 — 고치기 전 트리에서는 첫 끌기에서 떨어져야 한다 */
      await page.evaluate(()=>{
        boardShowDefault();const s=captureSnap();
        s.players=[{id:'ba',team:'blue',num:8,name:'가',x:450,y:340},{id:'bb',team:'red',num:9,name:'나',x:620,y:470},{id:'bc',team:'blue',num:10,name:'다',x:300,y:200}];
        s.equipment=[{id:'eq1',team:'cone',x:720,y:340}];s.ball={id:'ball',team:'ball',x:570,y:350};s.drawings=[];loadSnap(s);state.tool='move';
      });
      for(const orientation of (phone?['v']:['h','v'])){
        await page.evaluate(o=>{state.orientation=o;buildPitch();applyView();renderTokens();},orientation);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        /* 판 상자 = clientToUnit 이 쓰는 worldBounds(운동장 좌표 · 세로 보기 보정) · 운동장은 판 안 */
        const box=await page.evaluate(()=>{const b=worldBounds();return {box:window.__psBoardBox,wb:[b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY],W,H,M};});
        assert.deepEqual(box.box,box.wb,JSON.stringify({viewport,orientation,box}));
        /* 운동장(선 안쪽 — 폰은 터치라인 여백을 30 → 8 로 줄인다, 2.800)은 판 안 */
        assert.ok(box.box[0]<=box.M+EPS&&box.box[1]<=box.M+EPS&&box.box[0]+box.box[2]>=box.W-box.M-EPS&&box.box[1]+box.box[3]>=box.H-box.M-EPS,'운동장이 판 안 '+JSON.stringify({viewport,orientation,box}));
        log.steps.push({orientation,box:box.box});
        if(phone)continue;
        /* ① 끌기 — 선수 · 공 · 장비를 네 귀 멀리로 끌면 토큰 원이 판 가장자리에 닿아 멈춘다 */
        for(const id of ['ba','ball','eq1'])for(const corner of [[-4000,-4000],[9000,-4000],[9000,9000],[-4000,9000]]){
          let t,tries=0;
          do{
          await settle(page);
          t=await page.evaluate(({id,corner,CENTER,start})=>{
            sel=null;multiSel=[];state.tool='move';
            const p0=tokenItems().find(it=>String(it.o.id)===id).o;p0.x=start[0];p0.y=start[1];if(id==='ball'){state.ball.x=start[0];state.ball.y=start[1];}renderTokens();
            const p=tokenItems().find(it=>String(it.o.id)===id).o,g=tokenLayer.querySelector('[data-id="'+id+'"]'),box0=window.__psBoardBox.slice();
            const c0=eval(CENTER)(g),x=c0[0],y=c0[1];
            const fire=(type,q)=>g.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:77,pointerType:'mouse',buttons:type==='pointerup'?0:1,clientX:q[0],clientY:q[1]}));
            fire('pointerdown',[x,y]);fire('pointermove',[x+(corner[0]>0?30:-30),y+(corner[1]>0?30:-30)]);fire('pointermove',corner);fire('pointerup',corner);
            return {x:p.x,y:p.y,r:21*_tokScaleOf(p),box0,box:window.__psBoardBox.slice(),same:id==='ball'?p===state.ball:true,ball:state.ball?{x:state.ball.x,y:state.ball.y}:null,dragging:document.body.classList.contains('token-drag')};
          },{id,corner,CENTER,start:START[id]});
          tries++;
          }while(tries<3&&JSON.stringify(t.box0)!==JSON.stringify(t.box));
          t.tries=tries;const tag=JSON.stringify({viewport,orientation,id,corner,t});
          assert.equal(t.same,true,'끌던 토큰이 그대로 state 의 것 '+tag);
          assert.ok(inside(t,t.box0),'끌기: 판 안 '+tag);
          /* 세로 보기는 화면 왼쪽이 운동장 ±x 라 어느 쪽인지 안 가린다 — 귀로 끌었으니 x 가장자리 하나 · y 가장자리 하나에 닿는다 */
          assert.ok(Math.abs(t.x-t.r-t.box0[0])<TOUCH||Math.abs(t.x+t.r-(t.box0[0]+t.box0[2]))<TOUCH,'끌기: x 가장자리에 닿음 '+tag);
          assert.ok(Math.abs(t.y-t.r-t.box0[1])<TOUCH||Math.abs(t.y+t.r-(t.box0[1]+t.box0[3]))<TOUCH,'끌기: y 가장자리에 닿음 '+tag);
          if(id==='ball')assert.deepEqual(t.ball,{x:t.x,y:t.y},'공은 state.ball 도 같은 자리 '+tag);
          assert.equal(t.dragging,false);
          log.steps.push({orientation,drag:id,corner,x:t.x,y:t.y,r:t.r,tries:t.tries});
        }
        await page.evaluate(()=>{const f=id=>tokenItems().find(it=>String(it.o.id)===id).o;Object.assign(f('ba'),{x:450,y:340});Object.assign(f('eq1'),{x:720,y:340});Object.assign(f('ball'),{x:570,y:350});state.ball.x=570;state.ball.y=350;renderTokens();});
        /* ② 묶음 끌기 — 둘을 함께 오른쪽 아래 멀리로: 하나도 안 나가고, 먼저 걸리는 쪽이 가장자리에 닿고, 둘은 같은 거리 */
        let grp,gtries=0;
        do{
        await settle(page);
        grp=await page.evaluate(CENTER=>{
          const f=id=>tokenItems().find(it=>String(it.o.id)===id).o,pa=f('ba'),pc=f('bc');Object.assign(pa,{x:450,y:340});Object.assign(pc,{x:300,y:200});
          state.tool='move';sel=null;multiSel=[pa,pc];renderTokens();const before=[{x:pa.x,y:pa.y},{x:pc.x,y:pc.y}],box0=window.__psBoardBox.slice();
          const g=tokenLayer.querySelector('[data-id="ba"]'),c0=eval(CENTER)(g),x=c0[0],y=c0[1];
          const fire=(type,q)=>g.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:78,pointerType:'mouse',buttons:type==='pointerup'?0:1,clientX:q[0],clientY:q[1]}));
          fire('pointerdown',[x,y]);fire('pointermove',[x+30,y+30]);fire('pointermove',[9000,9000]);fire('pointerup',[9000,9000]);
          const r=[{x:pa.x,y:pa.y,r:21*_tokScaleOf(pa)},{x:pc.x,y:pc.y,r:21*_tokScaleOf(pc)}];multiSel=[];renderTokens();
          return {before,after:r,box0,box:window.__psBoardBox.slice()};
        },CENTER);
        gtries++;
        }while(gtries<3&&JSON.stringify(grp.box0)!==JSON.stringify(grp.box));
        const gtag=JSON.stringify({viewport,orientation,grp});
        grp.after.forEach(t=>assert.ok(inside(t,grp.box0),'묶음: 판 안 '+gtag));
        assert.ok(grp.after.some(t=>touching(t,grp.box0)),'묶음: 하나는 가장자리에 닿음 '+gtag);
        assert.ok(Math.abs((grp.after[0].x-grp.before[0].x)-(grp.after[1].x-grp.before[1].x))<EPS&&Math.abs((grp.after[0].y-grp.before[0].y)-(grp.after[1].y-grp.before[1].y))<EPS,'묶음: 같은 거리 '+gtag);
        assert.ok(Math.hypot(grp.after[0].x-grp.before[0].x,grp.after[0].y-grp.before[0].y)>100,'묶음: 실제로 옮겨졌다 '+gtag);
        log.steps.push({orientation,group:grp});
        /* ③ 방향키 — Shift+→ · Shift+↓ 를 수백 번: 판 안에서 멈추고, 되돌아올 수 있다 */
        await settle(page);
        await page.evaluate(()=>{const pa=tokenItems().find(it=>String(it.o.id)==='ba').o;Object.assign(pa,{x:450,y:340});renderTokens();selectItem('player',pa);if(document.activeElement&&document.activeElement!==document.body)document.activeElement.blur();});
        await page.keyboard.down('Shift');for(let i=0;i<260;i++){await page.keyboard.press('ArrowRight');}for(let i=0;i<260;i++){await page.keyboard.press('ArrowDown');}
        const key=await page.evaluate(()=>{const pa=tokenItems().find(it=>String(it.o.id)==='ba').o;return {x:pa.x,y:pa.y,r:21*_tokScaleOf(pa),box:window.__psBoardBox.slice()};});
        for(let i=0;i<3;i++){await page.keyboard.press('ArrowLeft');}await page.keyboard.up('Shift');
        const back=await page.evaluate(()=>{const pa=tokenItems().find(it=>String(it.o.id)==='ba').o;sel=null;renderTokens();return {x:pa.x,y:pa.y};});
        const ktag=JSON.stringify({viewport,orientation,key,back});
        assert.ok(inside(key,key.box),'방향키: 판 안 '+ktag);
        assert.ok(touching(key,key.box),'방향키: 가장자리에 닿음 '+ktag);
        assert.ok(Math.hypot(key.x-450,key.y-340)>200,'방향키: 실제로 옮겨졌다 '+ktag);
        assert.ok(Math.hypot(back.x-key.x,back.y-key.y)>20,'방향키: 가장자리에서 되돌아온다 '+ktag);
        log.steps.push({orientation,key,back});
      }
      if(!phone){
        /* ④ 불러오기 크기 규칙(3.381) — 편집기 [3] · 작전판 [3]×0.68(화면에서 같아 보이게) · 판 위 자리에 입힐 땐 그대로 · 더 크면 그대로 · 편집기 장비 [3] · 팀 명단 창도 [3] */
        await page.evaluate(()=>{state.orientation='h';buildPitch();applyView();});
        const sz=await page.evaluate(()=>{
          const L=tokScaleLevels(),r=v=>Math.round(v*100)/100,o={L0:r(L[0]),L1:r(L[1]),L2:r(L[2]),L3:r(L[3]),LB:r(L[3]*0.68),L5:r(L[5]),L6:r(L[6])};
          const reset=()=>{state.players=[];state.equipment=[];state.ball=null;state.tokenScale=L[0];sel=null;multiSel=[];};
          squad.players=[{id:'s1',name:'가',pos:'GK',num:1},{id:'s2',name:'나',pos:'CB',num:4},{id:'s3',name:'다',pos:'ST',num:9}];
          document.body.classList.remove('editing');reset();applySquadToBoard({});o.plain=state.tokenScale;o.plainN=state.players.length;
          document.body.classList.add('editing');reset();applySquadToBoard({});o.edit=state.tokenScale;o.editN=state.players.length;
          state.tokenScale=L[0];applySquadToBoard({});o.dress=state.tokenScale;o.dressN=state.players.length;
          reset();state.tokenScale=r(L[6]);applySquadToBoard({});o.keepBig=state.tokenScale;
          reset();dropToken('equip','cone',{x:525,y:340});o.equip=state.tokenScale;o.equipN=state.equipment.length;
          document.body.classList.remove('editing');reset();dropToken('equip','cone',{x:525,y:340});o.equipPlain=state.tokenScale;
          const team=[{id:'t1',name:'라',pos:'GK',no:1},{id:'t2',name:'마',pos:'CB',no:5}];
          document.body.classList.add('editing');reset();PSBoardScoutImport.apply(window,team,'blue','전체',null,0);o.team=state.tokenScale;o.teamN=state.players.length;
          state.tokenScale=L[0];PSBoardScoutImport.apply(window,team,'blue','전체',null,0);o.teamDress=state.tokenScale;
          document.body.classList.remove('editing');reset();PSBoardScoutImport.apply(window,team,'blue','전체',null,0);o.teamPlain=state.tokenScale;
          document.body.classList.remove('editing');return o;
        });
        const stag=JSON.stringify({viewport,sz});
        assert.ok(sz.plainN>=3&&sz.editN>=3&&sz.teamN===2,'선수가 올라갔다 '+stag);
        assert.equal(sz.plain,sz.LB,'작전판 불러오기는 [3]×0.68 — 편집기 화면과 같아 보이게 '+stag);
        assert.equal(sz.edit,sz.L3,'편집기 불러오기는 [3] '+stag);
        assert.ok(sz.dress<sz.L1-0.001&&sz.dressN>=3,'판 위 자리에 입힐 땐 크기 그대로(2.975) '+stag);
        assert.equal(sz.keepBig,sz.L6,'더 크게 해 둔 판은 그대로 '+stag);
        assert.equal(sz.equip,sz.L3,'편집기에서 장비를 놓으면 [3] '+stag);assert.equal(sz.equipN,1,stag);
        assert.ok(sz.equipPlain<sz.L2-0.001,'편집기 밖 장비는 그대로 '+stag);
        assert.equal(sz.team,sz.L3,'팀 명단 창(PSBoardScoutImport.apply)도 편집기에서 [3] '+stag);
        assert.ok(sz.teamDress<sz.L1-0.001,'팀 공간 불러오기도 판 위 자리에 입힐 땐 그대로 '+stag);
        assert.equal(sz.teamPlain,sz.LB,'작전판 팀 명단 창도 [3]×0.68(3.381 — 3.242 는 크기를 안 바꿨다) '+stag);
        log.steps.push({size:sz});
      }
      const real=errors.filter(e=>!e.includes(RO));
      assert.deepEqual(real,[],'페이지 오류 '+JSON.stringify(errors));
      log.passed=true;log.resizeObserverNotices=errors.length-real.length;
      fs.writeFileSync(path.join(out,viewport.width+'.json'),JSON.stringify(log,null,2));
      console.log(JSON.stringify({test:'board-bounds-3320',engine,width:viewport.width,passed:true,steps:log.steps.length}));
    }finally{await context.close();}
  }
}catch(e){console.error(e);process.exitCode=1;}
finally{await browser.close();}
