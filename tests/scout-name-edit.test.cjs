'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ScoutStore=require('../studio/scouting-store.js');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const begin=source.indexOf('function scNameEditBegin(input){');
const end=source.indexOf('/* ── 핵심 속성 나란히 비교',begin);
assert.ok(begin>=0&&end>begin);
const implementation=source.slice(begin,end);

function setup(){
  const doc=ScoutStore.reconcile(null,{v:1,players:[{id:'candidate-1',type:'target',name:'기존 이름',club:'기존 팀',num:'9',memos:['기존 메모']}]});
  const state={owner:'team-A/account-A',allowed:true,ready:true,saves:[],boards:0,profiles:[],warnings:[],timers:[],saveResult:true};
  const client={state:{owner:state.owner,doc},check(){if(!state.allowed)throw new Error('권한 변경');if(!state.ready)throw new Error('자료 변경');}};
  let stamp=0;
  const p=ScoutStore.project(()=>client.state.doc,doc.players[0],(id,k,v)=>{
    client.check();ScoutStore.edit(client.state.doc,id,k,v,{at:++stamp,id:'name-edit'});
  });
  const data={players:[p],positions:[]};
  const listeners={};
  const box={parentElement:null,innerHTML:'',querySelectorAll:()=>[],addEventListener(type,fn){(listeners[type]||(listeners[type]=[])).push(fn);}};
  const c=vm.createContext({data,PSScoutStore:ScoutStore,scStore:()=>client,scWarn:e=>state.warnings.push(e.message),toast:m=>state.warnings.push(m),
    save(){if(state.saveError)throw state.saveError;state.saves.push(JSON.parse(JSON.stringify(client.state.doc)));return state.saveResult;},renderScoutBoard(){state.boards++;},
    setTimeout(fn){state.timers.push(fn);},
    $:id=>id==='scList'?box:null,scRenderTools(){},renderScDbHits(){},scSearchQ:'',scSort:'pos',sbShow:'tgt',
    scMemos:p=>p.memos||[],scStOf:()=>['rep','추천','#000'],scoutFit:()=>0,sbAge:()=>null,SB_GRADES:['A','B','C','D'],
    catAvgCellsHTML:()=>'',esc:v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    document:{addEventListener(){}},openPlayer:id=>state.profiles.push(id)
  });
  vm.runInContext(implementation,c,{filename:'scout-name-edit.js'});
  c.renderScoutCands();
  function emit(type,target,extra={}){
    const e={target,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};
    (listeners[type]||[]).forEach(fn=>fn(e));return e;
  }
  const profile={attrs:{'aria-label':p.name+' 프로필 수정'},setAttribute(k,v){this.attrs[k]=v;}};
  const row={querySelector:s=>s==='[data-sccard]'?profile:null};
  const input={dataset:{scname:p.id},value:p.name,defaultValue:p.name,isConnected:true,title:p.name,attrs:{},
    closest(selector){return selector==='.sc-row'?row:selector==='[data-scname]'||selector==='input,.sc-notes'?this:null;},
    setAttribute(k,v){this.attrs[k]=v;},blur(){emit('focusout',this);}};
  const focus=()=>emit('focusin',input);
  const key=(key,extra)=>emit('keydown',input,{key,...extra});
  const flush=()=>{while(state.timers.length)state.timers.shift()();};
  return {c,data,p,client,state,box,input,profile,emit,focus,key,flush};
}

test('the actual candidate list exposes a native name input and name clicks never open the profile',()=>{
  const h=setup();
  assert.match(h.box.innerHTML,/<input type="text" class="sc-name" data-scname="candidate-1"/);
  h.focus();const e=h.emit('click',h.input);
  assert.equal(e.stopped,true);assert.deepEqual(h.state.profiles,[]);assert.equal(h.state.saves.length,0);
  h.emit('click',{closest:s=>s==='[data-sccard]'?{dataset:{sccard:h.p.id}}:null});
  assert.deepEqual(h.state.profiles,[h.p.id]);
});

test('blur commits a trimmed name through the shared candidate registry and preserves other fields',()=>{
  const h=setup();h.focus();h.input.value='  변경한 이름  ';h.emit('focusout',h.input);
  assert.equal(h.p.name,'변경한 이름');assert.equal(h.input.value,'변경한 이름');
  assert.equal(h.state.saves.length,1);assert.equal(h.state.boards,1);
  assert.equal(h.state.saves[0].scoutRegistry.candidates['target:candidate-1'].info.name,'변경한 이름');
  assert.equal(h.p.club,'기존 팀');assert.equal(h.p.num,'9');assert.deepEqual(h.p.memos,['기존 메모']);
  assert.equal(h.profile.attrs['aria-label'],'변경한 이름 프로필 수정');
  assert.equal(h.input.attrs['aria-label'],'변경한 이름 이름 편집');
});

test('Enter commits once despite its subsequent blur, while Escape reverts without saving',()=>{
  const h=setup();h.focus();h.input.value='Enter 이름';assert.equal(h.key('Enter').prevented,true);
  assert.equal(h.state.saves.length,1);assert.equal(h.p.name,'Enter 이름');
  h.focus();h.input.value='취소할 이름';assert.equal(h.key('Escape').prevented,true);
  assert.equal(h.input.value,'Enter 이름');assert.equal(h.p.name,'Enter 이름');assert.equal(h.state.saves.length,1);
});

test('empty and unchanged names never write or remove a candidate from the list',()=>{
  const h=setup();h.focus();h.input.value=' \n ';h.key('Enter');
  assert.equal(h.p.name,'기존 이름');assert.equal(h.input.value,'기존 이름');assert.equal(h.state.warnings.length,1);
  h.focus();h.input.value=' 기존 이름 ';h.emit('focusout',h.input);
  assert.equal(h.state.saves.length,0);assert.equal(h.data.players.length,1);
});

test('IME confirmation Enter is not intercepted or committed before composition ends',()=>{
  const h=setup();h.focus();h.emit('compositionstart',h.input);h.input.value='ㄱ';
  assert.equal(h.key('Enter',{isComposing:true}).prevented,false);
  assert.equal(h.key('Enter',{keyCode:229}).prevented,false);
  assert.equal(h.key('Enter').prevented,false);assert.equal(h.key('Escape').prevented,false);
  assert.equal(h.state.saves.length,0);
  h.emit('compositionend',h.input);h.input.value='김민준';h.key('Enter');
  assert.equal(h.p.name,'김민준');assert.equal(h.state.saves.length,1);
});

test('blur during composition waits for the final input value and still checks context at deferred commit',()=>{
  const h=setup();h.focus();h.emit('compositionstart',h.input);h.input.value='김ㅁ';h.emit('focusout',h.input);
  assert.equal(h.state.saves.length,0);h.emit('compositionend',h.input);h.input.value='김민준';h.flush();
  assert.equal(h.p.name,'김민준');assert.equal(h.state.saves.length,1);
  h.focus();h.emit('compositionstart',h.input);h.input.value='다른 이름';h.emit('focusout',h.input);h.emit('compositionend',h.input);
  h.client.state.owner='team-B/account-A';h.flush();
  assert.equal(h.p.name,'김민준');assert.equal(h.state.saves.length,1);
});

for(const [label,change]of [
  ['workspace/account switch',h=>{h.client.state.owner='team-B/account-B';}],
  ['permission revocation',h=>{h.state.allowed=false;}],
  ['unverified or externally replaced document',h=>{h.state.ready=false;}],
  ['candidate replacement with the same player ID',h=>{h.data.players=[{...h.p}];}],
  ['candidate identity change',h=>{h.p._scoutRef={id:'target:another'};}],
  ['candidate archived while editing',h=>{h.p._scoutHidden=true;}],
  ['candidate converted to our player',h=>{h.p.type='ours';}],
  ['candidate removed while editing',h=>{h.data.players=[];}]
])test('pending name edit cannot overwrite after '+label,()=>{
  const h=setup();h.focus();h.input.value='오래된 편집';change(h);h.emit('focusout',h.input);
  assert.equal(h.state.saves.length,0);assert.equal(h.client.state.doc.scoutRegistry.candidates['target:candidate-1'].info.name,'기존 이름');
});

test('a newer name edit wins over an older still-focused input',()=>{
  const h=setup();h.focus();h.input.value='오래된 이름';h.p.name='다른 곳의 최신 이름';h.key('Enter');
  assert.equal(h.p.name,'다른 곳의 최신 이름');assert.equal(h.state.saves.length,0);assert.equal(h.state.warnings.length,1);
});

test('removed DOM inputs cannot commit and a failed permission check cannot start an edit',()=>{
  const h=setup();h.focus();h.input.value='사라진 입력';h.input.isConnected=false;h.emit('focusout',h.input);
  assert.equal(h.p.name,'기존 이름');assert.equal(h.state.saves.length,0);
  h.input.isConnected=true;h.state.allowed=false;h.focus();h.input.value='권한 없는 입력';h.key('Enter');
  assert.equal(h.p.name,'기존 이름');assert.equal(h.input.value,'기존 이름');assert.equal(h.state.saves.length,0);
  h.state.allowed=true;h.focus();h.input.value='허용된 편집';h.key('Enter');
  h.state.allowed=false;h.focus();h.input.value='다시 권한 없는 입력';h.emit('focusout',h.input);
  assert.equal(h.p.name,'허용된 편집');assert.equal(h.input.value,'허용된 편집');assert.equal(h.state.saves.length,1);
});

for(const failure of ['returns false','throws'])test('a save that '+failure+' warns and retains the local name for a later retry',()=>{
  const h=setup();h.focus();h.input.value='아직 저장되지 않은 이름';
  if(failure==='throws')h.state.saveError=new Error('저장 오류');else h.state.saveResult=false;
  h.key('Enter');
  assert.equal(h.p.name,'아직 저장되지 않은 이름');assert.equal(h.input.value,h.p.name);
  assert.equal(h.state.warnings.length,1);assert.equal(h.state.boards,0);
  assert.equal(h.profile.attrs['aria-label'],h.p.name+' 프로필 수정');
});
