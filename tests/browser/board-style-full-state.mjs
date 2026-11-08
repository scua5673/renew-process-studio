import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const fx=await startFixture(),browsers={};
try{
  const {page}=await openApp(fx,'desktop',{browsers});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>!!window.__lookPresets&&!!window.__psPages);
  await page.waitForTimeout(1500);
  const result=await f.evaluate(()=>{
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const base=captureSnap();
    const saved={...base,orientation:'v',spFlip:true,pitchView:'half',pvSide:'opp',pitchN:2,
      players:[{id:701,team:'blue',num:'7',name:'테스트',x:210,y:320}],
      equipment:[{id:702,team:'cone',x:120,y:160}],ball:{x:330,y:240},drawings:[{type:'rect',color:'#fff',pts:[{x:100,y:100},{x:180,y:150}]}],
      teamColors:{blue:'#123456'},matchNote:'저장한 메모'};
    loadSnap(saved);const expected=captureSnap();
    const ok=__lookPresets.save('전체 상태');
    loadSnap({...base,orientation:'h',players:[],equipment:[],ball:null,matchNote:'다른 메모'});
    const before=captureSnap();
    const applied=__lookPresets.apply('전체 상태');
    const restored=same(captureSnap(),expected);
    undoLast();const undone=same(captureSnap(),before);
    const list=__lookPresets.list();list.push({name:'옛 스타일',look:expected,pitchTheme:expected.pitchTheme});
    localStorage.setItem('ps_board_look_presets_v1',JSON.stringify(list));
    const oldBefore=captureSnap();__lookPresets.apply('옛 스타일');
    const legacy=state.orientation===oldBefore.orientation&&same(state.players,oldBefore.players);
    return {ok,applied,restored,undone,legacy};
  });
  assert.deepEqual(result,{ok:true,applied:true,restored:true,undone:true,legacy:true});
  console.log('Full board style save/restore, undo and legacy compatibility passed');
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
