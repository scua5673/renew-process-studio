'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {view,combine,observe,observeShell}=require('../studio/autosave-status.js');
const server={kind:'ok',at:100,n:0,review:0};
const turn=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(){
  let currentOwner='coach-a/team-a/epoch-1',changes=0;
  function surface(name){
    const events={},frames=[],scopes={};let pending=false;
    const doc={name,querySelectorAll:()=>frames};
    const win={document:doc,location:{href:'https://fixture.test/'+name+'.html'},
      addEventListener(type,fn){(events[type]||(events[type]=[])).push(fn);},
      removeEventListener(type,fn){events[type]=(events[type]||[]).filter(x=>x!==fn);},
      PSSaveState:{owner:()=>currentOwner,snapshot:()=>({owner:currentOwner,scopes:{...scopes}})},psHasPending:()=>pending};
    return {win,doc,frames,scopes,pending(value){pending=value;},
      emit(type,detail){for(const fn of events[type]||[])fn({type,detail,target:win});},
      listeners(type){return [...(events[type]||[])];},
      set(scope,state,owner=currentOwner){scopes[scope]=state;this.emit('ps-save-state',{scope,state,owner});}};
  }
  const root=surface('app');
  function child(parent=root,name='schedule'){
    const source=surface(name),frame={isConnected:true,getAttribute:()=>name+'.html',contentWindow:source.win};
    parent.frames.push(frame);source.frame=frame;
    source.remove=()=>{frame.isConnected=false;parent.frames.splice(parent.frames.indexOf(frame),1);};return source;
  }
  function monitor(confirm){return observe(root.win,{owner:()=>currentOwner,change:()=>changes++,confirm});}
  return {root,child,monitor,owner(value){currentOwner=value;},get changes(){return changes;}};
}

test('failed and pending child writes override an old root server confirmation',()=>{
  const f=fixture(),schedule=f.child(),m=f.monitor();
  schedule.scopes.schedule='failed';
  assert.equal(combine(view(server),m.read()).text,'기기에 저장하지 못했어요');
  assert.equal(combine(view(server),m.read()).complete,false);
  schedule.scopes.schedule='saving';
  assert.equal(combine(view(server),m.read()).text,'기기에 저장 중…');
  schedule.scopes.schedule='idle';schedule.pending(true);
  assert.equal(combine(view(server),m.read()).complete,false,'A debounce/IDB barrier also blocks old success');
  m.dispose();
});

test('nested hidden editors count, while foreign frames cannot supply state',()=>{
  const f=fixture(),team=f.child(f.root,'team'),review=f.child(team,'match-review'),m=f.monitor();
  review.scopes.review='failed';
  const foreign={isConnected:true,get contentWindow(){return {get document(){throw new Error('SecurityError');}};}};
  f.root.frames.push(foreign);
  assert.equal(m.read().failed,true);
  review.remove();
  assert.equal(m.read().failed,false,'A discarded editor does not leave a stale error behind');
  assert.equal(combine(view(server),m.read()).text,'서버 저장 확인');m.dispose();
});

test('an old live owner is unknown, and neither its failure nor its forged success crosses teams',async()=>{
  const f=fixture(),child=f.child(),m=f.monitor();child.scopes.schedule='failed';m.read();
  f.owner('coach-a/team-b/epoch-2');child.scopes.schedule='idle';
  let state=m.read();assert.equal(state.failed,false);assert.equal(state.unknown,true);
  child.emit('ps-save-state',{scope:'schedule',state:'saved',owner:'coach-a/team-a/epoch-1'});
  assert.equal(m.read().unknown,true);
  child.set('schedule','saving');await turn();
  state=m.read();assert.equal(state.unknown,false);assert.equal(state.saving,true);m.dispose();
});

test('payloads cannot clear the actual document failure and replaced documents lose old callbacks',async()=>{
  const f=fixture(),child=f.child(),m=f.monitor();child.scopes.schedule='failed';m.read();
  child.emit('ps-save-state',{scope:'schedule',state:'saved',owner:'coach-a/team-a/epoch-1'});
  assert.equal(m.read().failed,true,'Read the real API snapshot, not event.state');
  const oldDoc=child.win.document,late=child.listeners('ps-save-state');child.win.document={querySelectorAll:()=>[]};child.scopes.schedule='idle';
  m.read();await turn();const changed=f.changes;
  for(const fn of late)fn({detail:{scope:'schedule',state:'failed',owner:'coach-a/team-a/epoch-1'}});await turn();
  assert.equal(child.win.document===oldDoc,false);
  assert.equal(m.read().failed,false);
  assert.equal(f.changes,changed,'A late callback for the old Document cannot repaint the root');m.dispose();
});

test('local success and a fresh global timestamp never impersonate an exact document ACK',async()=>{
  const f=fixture(),child=f.child();let verified=false;
  const m=f.monitor((_win,scope)=>scope==='schedule'?Promise.resolve({confirmed:verified}):null);
  child.scopes.schedule='saved';let state=m.read();
  assert.equal(state.unconfirmed,true);assert.equal(combine(view({...server,at:999999}),state).complete,false);
  await turn();state=m.read();assert.equal(state.unconfirmed,true);
  verified=true;m.refresh();m.read();await turn();state=m.read();
  assert.equal(state.unconfirmed,false);assert.equal(combine(view(server),state).text,'서버 저장 확인');
  child.set('schedule','saving');assert.equal(combine(view(server),m.read()).complete,false);
  child.set('schedule','saved');m.read();await turn();
  child.set('unknown-multi-key-tracker','saved');
  m.read();await turn();
  assert.equal(combine(view(server),m.read()).text,'기기에 저장됨','Unsupported scope receipt stays local');m.dispose();
});

test('late ACK completion cannot confirm a new owner or newer local edit',async()=>{
  const f=fixture(),child=f.child(),deferred=[];
  const m=f.monitor(()=>new Promise(resolve=>deferred.push(resolve)));
  child.scopes.schedule='saved';m.read();assert.equal(deferred.length,1);
  child.set('schedule','saving');m.read();deferred.shift()({confirmed:true});await turn();
  assert.equal(m.read().saving,true);
  child.set('schedule','saved');m.read();f.owner('coach-b/team-c/epoch-3');deferred.shift()({confirmed:true});await turn();
  assert.equal(m.read().unknown,true);assert.equal(combine(view(server),m.read()).complete,false);m.dispose();
});

test('a durable unsaved board is a device draft and a failed draft remains a failure',()=>{
  const f=fixture(),child=f.child(f.root,'board'),m=f.monitor();
  const draft={needed:true,unsaved:true,localDurable:true,pending:false,blocked:false,failed:false,serverConfirmed:false};
  child.win.__psBoardDraft={snapshot:()=>draft};
  assert.equal(combine(view(server),m.read()).text,'보드 초안 · 기기에 저장됨');
  assert.equal(combine(view({kind:'bad',reason:'sync_auth'}),m.read()).action,'login','A local draft never hides a server login failure');
  draft.localDurable=false;draft.pending=true;assert.equal(combine(view(server),m.read()).text,'기기에 저장 중…');
  draft.failed=true;assert.equal(combine(view(server),m.read()).text,'기기에 저장하지 못했어요');
  draft.failed=false;draft.pending=false;draft.needed=false;draft.serverPending=true;draft.privateLocalDurable=true;
  assert.equal(combine(view(server),m.read()).text,'기기에 저장됨 · 서버 확인 대기');m.dispose();
});

test('the shell adapter reads a missing schedule mirror with readonly peek and rechecks exact durable raw',async()=>{
  const f=fixture(),child=f.child(),reads=[],calls=[];child.scopes.schedule='saved';
  child.win.localStorage={getItem:()=>null};
  child.win.storage={get(){assert.fail('A status read must never call the migration getter');},peek:async key=>{reads.push(key);return {value:reads.length===1?'exact original':'new concurrent document'};}};
  f.root.win.PSSync={confirmedValue:(key,raw)=>{calls.push({key,raw});return true;}};
  const m=observeShell(f.root.win,()=>{});m.read();await turn();
  assert.deepEqual(reads,['process_coach_v1','process_coach_v1']);assert.deepEqual(calls,[{key:'process_coach_v1',raw:'exact original'}]);
  assert.equal(m.read().unconfirmed,true,'A concurrent durable edit invalidates the otherwise exact old receipt');m.dispose();
});

test('the shell adapter accepts the synchronous exact ACK only while the local mirror stays identical',async()=>{
  const f=fixture(),child=f.child();let raw='current exact schedule';child.scopes.schedule='saved';
  child.win.localStorage={getItem:()=>raw};f.root.win.PSSync={confirmedValue:(_key,value)=>value===raw};
  const m=observeShell(f.root.win,()=>{});m.read();await turn();assert.equal(m.read().unconfirmed,false);
  f.root.win.PSSync.confirmedValue=()=>{raw='concurrent changed schedule';return true;};m.refresh();m.read();await turn();
  assert.equal(m.read().unconfirmed,true);m.dispose();
});

test('only the exact private-board receipt can clear an inactive draft dependency',async()=>{
  const f=fixture(),child=f.child(f.root,'board'),b={needed:true,unsaved:true,localDurable:true,pending:false,blocked:false,failed:false,serverPending:false,privateServerConfirmed:true};
  child.win.__psBoardDraft={snapshot:()=>b};child.scopes['board-private']='saved';child.scopes['board-draft']='saved';
  const m=observeShell(f.root.win,()=>{});m.read();await turn();
  assert.equal(combine(view(server),m.read()).text,'보드 초안 · 기기에 저장됨','An ACK for the saved head cannot cover a newer unsaved draft');
  b.needed=false;b.unsaved=false;child.set('board-private','saved');m.read();await turn();
  assert.equal(combine(view(server),m.read()).text,'서버 저장 확인');
  b.privateServerConfirmed=false;child.set('board-private','saved');m.read();await turn();
  assert.equal(combine(view(server),m.read()).complete,false);m.dispose();
});

test('opening an archive cannot make the shipped footer hide unconfirmed local changes',()=>{
  const source=fs.readFileSync(require.resolve('../studio/app.html'),'utf8');
  const start=source.indexOf('    function draw(){\n      var st=currentView();'),end=source.indexOf('    btn.addEventListener',start);
  assert.ok(start>0&&end>start);
  let shown;const el={setAttribute(){},title:'',className:''},tx={},ago={},btn={style:{}};
  const c=vm.createContext({el,tx,ago,btn,currentView:()=>shown,archSeen:()=>true});vm.runInContext(source.slice(start,end),c);
  const archived=view({...server,archivedCount:1});
  shown=combine(archived,{saved:true,localOnly:true});c.draw();
  assert.equal(shown.complete,false);assert.equal(tx.textContent,'일부 변경 별도 보관');
  shown=combine(archived,{failed:true});c.draw();assert.equal(tx.textContent,'기기에 저장하지 못했어요');
  shown=combine(archived,{});c.draw();assert.equal(tx.textContent,'서버 저장 확인','A seen archive may be quiet only when the current save is confirmed');
});
