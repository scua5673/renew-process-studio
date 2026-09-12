'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual settings status renderer and its registered manual-sync
// click handler. Only the DOM, timers and sync API responses are simulated.
const source = fs.readFileSync(path.join(__dirname, '../studio/app.html'), 'utf8');
const start = source.indexOf("  var pbtn=document.getElementById('psPushNow')");
const end = source.indexOf('  /* ══ 2.352 · 팀 자료 통째로', start);
assert.ok(start >= 0 && end > start, 'Can extract the shipped sync settings block');
const code = source.slice(start, end);
const SUCCESS = /동기화했습니다|이미 최신입니다|최신 상태|팀과 같아요|모든 변경을 맞췄/;
const confirmed = {kind:'ok',text:'팀과 같아요',at:100,ago:'방금',n:0,review:0};

function harness(options = {}) {
  const textHistory = [], toasts = [], alerts = [], timers = [], calls = [];
  const handlers = {};
  let current = options.state === undefined ? {...confirmed} : options.state;
  let session = options.session === undefined ? {uid:'coach-a'} : options.session;
  let reviews = options.reviews || [], opened = 0, resultIndex = 0;
  const button = {disabled:false,textContent:'',addEventListener(type, fn){handlers[type]=fn;}};
  const status = {
    value:'',
    get textContent(){return this.value;},
    set textContent(v){this.value=String(v);textHistory.push(this.value);},
  };
  const api = {
    session:()=>session,
    pending:()=>({count:options.teamPending || 0}),
    state:()=>current,
    ago:()=> '오래전',
    hold:{list:()=>[],open:()=>{opened++;}},
    syncNow(reason){
      calls.push(reason);
      if(options.reject)return Promise.reject(new Error('simulated network failure'));
      if(options.nextState !== undefined)current=options.nextState;
      if(options.nextReviews)reviews=options.nextReviews;
      const sequence=options.results || [options.result || {}];
      const result=sequence[Math.min(resultIndex++,sequence.length-1)];
      return Promise.resolve(result);
    },
  };
  if(options.noState)delete api.state;
  const ctx = vm.createContext({
    Promise, console,
    document:{getElementById:id=>id==='psPushNow'?button:id==='psPushState'?status:null},
    localStorage:{getItem:k=>k==='ps_last_pull_at'?String(options.lastPull || 999):null},
    PSSync:api,
    PSDataReview:{list:()=>reviews,open:()=>{opened++;}},
    toast:message=>toasts.push(String(message)),
    alert:message=>alerts.push(String(message)),
    setTimeout(fn){timers.push(fn);return timers.length;},
  });
  ctx.window=ctx;
  vm.runInContext(code,ctx,{filename:'app.html sync settings'});
  async function flush(){
    // Real promise microtasks, deterministic browser timers: bounded retries
    // exercise the event handler without waiting eight seconds on wall time.
    let idle=0;
    for(let turns=0;turns<300;turns++){
      await new Promise(resolve=>setImmediate(resolve));
      if(timers.length){idle=0;timers.shift()();}
      else if(++idle===3)return;
    }
    assert.fail('Settings handler did not settle after bounded timers');
  }
  return {
    button,status,textHistory,toasts,alerts,calls,
    get opened(){return opened;},
    refresh(){ctx.__psRefreshPushState();},
    async click(){assert.equal(typeof handlers.click,'function');handlers.click();await flush();},
    state(value){current=value;},
    logout(){session=null;},
  };
}

function noSuccess(h, includeStatus = true){
  const messages=[...h.toasts,...h.alerts,...(includeStatus?h.textHistory:[])];
  assert.deepEqual(messages.filter(x=>SUCCESS.test(x)),[],`No false success: ${JSON.stringify(messages)}`);
}

test('personal pending remains visible when the active team outbox is empty',()=>{
  const state={kind:'busy',text:'개인 자료 올리는 중 · 2',n:2,review:0};
  const h=harness({state,teamPending:0});
  h.refresh();
  assert.ok(h.status.textContent.includes(state.text));
  noSuccess(h);
});

test('personal upload failure is preserved despite an old successful team pull',()=>{
  const state={kind:'bad',text:'개인 자료를 못 올렸어요 · 저장소를 확인해 주세요',reason:'sync_storage',n:1,review:0};
  const h=harness({state,teamPending:0,lastPull:99999});
  h.refresh();h.refresh();
  assert.ok(h.status.textContent.includes(state.text));
  noSuccess(h);
});

test('missing authoritative state does not turn an empty team outbox into success',()=>{
  const h=harness({noState:true,teamPending:0,lastPull:99999});
  h.refresh();
  noSuccess(h);
});

test('ok without any confirmed sync timestamp is not presented as latest',()=>{
  const h=harness({state:{...confirmed,at:0,ago:''}});
  h.refresh();
  noSuccess(h);
});

test('a confirmed state can display its successful synchronization status',()=>{
  const h=harness();
  h.refresh();
  assert.ok(SUCCESS.test(h.status.textContent));
});

test('personal conflict opens the actual data review instead of uploading again',async()=>{
  const h=harness({state:{kind:'ask',text:'올리기 전 확인할 것 1',n:1,review:1},reviews:[{src:'personal',k:'cs_notes_v1'}]});
  h.refresh();
  assert.equal(h.button.textContent,'보기');
  await h.click();
  assert.equal(h.opened,1);
  assert.equal(h.calls.length,0);
  noSuccess(h);
});

test('manual team success cannot conceal a failed personal backup',async()=>{
  const state={kind:'bad',text:'개인 자료를 못 올렸어요 · 권한을 확인해 주세요',reason:'sync_permission',n:1,review:0};
  const h=harness({result:{pushed:1,applied:0,personalError:'permission'},nextState:state,teamPending:0});
  await h.click();
  assert.equal(h.calls.length,1);
  assert.ok(h.status.textContent.includes(state.text));
  assert.equal(h.button.disabled,false);
  noSuccess(h);
});

for(const [name,result] of [
  ['personal error',{personalError:'network'}],
  ['whole sync error',{error:'network'}],
  ['authentication missing',{noauth:1}],
  ['skipped result',{skipped:1}],
  ['pending data',{pending:1}],
  ['deferred schedule',{scheduleDeferred:true}],
]){
  test(`manual ${name} never announces success from a previously confirmed state`,async()=>{
    const h=harness({result});
    await h.click();
    noSuccess(h,false);
    assert.equal(h.button.disabled,false);
  });
}

test('repeated busy skips exhaust retries without announcing success',async()=>{
  const h=harness({result:{skip:1}});
  await h.click();
  assert.ok(h.calls.length>1&&h.calls.length<=33,'Existing retries remain bounded');
  noSuccess(h,false);
  assert.equal(h.button.disabled,false);
});

for(const kind of ['busy','bad']){
  test(`successful row counts do not override the current ${kind} state`,async()=>{
    const state={kind,text:kind==='busy'?'개인 자료 올리는 중 · 1':'개인 자료를 못 올렸어요 · 오프라인',n:1,review:0};
    const h=harness({result:{pushed:2,applied:1},nextState:state});
    await h.click();
    assert.ok(h.status.textContent.includes(state.text));
    noSuccess(h);
  });
}

test('a review discovered during sync prevents a completion announcement',async()=>{
  const state={kind:'ask',text:'올리기 전 확인할 것 1',n:1,review:1};
  const h=harness({result:{pushed:1},nextState:state,nextReviews:[{src:'personal'}]});
  await h.click();
  assert.equal(h.button.textContent,'보기');
  noSuccess(h);
});

test('unconfirmed ok does not turn an empty manual response into success',async()=>{
  const h=harness({result:{},nextState:{...confirmed,at:0,ago:''}});
  await h.click();
  noSuccess(h);
});

test('confirmed completion still announces success and enables the button',async()=>{
  const h=harness({result:{pushed:1,applied:1},nextState:{...confirmed,at:200}});
  await h.click();
  assert.ok(h.toasts.some(x=>SUCCESS.test(x)),'Real completion remains visible');
  assert.equal(h.button.disabled,false);
});

test('rejected manual sync never announces success and re-enables retry',async()=>{
  const h=harness({reject:true,state:{kind:'bad',text:'못 올렸어요 · 인터넷을 확인해 주세요',n:1,review:0}});
  await h.click();
  noSuccess(h);
  assert.equal(h.button.disabled,false);
});

for(const [name,result] of [
  ['failure',{personalError:'network'}],
  ['unfinished work',{pending:1}],
]){
  test(`manual ${name} survives stale success refreshes until a newer confirmed sync`,async()=>{
    const h=harness({state:{...confirmed,at:100},result});
    await h.click();
    const notice=h.status.textContent;
    assert.ok(notice.length>0);
    noSuccess(h);

    // The settings panel and background notifications may refresh repeatedly.
    // The previously completed round cannot acknowledge this newer attempt.
    for(let i=0;i<3;i++){
      h.state({...confirmed,at:100});
      h.refresh();
      assert.equal(h.status.textContent,notice);
    }
    noSuccess(h);

    // A later confirmed successful round releases the old attempt's notice.
    h.state({...confirmed,at:200});
    h.refresh();
    assert.notEqual(h.status.textContent,notice);
    assert.ok(SUCCESS.test(h.status.textContent));
    assert.equal(h.button.disabled,false);
  });
}

test('logged-out settings remain disabled and do not advertise synchronized data',()=>{
  const h=harness({session:null});
  h.refresh();
  assert.equal(h.button.disabled,true);
  noSuccess(h);
});
