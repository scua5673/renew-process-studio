'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
/* 3.062 — 일정 거울(localStorage)이 IDB 정본보다 뒤처진 기기(아이패드 거울 쓰기 실패)에서 «오늘»이 정본을 읽는다. */
const src=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
const a=src.lastIndexOf('(function(){',src.indexOf("var SCHED_KEY='process_coach_v1'")),b=src.indexOf('})();',src.indexOf("try{ normalize(); }",a))+5;
const block=src.slice(a,b);
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const mon=(()=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const doc=t=>JSON.stringify({anchorMonday:mon,scheduleRev:1,weeks:{'0':[{t}]}});
function harness(mirror,idb){
  const ls=new Map();if(mirror!=null)ls.set('process_coach_v1',mirror);
  const events=[],listeners={};const box={idb,timers:[]};
  const win={
    localStorage:{getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,String(v))},
    storage:{get:async k=>{const v=box.idb;if(box.afterGet){box.afterGet();box.afterGet=null;}return v==null?null:{value:v};}},
    addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f);},
    dispatchEvent:e=>{events.push(e.type);return true;},
    CustomEvent:class{constructor(t,o){this.type=t;this.detail=o&&o.detail;}},
    setTimeout:(f,ms)=>{if(ms>=1000)setImmediate(f);else box.timers.push(f);return 0;},clearTimeout:()=>{},
    document:{addEventListener(){},visibilityState:'visible'},
    PSStorageDiagnostic(){},
  };
  win.window=win;win.psSaveShared=(k,v)=>{ls.set(k,v);return true;};
  vm.createContext(win);vm.runInContext(block,win);
  return {S:win.PSSchedule,ls,box,events,fire:(k)=>(listeners.storage||[]).forEach(f=>f({key:k}))};
}
test('stale mirror: reads the IDB copy after a stable second look and announces it', async()=>{
  const h=harness(doc('old'),doc('new'));
  assert.equal(h.S.read().weeks['0'][0].t,'old');
  assert.equal(await h.S.check(),true);
  assert.equal(h.S.read().weeks['0'][0].t,'new');
  assert.equal(h.S.view('').weeks['0'][0].t,'new');
  assert.equal(JSON.parse(h.S.raw()).weeks['0'][0].t,'new');
  assert.deepEqual(h.events,['ps-schedule-source']);
});
test('missing mirror: reads the IDB copy', async()=>{
  const h=harness(null,doc('idb'));
  assert.equal(h.S.read(),null);
  await h.S.check();
  assert.equal(h.S.readFor('U12').weeks['0'][0].t,'idb');
});
test('a new mirror write (user edit) wins over the shadow at once', async()=>{
  const h=harness(doc('old'),doc('new'));await h.S.check();
  h.ls.set('process_coach_v1',doc('typed'));
  assert.equal(h.S.read().weeks['0'][0].t,'typed');
});
test('no shadow when equal, when IDB is empty or malformed, or when IDB changes between looks', async()=>{
  for(const [m,i] of [[doc('x'),doc('x')],[doc('x'),null],[doc('x'),'{"no":1}'],[doc('x'),'not json']]){
    const h=harness(m,i);assert.equal(await h.S.check(),false);assert.equal(h.S.read().weeks['0'][0].t,'x');assert.deepEqual(h.events,[]);
  }
  const h=harness(doc('old'),doc('a'));
  h.box.afterGet=()=>{h.box.idb=doc('b');};const p=h.S.check();   /* 다른 창의 IDB 쓰기가 진행 중 */
  assert.equal(await p,false);assert.equal(h.S.read().weeks['0'][0].t,'old');
});
test('shadow clears once IDB and mirror agree again', async()=>{
  const h=harness(doc('old'),doc('new'));await h.S.check();
  h.ls.set('process_coach_v1',doc('new'));h.box.idb=doc('new');
  await h.S.check();
  h.box.idb=doc('later');   /* 그림자가 남아 있었다면 옛 정본을 계속 보였을 것 */
  assert.equal(h.S.read().weeks['0'][0].t,'new');
});
test('scout today reads the schedule through PSSchedule.raw and redraws on source change', ()=>{
  assert.match(scout,/get\(k\)\{try\{const v=\(k==="process_coach_v1"&&window\.PSSchedule&&PSSchedule\.raw\)\?PSSchedule\.raw\(\)/);
  assert.equal((scout.match(/JSON\.parse\(localStorage\.getItem\("process_coach_v1"\)/g)||[]).length,0);
  assert.match(scout,/addEventListener\("ps-schedule-source"/);
});
/* 3.131 — 못 쓰는 거울을 동기화가 걷은 뒤(아이패드 경기 화면 멈춤의 고침) 화면이 빈 일정 · 옛 일정에 머물지 않는다 */
test('3.131 missing mirror: the IDB copy shows at once (no second look to wait for)', async()=>{
  const h=harness(null,doc('idb'));
  h.box.afterGet=()=>{h.box.idb=doc('later');};
  assert.equal(await h.S.check(),true);
  assert.equal(h.S.read().weeks['0'][0].t,'idb');
  assert.deepEqual(h.events,['ps-schedule-source']);
});
test('3.131 a change during the look schedules another look instead of giving up', async()=>{
  const h=harness(doc('old'),doc('a'));h.box.timers.length=0;
  h.box.afterGet=()=>{h.box.idb=doc('b');};
  assert.equal(await h.S.check(),false);
  assert.equal(h.box.timers.length,1,'다시 볼 약속');
  assert.equal(await h.box.timers.pop()(),true);
  assert.equal(h.S.read().weeks['0'][0].t,'b');
});
