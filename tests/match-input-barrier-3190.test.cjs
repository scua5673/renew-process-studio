'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('../studio/match-lock.js');
const turn=()=>new Promise(r=>setImmediate(r));
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(){
  const ls=new Map(),handlers={},windowHandlers={},timers=new Map(),calls={queue:0,ready:0,flush:0,status:[],statusCalls:[]},models={a:{id:'a',reviewGood:'old'},b:{id:'b',reviewGood:'other'}},durable={};
  let mid='a',cloudPending=true,can=true,assigned=true,timer=0,queued=false,writing=false,unrelatedPending=false,hold=null,nativeError=null,nativeValue={verified:true},statusError=null,statusValue='native status return';
  const shell={classList:{contains:()=>false}},field={tagName:'TEXTAREA',type:'textarea',isConnected:true,value:'old',selectionStart:1,selectionEnd:1,matches:s=>s.includes('[data-match-field]'),closest:s=>s==='.match-shell'?shell:null,getAttribute(){return this.fieldName||'reviewGood';},focus(){doc.activeElement=this;},setSelectionRange(){}};
  const doc={body:{},activeElement:field,visibilityState:'visible',addEventListener:(kind,fn)=>(handlers[kind]||(handlers[kind]=[])).push(fn),querySelector:selector=>selector==='.match-shell'?shell:field};
  function setOwner(uid='coach-a',wid='team-a',perms='executive',epoch='epoch-1'){
    ls.set('ps_sync_session',JSON.stringify({uid}));ls.set('ps_active_ws',wid);ls.set('ps_cache_owner_v1',JSON.stringify({uid,wid,nonce:uid+'-'+wid}));ls.set('ps_ws_switch_epoch_v1',epoch);ls.set('cs_perms_v1',perms);
  }
  setOwner();
  const w={document:doc,localStorage:{getItem:k=>ls.get(k)??null},addEventListener:(kind,fn)=>(windowHandlers[kind]||(windowHandlers[kind]=[])).push(fn),setTimeout(fn,ms){timers.set(++timer,{fn,ms});return timer;},clearTimeout:id=>timers.delete(id),
    teamSaveOwner:()=>JSON.stringify([ls.get('ps_active_ws')||'',JSON.parse(ls.get('ps_sync_session')||'null')?.uid||'',ls.get('ps_cache_owner_v1')||'',ls.get('ps_ws_switch_epoch_v1')||'',ls.get('cs_perms_v1')||'']),
    matchGet:()=>models[mid]||null,matchLoad:()=>({matches:Object.values(models)}),matchDocPending:()=>cloudPending,matchCanEdit:()=>can&&!cloudPending,matchCanEditOne:id=>assigned&&can&&!cloudPending&&!!models[id],
    matchSayState:function(text,bad){calls.status.push({text,bad});calls.statusCalls.push({receiver:this,args:[...arguments]});if(statusError)throw statusError;return statusValue;},matchQueueSave(){calls.queue++;queued=true;w.matchSayState('native queued',false);},psHasPending:()=>queued||writing||unrelatedPending,
    psFlushPending(){calls.flush++;return queued;},
    psFlushPendingReady(...args){calls.ready++;calls.receiver=this;calls.args=args;const next=JSON.parse(JSON.stringify(models)),had=queued;queued=false;writing=had;
      return Promise.resolve(hold&&hold.promise).then(()=>{if(nativeError){if(had)queued=true;writing=false;w.matchSayState('native failed',true);throw nativeError;}if(had)Object.assign(durable,next);writing=false;if(w.psHasPending()){const e=Error('native pending remains');e.psCode='match_pending_left';throw e;}return nativeValue;});},
    renderMatch(){field.value=models[mid]?.reviewGood||'';}
  };
  const api=L.install(w);
  const fire=(kind,target=field)=>{for(const fn of handlers[kind]||[])fn({target,cancelable:true,preventDefault(){}});};
  return {w,api,field,doc,models,durable,calls,ls,timers,setOwner,fire,nativeFinish(){Object.assign(durable,JSON.parse(JSON.stringify(models)));queued=false;writing=false;w.matchSayState('native saved',false);},otherPending(v){unrelatedPending=v;},hold(v){hold=v;},error(v){nativeError=v;},statusError(v){statusError=v;},pending(v){cloudPending=v;},permission(v){can=v;},assigned(v){assigned=v;},match(v){mid=v;field.value=models[v]?.reviewGood||'';},
    input(v,native=true,name='reviewGood'){field.fieldName=name;field.value=v;fire('input');if(native&&w.matchCanEdit()){models[mid][name]=v;w.matchQueueSave();}},async timersOnce(){for(const [id,t]of [...timers]){timers.delete(id);t.fn();}await turn();},lifecycle(kind){if(kind==='visibilitychange'){doc.visibilityState='hidden';fire(kind,doc);}else for(const fn of windowHandlers[kind]||[])fn();}};
}
test('actual pending input blocks exit before native save, then joins native verified storage',async()=>{
  const h=fixture();h.input('new retained input');assert.equal(h.models.a.reviewGood,'old');assert.equal(h.w.psHasPending(),true);
  await assert.rejects(h.w.psFlushPendingReady(),e=>e.psCode==='match_input_pending');assert.equal(h.calls.ready,0);assert.equal(h.calls.queue,0);assert.deepEqual(h.api.typed(),['reviewGood']);
  h.pending(false);const receiver={};const result=await h.w.psFlushPendingReady.call(receiver,'native-argument');assert.deepEqual(result,{verified:true});assert.equal(h.calls.receiver,receiver);assert.deepEqual(h.calls.args,['native-argument']);assert.equal(h.durable.a.reviewGood,'new retained input');assert.equal(h.w.psHasPending(),false);assert.deepEqual(h.api.typed(),[]);
});
test('blocked timers do not silently discard an unapplied field after sixty seconds',async()=>{
  const h=fixture();h.input('must remain');const now=Date.now;Date.now=()=>now()+120000;
  try{await h.timersOnce();assert.equal(h.w.psHasPending(),true);assert.deepEqual(h.api.typed(),['reviewGood']);assert.equal(h.models.a.reviewGood,'old');assert.equal(h.calls.queue,0);}finally{Date.now=now;}
});
for(const kind of ['permission','assignment','other-match','field-conflict'])test(kind+' prevents replay without writes and retains the input barrier',async()=>{
  const h=fixture();h.input('unapplied');h.pending(false);if(kind==='permission')h.permission(false);if(kind==='assignment')h.assigned(false);if(kind==='other-match')h.match('b');if(kind==='field-conflict')h.models.a.reviewGood='new foreign field';
  await assert.rejects(h.w.psFlushPendingReady(),e=>e.psCode==='match_input_pending');assert.equal(h.calls.queue,0);assert.equal(h.calls.ready,0);assert.equal(h.w.psHasPending(),true);assert.deepEqual(h.api.typed(),['reviewGood']);assert.equal(h.models.a.reviewGood,kind==='field-conflict'?'new foreign field':'old');
});
test('match switching retains an unapplied field until its original match returns',async()=>{
  const h=fixture();h.input('match-a input');h.pending(false);h.match('b');await assert.rejects(h.w.psFlushPendingReady());h.match('a');await h.w.psFlushPendingReady();assert.equal(h.durable.a.reviewGood,'match-a input');assert.equal(h.durable.b.reviewGood,'other');
});
test('an accepted model-equal input transfers to the real queue and survives a later match selection',async()=>{
  const h=fixture();h.pending(false);h.input('native accepted');await turn();h.match('b');await h.w.psFlushPendingReady();assert.equal(h.durable.a.reviewGood,'native accepted');assert.equal(h.w.psHasPending(),false);
});
test('a late model reset cannot turn a previously model-equal input into an exit-safe result',async()=>{
  const h=fixture(),g=gate();h.pending(false);h.input('native accepted');h.hold(g);const saving=h.w.psFlushPendingReady();saving.catch(()=>{});h.models.a.reviewGood='old';g.resolve();await assert.rejects(saving);assert.equal(h.w.psHasPending(),true);assert.deepEqual(h.api.typed(),['reviewGood']);h.hold(null);await h.w.psFlushPendingReady();assert.equal(h.durable.a.reviewGood,'native accepted');assert.equal(h.w.psHasPending(),false);
});
test('a real native storage failure is preserved and does not acknowledge the typed shadow',async()=>{
  const h=fixture(),failure=Error('synthetic actual IDB verification failure');h.pending(false);h.input('retain after I/O failure');h.error(failure);await assert.rejects(h.w.psFlushPendingReady(),e=>e===failure);assert.equal(h.w.psHasPending(),true);assert.deepEqual(h.api.typed(),['reviewGood']);
});
test('old owners stay quarantined and do not apply or block a different active owner',async()=>{
  const h=fixture();h.input('private coach-a input');h.setOwner('coach-b','team-b');h.pending(false);assert.equal(h.w.psHasPending(),false);await h.w.psFlushPendingReady();assert.equal(h.calls.queue,0);assert.equal(h.models.a.reviewGood,'old');h.setOwner();assert.equal(h.w.psHasPending(),true,'the original owner still has its unacknowledged input');
});
for(const kind of ['missing-owner','unavailable-owner','bad-seal','switch-guard'])test('unknown '+kind+' cannot certify captured input',async()=>{
  const h=fixture();if(kind==='missing-owner')h.ls.delete('ps_sync_session');if(kind==='unavailable-owner')h.w.teamSaveOwner=()=> 'unavailable-owner';if(kind==='bad-seal')h.ls.set('ps_cache_owner_v1',JSON.stringify({uid:'foreign',wid:'team-a'}));if(kind==='switch-guard')h.ls.set('ps_ws_switch_guard_v1','active switch');h.input('unowned visible input');h.pending(false);assert.equal(h.w.psHasPending(),true);await assert.rejects(h.w.psFlushPendingReady(),e=>e.psCode==='match_input_pending');assert.equal(h.calls.queue,0);assert.equal(h.calls.ready,0);
});
test('unassigned input stays pending after a valid owner appears and is never assigned or replayed automatically',async()=>{
  const h=fixture();h.ls.delete('ps_sync_session');h.input('unassigned visible input');h.setOwner();h.pending(false);
  assert.equal(h.w.psHasPending(),true);await assert.rejects(h.w.psFlushPendingReady(),e=>e.psCode==='match_input_pending');assert.equal(h.calls.queue,0);assert.equal(h.calls.ready,0);assert.equal(h.models.a.reviewGood,'old');assert.deepEqual(h.api.typed(),['reviewGood']);
  h.setOwner('coach-b','team-b');assert.equal(h.w.psHasPending(),true,'unknown authorship cannot become another account\'s completed save');await assert.rejects(h.w.psFlushPendingReady(),e=>e.psCode==='match_input_pending');assert.equal(h.calls.queue,0);
});
test('unassigned input cannot restore its text into another valid owner\'s field',async()=>{
  const h=fixture();h.ls.delete('ps_sync_session');h.input('unknown old text');h.setOwner('coach-b','team-b');h.field.value='coach-b original visible text';h.models.a.reviewGood='coach-b original visible text';h.doc.activeElement=h.doc.body;
  await h.timersOnce();assert.equal(h.field.value,'coach-b original visible text');assert.equal(h.models.a.reviewGood,'coach-b original visible text');assert.equal(h.w.psHasPending(),true);await assert.rejects(h.w.psFlushPendingReady(),e=>e.psCode==='match_input_pending');assert.equal(h.calls.queue,0);assert.equal(h.calls.status.length,0);
});
test('a current author\'s input remains pending during a switch guard and recovers only after it clears',async()=>{
  const h=fixture();h.input('same-author held input');h.ls.set('ps_ws_switch_guard_v1','active source guard');h.pending(false);
  assert.equal(h.w.psHasPending(),true);await assert.rejects(h.w.psFlushPendingReady(),e=>e.psCode==='match_input_pending');assert.equal(h.calls.queue,0);assert.equal(h.calls.ready,0);assert.equal(h.models.a.reviewGood,'old');
  h.ls.delete('ps_ws_switch_guard_v1');await h.w.psFlushPendingReady();assert.equal(h.durable.a.reviewGood,'same-author held input');assert.equal(h.w.psHasPending(),false);
});
test('invalid new-owner context cannot acknowledge old input, but a valid different owner stays isolated',async()=>{
  const h=fixture();h.input('known coach-a input');h.setOwner('coach-b','team-b');h.ls.set('ps_cache_owner_v1',JSON.stringify({uid:'foreign',wid:'team-b'}));h.pending(false);
  assert.equal(h.w.psHasPending(),true);await assert.rejects(h.w.psFlushPendingReady(),e=>e.psCode==='match_input_pending');assert.equal(h.calls.queue,0);h.setOwner('coach-b','team-b');assert.equal(h.w.psHasPending(),false);await h.w.psFlushPendingReady();assert.equal(h.calls.queue,0);assert.equal(h.models.a.reviewGood,'old');assert.deepEqual(h.durable,{});
});
test('blocked visible input says waiting while the accepted native input keeps its own status',async()=>{
  const blocked=fixture();blocked.input('not yet in model');await turn();assert.deepEqual(blocked.calls.status,[{text:'저장 대기 중…',bad:false}]);assert.equal(blocked.calls.ready,0);
  const accepted=fixture();accepted.pending(false);accepted.input('native accepted');await turn();assert.deepEqual(accepted.calls.status,[{text:'native queued',bad:false}]);
  for(const changed of ['owner','match']){const h=fixture();h.input('old input');if(changed==='owner')h.setOwner('coach-b','team-b');else h.match('b');await turn();assert.equal(h.calls.status.length,0,'an old '+changed+' cannot change the new status');}
});
test('owner changes during native verification cannot report the old operation completed',async()=>{
  const h=fixture(),g=gate();h.pending(false);h.input('owner-a input');h.hold(g);const saving=h.w.psFlushPendingReady();saving.catch(()=>{});h.setOwner('coach-b','team-b');g.resolve();await assert.rejects(saving,e=>e.psCode==='match_input_pending');assert.equal(h.w.psHasPending(),false);
});
test('a new semantic input during native verification remains an unacknowledged barrier',async()=>{
  const h=fixture(),g=gate();h.pending(false);h.input('first');h.hold(g);const saving=h.w.psFlushPendingReady();saving.catch(()=>{});h.pending(true);h.input('second');g.resolve();await assert.rejects(saving);assert.equal(h.w.psHasPending(),true);assert.deepEqual(h.api.typed(),['reviewGood']);h.pending(false);h.hold(null);await h.w.psFlushPendingReady();assert.equal(h.durable.a.reviewGood,'second');
});
test('synchronous flush and lifecycle drain transfer only authorized current input to the native queue',()=>{
  for(const kind of ['flush','pagehide','visibilitychange']){const h=fixture();h.input('lifecycle input');h.pending(false);if(kind==='flush')assert.equal(h.w.psFlushPending(),true);else h.lifecycle(kind);assert.equal(h.models.a.reviewGood,'lifecycle input');assert.equal(h.calls.queue,1);assert.equal(h.calls.ready,0);assert.equal(h.w.psHasPending(),true,'a sync drain is not a durable receipt');}
});
test('render preservation never copies an old owner field into the newly active owner',()=>{
  const h=fixture();h.fire('focusin');h.input('private old owner');h.setOwner('coach-b','team-b');h.models.a.reviewGood='new owner model';h.w.renderMatch();assert.equal(h.field.value,'new owner model');assert.equal(h.w.psHasPending(),false);
});

test('a late native saving/saved message cannot cover an owned unapplied current field',async()=>{
  const h=fixture();h.input('visible but blocked');await turn();const receiver={native:'receiver'};
  assert.equal(h.w.matchSayState.call(receiver,'방금 자동 저장됨',false,'extra'),'native status return');
  assert.deepEqual(h.calls.status.at(-1),{text:'저장 대기 중…',bad:false});assert.equal(h.calls.statusCalls.at(-1).receiver,receiver);assert.deepEqual(h.calls.statusCalls.at(-1).args,['저장 대기 중…',false,'extra']);
  h.w.matchSayState('저장 중…',false);assert.equal(h.calls.status.at(-1).text,'저장 대기 중…');assert.equal(h.calls.queue,0);assert.equal(h.w.psHasPending(),true);
});
test('native failures and native status throws remain unchanged while input is blocked',async()=>{
  const h=fixture();h.input('blocked');await turn();const failure=Error('native status failure');h.w.matchSayState('actual native I/O failure',true,'detail');assert.deepEqual(h.calls.statusCalls.at(-1).args,['actual native I/O failure',true,'detail']);
  h.statusError(failure);assert.throws(()=>h.w.matchSayState('old success',false),e=>e===failure);
});
test('status precedence excludes accepted, unknown, other-owner and other-match rows',async()=>{
  const accepted=fixture();accepted.pending(false);accepted.input('accepted');await turn();accepted.w.matchSayState('native saved',false);assert.equal(accepted.calls.status.at(-1).text,'native saved');
  for(const changed of ['owner','match','unknown']){const h=fixture();if(changed==='unknown')h.ls.delete('ps_sync_session');h.input('old input');if(changed==='owner')h.setOwner('coach-b','team-b');if(changed==='match')h.match('b');await turn();h.w.matchSayState('native saved',false);assert.equal(h.calls.status.at(-1).text,'native saved',changed);}
});
test('automatic typed verification preserves the native accepted typing debounce',async()=>{
  const h=fixture();h.pending(false);h.input('normal native typing');await turn();assert.equal(h.calls.queue,1);await h.timersOnce();
  assert.equal(h.calls.queue,1,'300ms observer cannot queue the accepted input twice');assert.equal(h.calls.ready,0,'300ms observer must wait for the native queued debounce');assert.equal(h.calls.flush,0);assert.equal(h.w.psHasPending(),true);
  await h.w.psFlushPendingReady();assert.equal(h.calls.queue,1,'explicit verification reuses the native queue');assert.equal(h.calls.ready,1);assert.equal(h.durable.a.reviewGood,'normal native typing');assert.equal(h.w.psHasPending(),false);
});
test('an actual native I/O failure pauses automatic retries of the same input but explicit retry works',async()=>{
  const h=fixture(),failure=Error('actual synthetic I/O failure');h.pending(false);h.input('keep after failure');await turn();h.error(failure);await assert.rejects(h.w.psFlushPendingReady(),e=>e===failure);const before={ready:h.calls.ready,queue:h.calls.queue};
  for(let i=0;i<4;i++)await h.timersOnce();assert.equal(h.calls.ready,before.ready,'failure is not retried by each 300ms observer');assert.equal(h.calls.queue,before.queue);assert.equal(h.w.psHasPending(),true);assert.equal(h.calls.status.at(-1).text,'native failed');assert.equal(h.calls.status.at(-1).bad,true);
  h.error(null);await h.w.psFlushPendingReady();assert.equal(h.calls.queue,before.queue+1,'explicit retry performs one fresh normal save');assert.equal(h.durable.a.reviewGood,'keep after failure');assert.equal(h.w.psHasPending(),false);
});
test('new semantic input can recover after an automatic retry has been paused',async()=>{
  const h=fixture(),failure=Error('actual synthetic I/O failure');h.pending(false);h.input('failed first');await turn();h.error(failure);await assert.rejects(h.w.psFlushPendingReady(),e=>e===failure);h.error(null);h.input('new retained input',false);await turn();
  await h.timersOnce();assert.equal(h.durable.a.reviewGood,'new retained input');assert.equal(h.w.psHasPending(),false);assert.equal(h.calls.ready,2);
});

test('automatic verification of accepted input waits until the native debounce finishes',async()=>{
  const h=fixture();h.pending(false);h.input('normally saved input');await turn();await h.timersOnce();assert.equal(h.calls.ready,0);h.nativeFinish();await h.timersOnce();
  assert.equal(h.calls.queue,1);assert.equal(h.calls.ready,1);assert.equal(h.durable.a.reviewGood,'normally saved input');assert.equal(h.w.psHasPending(),false);assert.deepEqual(h.api.typed(),[]);
});
test('an automatic replay I/O failure is not retried on subsequent ticks',async()=>{
  const h=fixture(),failure=Error('automatic synthetic I/O verification failure');h.input('blocked then replayed');await turn();h.pending(false);h.error(failure);await h.timersOnce();assert.equal(h.calls.ready,1);assert.equal(h.calls.queue,1);assert.equal(h.calls.status.at(-1).bad,true);
  for(let i=0;i<4;i++)await h.timersOnce();assert.equal(h.calls.ready,1);assert.equal(h.calls.queue,1);assert.equal(h.w.psHasPending(),true);assert.deepEqual(h.api.typed(),['reviewGood']);h.error(null);await h.w.psFlushPendingReady();assert.equal(h.calls.queue,2);assert.equal(h.durable.a.reviewGood,'blocked then replayed');assert.equal(h.w.psHasPending(),false);
});

test('new semantic input in another field lets the same owner native save verify all retained input',async()=>{
  const h=fixture(),failure=Error('field A native I/O failure');h.pending(false);h.input('retained field A');await turn();h.error(failure);await assert.rejects(h.w.psFlushPendingReady(),e=>e===failure);h.error(null);h.input('new field B',true,'reviewBad');await turn();const before={queue:h.calls.queue,ready:h.calls.ready};
  await h.timersOnce();assert.equal(h.calls.queue,before.queue,'new native input keeps its own debounce');assert.equal(h.calls.ready,before.ready);h.nativeFinish();await h.timersOnce();assert.equal(h.calls.queue,before.queue);assert.equal(h.calls.ready,before.ready+1);assert.equal(h.durable.a.reviewGood,'retained field A');assert.equal(h.durable.a.reviewBad,'new field B');assert.equal(h.w.psHasPending(),false);assert.deepEqual(h.api.typed(),[]);
});
test('a render or repeated event with the same value does not resume an I/O retry',async()=>{
  const h=fixture(),failure=Error('same value native I/O failure');h.pending(false);h.input('unchanged failed input');await turn();h.error(failure);await assert.rejects(h.w.psFlushPendingReady(),e=>e===failure);h.error(null);h.input('unchanged failed input',false);await turn();const before={queue:h.calls.queue,ready:h.calls.ready};h.nativeFinish();await h.timersOnce();assert.equal(h.calls.queue,before.queue);assert.equal(h.calls.ready,before.ready);assert.equal(h.w.psHasPending(),true);await h.w.psFlushPendingReady();assert.equal(h.w.psHasPending(),false);
});
test('a different owner semantic input cannot resume the old owner paused retry',async()=>{
  const h=fixture(),failure=Error('owner A native I/O failure');h.pending(false);h.input('owner A retained');await turn();h.error(failure);await assert.rejects(h.w.psFlushPendingReady(),e=>e===failure);h.error(null);h.setOwner('coach-b','team-b');h.input('owner B new input',true,'reviewBad');await turn();h.nativeFinish();h.setOwner();const before={queue:h.calls.queue,ready:h.calls.ready};await h.timersOnce();assert.equal(h.calls.queue,before.queue);assert.equal(h.calls.ready,before.ready);assert.equal(h.w.psHasPending(),true);await h.w.psFlushPendingReady();assert.equal(h.w.psHasPending(),false);
});
test('unknown-author input cannot resume a known owner paused retry',async()=>{
  const h=fixture(),failure=Error('known owner native I/O failure');h.pending(false);h.input('known retained');await turn();h.error(failure);await assert.rejects(h.w.psFlushPendingReady(),e=>e===failure);h.error(null);h.ls.set('ps_ws_switch_guard_v1','active guard');h.input('unknown other input',false,'reviewBad');await turn();h.ls.delete('ps_ws_switch_guard_v1');h.nativeFinish();const before={queue:h.calls.queue,ready:h.calls.ready};await h.timersOnce();assert.equal(h.calls.queue,before.queue);assert.equal(h.calls.ready,before.ready);assert.equal(h.w.psHasPending(),true);assert.deepEqual(h.api.typed().sort(),['reviewBad','reviewGood']);
});

test('same-owner held fields arriving during a native flight resume when match readiness returns',async t=>{
  const h=fixture(),g=gate();h.pending(false);h.input('accepted A');await turn();h.hold(g);
  const first=h.w.psFlushPendingReady();first.catch(()=>{});
  assert.equal(h.calls.ready,1);assert.equal(h.calls.queue,1);
  h.pending(true);h.input('held B',true,'reviewBad');h.input('held C',true,'oppAttack');await turn();
  assert.equal(h.models.a.reviewBad,undefined);assert.equal(h.models.a.oppAttack,undefined,'native input handlers did not accept B/C while the match document was pending');
  g.resolve();let firstCode='';await assert.rejects(first,e=>{firstCode=e.psCode;return firstCode==='match_pending_left';});
  assert.deepEqual(h.durable.a,{id:'a',reviewGood:'accepted A'},'the older native flight committed only A');
  h.hold(null);h.pending(false);const before={queue:h.calls.queue,ready:h.calls.ready};
  for(let i=0;i<4;i++)await h.timersOnce();
  t.diagnostic(JSON.stringify({firstCode,before,after:{queue:h.calls.queue,ready:h.calls.ready},model:h.models.a,durable:h.durable.a,typed:h.api.typed().sort(),pending:h.w.psHasPending()}));
  assert.deepEqual(h.durable.a,{id:'a',reviewGood:'accepted A',reviewBad:'held B',oppAttack:'held C'},'new held input must resume automatically after the older non-I/O pending result');
  assert.equal(h.w.psHasPending(),false);
});

test('same-field replacement during a native flight resumes alongside its other captured field',async()=>{
  const h=fixture(),g=gate();h.pending(false);h.input('first A');h.input('captured B',true,'reviewBad');await turn();h.hold(g);
  const first=h.w.psFlushPendingReady();first.catch(()=>{});h.pending(true);h.input('newer A');await turn();
  g.resolve();await assert.rejects(first,e=>e.psCode==='match_pending_left');
  assert.deepEqual(h.durable.a,{id:'a',reviewGood:'first A',reviewBad:'captured B'});assert.equal(h.w.psHasPending(),true);
  h.hold(null);h.pending(false);for(let i=0;i<4;i++)await h.timersOnce();
  assert.deepEqual(h.durable.a,{id:'a',reviewGood:'newer A',reviewBad:'captured B'});assert.equal(h.w.psHasPending(),false);assert.deepEqual(h.api.typed(),[]);
});

test('match_pending_left without newer typed input keeps the automatic retry paused',async()=>{
  const h=fixture(),g=gate();h.pending(false);h.input('captured A');await turn();h.hold(g);
  const first=h.w.psFlushPendingReady();first.catch(()=>{});h.otherPending(true);g.resolve();await assert.rejects(first,e=>e.psCode==='match_pending_left');
  h.otherPending(false);h.hold(null);const before={queue:h.calls.queue,ready:h.calls.ready};
  for(let i=0;i<4;i++)await h.timersOnce();
  assert.deepEqual({queue:h.calls.queue,ready:h.calls.ready},before);assert.deepEqual(h.api.typed(),['reviewGood']);assert.equal(h.w.psHasPending(),true);
});

for(const code of ['storage_readback_failed','store_ready.match_pending_left'])test(code+' keeps its exact failure and retry pause despite newer held input',async()=>{
  const h=fixture(),g=gate(),failure=Object.assign(Error('native verification failure'),{psCode:code});h.pending(false);h.input('captured A');await turn();h.hold(g);
  const first=h.w.psFlushPendingReady();first.catch(()=>{});h.pending(true);h.input('held B',true,'reviewBad');await turn();h.error(failure);g.resolve();await assert.rejects(first,e=>e===failure);
  h.error(null);h.hold(null);h.pending(false);const before={queue:h.calls.queue,ready:h.calls.ready};
  for(let i=0;i<4;i++)await h.timersOnce();
  assert.deepEqual({queue:h.calls.queue,ready:h.calls.ready},before);assert.equal(h.models.a.reviewBad,undefined);assert.equal(h.w.psHasPending(),true);assert.deepEqual(h.api.typed().sort(),['reviewBad','reviewGood']);
});

for(const change of ['owner','permissions','other-match'])test(change+' changes cannot resume an older flight from newer held input',async()=>{
  const h=fixture(),g=gate();h.pending(false);h.input('captured A');await turn();h.hold(g);
  const first=h.w.psFlushPendingReady();first.catch(()=>{});h.pending(true);
  if(change==='owner')h.setOwner('coach-b','team-b');else if(change==='permissions')h.setOwner('coach-a','team-a','staff');else h.match('b');
  h.input('foreign-context B',true,'reviewBad');await turn();g.resolve();await assert.rejects(first,e=>e.psCode==='match_pending_left');
  h.setOwner();h.match('a');h.hold(null);h.pending(false);const before={queue:h.calls.queue,ready:h.calls.ready};
  for(let i=0;i<4;i++)await h.timersOnce();
  assert.deepEqual({queue:h.calls.queue,ready:h.calls.ready},before);assert.equal(h.models.a.reviewBad,undefined);assert.equal(h.models.b.reviewBad,undefined);assert.equal(h.w.psHasPending(),true);
});
