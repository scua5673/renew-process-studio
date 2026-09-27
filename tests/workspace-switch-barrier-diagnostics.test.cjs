'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8'),app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
function section(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return src.slice(i,j);}
const code=section(sync,'function sleep(ms){','/* busy면 스킵되므로')+section(sync,'function flushWorkspaceFrames(','/* 지우기 전 현재 콘텐츠를 IDB에 백업')
  +section(app,'function psFlushAllPendingReady(','window.psFlushAllPendingReady=');

function frame(id,w){return {id,contentWindow:w};}
function harness({frames=[],shared=()=>Promise.resolve(true),held=false}={}){
  const diags=[];
  const c=vm.createContext({Promise,Error,Object,String,Array,
    // The 8-second backstop is exercised without waiting in real time.
    setTimeout:(fn,ms)=>setTimeout(fn,ms>=8000?30:ms),clearTimeout,
    editMirrorCommit:Promise.resolve(),editOutboxCommit:Promise.resolve(),
    scheduleHeld:()=>held,syncBaseReady:()=>Promise.resolve(true),
    syncDiagnostic:(stage,e)=>diags.push({stage,name:e&&e.name,code:e&&e.psCode}),
    document:{querySelectorAll:()=>frames},
    PSStorage:{sharedReady:shared}});
  c.window=c;
  vm.runInContext(code+';window.psFlushAllPendingReady=psFlushAllPendingReady;',c);
  return {c,diags};
}
const never=()=>new Promise(()=>{});

test('a clean flush opens the barrier without diagnostics',async()=>{
  const h=harness({frames:[frame('fScout',{psFlushPendingReady:()=>Promise.resolve(true),psHasPending:()=>false})]});
  assert.deepEqual({...await h.c.workspaceSwitchWriteBarrier()},{ready:1});
  assert.deepEqual(h.diags,[]);
});

test('a schedule edit still holds before any flush',async()=>{
  let flushed=0;const h=harness({held:true,frames:[frame('fProcess',{psFlushPendingReady:()=>{flushed++;return true;}})]});
  assert.deepEqual({...await h.c.workspaceSwitchWriteBarrier()},{held:1});
  assert.equal(flushed,0);
});

test('a frame that still reports pending names that frame, not the schedule',async()=>{
  const h=harness({frames:[frame('fProcess',{psFlushPendingReady:()=>true,psHasPending:()=>false}),frame('fScout',{psFlushPendingReady:()=>true,psHasPending:()=>true})]});
  const gate=await h.c.workspaceSwitchWriteBarrier();
  assert.equal(gate.error,1);assert.equal(gate.step,'frames');assert.equal(gate.frame,'fScout');
  assert.deepEqual(h.diags,[{stage:'workspace-switch-frames',name:'Error',code:'fScout'}]);
  const stop=h.c.workspaceBarrierStop(gate);
  assert.match(stop.msg,/선수단·경기 화면의 저장을 확인하지 못했어요/);assert.doesNotMatch(stop.msg,/일정/);
  assert.equal(stop.code,'barrier failed frames:fScout Error');
});

test('a frame that never settles times out with the unfinished frame recorded',async()=>{
  const h=harness({frames:[frame('fScout',{psFlushPendingReady:()=>Promise.resolve(true)}),frame('fNote',{psFlushPendingReady:never})]});
  const gate=await h.c.workspaceSwitchWriteBarrier();
  assert.equal(gate.__timeout,1);assert.equal(gate.step,'frames');assert.deepEqual([...gate.frames],['fNote']);
  assert.deepEqual(h.diags,[{stage:'workspace-switch-timeout',name:'Error',code:'fNote'}]);
  const stop=h.c.workspaceBarrierStop(gate);
  assert.match(stop.msg,/개인 노트 화면의 저장 확인이 8초 안에 끝나지 않았어요/);
  assert.ok(stop.code.length<=60,stop.code);
});

test('a shell storage verification failure is reported as a device-storage failure',async()=>{
  let calls=0;
  const shared=()=>{calls++;if(calls<2)return Promise.resolve(true);const e=new Error('storage verification failed');e.name='StorageVerificationError';return Promise.reject(e);};
  const h=harness({frames:[],shared});
  const gate=await h.c.workspaceSwitchWriteBarrier();
  assert.equal(gate.error,1);assert.equal(gate.step,'shared');assert.equal(gate.frame,'');assert.equal(gate.errName,'StorageVerificationError');
  assert.deepEqual(h.diags,[{stage:'workspace-switch-shared',name:'StorageVerificationError',code:'StorageVerificationError'}]);
  const stop=h.c.workspaceBarrierStop(gate);
  assert.match(stop.msg,/이 기기에 저장하는 것을 확인하지 못했어요/);assert.doesNotMatch(stop.msg,/일정/);
});

test('the shell flush keeps its previous contract when called without tracking',async()=>{
  const h=harness({frames:[frame('fIdp',{psFlushPendingReady:()=>Promise.reject('plain rejection')})]});
  await assert.rejects(h.c.psFlushAllPendingReady(),e=>e instanceof Error&&e.psFrame==='fIdp'&&/plain rejection/.test(e.message));
  const ok=harness({frames:[frame('fIdp',{psFlushPendingReady:()=>true})]});
  assert.equal(await ok.c.psFlushAllPendingReady(),true);
});

test('switch and mirror-drop diagnostics survive the support allowlist',()=>{
  const dd=require('../studio/support-diagnostics.js');
  assert.equal(dd.sanitizeLog('sync',{stage:'edit-idb-mirror-drop',code:'tab-workspace-stale'},null,0).code,'tab-workspace-stale');
  const sw=dd.sanitizeLog('sync',{stage:'workspace-switch-timeout',code:'fNote'},null,0);assert.equal(sw.stage,'workspace-switch-timeout');assert.equal(sw.code,'fNote');
  assert.equal(dd.sanitizeLog('sync',{stage:'workspace-switch-frames',code:'scout_tool_v1'},null,0).code,'','document keys are still dropped');
  const d=require('../studio/support-diagnostics.js'),src=fs.readFileSync(path.join(__dirname,'../studio/support-diagnostics.js'),'utf8');
  for(const s of ['workspace-switch-frames','workspace-switch-mirror','workspace-switch-shared','workspace-switch-aux','workspace-switch-timeout'])assert.ok(src.includes("'"+s+"'"),s);
  assert.ok(d);
});
