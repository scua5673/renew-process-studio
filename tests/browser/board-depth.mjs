import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/board-depth');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-depth-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
const results=[];
try{for(const viewport of [{width:1280,height:900},{width:820,height:1180},{width:393,height:852}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),errors=[];
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
    await page.goto(base+'/studio/board.html?fixture=depth');
    await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);
    await page.evaluate(()=>{
      boardShowDefault();const s=captureSnap();s.players=[{id:'depth-a',team:'blue',num:8,name:'A',x:450,y:340},{id:'depth-b',team:'red',num:9,name:'B',x:620,y:470}];
      s.equipment=[{id:'cone-a',team:'cone',x:720,y:340},{id:'marker-a',team:'marker',x:780,y:470}];s.ball={id:'ball',team:'ball',x:570,y:350};s.drawings=[];loadSnap(s);state.tool='move';
    });
    for(const theme of ['navy','white','train'])for(const orientation of ['h','v']){
      await page.evaluate(({theme,orientation})=>{document.documentElement.dataset.pitch=theme;state.orientation=orientation;buildPitch();window.__setTilt(true);window.__tiltFit();}, {theme,orientation});
      const r=await page.evaluate(()=>{
        const before=JSON.stringify(captureSnap()),selected=state.players[0];selectItem('player',selected);
        const target=tokenLayer.querySelector('[data-id="depth-a"]');let saves=0,renders=0;
        const save=boardSaveLive,render=renderTokens;boardSaveLive=()=>saves++;renderTokens=()=>renders++;
        let thumb,exportXML;try{thumb=boardThumbSVG();exportXML=boardImageXML().xml;}finally{boardSaveLive=save;renderTokens=render;}
        const goal=document.querySelector('#tiltGoals .goal-front');
        return {unchanged:before===JSON.stringify(captureSnap()),sameNode:target===tokenLayer.querySelector('[data-id="depth-a"]'),sameSelection:sel.ref===selected,saves,renders,thumbHasDepth:thumb.includes('ps-depth-face'),thumbHasSelection:thumb.includes('ps-selring'),exportHasDepth:exportXML.includes('ps-depth-face'),exportHasSelection:exportXML.includes('ps-selring'),tokens:tokenLayer.querySelectorAll('.token[data-depth]').length,goalColor:getComputedStyle(goal).borderTopColor,goalVisible:goal.getBoundingClientRect().width>0,
          chips:tokenLayer.querySelectorAll('.token[data-depth-chip] .ps-chip').length,names:[...tokenLayer.querySelectorAll('.ps-chip-name')].map(t=>t.textContent).sort().join(','),
          stage:getComputedStyle(document.getElementById('boardStage')).backgroundColor,line:getComputedStyle(document.querySelector('#lineLayer [stroke]:not([stroke="none"])')).stroke,
          exportHasStadium:/psStGrass|ps-chip/.test(exportXML)||/psStGrass|ps-chip/.test(thumb),
          flags:document.querySelectorAll('#tiltGoals .corner-flag').length,
          frame:getComputedStyle(svg).boxShadow};
      });
      assert.equal(r.unchanged,true);assert.equal(r.sameNode,true);assert.equal(r.sameSelection,true);assert.equal(r.saves,0);assert.equal(r.renders,0);
      assert.equal(r.exportHasDepth,false);assert.equal(r.exportHasSelection,false);assert.equal(r.thumbHasDepth,false);assert.equal(r.thumbHasSelection,false);assert.equal(r.tokens,5);assert.equal(r.goalVisible,true);
      // 3.009 — the 3D view is a stadium: grass, boards and stands around the pitch, white goals and lines on every pitch theme,
      // white chips with the player's name. None of it reaches pictures or exports.
      assert.equal(r.goalColor,'rgb(255, 255, 255)');assert.equal(r.chips,2);assert.equal(r.names,'A,B');
      assert.equal(r.stage,'rgb(5, 8, 6)');
      // The stadium is one picture (an SVG image): it must decode, and carry the grass, boards, crowd and dugouts.
      const pic=await page.evaluate(async()=>{const im=document.querySelector('#tiltSurface img.tilt-stadium');if(!im)return null;let ok=false;try{await im.decode();ok=true;}catch(_){}
        const sv=decodeURIComponent(im.src.slice(im.src.indexOf(',')+1)),b=im.getBoundingClientRect();
        return {ok,grass:sv.includes('fill="url(#psStGrass)"'),boards:(sv.match(/>PROCESS STUDIO</g)||[]).length,crowd:/id="psStCrowd"[^>]*><image /.test(sv),dugouts:(sv.match(/stroke-dasharray/g)||[]).length,w:b.width,h:b.height};});
      assert.ok(pic&&pic.ok,'the stadium picture decodes');assert.equal(pic.grass,true);assert.ok(pic.boards>=8,'ad boards around the pitch');
      assert.equal(pic.crowd,true,'stands carry the crowd texture');assert.ok(pic.dugouts>=2,'two technical areas by the dugouts');assert.ok(pic.w>0&&pic.h>0);
      assert.ok(r.line.match(/\d+/g).slice(0,3).every(v=>+v>=230),'pitch lines are light on the stadium grass: '+r.line);assert.equal(r.exportHasStadium,false);
      assert.equal(r.flags,4,'a corner flag stands at each corner');assert.equal(r.frame,'none','no card border line across the tilted board');
      await page.evaluate(()=>{sel=null;multiSel=[];renderTokens();updateDelUI();});
      await page.screenshot({path:path.join(out,`${viewport.width}-${theme}-${orientation}.png`)});
      results.push({width:viewport.width,theme,orientation,...r});
    }
    const before=await page.evaluate(()=>({x:state.players[0].x,y:state.players[0].y}));
    // 3.009 — players are 3D chips: grab the raised top (its name above is part of the chip too).
    const box=await page.locator('.token[data-id="depth-a"] .ps-chip .ps-chip-top').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/3);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/3+25,{steps:8});await page.mouse.up();
    const after=await page.evaluate(()=>({x:state.players[0].x,y:state.players[0].y}));assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>8,'raised face remains draggable');
    const variants=await page.evaluate(()=>{
      const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="orange"/></svg>');
      setTokShape('shirt');state.players[0].img=photo;state.players[0].rot=90;state.players[1].color='#238c71';state.players[1].rot=90;state.players[1].scale=1.4;renderTokens();
      const p=tokenLayer.querySelector('[data-id="depth-a"]'),shirt=tokenLayer.querySelector('[data-id="depth-b"]');
      const before=JSON.stringify(captureSnap()),saved=boardImageXML().xml;
      const cone=state.equipment[0],g=tokenLayer.querySelector('[data-id="cone-a"]'),coneBefore=g.querySelector('.ps-equipment-mesh').innerHTML;cone.rot=90;g.setAttribute('transform',tokenTransform(cone));PSBoardDepth.update(g,cone);
      return {photo:p.querySelector('image').getAttribute('href')===photo,shirt:shirt.querySelector('.tok-c').tagName==='path',color:shirt.querySelector('.tok-c').getAttribute('fill'),face:p.querySelector('.ps-depth-face').getAttribute('transform'),chip:shirt.querySelector('.ps-chip').getAttribute('transform'),kit:shirt.querySelector('.ps-chip .ps-chip-top').getAttribute('fill'),kitShape:shirt.querySelector('.ps-chip').getAttribute('data-shape'),exportPhoto:saved.includes('data:image/svg+xml'),rotatedCone:g.querySelector('.ps-equipment-mesh').innerHTML!==coneBefore};
    });
    assert.equal(variants.photo,true);assert.equal(variants.shirt,true);assert.equal(variants.color,'#238c71');assert.equal(variants.exportPhoto,true);assert.match(variants.face,/translate\(-13,/);assert.equal(variants.rotatedCone,true);
    assert.match(variants.chip,/^rotate\(-90\) scale\(/,'the stadium chip stays upright on a rotated token');assert.equal(variants.kit,'#238c71','the 3D shirt keeps the token colour');assert.equal(variants.kitShape,'shirt','the shirt shape stands as a 3D shirt');
    // 3.009 — every player shape has its 3D form; a shaper's beak turns with its heading without rebuilding the chip.
    const shapes=await page.evaluate(()=>{
      state.players[0].img=null;state.players[0].rot=0;state.players[1].rot=0;const out={};
      for(const s of ['shirt','circle','shaper']){setTokShape(s);renderTokens();renderVision();
        const g=tokenLayer.querySelector('[data-id="depth-b"]');out[s]={shape:g.querySelector('.ps-chip').getAttribute('data-shape'),turns:g.querySelectorAll('.ps-chip-turn').length};}
      const g=tokenLayer.querySelector('[data-id="depth-b"]'),before=g.querySelector('.ps-chip-turn').getAttribute('transform');
      state.ball.x-=260;state.ball.y+=170;renderVision();
      out.turned=g.querySelector('.ps-chip-turn').getAttribute('transform')!==before;out.sameNode=g===tokenLayer.querySelector('[data-id="depth-b"]');
      out.flatBeak=getComputedStyle(document.querySelector('#visionLayer .ps-shaper')).display;
      out.label=document.querySelector('#tiltSeg [data-t="1"]').textContent;
      out.exportBeak=boardImageXML().xml.includes('ps-shaper');setTokShape('circle');renderTokens();return out;});
    assert.deepEqual([shapes.shirt.shape,shapes.circle.shape,shapes.shaper.shape],['shirt','circle','shaper']);
    assert.equal(shapes.circle.turns,0);assert.ok(shapes.shaper.turns>=2,'the shaper teardrop is stacked and turns');
    assert.equal(shapes.turned,true,'the beak follows the ball');assert.equal(shapes.sameNode,true,'turning does not rebuild the chip');
    assert.equal(shapes.flatBeak,'none','the flat beak hides under the 3D chip');assert.equal(shapes.exportBeak,true,'pictures keep the flat beak');
    assert.equal(shapes.label,'3D');
    // 3.009 — the board's size steps work on the 3D view too (the readable minimum used to swallow the first three steps).
    const sizes=await page.evaluate(()=>{const w=()=>tokenLayer.querySelector('[data-id="depth-b"] .ps-chip-top').getBoundingClientRect().width;
      resetTokenSize();const a=w();scaleAll(1.15);const b=w();scaleAll(1.15);const c=w();resetTokenSize();return {a,b,c};});
    // 3.016 — by the square root of the step («3D 토큰이 너무 커졌다»): ×1.25 → ×1.12, ×1.24 → ×1.11
    assert.ok(Math.abs(sizes.b/sizes.a-Math.sqrt(1.25))<.03,'one step up makes the 3D chip √1.25× '+JSON.stringify(sizes));
    assert.ok(sizes.c>sizes.b*1.07,'the next step grows it again');
    // 3.010 — name label size/style on the 3D chip · 3D options (camera · stadium · ad text, device settings) · «내 설정» presets.
    const t3=await page.evaluate(async()=>{const out={},g=()=>tokenLayer.querySelector('[data-id="depth-b"]'),font=()=>+g().querySelector('.ps-chip-name').getAttribute('data-font');
      __setNameSize('m');__setNameStyle('auto');const f0=font();out.pill0=!!g().querySelector('.ps-chip-namebg');
      __setNameSize('l');out.fk=font()/f0;__setNameStyle('pill');out.pill=!!g().querySelector('.ps-chip-namebg');
      __setNameStyle('text');out.pillText=!!g().querySelector('.ps-chip-namebg');__setNameSize('m');__setNameStyle('auto');
      const img=()=>document.querySelector('#tiltSurface img.tilt-stadium'),xml=()=>decodeURIComponent(img().src.slice(img().src.indexOf(',')+1));
      try{const p=document.getElementById('cmd-board-settings-pop');if(p&&p.__psSelectTab)p.__psSelectTab('view');}catch(_){}   /* 3.036 — 3D 줄은 «내 화면» 탭에 산다(기본 탭은 운동장) */
      const row=()=>getComputedStyle(document.getElementById('tiltCamRow')).display;out.rowOn=row();
      out.cam={};for(const c of ['low','mid','high']){__setTilt3dOpt('cam',c);out.cam[c]={ax:document.documentElement.style.getPropertyValue('--tilt-ax'),tf:getComputedStyle(svg).transform};}
      __setTilt3dOpt('cam','mid');
      out.deco={};for(const d of ['full','simple','grass']){__setTilt3dOpt('deco',d);const x=xml();out.deco[d]={crowd:x.includes('psStCrowd'),boards:x.includes('>PROCESS STUDIO<'),bench:x.includes('#18212a'),k:+getComputedStyle(document.documentElement).getPropertyValue('--tilt-k')};}
      __setTilt3dOpt('deco','full');__setTilt3dOpt('ad','A<B & "C"');const ax=xml();out.adEsc=ax.includes('>A&lt;B &amp; &quot;C&quot;<')&&!ax.includes('PROCESS STUDIO');
      try{await img().decode();out.adDecodes=true;}catch(_){out.adDecodes=false;}
      __setTilt3dOpt('ad','');out.adBack=xml().includes('>PROCESS STUDIO<');
      out.stored=JSON.parse(localStorage.getItem('ps_tilt3d_opts_v1')||'null');
      __setTilt(false);out.rowOff=row();__setTilt(true);
      localStorage.removeItem('ps_board_look_presets_v1');const pos=JSON.stringify(state.players.map(p=>[p.x,p.y]));
      __setNameSize('l');out.saved=__lookPresets.save('  경기   분석 ');__setNameSize('s');
      out.applied=__lookPresets.apply('경기 분석')&&window.__nameSize;out.samePlayers=JSON.stringify(state.players.map(p=>[p.x,p.y]))===pos;
      out.names=__lookPresets.list().map(x=>x.name);out.removed=__lookPresets.remove('경기 분석')&&__lookPresets.list().length;__setNameSize('m');
      return out;});
    assert.equal(t3.pill0,false,'3D «기본» name is an outlined name');assert.ok(Math.abs(t3.fk-1.25)<.01,'«크게» = 1.25× '+t3.fk);
    assert.equal(t3.pill,true,'«알약» puts the 3D name on a pill');assert.equal(t3.pillText,false);
    assert.notEqual(t3.rowOn,'none','3D rows show in 3D');assert.equal(t3.rowOff,'none','3D rows hide on the flat board');
    assert.deepEqual([t3.cam.low.ax,t3.cam.mid.ax,t3.cam.high.ax],['36deg','','12deg'],'낮게 = more oblique · 보통 = 3.009 · 높게 = from above');
    assert.ok(new Set(Object.values(t3.cam).map(c=>c.tf)).size===3,'the camera changes the board transform');
    assert.deepEqual([t3.deco.full.crowd,t3.deco.simple.crowd,t3.deco.grass.crowd],[true,false,false],'stands only in «전체»');
    assert.deepEqual([t3.deco.full.boards,t3.deco.simple.boards,t3.deco.grass.boards],[true,true,false],'boards in «전체»·«간단»');
    assert.deepEqual([t3.deco.simple.bench,t3.deco.grass.bench],[true,false]);
    assert.ok(t3.deco.grass.k>t3.deco.full.k,'less stadium → bigger pitch '+JSON.stringify(t3.deco));
    assert.equal(t3.adEsc,true,'ad text is escaped');assert.equal(t3.adDecodes,true,'the stadium picture still decodes');assert.equal(t3.adBack,true,'empty → PROCESS STUDIO');
    assert.deepEqual(t3.stored,{cam:'mid',deco:'full',ad:'',mood:'night',brand:false},'device setting');   /* 3.029 — 분위기 · 팀 브랜딩도 같은 기기 설정에 */
    assert.equal(t3.saved,true);assert.deepEqual(t3.names,['경기 분석'],'names are trimmed');assert.equal(t3.applied,'l','applying restores the saved look');
    assert.equal(t3.samePlayers,true,'a preset never moves players');assert.equal(t3.removed,0);
    if(viewport.width===1280){   // typing in the ad box never reaches the board's shortcuts (tool keys, delete)
      await page.evaluate(()=>{__setTilt(true);const p=document.getElementById('cmd-board-settings-pop');if(p&&getComputedStyle(p).display==='none')__psToggleBoardSettings('toggle');p.__psSelectTab('view');});
      await page.waitForTimeout(400);   // the panel moves focus to its tab when it opens
      await page.click('#tiltAdInput');
      const before=await page.evaluate(()=>{selectItem('player',state.players[0]);const i=document.getElementById('tiltAdInput');i.value='';i.focus();return [state.players.length,state.tool,document.activeElement.id];});
      assert.equal(before[2],'tiltAdInput','the ad box takes focus in 3D');
      await page.keyboard.type('FC v');await page.keyboard.press('Backspace');await page.keyboard.press('Delete');await page.keyboard.press('Enter');
      const after=await page.evaluate(()=>{const r=[state.players.length,state.tool,window.__tilt3d.ad,document.activeElement.id];__setTilt3dOpt('ad','');__psToggleBoardSettings('toggle');return r;});
      assert.deepEqual(after.slice(0,2),before.slice(0,2),'no player deleted, no tool switched '+JSON.stringify(after));
      assert.equal(after[2],'FC ','Enter saves the text');assert.notEqual(after[3],'tiltAdInput','Enter leaves the box');
    }
    for(const theme of ['navy','white','train']){
      const equipment=await page.evaluate(theme=>{
        __setTilt(false);state.players=[];state.ball=null;state.orientation='h';document.documentElement.dataset.pitch=theme;
        state.equipment=PSBoardDepth.equipmentTypes.map((team,i)=>({id:'mesh-'+team,team,x:150+i%5*170,y:180+Math.floor(i/5)*210,color:/goal/.test(team)?undefined:'#ed8b23',rot:i%3===0?25:0,locked:team==='pole'}));
        sel=null;multiSel=[];buildPitch();renderTokens();
        const before=JSON.stringify(captureSnap()),flat=Array.from(tokenLayer.children).map(g=>g.innerHTML);
        __setTilt(true);__tiltFit();
        const clone=tokenLayer.cloneNode(true);PSBoardDepth.flattenAll(clone);
        const restored=Array.from(clone.children).map(g=>g.innerHTML);
        const meshes=Array.from(tokenLayer.querySelectorAll('.ps-equipment-mesh')).map(g=>({type:g.dataset.equipment,faces:g.querySelectorAll('polygon,polyline').length,width:g.getBBox().width,height:g.getBBox().height}));
        const xml=boardImageXML().xml;
        return {before,after:JSON.stringify(captureSnap()),flat,restored,meshes,exportMesh:xml.includes('ps-equipment-mesh'),lockVisible:!!tokenLayer.querySelector('[data-id="mesh-pole"] .ps-depth-face > .tok-lock')};
      },theme);
      assert.equal(equipment.before,equipment.after);assert.deepEqual(equipment.restored,equipment.flat);
      assert.equal(equipment.meshes.length,15);assert.equal(equipment.exportMesh,false);assert.equal(equipment.lockVisible,true);
      for(const m of equipment.meshes){assert.ok(m.faces>=10,m.type);assert.ok(m.width>0&&m.height>0&&Number.isFinite(m.width+m.height),m.type);}
      await page.screenshot({path:path.join(out,viewport.width+'-equipment-'+theme+'.png')});
      if(viewport.width===1280&&theme==='white'){
        for(const m of equipment.meshes.filter(m=>m.type!=='pole')){
          const point=await page.evaluate(type=>{
            const mesh=tokenLayer.querySelector('[data-id="mesh-'+type+'"] .ps-equipment-mesh'),b=mesh.getBoundingClientRect();
            let best=null;
            const hits=(x,y)=>document.elementFromPoint(x,y)?.closest('.ps-equipment-mesh')===mesh;
            for(let iy=1;iy<30;iy++)for(let ix=1;ix<30;ix++){
              const x=Math.round(b.x+b.width*ix/30),y=Math.round(b.y+b.height*iy/30);
              if(!hits(x,y))continue;
              const score=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>hits(x+dx,y+dy)).length;
              if(!best||score>best.score)best={x,y,score};
            }
            return best;
          },m.type);
          assert.ok(point,m.type+' has a visible draggable surface');
          const before=await page.evaluate(type=>{clearBoardHistory();const p=state.equipment.find(p=>p.team===type);return {x:p.x,y:p.y};},m.type);
          await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+15,point.y+10,{steps:4});await page.mouse.up();
          const after=await page.evaluate(type=>{const p=state.equipment.find(p=>p.team===type),r={x:p.x,y:p.y};undoLast();return r;},m.type);
          assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>5,m.type+' moves from its mesh surface '+JSON.stringify({point,before,after}));
        }
      }

    }
    await page.evaluate(()=>__setTilt(false));assert.equal(await page.locator('.token[data-depth]').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,results},null,2));}
console.log(JSON.stringify({engine,cases:results.length,passed:true}));
