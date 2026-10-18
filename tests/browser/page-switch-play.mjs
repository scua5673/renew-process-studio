import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.106(처음 고침 3.001, 합쳐지지 못했던 가지 bc816bd) — 장면을 재생하는 도중 페이지 띠로 다른 페이지를 누르면(보관함에서 연 세 페이지 작전판)
//  예전: 떠나는 페이지에 재생 중간 위치가 담기고, 재생이 끝날 때 그 페이지의 재생 전 판이 옮겨 간 페이지 위에 올라갔다
//        (장면 없는 페이지는 바로, 장면 있는 페이지는 그 페이지의 장면으로 재생이 이어지다 끝날 때). 저장하면 그 페이지가 남의 판으로 덮였다.
//  이제: 옮기기 전에 재생을 멈춰 재생 전 판으로 돌린다 — 두 페이지 다 제 판 그대로다.
//  («둘러보기만 해도 변경 있음»은 이 시험이 보지 않는다 — 페이지 띠를 누르면 지금도 켜진다. 나가기 전에 끈다)
// 크롬 = 데스크톱, 웹킷 = 아이패드(둘 다 페이지 띠가 페이지 고르개). PS_SIZE 로 하나만 고를 수 있다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',sizes=process.env.PS_SIZE?[process.env.PS_SIZE]:(engine==='webkit'?['ipad']:['desktop']);
for(const size of sizes)await run(size);
async function run(size){
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&typeof renderTokens==='function');
  const shot=n=>page.screenshot({path:path.join(SHOTS,`page-switch-play-${engine}-${size}-${n}.png`)});
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await bf.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:12000});
  // A: 장면 셋(x 200 → 500 → 800) · B: 장면 둘(600 → 900) · C: 장면 없음(300)
  await bf.evaluate(async()=>{ const lib=await libGet(),sn=x=>({players:[{id:1,team:'blue',num:8,x:x,y:300}],equipment:[],drawings:[],ball:null,pitchN:1}),fr=x=>({snap:sn(x),dur:1});
    lib.unshift({libId:'VPAGEPLAY',type:'board',name:'재생 중 옮기기',folder:'',thumb:'',tags:[],savedAt:Date.now(),snap:sn(200),pages:[
      {name:'A',snap:sn(200),thumb:'',anim:{frames:[fr(200),fr(500),fr(800)],active:0,hold:.6,title:'',titleColor:''}},
      {name:'B',snap:sn(600),thumb:'',anim:{frames:[fr(600),fr(900)],active:0,hold:.6,title:'',titleColor:''}},
      {name:'C',snap:sn(300),thumb:''}]});
    await libWrite(lib); try{libTouch();}catch(_){} try{renderDrillFiles();}catch(_){} });
  await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes('재생 중 옮기기')),null,{timeout:12000});
  const open=async()=>{ await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('재생 중 옮기기')); [...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click(); });
    await bf.waitForFunction(()=>window.__csView==='board'&&window.__vaultEdit&&!window.__vaultHydrating&&document.querySelectorAll('#boardPageStrip .bp-tab').length===3,null,{timeout:12000}); await page.waitForTimeout(800); };
  const now=()=>bf.evaluate(()=>({idx:window.__psPages.pageInfo().idx,x:state.players[0]&&state.players[0].x,playing:animPlaying}));
  const pageA=()=>bf.evaluate(()=>{ const p=window.__psPages.exportList(); return p&&p[0].frames.map(f=>f.snap.players[0].x); });
  const asking=()=>bf.evaluate(()=>!![...document.body.children].find(e=>e.tagName==='DIV'&&/버리고 나갈까요/.test(e.textContent)));
  const left=()=>bf.waitForFunction(()=>window.__csView==='session'&&!window.__vaultEdit,null,{timeout:12000});
  for(const [tab,name,x,scenes] of [[2,'C',300,0],[1,'B',600,2]]){
    await open();
    assert.deepEqual(await now(),{idx:0,x:200,playing:false});
    await bf.evaluate(()=>{ document.getElementById('animBar').classList.add('on'); selectAnimFrame(0); playAnim(); });
    await bf.waitForFunction(()=>animPlaying&&state.players[0].x>230,null,{timeout:8000});   /* 장면 1 → 2 로 움직이는 중 */
    await bf.click(`#boardPageStrip .bp-tab >> nth=${tab}`); await page.waitForTimeout(250);
    let st=await now(); console.log(name,'right after',JSON.stringify(st));
    assert.deepEqual(st,{idx:tab,x,playing:false},`page ${name} shows its own board and the play stopped`);
    await page.waitForTimeout(scenes?3500:800);   /* 예전엔 재생이 끝날 때 A 의 판이 여기 올라왔다 */
    st=await now(); assert.deepEqual(st,{idx:tab,x,playing:false},`page ${name} stays itself: `+JSON.stringify(st));
    assert.equal(await bf.evaluate(()=>anim.frames.length),scenes,`page ${name} has its own scenes`);
    assert.deepEqual(await pageA(),[200,500,800],'page A keeps its scenes — not a mid-play position');
    await bf.click('#boardPageStrip .bp-tab >> nth=0'); await page.waitForTimeout(400);
    assert.deepEqual(await now(),{idx:0,x:200,playing:false},'page A comes back on its first scene, before the play');
    await shot(name);
    await bf.evaluate(()=>{ window.__vaultManualDirty=false; });   /* 페이지 띠 누름이 켠 «변경 있음» — 이 시험의 대상이 아니다 */
    await bf.click('#vCreateCancel'); await page.waitForTimeout(300);
    assert.equal(await asking(),false,'leaving asks nothing'); await left();
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('page-switch-play ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
}
