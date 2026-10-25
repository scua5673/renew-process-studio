import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS} from '../fixtures/team-app.mjs';

// Real shell and SVG image, synthetic account/API only. In particular, the
// portrait case covers both perspective hit testing and Safari's affine paint.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'supported browser engine');
const fx=await startFixture(),browsers={},results=[];
const modes=[
  {name:'desktop',orientation:'h',ctx:SIZES.desktop.ctx,cams:['mid']},
  {name:'ipad-portrait',orientation:'v',ctx:{...SIZES.ipad.ctx,viewport:{width:834,height:1194},screen:{width:834,height:1194},deviceScaleFactor:2},cams:['mid','low']}
];
async function settle(frame){
  let previous='';
  for(let n=0;n<8;n++){
    const key=await frame.evaluate(async()=>{
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const image=document.querySelector('#tiltSurface .tilt-stadium');if(image)await image.decode();
      return [image?.__sig,svg.getAttribute('style'),document.querySelector('#boardStage').clientWidth,document.querySelector('#boardStage').clientHeight].join('|');
    });
    if(key===previous)return;previous=key;
  }
  throw new Error('stadium layout did not settle');
}
async function picture(frame){return frame.evaluate(()=>{const i=document.querySelector('#tiltSurface .tilt-stadium');return {src:i.src,vb:i.__psVb.slice(),ground:i.__psGround};});}

try{
  for(const mode of modes){
    const size='stadiumGround-'+mode.name;SIZES[size]={engine,ctx:mode.ctx};
    const {page,context,logs}=await openApp(fx,size,{browsers,dark:true,tilt3d:true,init:{fn:()=>{
      localStorage.setItem('ps_tilt3d_touch_reset_v1','1');localStorage.setItem('ps_pad_scale_v1','m');
      localStorage.setItem('ps_tilt3d_opts_v1',JSON.stringify({cam:'mid',deco:'full',mood:'night',brand:false}));
    }}});
    try{
      await page.evaluate(()=>window.__psShowApp('board'));
      const frame=await page.locator('#fBoard').elementHandle().then(e=>e.contentFrame());
      await frame.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);
      await frame.evaluate(orientation=>{
        boardShowDefault();const p=PR(),s=captureSnap();
        s.players=[{id:'ground-blue',team:'blue',num:8,name:'',x:p.CX-90,y:p.CY},{id:'ground-red',team:'red',num:9,name:'',x:p.CX+90,y:p.CY}];
        s.equipment=[];s.drawings=[];s.gridType='off';loadSnap(s);
        __setPitchSpec('fifa');__setBoardOrient(orientation);__setTilt(true,{quiet:true});
        __setTilt3dOpt('cam','mid');__setTilt3dOpt('deco','full');__setTilt3dOpt('mood','night');__tiltFit();
      },mode.orientation);
      await settle(frame);const full=await picture(frame);assert.equal(full.ground,null,'full retains its original image');
      await frame.evaluate(()=>__setPitchSpec('grid30'));await settle(frame);
      const blank=await picture(frame);assert.equal(blank.ground,null,'blank grid retains its existing bleed');
      await frame.evaluate(()=>__setPitchSpec('fifa'));

      for(const deco of ['simple','grass'])for(const cam of mode.cams){
        await frame.evaluate(({deco,cam})=>{__setTilt3dOpt('deco',deco);__setTilt3dOpt('cam',cam);__tiltFit();},{deco,cam});
        await settle(frame);
        const parent=await page.evaluate(()=>{const r=document.querySelector('#fBoard').getBoundingClientRect(),v=visualViewport;return {left:r.left,top:r.top,width:r.width,height:r.height,vleft:v?.offsetLeft||0,vtop:v?.offsetTop||0,vright:(v?.offsetLeft||0)+(v?.width||innerWidth),vbottom:(v?.offsetTop||0)+(v?.height||innerHeight)};});
        const m=await frame.evaluate(parent=>{
          const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
          const stage=document.querySelector('#boardStage'),r=stage.getBoundingClientRect(),cs=getComputedStyle(stage),sx=parent.width/innerWidth,sy=parent.height/innerHeight;
          const clip={left:Math.max(r.left+(parseFloat(cs.paddingLeft)||0),0,(parent.vleft-parent.left)/sx),right:Math.min(r.right-(parseFloat(cs.paddingRight)||0),innerWidth,(parent.vright-parent.left)/sx),top:Math.max(r.top+(parseFloat(cs.paddingTop)||0),0,(parent.vtop-parent.top)/sy),bottom:Math.min(r.bottom-(parseFloat(cs.paddingBottom)||0),innerHeight,(parent.vbottom-parent.top)/sy)};
          const image=document.querySelector('#tiltSurface .tilt-stadium'),ground=image.__psGround,b=ground.box,flat=world.getScreenCTM().inverse();
          const corners=[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]];
          const points=corners.flatMap(([x,y])=>[bcUnproject(x,y),{x:flat.a*x+flat.c*y+flat.e,y:flat.b*x+flat.d*y+flat.f}]);
          const covered=points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=b[0]-.01&&p.x<=b[2]+.01&&p.y>=b[1]-.01&&p.y<=b[3]+.01);
          const doc=new DOMParser().parseFromString(decodeURIComponent(image.src.slice(image.src.indexOf(',')+1)),'image/svg+xml'),rects=[...doc.querySelectorAll('[data-ps-ground] rect')];
          const painted=rects.length>0&&rects.every(e=>+e.getAttribute('x')===b[0]&&+e.getAttribute('y')===b[1]&&+e.getAttribute('width')===b[2]-b[0]&&+e.getAttribute('height')===b[3]-b[1]);
          const p=PR(),probe=el('rect',{x:p.L,y:p.T,width:p.PW,height:p.PH,fill:'none','pointer-events':'none'});world.appendChild(probe);const pitch=box(probe);probe.remove();
          const goals=[...document.querySelectorAll('#tiltGoals .goal-plane')].filter(e=>e.getBoundingClientRect().width>.01&&e.getBoundingClientRect().height>.01).map(e=>({kind:e.className,box:box(e)}));
          const original={node:image,src:image.src,vb:JSON.stringify(image.__psVb),ground:JSON.stringify(ground)};
          renderTokens();tiltGoalsSync();
          const sameImage=image===document.querySelector('#tiltSurface .tilt-stadium')&&image.src===original.src;
          const camera=_t3Camera(720,1280,_exportPitchBox(),{ax:__tiltCamNow().ax,sy:__tiltCamNow().sy,pads:__tiltPadsNow()}),visible=_t3Visible(camera);
          const view=PSStadiumGround.exportView(image,visible),v=view.vb,again=PSStadiumGround.exportView(image,visible.slice());
          return {covered,painted,points:points.length,images:document.querySelectorAll('#tiltSurface .tilt-stadium').length,sameImage,pitch,clip,goals,exportCovered:v[0]<=visible[0]&&v[1]<=visible[1]&&v[0]+v[2]>=visible[2]&&v[1]+v[3]>=visible[3],exportCached:view===again,liveUnchanged:image===original.node&&image.src===original.src&&JSON.stringify(image.__psVb)===original.vb&&JSON.stringify(image.__psGround)===original.ground};
        },parent);
        const tag=[engine,mode.name,deco,cam].join(' '),within=(a,b)=>a.left>=b.left-1.5&&a.right<=b.right+1.5&&a.top>=b.top-1.5&&a.bottom<=b.bottom+1.5;
        assert.equal(m.points,8,tag+' tests both actual projection paths');
        assert.ok(m.covered&&m.painted,tag+' serialized ground covers every stage corner');
        assert.equal(m.images,1,tag+' single cached stadium image');assert.ok(m.sameImage,tag+' player rendering reuses the cached image');
        assert.ok(within(m.pitch,m.clip),tag+' entire pitch remains visible '+JSON.stringify({pitch:m.pitch,clip:m.clip}));
        assert.equal(m.goals.filter(g=>g.kind.includes('goal-front')).length,2,tag+' both goals remain');
        assert.ok(m.goals.every(g=>within(g.box,m.clip)),tag+' goals remain inside the visible frame');
        assert.ok(m.exportCovered&&m.exportCached&&m.liveUnchanged,tag+' portrait export covers its camera without modifying the live image');
        results.push({mode:mode.name,deco,cam,passed:true});
      }
      await frame.evaluate(()=>{__setTilt3dOpt('cam','mid');__setTilt3dOpt('deco','full');});await settle(frame);
      const restored=await picture(frame);assert.equal(restored.ground,null);assert.equal(restored.src,full.src,mode.name+' original full SVG is restored');assert.deepEqual(restored.vb,full.vb);
      await frame.evaluate(()=>__setPitchSpec('grid30'));await settle(frame);
      const restoredBlank=await picture(frame);assert.equal(restoredBlank.ground,null);assert.equal(restoredBlank.src,blank.src,mode.name+' original blank SVG is restored');assert.deepEqual(restoredBlank.vb,blank.vb);
      const passThrough=await frame.evaluate(()=>{const h=document.querySelector('#tiltSurface .tilt-stadium'),v=PSStadiumGround.exportView(h,[-2000,-2000,3000,3000]);return {sameSrc:v.src===h.src,sameVb:JSON.stringify(v.vb)===JSON.stringify(h.__psVb)};});assert.ok(passThrough.sameSrc&&passThrough.sameVb,'blank export preserves its source');
      assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[],'no app errors');
    }catch(error){await page.screenshot({path:path.join(SHOTS,'board-stadium-ground-'+engine+'-'+mode.name+'-failure.png')}).catch(()=>{});throw error;}
    finally{await context.close();delete SIZES[size];}
  }
  console.log(JSON.stringify({engine,test:'board-stadium-ground',cases:results.length,passed:true,results}));
}finally{for(const browser of Object.values(browsers))await browser.close();await fx.close();}
