'use strict';
// 3.284 — 보관된 선수 행(journal items-stale-device + 기기 묶음 영수증)은 «올릴 차례의 변경»이 아니다.
// sync-items-stale.js: archived(job) — 이 요청이 이미 활성 보관에 있다 · held(receipt) — 기기 묶음 영수증이 모두 활성 보관 안에 있다 ·
// 모듈 접근자 PSItemsStale.held/archived(셸 밖 선수단 화면이 묻는 길). storage.js: 그 실패의 알약은 «일부 변경 보관 — 앱 설정 › 데이터 › 보관된 변경».
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const J=require('../studio/autosave-journal.js');
const Q=require('../studio/sync-items-stale.js');
const R=require('../studio/roster-outbox.js');
const S=require('../studio/autosave-status.js');
const raw=JSON.stringify;
const ROW='sq:p1';
const BASE=raw({id:'p1',name:'Synthetic original',memo:'baseline'});
const A=raw({id:'p1',name:'Synthetic original',memo:'authored A'});
const B=raw({id:'p1',name:'Synthetic original',memo:'other writer B'});
const C=raw({id:'p1',name:'Synthetic original',memo:'latest writer C'});
const PERMISSION=raw({role:'admin',edit:{team:true,scout:true}});
function stale(job,stage='items_write_stale_job'){return Object.assign(Error('synthetic stale preimage'),{psCode:'sync_local_changed',psStage:stage,psItemsJob:job,psItemId:'p1'});}
function fixture(){
  let owner={uid:'synthetic-coach-a',wid:'synthetic-team-a',seal:'seal-a',epoch:'epoch-a',signout:0},permission=PERMISSION,uuid=0,at=1000;
  let context={uid:owner.uid,wid:owner.wid,seal:'autosave-seal-a',epoch:'epoch-a'};
  const disk=new Map([[ROW,B]]),localDisk=new Map();
  const localStorage={get length(){return localDisk.size;},key:i=>[...localDisk.keys()][i]??null,getItem:k=>localDisk.get(k)??null,setItem(k,v){localDisk.set(k,String(v));},removeItem(k){localDisk.delete(k);}};
  const outbox=R.create({storage:localStorage,owner:()=>context?{uid:context.uid,wid:context.wid}:null});
  const storage={
    async get(k){return disk.has(k)?{value:disk.get(k)}:null;},
    async set(k,v){disk.set(k,v);return true;},
    async keys(){return [...disk.keys()];},
    async replaceIfValue(k,before,value){if((disk.get(k)??null)!==before)return false;if(value===null)disk.delete(k);else disk.set(k,value);return true;},
    async setIfValues(k,expected,value,checks,current){if(current&&current()!==true)throw Error('guard');if((disk.get(k)??null)!==expected||Object.keys(checks).some(key=>(disk.get(key)??null)!==checks[key]))return false;disk.set(k,value);return true;}
  };
  const journal=J.create({storage,context:()=>context,hash:J.hash,randomUUID:()=>'00000000-0000-4000-8000-'+String(++uuid).padStart(12,'0'),now:()=>at++});
  const same=o=>!!o&&!!owner&&['uid','wid','seal','epoch','signout'].every(k=>o[k]===owner[k]);
  const deps={context:()=>context,journal:()=>journal,current:same,permission:()=>permission,storage,hash:J.hash,createJournal:J.create,journalPrefix:J.PREFIX,outbox:()=>outbox};
  const job=(intent,players=A,seq=1)=>({players:[JSON.parse(players)],owner:{...owner},at:50+seq,sequence:seq,expected:{p1:BASE},written:[],predecessors:[],patch:true,permission,changedIds:['p1'],deletedIds:[],pendingIntent:intent?JSON.parse(raw(intent)):null});
  const stage=(players,base=BASE)=>outbox.stage({players:[JSON.parse(players)],basePlayers:[JSON.parse(base)],changedIds:['p1'],deletedIds:[]});
  const archiveRows=async()=>journal.list({...context});
  return {api:Q.create(deps),deps,journal,disk,outbox,job,stage,archiveRows,get context(){return context;},move(change){owner={...owner,...change};context={uid:owner.uid,wid:owner.wid,seal:'autosave-'+owner.seal,epoch:owner.epoch};}};
}
async function archivedFixture(){
  const h=fixture(),intent=h.stage(A),job=h.job(intent);
  await h.api.background(()=>Promise.reject(stale(job)));
  const row=(await h.archiveRows()).find(r=>r.reason==='items-stale-device'),value=await h.journal.read({...h.context},row.id);
  return {h,intent,job,row,value};
}

test('archived(job): 같은 영수증 · 같은 입력의 새 요청(새 sequence · at)은 활성 보관에 있다 — 다른 입력 · 다른 영수증 · 영수증 없음은 아니다',async()=>{
  const {h,intent,job}=await archivedFixture();
  assert.equal(h.api.archived(job),true,'보관한 그 작업');
  assert.equal(h.api.archived(h.job(intent,A,99)),true,'같은 영수증 · 같은 입력을 다시 올린 작업(선수단 화면의 재시도 폐쇄)');
  assert.equal(h.api.retired(h.job(intent,A,99)),false,'아직 고르지 않았으니 retired 는 아니다');
  assert.equal(h.api.archived(h.job(intent,C,99)),false,'같은 영수증이라도 다른 입력(C)은 새 요청');
  assert.equal(h.api.archived(h.job(h.stage(C),C,99)),false,'새 영수증(새 묶음)은 새 요청');
  assert.equal(h.api.archived(h.job(null,A,99)),false,'영수증 없는 요청은 원문이 글자 그대로 같을 때만');
  assert.equal(h.api.fenced(ROW),true,'보관 자체는 그대로(행은 여전히 fenced)');
  assert.equal((await h.archiveRows()).filter(r=>r.reason==='items-stale-device').length,1);
});

test('배경 회차가 같은 요청의 새 작업(새 sequence · at)을 또 받아도 보관을 하나 더 만들지 않고 기존 보관으로 증서를 준다 — 다른 입력 · 행을 일부 쓴 작업은 새 보관',async()=>{
  const {h,intent,job}=await archivedFixture();
  const again=h.job(intent,A,99);
  assert.deepEqual(await h.api.background(()=>Promise.reject(stale(again,'items_stale_review'))),{held:true,quarantined:true});
  assert.equal((await h.archiveRows()).filter(r=>r.reason==='items-stale-device').length,1,'같은 요청은 보관을 늘리지 않는다');
  assert.equal(h.api.skip(again),true,'다음 회차는 그 작업을 건너뛴다');assert.equal(h.api.skip(job),true);
  const other=h.job(intent,C,100);
  await h.api.background(()=>Promise.reject(stale(other,'items_stale_review')));
  assert.equal((await h.archiveRows()).filter(r=>r.reason==='items-stale-device').length,2,'다른 입력은 제 보관을 받는다');assert.equal(h.api.skip(other),true);
  const partial=h.job(intent,A,101);partial.written.push({id:'p1',before:BASE,after:A});
  await h.api.background(()=>Promise.reject(stale(partial,'items_stale_review')));
  assert.equal((await h.archiveRows()).filter(r=>r.reason==='items-stale-device').length,3,'행을 일부 쓴 작업은 그 흔적이 남게 제 보관을 받는다');
  partial.written.push({id:'p1',before:A,after:C});assert.equal(h.api.skip(partial),false,'바뀐 작업은 옛 증서를 못 쓴다(3.217)');
});

test('held(receipt): 기기 묶음 영수증이 모두 활성 보관의 영수증 안에 있을 때만 참 — 새 묶음이 섞이면 거짓',async()=>{
  const {h,intent}=await archivedFixture();
  assert.equal(h.api.held(intent),true,'보관한 영수증 그대로');
  assert.equal(h.api.held(h.outbox.read()),true,'기기 묶음을 다시 읽은 영수증(부팅의 rosterResumeRows)도 같은 출처');
  assert.equal(h.api.held({rows:[]}),false);assert.equal(h.api.held(null),false);assert.equal(h.api.held({rows:[{id:'p1',token:'x',sources:[]}]}),false);
  const later=h.stage(C);   // 같은 선수의 새 입력 → 새 묶음(출처 둘)
  assert.equal(h.api.held(later),false,'새 출처가 있는 영수증은 올릴 차례의 변경');
  assert.equal(h.api.held(h.outbox.read()),false,'기기 묶음 전체도 이제 held 가 아니다');
  assert.equal(h.api.held(intent),true,'보관한 옛 영수증 자체는 여전히 held(출처가 보관 안에 있다)');
});

test('고른 뒤(현재 기기 사본 유지)에는 archived · held 가 거짓이고 retired 만 참 — 보관 원문은 그대로',async()=>{
  const {h,intent,job,row,value}=await archivedFixture(),before=[...h.disk.entries()];
  const view=await h.api.prepare(row,value,()=>true);await h.api.resolve(row,value,view,()=>true);
  assert.equal(h.api.archived(job),false);assert.equal(h.api.archived(h.job(intent,A,99)),false);
  assert.equal(h.api.retired(h.job(intent,A,99)),true);
  assert.equal(h.api.held(intent),false,'고른 영수증은 settle 돼 더는 «보관 중»이 아니다');
  assert.equal(h.outbox.pending(),false);
  for(const [k,v] of before)assert.equal(h.disk.get(k),v,'원문 불변');
});

test('안 읽혔거나 계정 · 팀이 바뀌면 둘 다 거짓(fail-closed) — 다시 읽으면 돌아온다',async()=>{
  const {h,intent,job}=await archivedFixture();
  const fresh=Q.create(h.deps);
  assert.equal(fresh.archived(job),false);assert.equal(fresh.held(intent),false);
  await fresh.load();assert.equal(fresh.archived(job),true);assert.equal(fresh.held(intent),true);
  h.move({seal:'other-generation',epoch:'epoch-b'});
  assert.equal(fresh.archived(job),false);assert.equal(fresh.held(intent),false);
});

test('모듈 접근자 PSItemsStale.held/archived 는 마지막 인스턴스에 묻는다 — 인스턴스가 없으면 거짓',async()=>{
  const {h,intent,job}=await archivedFixture();   // 이 fixture 의 인스턴스가 마지막
  assert.equal(Q.held(intent),true);assert.equal(Q.archived(job),true);
  assert.equal(Q.held({rows:[]}),false);assert.equal(Q.archived(null),false);
  const other=fixture();   // 새 인스턴스(아직 안 읽힘)가 마지막이 된다
  assert.equal(Q.held(intent),false);assert.equal(Q.archived(job),false);
  await other.api.load();assert.equal(Q.held(intent),false,'다른 기기 묶음 · 보관 없음');
  void h;
});

/* storage.js 의 PSSaveState 알약 — 저장 상태 구간을 잘라 돌린다(storage-recovery-notice 와 같은 방법). 선수 행 보관 오류(psStage items_stale_* · items_write_stale_*)면
   «일부 변경 보관 + PATH_HELD», 다른 실패는 예전 문장. */
function pillHarness(){
  const source=fs.readFileSync(path.join(__dirname,'..','studio','storage.js'),'utf8');
  /* 구간은 코드로 찾는다(주석 기준점 래칫): LABEL 표가 있는 IIFE 의 시작 ~ ps-storage-recovered 리스너 뒤 IIFE 의 끝 */
  const l=source.indexOf("var LABEL={saving:'저장 중…'"),a=source.lastIndexOf('(function(){',l),r=source.indexOf("window.addEventListener('ps-storage-recovered'",l),b=source.indexOf('})();',r)+5;
  assert.ok(l>0&&a>=0&&a<l&&r>l&&b>r,'PSSaveState 구간');
  const local=new Map();const owner=(uid,wid)=>{local.set('ps_sync_session',raw({uid}));local.set('ps_active_ws',wid);local.set('ps_cache_owner_v1',raw({uid,wid}));};owner('fixture-a','fixture-team-a');
  function node(tag){return {tagName:tag,id:'',children:[],style:{},isConnected:false,_text:'',innerHTML:'',set textContent(v){this._text=String(v);this.children=[];},get textContent(){return this._text+this.children.map(c=>c.textContent).join('');},setAttribute(){},appendChild(n){n.parentNode=this;n.isConnected=true;this.children.push(n);return n;},remove(){this.isConnected=false;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}};}
  const body=node('body');body.isConnected=true;
  function find(id,n=body){if(n.id===id)return n;for(const child of n.children){const m=find(id,child);if(m)return m;}return null;}
  const c={Promise,Object,String,JSON,Date,console:{warn(){}},document:{body,createElement:node,createTextNode:t=>({nodeType:3,textContent:String(t)}),getElementById:find},
    localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
    setTimeout(){return 1;},clearTimeout(){},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},
    addEventListener(){},dispatchEvent(){},PSStorageDiagnostic(){},PSStorage:{quotaState:()=>({checking:false})},PSAutosaveStatus:S};
  c.window=c;vm.createContext(c);vm.runInContext(source.slice(a,b),c);
  return {c,find,pill:()=>{const el=find('psSaveFailed');if(!el)return null;const t=el.children[0];return t.children.length?t.textContent:t.innerHTML;}};
}
test('알약: 선수 행 보관 오류는 «일부 변경 보관 — 앱 설정 › 데이터 › 보관된 변경», 다른 실패는 «저장되지 않았습니다 · 앱을 닫으면 …»',()=>{
  const h=pillHarness();
  h.c.PSSaveState.fail('team',Object.assign(Error('선수 입력 원문을 보관했습니다'),{psCode:'sync_local_changed',psStage:'items_stale_review'}));
  const held=h.pill();assert.ok(held,'알약이 뜬다');
  assert.match(held,/^⚠ 일부 변경 보관/);assert.ok(held.includes(S.paths.held),held);assert.ok(!held.includes('앱을 닫으면'),held);
  h.c.PSSaveState.ok('team');assert.equal(h.pill(),null,'행이 held 로 끝나면 알약이 내려간다');
  h.c.PSSaveState.fail('team',Object.assign(Error('stale'),{psCode:'sync_local_changed',psStage:'items_write_stale_job'}));
  assert.match(h.pill(),/^⚠ 일부 변경 보관/);h.c.PSSaveState.ok('team');
  h.c.PSSaveState.fail('schedule',Error('quota'));
  assert.equal(h.pill(),'⚠ <b>저장되지 않았습니다.</b><br>앱을 닫으면 방금 편집이 사라집니다.','다른 실패는 예전 문장(innerHTML)');
  h.c.PSSaveState.ok('schedule');
  delete h.c.PSAutosaveStatus;   // autosave-status.js 를 싣지 않은 화면 — 길을 모르면 예전 문장
  h.c.PSSaveState.fail('team',Object.assign(Error('stale'),{psStage:'items_stale_review'}));
  assert.match(h.pill(),/저장되지 않았습니다/);
});
