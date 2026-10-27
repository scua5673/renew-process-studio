import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
try{
  const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,tilt3d:false});
  async function board(){
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard')).contentFrame();
    await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&window.PSBoardEdit);
    return f;
  }
  let f=await board();
  await f.addScriptTag({path:fileURLToPath(new URL('../fixtures/board-training-checks.js',import.meta.url))});
  const results=await f.evaluate(()=>PSBoardEditChecks.run());
  console.log(JSON.stringify(results));assert.deepEqual(results.filter(r=>!r.pass),[]);
  await f.evaluate(()=>PSBoardEditChecks.seed());
  await f.getByRole('button',{name:'배치 도구',exact:true}).click();
  await f.getByRole('button',{name:'훈련 조끼 주황',exact:true}).click();
  await f.getByLabel('편집 격자 간격',{exact:true}).selectOption('3');
  await f.getByLabel('격자·안내선에 맞추기',{exact:true}).check();
  await f.getByRole('button',{name:'배치 도구 닫기',exact:true}).click();
  await f.evaluate(()=>{const d=state.drawings[1];addText(d.pts[0],d);});
  await f.getByRole('button',{name:'아주 굵게',exact:true}).click();
  await f.getByRole('button',{name:'기울임',exact:true}).click();
  await f.getByLabel('텍스트 회전 각도',{exact:true}).fill('15');
  await f.getByRole('button',{name:'완료',exact:true}).click();
  for(const width of [375,768,1100,1280]){
    await page.setViewportSize({width,height:900});
    await f.getByRole('button',{name:'배치 도구',exact:true}).click();
    const bounds=await f.locator('#psEditTools').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,overflow:el.scrollWidth-el.clientWidth};});
    assert.ok(bounds.left>=0&&bounds.right<=bounds.width+1&&bounds.overflow<=1,JSON.stringify(bounds));
    await f.getByRole('button',{name:'배치 도구 닫기',exact:true}).click();
  }
  assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true);
  await page.reload({waitUntil:'domcontentloaded'});f=await board();
  assert.deepEqual(await f.evaluate(()=>({bibs:state.players.map(p=>p.bib),grid:window.__editGrid,text:PSBoardEdit.textStyle(state.drawings[1])})),{bibs:['#fb923c','#fb923c','#fb923c'],grid:3,text:{textWeight:400,textItalic:true,textAngle:15}});
  assert.equal(await f.locator('#tokenLayer .ps-bib').count(),3,'saved bibs are visible immediately after reload');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
