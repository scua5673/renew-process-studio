import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};for(const s of Object.values(SIZES))s.engine=engine;
try{for(const width of (process.env.PS_WIDTHS||'375,393,768,1280').split(',').map(Number)){
 const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:900};
 const {page,context}=await openApp(fx,size,{browsers});await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());const f=await(await page.waitForSelector('#fBoard')).contentFrame();
 await f.waitForFunction(()=>window.__boardReady&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!!(_boardPrivateRecord?_boardPrivateRecord.base:_boardPrivateBase));
 await f.evaluate(()=>{__setTilt(false);boardShowDefault();state.tool='move';state.drawings=[{type:'rect',color:'#fff',pts:[{x:200,y:200},{x:300,y:300}]}];anim.frames=[];animActive=-1;document.getElementById('animAdd').click();document.getElementById('animAdd').click();document.getElementById('animAdd').click();selectAnimFrame(1);state.drawings[0].pts[0].x=240;renderDrawings();});
 await page.waitForTimeout(450);
 const before=await f.evaluate(()=>JSON.stringify(anim.frames[0]));
 await f.evaluate(()=>window.__psShapeMenu.open(state.drawings[0],100,130));
 await f.locator('#psShapeMenu [data-act=reset]').click();
 const result=await f.evaluate(()=>({x:anim.frames[2].snap.drawings[0].pts[0].x,same:JSON.stringify(anim.frames[0]),id:state.drawings[0]._sceneId}));assert.equal(result.x,240);assert.equal(result.same,before);assert.ok(result.id);
 await f.evaluate(()=>undoLast());assert.equal(await f.evaluate(()=>anim.frames[2].snap.drawings[0].pts[0].x),200);
 await f.evaluate(()=>{_afCtx=false;document.activeElement?.blur();});const last=await f.evaluate(()=>anim.frames.length-1);await page.keyboard.press('End');assert.equal(await f.evaluate(()=>animActive),last);await page.keyboard.press('Home');assert.equal(await f.evaluate(()=>animActive),0);
 await f.evaluate(()=>{selectAnimFrame(1);state.orientation='h';applyView();__setTilt(true);state.drawings=[];document.querySelector('#toolSeg [data-tool=text]').click();renderDrawings();});await page.waitForTimeout(250);
 const pos=await f.evaluate(()=>{const p={x:CX-65,y:H+20},m=document.createElementNS('http://www.w3.org/2000/svg','circle');m.setAttribute('cx',p.x);m.setAttribute('cy',p.y);m.setAttribute('r',1);world.appendChild(m);const r=m.getBoundingClientRect();m.remove();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 const box=await page.locator('#fBoard').boundingBox(),scale=engine==='webkit'&&width<1000?await page.evaluate(()=>visualViewport.scale):1;
 if(width<1000)await page.touchscreen.tap((box.x+pos.x)*scale,(box.y+pos.y)*scale);else await page.mouse.click(box.x+pos.x,box.y+pos.y);
 await f.locator('.ps-text-inline-editor').fill('벤치 위 합성 글',{timeout:5000});await page.keyboard.press('Home');assert.equal(await f.evaluate(()=>animActive),1,'typing keeps Home in the editor');await f.getByRole('button',{name:'완료',exact:true}).click();
 const text=await f.evaluate(()=>{const d=state.drawings.find(d=>d.type==='text');zOrderItems([d],true);const g=PSBoardText.node(d),r=g.getBoundingClientRect(),vb=__exportVB(),b=__exportLayerBBox(g);return{y:d.pts[0].y,outside:d.pts[0].y>H,hit:g.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),exportFits:b.y+b.height<=vb[1]+vb[3],xml:boardImageXML().xml.includes('벤치 위 합성 글')};});
 assert.equal(text.outside,true,JSON.stringify(text));assert.equal(text.hit,true,JSON.stringify(text));assert.equal(text.exportFits,true);assert.equal(text.xml,true);
 console.log(JSON.stringify({engine,width,reset:true,undo:true,homeEnd:true,benchText:true,exportFits:true}));await context.close();
}}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
