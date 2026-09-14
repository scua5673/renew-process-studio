'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=[section('  function open(){','  function idbGet(k){'),
  section('  function idbDel(k,current){','  /* sync 회차'),section('  function afterMigrate(fn){','  /* 1.618')].join('\n');
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function harness(){
  const migration=deferred(),data=new Map([['synthetic-key','new account draft']]),state={uid:'A'},hooks={},calls={opens:[],transactions:0,deletes:[],guards:0};
  const db={transaction(_store,mode){
    assert.equal(mode,'readwrite');calls.transactions++;
    const transaction={objectStore:()=>({delete(k){calls.deletes.push(k);data.delete(k);}})};
    if(hooks.transaction)hooks.transaction();
    setImmediate(()=>{if(transaction.oncomplete)transaction.oncomplete();});
    return transaction;
  }};
  const c=vm.createContext({Promise,Error,DB:'synthetic-db',VER:1,STORE:'kv',dbp:null,migrated:migration.promise,
    indexedDB:{open(){const request={result:db};calls.opens.push(request);return request;}},window:{}});
  vm.runInContext(code,c);
  function current(){calls.guards++;if(state.uid!=='A'){const e=new Error('owner changed');e.psDataLocked=true;throw e;}}
  function releaseOpen(){assert.equal(calls.opens.length,1);calls.opens[0].onsuccess();}
  return{c,migration,data,state,hooks,calls,current,releaseOpen};
}
for(const outcome of ['resolved','rejected'])test('owner changed while migration waits: '+outcome+' migration cannot enqueue any deletion',async()=>{
  const h=harness(),pending=h.c.window.storage.del('synthetic-key',h.current),rejected=assert.rejects(pending,/owner changed/);
  h.state.uid='B';if(outcome==='resolved')h.migration.resolve();else h.migration.reject(Error('synthetic migration failure'));
  await rejected;assert.equal(h.calls.opens.length,0);assert.equal(h.calls.transactions,0);assert.deepEqual(h.calls.deletes,[]);assert.equal(h.data.get('synthetic-key'),'new account draft');
});
test('owner changed while IndexedDB opens: actual transaction submits zero delete requests',async()=>{
  const h=harness(),pending=h.c.window.storage.del('synthetic-key',h.current),rejected=assert.rejects(pending,/owner changed/);
  h.migration.resolve();await tick();assert.equal(h.calls.opens.length,1);assert.equal(h.calls.guards,1);
  h.state.uid='B';h.releaseOpen();await rejected;
  assert.equal(h.calls.transactions,1);assert.deepEqual(h.calls.deletes,[]);assert.equal(h.data.get('synthetic-key'),'new account draft');assert.equal(h.calls.guards,2);
});
test('transaction-time owner check runs immediately before the delete request',async()=>{
  const h=harness(),pending=h.c.window.storage.del('synthetic-key',h.current),rejected=assert.rejects(pending,/owner changed/);
  h.migration.resolve();await tick();h.hooks.transaction=()=>{h.state.uid='B';};h.releaseOpen();await rejected;
  assert.deepEqual(h.calls.deletes,[]);assert.equal(h.data.get('synthetic-key'),'new account draft');
});
for(const guarded of [true,false])test((guarded?'unchanged guarded owner':'existing one-argument caller')+' still deletes after transaction completion',async()=>{
  const h=harness(),pending=guarded?h.c.window.storage.del('synthetic-key',h.current):h.c.window.storage.del('synthetic-key');
  let completed=false;pending.then(()=>{completed=true;});h.migration.resolve();await tick();assert.equal(completed,false);h.releaseOpen();await pending;
  assert.deepEqual(h.calls.deletes,['synthetic-key']);assert.equal(h.data.has('synthetic-key'),false);assert.equal(h.calls.guards,guarded?2:0);assert.equal(completed,true);
});
