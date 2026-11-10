'use strict';
/* 0976735a — 작전판 초안 저장 실패(psCode board_draft_storage)에 짧은 까닭(psWhy)이 붙고, 새 판 적용 미뤄짐 기록
   (update_deferred 의 error_code · meta.stage/reason)까지 간다. 판정 · 차례는 그대로다(tests/board-draft-transition 이 지킨다). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {create,install}=require('../studio/board-draft.js'),Update=require('../studio/update-client.js');
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 const local=new Map(),idb=new Map(),hooks={};
 let owner={uid:'synthetic-a',wid:'personal-a'},seq=1,current=true,blocked=false,why='',borrowed=false,paused=false,raw=JSON.stringify({snap:{players:[{x:1}]}});
 const d={context:()=>({owner,seq,generation:1,current,blocked,why,borrowed,paused,needed:true}),capture:()=>hooks.nocap?null:({raw}),key:o=>'ps_private_board_draft_v1:'+o.uid+':unsaved',now:()=>123,
  local:{getItem:k=>local.get(k)??null,setItem(k,v){if(hooks.quota)throw Error('synthetic quota');local.set(k,v);},removeItem(k){local.delete(k);}},
  storage:{async get(k){if(hooks.get)await hooks.get(k);return idb.has(k)?{value:idb.get(k)}:null;},async peek(k){return idb.has(k)?{value:idb.get(k)}:null;},
   async replaceIfValue(k,b,v,guard){if(hooks.cas)await hooks.cas(k);guard();if((idb.get(k)??null)!==b)return false;idb.set(k,v);return true;}},
  async verifyIDB(k,record){if(idb.get(k)!==record)throw Error('not durable');}};
 return {api:create(d),d,local,idb,hooks,key:d.key(owner),set(o){if('seq' in o)seq=o.seq;if('current' in o)current=o.current;if('blocked' in o)blocked=o.blocked;if('why' in o)why=o.why;if('borrowed' in o)borrowed=o.borrowed;if('paused' in o)paused=o.paused;if('owner' in o)owner=o.owner;if('raw' in o)raw=o.raw;}};
}
const why=p=>p.then(()=>null,e=>({code:e.psCode,why:e.psWhy,deferred:!!e.psDeferred,conflict:!!e.psConflict}));
test('blocked contexts name what blocked them',async()=>{
 const h=harness();h.set({blocked:true,why:'vault-edit'});
 assert.deepEqual(await why(h.api.ready()),{code:'board_draft_storage',why:'blocked:vault-edit',deferred:false,conflict:false});
 h.set({why:''});assert.equal((await why(h.api.ready())).why,'blocked:x');
});
test('a borrowed view without a source certificate says so and stays deferred',async()=>{
 const h=harness();h.set({blocked:true,borrowed:true,why:'view'});
 assert.deepEqual(await why(h.api.ready()),{code:'board_draft_storage',why:'view:no-job',deferred:true,conflict:false});
});
test('a guarded owner with no durable receipt, a later edit, and an owner change are told apart',async()=>{
 const a=harness();a.set({current:false});assert.equal((await why(a.api.ready())).why,'guard:no-job');
 const b=harness();await b.api.ready();b.set({current:false,seq:2});assert.equal((await why(b.api.ready())).why,'guard:seq');
 const c=harness();await c.api.ready();c.set({current:false,owner:{uid:'synthetic-b',wid:'personal-b'}});assert.equal((await why(c.api.ready())).why,'guard:owner');
});
test('capture failure, a foreign newer IDB draft and an edit during the write each carry their own reason',async()=>{
 const a=harness();a.hooks.nocap=true;assert.equal((await why(a.api.ready())).why,'capture');
 const b=harness();b.idb.set(b.key,JSON.stringify({v:1,uid:'synthetic-a',wid:'personal-a',raw:'{}',at:999}));
 assert.deepEqual(await why(b.api.ready()),{code:'board_draft_storage',why:'idb-cas',deferred:false,conflict:true});
 const c=harness();let release;c.hooks.cas=()=>new Promise(r=>release=r);const work=why(c.api.ready());await tick();c.set({seq:2});release();
 assert.equal((await work).why,'seq');
});
test('every thrown draft error has a machine-safe reason and no site is left bare',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../studio/board-draft.js'),'utf8');
 assert.equal(/\b(error|changed)\(\)/.test(source),false,'error()/changed() without a reason');
 const tags=[...source.matchAll(/(?:error\((?:null|c),|changed\()'([^']+)'/g)].map(m=>m[1]);
 assert.ok(tags.length>=25,'tagged sites: '+tags.length);
 for(const t of tags)assert.match(t,/^[a-z0-9:-]{2,40}$/);
});
test('the installed context names the blocker without changing the blocked decision',()=>{
 const flags={},classes=new Set(),w={__csView:'board',_boardPrivateOwner:{uid:'u',wid:'w'},_boardPrivateLoaded:true,_boardPrivateEditSeq:1,_boardPrivateGeneration:1,
  boardPrivateCurrent:()=>true,boardManualChanged:()=>true,restoreAnimBeforeCapture(){},boardDraftWriteNow(){},boardLiveCapture:()=>({raw:'{}'}),boardDraftKey:()=>'k',localStorage:{getItem:()=>null},storage:{},
  document:{body:{classList:{contains:c=>classes.has(c)}}},clearTimeout(){},setTimeout(){},PSStorage:{}};
 const api=install(w);assert.ok(api);
 const state=()=>api.snapshot().blocked;
 assert.equal(state(),false);
 w.__vaultEdit=true;assert.equal(state(),true);
 return api.ready().then(()=>assert.fail('must reject'),e=>{assert.equal(e.psWhy,'blocked:vault-edit');w.__vaultEdit=false;classes.add('editing');return api.ready();}).then(()=>assert.fail('must reject'),e=>assert.equal(e.psWhy,'blocked:editing'));
});
test('the shell appends the reason to flush_fail and the wording stops calling an open vault editor a storage failure',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
 assert.match(app,/'flush_fail:'\+\(\(e&&e\.psFrame\)\|\|'\?'\)\+':'\+\(\(e&&\(e\.psCode\|\|e\.name\)\)\|\|'\?'\)\+\(e&&e\.psWhy\?':'\+e\.psWhy:''\)/);
 const code='flush_fail:fBoard:board_draft_storage:blocked:vault-edit';
 assert.ok(code.length<=80&&/^[a-zA-Z0-9_.:+-]+$/.test(code),'survives psUpdNote/record sanitising');
 assert.match(Update.reason(code),/편집 중인 자료를 저장하거나 닫으면/);
 assert.match(Update.reason('flush_fail:fBoard:board_draft_storage:idb-cas'),/작전판의 기기 저장을 확인하지 못해/);
 assert.match(Update.reason('flush_fail:fBoard:board_draft_storage'),/작전판의 기기 저장을 확인하지 못해/);
 // meta 는 safeEventMeta 가 받는 모양 그대로: 까닭은 문자열 칸(stage · reason)에만 실린다
 const records=[],w={PS_BUILD:'4.001',navigator:{},document:{hidden:true},PSSync:{session:()=>({uid:'coach'}),event:(name,opts)=>records.push(opts)}};
 Update.create(w).record('deferred',code);
 assert.equal(records[0].error_code,code);assert.equal(records[0].meta.reason,code);assert.equal(records[0].meta.stage,'deferred');
});
