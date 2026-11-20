'use strict';
/* 3.336 — 이 창이 본 뒤에 다른 창(또는 앞 문서)이 작업 보드 초안 칸(계정당 하나)을 바꾸면, 예전엔 이 창의 «아는 값»(known)이 다시 잡히지 않아
   창이 살아 있는 동안 편집마다 local-foreign · idb-cas 로 실패했다(«보드 저장» 뒤에도 — 새로고침해야 풀림 · 새 판 적용 · 팀 전환 장벽도 영영 막힘;
   운영 기록 11/12~11/19 update_deferred flush_fail:fBoard:board_draft_storage:idb-cas 최장 26시간 · local-foreign 13시간).
   이제 자리를 내줄 남의 사본을 보관 키(…:kept:split-<지문>)에 글자 그대로 옮겨 되읽어 확인한 뒤 지금 저장소 값을 기준으로 이어 쓴다(board-draft.js adopt).
   보관을 못 하거나 그 사이 칸이 또 바뀌면 예전처럼 막고 남의 사본을 건드리지 않는다. 합성 값만 쓴다. */
const test=require('node:test'),assert=require('node:assert/strict');
const Draft=require(process.env.PS_BOARD_DRAFT_MODULE||'../studio/board-draft.js');
const tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const owner={uid:'synthetic-adopt',wid:'synthetic-personal'},KEY='ps_private_board_draft_v1:synthetic-adopt:unsaved';
/* 저장소 하나를 같이 쓰는 창(문서) 여럿 — 실제로는 같은 출처의 작은 저장소 · IndexedDB */
function stores(){
  const local=new Map(),idb=new Map(),hooks={};let clock=100;
  return {local,idb,hooks,now:()=>++clock,
    kept:()=>[...idb].filter(([k])=>k.includes(':kept:split-')).map(([,v])=>v),
    record:(raw,at)=>JSON.stringify({v:1,uid:owner.uid,wid:owner.wid,raw,at})};
}
function windowOn(s,name){
  let seq=1,raw=JSON.stringify({snap:{players:[{id:name,x:1}]}}),active=true,borrowed=false;const states=[],notes=[];
  const d={context:()=>({owner,seq,generation:1,current:active,needed:true,blocked:borrowed,borrowed}),key:()=>KEY,capture:()=>({raw}),now:s.now,
    local:{getItem:k=>s.local.get(k)??null,setItem(k,v){s.local.set(k,v);},removeItem(k){s.local.delete(k);}},
    storage:{async get(k){if(s.hooks.get)await s.hooks.get(k,name);return s.idb.has(k)?{value:s.idb.get(k)}:null;},async peek(k){return s.idb.has(k)?{value:s.idb.get(k)}:null;},
      async replaceIfValue(k,b,v,guard){if(s.hooks.cas)await s.hooks.cas(k,name);guard();if((s.idb.get(k)??null)!==b)return false;s.idb.set(k,v);return true;},
      async delIfValue(k,v,guard){guard();if(s.idb.get(k)!==v)return false;s.idb.delete(k);return true;}},
    async verifyIDB(k,v){if(s.hooks.verify)await s.hooks.verify(k,name);assert.equal(s.idb.get(k),v);},
    recoverLocal:async()=>true,state:x=>states.push(x),note:(why,m)=>notes.push([why,m])};
  const api=Draft.create(d);
  return {api,d,states,notes,get raw(){return raw;},edit(n){seq++;raw=JSON.stringify({snap:{players:[{id:name,x:n}]}});},boot(){api.observe(owner,s.local.get(KEY)??null,s.idb.get(KEY)??null);},
    lock(){active=false;},borrow(){borrowed=true;},main:()=>{const v=s.idb.get(KEY);return v?JSON.parse(v).raw:null;}};
}
const ok=p=>p.then(()=>'ok',e=>(e&&e.psWhy)||String(e));

test('two windows: the window that booted first keeps saving after the other one wrote the shared draft',async()=>{
  const s=stores(),a=windowOn(s,'A');a.boot();assert.equal(await ok(a.api.ready()),'ok');
  const b=windowOn(s,'B');b.boot();                                   // B 는 A 의 초안을 보고 부팅
  b.edit(2);assert.equal(await ok(b.api.ready()),'ok');               // B 가 칸을 바꾼다 — A 의 known 은 낡았다
  const fromB=s.idb.get(KEY);
  a.edit(3);assert.equal(await ok(a.api.ready()),'ok','예전: idb-cas (영영)');
  assert.equal(a.main(),a.raw,'보는 화면 = 저장된 초안');assert.ok(s.kept().includes(fromB),'B 의 초안은 보관 키에 글자 그대로');
  assert.equal(a.api.pending(),false);assert.equal(a.states.at(-1),'ok');assert.deepEqual(a.notes.map(n=>n[0]),['idb-cas']);
  a.edit(4);assert.equal(await ok(a.api.ready()),'ok');assert.equal(s.kept().length,1,'그 뒤 편집은 평소 길 — 보관이 늘지 않는다');
  b.edit(5);assert.equal(await ok(b.api.ready()),'ok','B 도 같은 처방으로 이어 쓴다');assert.equal(b.main(),b.raw);assert.equal(s.kept().length,2);
});

test('a lifecycle copy another document left in localStorage is archived, then removed, then replaced (local-foreign)',async()=>{
  const s=stores(),foreign=s.record(JSON.stringify({snap:{players:[{id:'gone',x:9}]}}),50);s.local.set(KEY,foreign);
  const w=windowOn(s,'W');                                            // known 없음 — 그 사본을 본 적이 없다
  assert.equal(await ok(w.api.ready()),'ok','예전: local-foreign (영영)');
  assert.deepEqual(s.kept(),[foreign]);assert.equal(s.local.has(KEY),false,'보관 · 확인한 사본만 걷었다');assert.equal(w.main(),w.raw);
  assert.equal(w.api.pending(),false);assert.equal(w.api.snapshot().localDurable,true);assert.deepEqual(w.notes.map(n=>n[0]),['local-foreign']);
  assert.deepEqual(w.notes[0][1],{ls:1,idb:0,kept:1,kb:0});
});

test('an unobserved older IDB draft is archived before it is replaced (idb-cas with no observation)',async()=>{
  const s=stores(),old=s.record('{"snap":{}}',7);s.idb.set(KEY,old);
  const w=windowOn(s,'W');assert.equal(await ok(w.api.ready()),'ok');assert.deepEqual(s.kept(),[old]);assert.equal(w.main(),w.raw);
});

test('a slot another window cleared («보드 저장» · «버리기») is simply reused (idb-gone)',async()=>{
  const s=stores(),a=windowOn(s,'A');a.boot();assert.equal(await ok(a.api.ready()),'ok');
  const b=windowOn(s,'B');b.boot();await b.api.clear(owner);assert.equal(s.idb.has(KEY),false);
  a.edit(2);assert.equal(await ok(a.api.ready()),'ok');assert.equal(a.main(),a.raw);assert.deepEqual(s.kept(),[],'지울 것도 보관할 것도 없다');assert.deepEqual(a.notes.map(n=>n[0]),['idb-gone']);
});

test('the failure is no longer sticky: an archive failure blocks exactly like before, and the next try succeeds',async()=>{
  const s=stores(),foreign=s.record('{"source":"other window"}',60);s.idb.set(KEY,foreign);const w=windowOn(s,'W');
  s.hooks.cas=k=>{if(k.includes(':kept:split-'))throw Error('synthetic archive failure');};
  assert.equal(await ok(w.api.ready()),'idb-cas');assert.equal(s.idb.get(KEY),foreign,'보관을 못 하면 덮지 않는다');
  assert.equal(w.api.pending(),true);assert.equal(w.api.snapshot().failed,true);assert.equal(w.states.at(-1),'fail');
  assert.ok([...s.idb].some(([k,v])=>k.includes(':kept:')&&!k.includes(':kept:split-')&&JSON.parse(v).raw===w.raw),'이 창의 편집은 따로 보관(예전 그대로)');
  delete s.hooks.cas;assert.equal(await ok(w.api.ready()),'ok','다음 시도(새 판 적용 · 화면 떠나기 장벽)가 다시 보고 이어 쓴다');
  assert.ok(s.kept().includes(foreign));assert.equal(w.main(),w.raw);assert.equal(w.api.pending(),false);
});

test('a slot that changes again while its foreign copy is being archived is never replaced',async()=>{
  const s=stores(),first=s.record('{"source":"first"}',60),gate=defer();s.idb.set(KEY,first);const w=windowOn(s,'W');
  s.hooks.verify=k=>k.includes(':kept:split-')?gate.promise:null;const work=ok(w.api.ready());await tick();await tick();
  const second=s.record('{"source":"second window write"}',70);s.idb.set(KEY,second);gate.resolve();
  assert.equal(await work,'idb-cas');assert.equal(s.idb.get(KEY),second,'그 사이에 온 값은 그대로');
  delete s.hooks.verify;assert.equal(await ok(w.api.ready()),'ok');assert.ok(s.kept().includes(first)&&s.kept().includes(second));assert.equal(w.main(),w.raw);
});

test('a foreign localStorage copy that changes during the archive is never removed',async()=>{
  const s=stores(),first=s.record('{"source":"lifecycle copy"}',60),gate=defer();s.local.set(KEY,first);const w=windowOn(s,'W');
  s.hooks.verify=k=>k.includes(':kept:split-')?gate.promise:null;const work=ok(w.api.ready());await tick();await tick();
  const again=s.record('{"source":"newer lifecycle copy"}',70);s.local.set(KEY,again);gate.resolve();
  assert.notEqual(await work,'ok');assert.equal(s.local.get(KEY),again);assert.equal(s.idb.has(KEY),false);
});

test('an explicit save or discard in the same window no longer leaves the next edit stuck behind a foreign copy',async()=>{
  const s=stores(),foreign=s.record('{"source":"other window"}',60);s.local.set(KEY,foreign);const w=windowOn(s,'W');
  s.hooks.cas=k=>{if(k.includes(':kept:split-'))throw Error('synthetic archive failure');};assert.equal(await ok(w.api.ready()),'local-foreign');delete s.hooks.cas;
  await w.api.clear(owner);assert.equal(s.local.get(KEY),foreign,'«보드 저장» · «버리기»는 남의 사본을 지우지 않는다(예전 그대로)');
  w.edit(2);assert.equal(await ok(w.api.ready()),'ok','예전: 같은 창에서 영영 local-foreign');assert.ok(s.kept().includes(foreign));assert.equal(w.main(),w.raw);
});

test('an observed divergent IDB copy is archived too when localStorage already belongs to someone else',async()=>{
  const s=stores(),lsSeen=s.record('{"source":"seen LS"}',10),idbSeen=s.record('{"source":"seen IDB"}',11),w=windowOn(s,'W');
  s.local.set(KEY,lsSeen);s.idb.set(KEY,idbSeen);w.boot();                       // 부팅 때 두 사본이 갈려 있었다(3.302 settle 의 경우)
  const other=s.record('{"source":"another lifecycle copy"}',12);s.local.set(KEY,other);   // 그 뒤 다른 문서가 작은 저장소를 바꿨다
  w.edit(2);assert.equal(await ok(w.api.ready()),'ok');
  assert.ok(s.kept().includes(other),'남의 작은 저장소 사본');assert.ok(s.kept().includes(idbSeen),'본 적 있지만 갈려 있던 IDB 사본도 보관 없이 덮지 않는다');assert.equal(w.main(),w.raw);
});

test('the synchronous lifecycle path still never overwrites an unobserved localStorage copy; the async path archives it afterwards',async()=>{
  const s=stores(),foreign=s.record('{"source":"unobserved"}',60);s.local.set(KEY,foreign);const w=windowOn(s,'W');
  const work=w.api.write({lifecycle:true});work.catch(()=>{});
  assert.equal(s.local.get(KEY),foreign,'동기 길은 그대로');assert.ok([...s.local].some(([k,v])=>k.includes(':kept:')&&JSON.parse(v).raw===w.raw),'이 창의 마지막 입력은 바로 따로');
  await work;assert.deepEqual(s.kept(),[foreign]);assert.equal(w.main(),w.raw);assert.equal(s.local.has(KEY),false);
});

test('a borrowed view never adopts: the captured working board is written only after the board returns',async()=>{
  const s=stores(),foreign=s.record('{"source":"other window"}',60);s.idb.set(KEY,foreign);const w=windowOn(s,'W');w.borrow();
  assert.notEqual(await ok(w.api.ready()),'ok');assert.equal(s.idb.get(KEY),foreign);assert.deepEqual(s.kept(),[]);
});

test('install reports adoptions as board_draft_adopted at most every 30 minutes per reason, with only counts',async()=>{
  const events=[],local=new Map(),idb=new Map(),rec=(raw,at)=>JSON.stringify({v:1,uid:owner.uid,wid:owner.wid,raw,at});
  const w={__csView:'board',_boardPrivateOwner:owner,_boardPrivateLoaded:true,_boardPrivateEditSeq:1,_boardPrivateGeneration:1,
    boardPrivateCurrent:()=>true,boardManualChanged:()=>true,restoreAnimBeforeCapture(){},boardDraftWriteNow(){},boardDraftKey:()=>KEY,
    boardLiveCapture:()=>({raw:JSON.stringify({snap:{n:w._boardPrivateEditSeq}})}),boardPrivateKey:()=>'ps_private_board_draft_v1:synthetic-adopt',
    localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){local.set(k,v);},removeItem(k){local.delete(k);}},
    storage:{async get(k){return idb.has(k)?{value:idb.get(k)}:null;},async peek(k){return idb.has(k)?{value:idb.get(k)}:null;},async replaceIfValue(k,b,v,guard){guard();if((idb.get(k)??null)!==b)return false;idb.set(k,v);return true;}},
    PSStorage:{async sharedVerified(k,v){assert.equal(idb.get(k),v);}},document:{body:{classList:{contains:()=>false}}},clearTimeout(){},setTimeout(){},
    parent:{PSSync:{event:(name,o)=>events.push([name,o])}}};
  const api=Draft.install(w),now=Date.now;let t=Date.now();
  const foreignIdb=n=>{idb.set(KEY,rec('{"other":'+n+'}',1));w._boardPrivateEditSeq++;};
  try{
    Date.now=()=>t;
    foreignIdb(1);await api.ready();foreignIdb(2);await api.ready();
    local.set(KEY,rec('{"lifecycle":1}',2));w._boardPrivateEditSeq++;await api.ready();
    t+=1800001;foreignIdb(3);await api.ready();
  }finally{Date.now=now;}
  assert.deepEqual(events.map(e=>[e[0],e[1].error_code,e[1].status,e[1].meta.n]),[['board_draft_adopted','idb-cas','ok',1],['board_draft_adopted','local-foreign','ok',1],['board_draft_adopted','idb-cas','ok',2]]);
  assert.deepEqual(Object.keys(events[0][1].meta).sort(),['idb','kb','kept','ls','n'],'이름 · 숫자만(내용 없음)');
  assert.ok([...idb.keys()].filter(k=>k.includes(':kept:unsaved-split-')).length>=4,'설치된 길의 보관 키는 recoveryKey(…:kept:unsaved-) 아래');
});
