'use strict';
/* 2.991 — 보관함 자동 저장(미팅 등): 어느 길로 끝나든 «저장 중» 잠금을 풀고, 실패하면 간격을 늘려 세 번까지 다시 시도한다.
   예전: 보기 전용·빈 슬라이드에서 return 만 해 잠금이 남았고, 저장 실패는 «다시 시도해 주세요»만 적고 영영 다시 저장하지 않았다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};
const autoCode=slice('  var _vaultAutoT=null,_vaultAutoWriting=false','  /* 2.975 — «저장»(나가지 않고)')
  +slice('  window.__vaultAutoSaveSchedule=function(){','  window.__vaultAutoSaveFlush=function(){');

/* 자동 저장 부분만 떼어 돌린다. vaultSaveCurrent 는 각 시험이 정한 대로 끝난다. */
function harness(save){
  const timers=[],status=[],calls=[];
  const sub={textContent:''};
  const c={JSON,Date,Math,
    document:{activeElement:null,visibilityState:'visible',getElementById:id=>id==='vCreateSub'?sub:null},
    localStorage:{setItem(){}},
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},
    curType:()=>'meeting',$id:id=>c.document.getElementById(id),
    vaultSaveCurrent(o){calls.push(o);return save(o,calls.length);},
    restoreAnimBeforeCapture(){},VAULT_REC_KEY:'k'};
  c.window=c;c.__vaultEdit=true;c.__curVaultId='VMEET';c.__vaultReadOnly=false;c.__vaultHydrating=false;c.__vaultPending=null;
  vm.createContext(c);vm.runInContext(autoCode+';this.__run=_vaultAutoRun;this.__writing=function(){return _vaultAutoWriting;};',c);
  Object.defineProperty(sub,'textContent',{get(){return this._t||'';},set(v){this._t=v;status.push(v);}});
  return {c,timers,status,calls,run:()=>c.__run(),writing:()=>c.__writing(),
    fire(){const t=timers.shift();assert.ok(t,'a timer is pending');t.fn();return t.ms;}};
}

test('a save that ends without writing (view-only · no slides) releases the lock — the next autosave really runs',()=>{
  const h=harness(o=>{o.onskip();});
  h.run();assert.equal(h.writing(),false,'lock released');
  h.c.__vaultAutoSaveSchedule();assert.equal(h.fire(),850);
  assert.equal(h.calls.length,2,'the next save is not swallowed into «again»');
});
test('a save that throws synchronously releases the lock and retries',()=>{
  const h=harness(()=>{throw new Error('capture failed');});
  h.run();assert.equal(h.writing(),false);
  assert.equal(h.timers.length,1,'retry scheduled');assert.equal(h.timers[0].ms,1500);
});
test('failures retry three times with growing gaps, then stop and ask the person',()=>{
  const h=harness(o=>{o.onerror(new Error('StorageVerificationError'),false);});
  h.run();
  const gaps=[];while(h.timers.length)gaps.push(h.fire());
  assert.deepEqual(gaps,[1500,4000,10000]);
  assert.equal(h.calls.length,4,'first try + three retries');
  assert.equal(h.status[h.status.length-1],'· 저장 실패 — 다시 시도해 주세요');
  assert.ok(h.status.includes('· 저장 실패 — 잠시 뒤 다시 저장해요'));
  assert.equal(h.writing(),false);
});
test('a retry that succeeds says saved and starts the count again',()=>{
  const h=harness((o,n)=>{if(n===1)o.onerror(new Error('x'),false);else o.after();});
  h.run();assert.equal(h.fire(),1500);
  assert.equal(h.status[h.status.length-1],'· 이 기기에 저장됨 ✓');
  const h2=harness((o,n)=>{if(n===1||n===3)o.onerror(new Error('x'),false);else o.after();});
  h2.run();h2.fire();h2.c.__vaultAutoSaveSchedule();h2.fire();
  assert.equal(h2.fire(),1500,'after a success the next failure starts from the first gap');
});
test('a failure that cannot heal by retrying (no login · someone else’s item) is not retried',()=>{
  const h=harness(o=>{o.onerror(null,true);});
  h.run();assert.equal(h.timers.length,0);assert.equal(h.writing(),false);
  assert.equal(h.status[h.status.length-1],'· 저장 실패 — 다시 시도해 주세요');
});
test('a retry waits for nothing once the item is closed or turns view-only',()=>{
  const h=harness(o=>{o.onerror(new Error('x'),false);});
  h.run();h.c.__vaultReadOnly=true;h.fire();
  assert.equal(h.calls.length,1,'no save after the item became view-only');
});
test('cancel (opening another item) clears a pending retry and its count',()=>{
  const h=harness((o,n)=>{if(n<=2)o.onerror(new Error('x'),false);else o.after();});
  h.run();h.fire();assert.equal(h.timers[0].ms,4000);
  h.c.__vaultAutoSaveCancel();h.timers.length=0;
  h.c.__vaultAutoSaveSchedule();h.fire();assert.equal(h.calls.length,3);
});

/* vaultSaveCurrent 자체 — 저장하지 않고 끝나는 두 길이 onskip 을 부르고, 다시 해도 안 되는 실패는 final 로 알린다 */
const saveCode=slice('  function vaultSaveCurrent(_o){','  try{window.__vaultSave=vaultSaveCurrent;}catch(_){}');
function saveCtx(extra){
  const toasts=[];
  const c=Object.assign({JSON,Date,Promise,toasts,toast:m=>toasts.push(m),_vaultAutoWriting:true,_vaultAutoStatus(){},
    psVaultRequireLogin:()=>true,restoreAnimBeforeCapture(){},curType:()=>'meeting',typeLabel:()=>'미팅자료',
    anim:{slides:[]},document:{body:{classList:{contains:()=>true}}}},extra||{});
  c.window=c;vm.createContext(c);vm.runInContext(saveCode+';this.__save=vaultSaveCurrent;',c);return c;
}
test('view-only and empty meetings end through onskip (the autosave lock is released)',()=>{
  let skipped=0;
  const ro=saveCtx({__vaultReadOnly:true});ro.__save({skipSheet:true,silent:true,onskip:()=>skipped++});
  assert.equal(skipped,1,'view-only');
  const empty=saveCtx({__vaultReadOnly:false,__meetSyncCur(){}});empty.__save({skipSheet:true,silent:true,onskip:()=>skipped++});
  assert.equal(skipped,2,'no slides');
});
test('no login reports a final failure (not retried)',()=>{
  let got=null;const c=saveCtx({psVaultRequireLogin:()=>false});
  c.__save({skipSheet:true,silent:true,onerror:(e,final)=>{got=final;}});
  assert.equal(got,true);
});
