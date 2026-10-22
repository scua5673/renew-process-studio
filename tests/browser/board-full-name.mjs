import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,ready,SHOTS,SIZES} from '../fixtures/team-app.mjs';

// Report 0c4599ff: actual keyboard input must not stop at 40 characters.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
const name='Process FC Player With A Complete Long Display Name '+ '가나다라마바사아자차카타파하';
try{
  for(const width of [375,393,768,1280]){
    const size=engine==='webkit'?(width<768?'phone':'ipad'):'desktop';
    // Mobile WebKit keeps its original device width on resize: create each screen at its actual width.
    SIZES[size].ctx.viewport={width,height:850};SIZES[size].ctx.screen={width,height:850};
    const {page,context,logs}=await openApp(fx,size,{browsers,tilt3d:false});
    async function board(){
      if(await page.evaluate(()=>document.body.classList.contains('ps-team-open'))){
        await page.locator('#teamBottom [data-tb="more"]').click();
        await page.locator('#teamMoreSheet [data-tb-app="board"]').click();
      }
      await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
      const f=await (await page.waitForSelector('#fBoard')).contentFrame();
      await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&window.__psPages);
      return f;
    }
    let f=await board();
    await f.evaluate(()=>{
      state.players=[{id:701,team:'blue',num:'7',x:600,y:350},{id:702,team:'red',num:'9',name:'다른 선수',x:300,y:450}];
      state.drawings=[];renderTokens();
      document.getElementById('animAdd').click();document.getElementById('animAdd').click();
      selectAnimFrame(0);sel={type:'player',ref:state.players.find(p=>p.id===701)};window.__selPanelOpen(true);
    });
    await f.locator('#nameInput').fill('');
    await f.locator('#nameInput').focus();await page.keyboard.type(name);
    assert.equal(await f.locator('#nameInput').inputValue(),name,'real keyboard accepts the whole name');
    await f.locator('#nameInput').press('Enter');
    const names=()=>f.evaluate(()=>({name:state.players.find(p=>p.id===701).name,other:state.players.find(p=>p.id===702).name,scenes:anim.frames.map(fr=>fr.snap.players.find(p=>p.id===701).name)}));
    let actual=await names();assert.equal(actual.name,name);assert.equal(actual.other,'다른 선수');
    assert.ok(actual.scenes.length>=2&&actual.scenes.every(n=>n===name),'all animation scenes preserve the name');
    const exported=await f.evaluate(()=>{const o=boardImageXML(),d=new DOMParser().parseFromString(o.xml,'image/svg+xml');return {names:[...d.querySelectorAll('text')].map(t=>t.textContent),error:!!d.querySelector('parsererror')};});
    assert.equal(exported.error,false);assert.ok(exported.names.includes(name),'export keeps the full label');
    await f.evaluate(()=>{sel={type:'player',ref:state.players.find(p=>p.id===701)};window.__selPanelOpen(true);});
    await f.locator('#nameInput').waitFor({state:'visible'});
    const metrics=await f.locator('#nameInput').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,viewport:innerWidth,value:e.value};});
    const layoutWidth=await page.evaluate(()=>innerWidth);
    assert.equal(page.viewportSize().width,width,'the physical viewport matches the requested screen');
    // iPad intentionally uses the existing desktop layout viewport (at least 1100px).
    if(size!=='ipad')assert.equal(layoutWidth,width);
    assert.equal(metrics.value,name);assert.ok(metrics.width>0&&metrics.left>=-1&&metrics.right<=metrics.viewport+1,JSON.stringify(metrics));
    await page.screenshot({path:path.join(SHOTS,'board-full-name-'+width+'-'+engine+'.png')});
    await f.locator('#nameInput').press('Tab');
    assert.equal(await f.evaluate(()=>__boardSaveExplicit()),true);
    await page.reload();await ready(page);f=await board();actual=await names();
    assert.equal(actual.name,name);assert.ok(actual.scenes.every(n=>n===name),'reload preserves all scenes');
    assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
    console.log(JSON.stringify({engine,passed:true,characters:[...name].length,reload:true,export:true,width,layoutWidth}));
    await context.close();
  }
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
