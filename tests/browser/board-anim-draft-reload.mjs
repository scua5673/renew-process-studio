/* 오류 제보 0976735a — 작전판에서 저장 안 한 애니메이션(장면)이 새로고침 뒤에도 «되살리기»로 돌아오는가.
   실제 조작(애니메이션 바 열기 · 장면 추가 · 토큰 끌기)으로 만들고, 다시 연 뒤 띠와 장면 수를 본다. */
import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES,A,WT,WP} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const browsers={},fx=await startFixture(),results=[];
const snap=x=>({players:[{id:'synthetic-anim-token',name:'가상 선수',num:8,team:'blue',x,y:330}],equipment:[],drawings:[],ball:null,pitchN:1,orientation:'h'});
const pages=[{id:'synthetic-page-a',name:'가상 첫 페이지',snap:snap(450),anim:{frames:[],active:-1}}];
const baseline=JSON.stringify({snap:snap(450),view:'board',matchActive:false,meetSlides:[],animFrames:null,animActive:0,boardPages:{idx:0,pages},boardLink:null,_savedAt:1000});
fx.db.set(WP+'|cs_private_board_v1',{workspace_id:WP,k:'cs_private_board_v1',v:baseline,cupd:1000,updated_by:A});
async function frame(page){
 await page.waitForFunction(({A})=>{
  const s=window.PSSync,w=document.getElementById('fBoard')?.contentWindow;
  return s&&s.dataUnlocked()&&s.session()?.uid===A&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!w.__boardRestoring;
 },{A},{timeout:45000});
 return (await page.$('#fBoard')).contentFrame();
}
async function dragToken(page,f,dx){
 const box=await f.evaluate(()=>{const fr=parent.document.getElementById('fBoard').getBoundingClientRect();const t=document.querySelector('#stage .player,#board .player,[data-player-id],g.player,.token');if(!t)return null;const r=t.getBoundingClientRect();return {x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2};});
 assert.ok(box,'선수 토큰을 찾지 못했다');
 await page.mouse.move(box.x,box.y);await page.mouse.down();await page.mouse.move(box.x+dx/2,box.y+10,{steps:4});await page.mouse.move(box.x+dx,box.y+20,{steps:4});await page.mouse.up();
}
const state=f=>f.evaluate(async()=>{
 const o=_boardPrivateOwner,key=boardDraftKey(o);let idb=null,ls=localStorage.getItem(key);try{const v=await storage.get(key);idb=v&&v.value;}catch(_){}
 const count=raw=>{try{const d=JSON.parse(raw);const p=JSON.parse(d.raw);const pg=p.boardPages&&p.boardPages.pages&&p.boardPages.pages[p.boardPages.idx||0];return {top:(p.animFrames||[]).length,page:pg&&pg.anim&&pg.anim.frames?pg.anim.frames.length:0};}catch(_){return null;}};
 let ready='ok';try{await psFlushPendingReady();}catch(e){ready=(e&&(e.psCode||e.message))||'fail';}
 return {frames:anim.frames.length,changed:boardManualChanged(),touched:_boardUserTouched,dirty:_boardManualDirty,snapshot:window.__psBoardDraft&&window.__psBoardDraft.snapshot(),idb:count(idb),ls:count(ls),ready,animBar:window.__animLive(),playing:animPlaying};
});
try{
 for(const [width,mode] of [[1280,'edit'],[1280,'playing'],[1280,'vault-first'],[768,'edit'],[768,'vault-first']]){
  if(process.env.PS_CASE&&process.env.PS_CASE!==width+'-'+mode)continue;
  SIZES.animdraft={engine,ctx:{viewport:{width,height:860},deviceScaleFactor:1}};
  const {page,context}=await openApp(fx,'animdraft',{browsers});
  try{
   await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
   let f=await frame(page);
   await page.waitForFunction(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count,null,{timeout:30000});
   const phone=width<700;
   if(phone){
    // 폰 작전판은 보기 전용이다 — 만들 수 없으니 잃을 것도 없다
    results.push({engine,width,mode,skipped:'phone-read-only',readOnly:await f.evaluate(()=>typeof psPhoneBoardReadOnly==='function'&&psPhoneBoardReadOnly())});
    continue;
   }
   await f.evaluate(()=>{if(!window.__animLive())document.getElementById('animToggle').click();});
   await f.waitForFunction(()=>window.__animLive(),null,{timeout:10000});
   await f.evaluate(()=>document.getElementById('animAdd').click());
   await dragToken(page,f,80);
   await f.evaluate(()=>document.getElementById('animAdd').click());
   await dragToken(page,f,80);
   await f.evaluate(()=>document.getElementById('animAdd').click());
   await page.waitForTimeout(1600);
   if(mode==='playing'){await f.evaluate(()=>playAnim());await page.waitForTimeout(300);}
   const before=await state(f);
   await page.reload();
   if(mode==='vault-first'){
    // 제보자의 길: 다시 열린 뒤 보관함을 먼저 보고(같은 작전판 틀을 빌려 쓴다) 작전판으로 간다
    await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]').click());
    f=await frame(page);await page.waitForTimeout(2500);
   }
   await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
   f=await frame(page);
   let bar=false;try{await f.waitForFunction(()=>!!document.getElementById('boardDraftBar'),null,{timeout:12000});bar=true;}catch(_){}
   let restored=null;
   if(bar){await f.evaluate(()=>document.querySelector('#boardDraftBar .bd-keep').click());await page.waitForTimeout(500);restored=await f.evaluate(()=>({frames:anim.frames.length,changed:boardManualChanged()}));}
   const after=await f.evaluate(()=>({frames:anim.frames.length,view:window.__csView}));
   let next=null;
   if(!bar&&process.env.PS_REPORT_ONLY){await dragToken(page,f,40);await page.waitForTimeout(1500);next=await state(f);}
   results.push({engine,width,mode,before:{frames:before.frames,ready:before.ready,idb:before.idb},bar,restored,after,next:next&&{ready:next.ready,idb:next.idb,ls:next.ls,snapshot:next.snapshot}});
   if(!process.env.PS_REPORT_ONLY){
    assert.equal(before.frames,3,'장면 셋을 만들었다');
    assert.equal(bar,true,width+' '+mode+': 다시 연 뒤 «저장하지 않은 작업» 띠');
    assert.equal(restored.frames,3,width+' '+mode+': 되살린 장면 수');
   }
  }finally{await context.close();}
 }
 console.log(JSON.stringify({ok:true,results},null,1));
}catch(e){console.log(JSON.stringify({ok:false,results},null,1));throw e;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
