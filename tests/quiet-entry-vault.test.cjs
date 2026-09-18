'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const helpers=section('function psVaultUnlocked(){','function psVaultAuthChanged(){');
const renders=[
  ['library','renderLib',section('async function renderLib(){','function openLib(){')],
  ['drill files original','renderDrillFiles',section('function renderDrillFiles(){','function dfRow(')],
  ['dock','renderLibDock',section('async function renderLibDock(){','async function dockAddToSession(')],
  ['tray','renderLibTray',section('async function renderLibTray(){','function drillpackKey(')],
  ['drill files current','renderDrillFiles',section('  renderDrillFiles=function(){','  /* ── 빈 보관함 스타터:')]
];
function harness({view='board',unlocked=false}={}){
  const state={unlocked,uid:'synthetic-a',wid:'synthetic-team'},nodes={},calls={toasts:[],reads:0,writes:0};
  function node(id=''){
    const attrs=new Map();const n={id,style:{},innerHTML:'',textContent:'',inert:false,
      hasAttribute:k=>attrs.has(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),
      contains:()=>false,querySelector:()=>({onclick:null}),appendChild(child){if(child.id)nodes[child.id]=child;},
      remove(){delete nodes[this.id];}};if(id)nodes[id]=n;return n;
  }
  for(const id of ['boardView','sessionView','drillLib','editorModal','vaultBar','dfCount','drillFiles','libGrid'])node(id);
  const c=vm.createContext({Promise,Error,Date,Math,JSON,
    document:{body:node(),getElementById:id=>nodes[id]||null,createElement:()=>node()},
    parent:{PSSync:{dataUnlocked:()=>state.unlocked}},__csView:view,
    psMyUid:()=>state.uid,psActiveWs:()=>({id:state.wid}),toast:m=>calls.toasts.push(m),libGet:async()=>{calls.reads++;return[];},
    store:{set(){calls.writes++;return Promise.resolve();}},LIB_KEY:'synthetic-library',
    $:id=>nodes[id]||null,$id:id=>nodes[id]||null,libFilter:{},libSel:null,updateLibSelBar(){},renderDrillFiles(){}});
  c.window=c;vm.runInContext(helpers,c);
  return{c,state,nodes,calls,run(code){vm.runInContext(code,c);}};
}
for(const [label,name,code] of renders)for(const view of ['board','session'])test(label+': locked '+view+' render never reads data or shows a toast',async()=>{
  const h=harness({view});h.run(code);await h.c[name]();await h.c[name]();
  assert.equal(h.calls.reads,0);assert.equal(h.calls.writes,0);assert.deepEqual(h.calls.toasts,[]);
  assert.equal(!!h.nodes.psVaultAuthLock,view==='session');
  assert.equal(h.nodes.boardView.inert,view==='session');
  if(view==='session')assert.equal(h.nodes.drillFiles.innerHTML,'');
});
test('an actual save action still gives the login hint without reading or writing library data',async()=>{
  const h=harness();h.run(section('async function saveToLib(d){','async function delFromLib('));
  assert.equal(await h.c.saveToLib({name:'Synthetic drawing'}),false);
  assert.deepEqual(h.calls.toasts,['로그인하면 보관함에 저장할 수 있어요']);assert.equal(h.calls.reads,0);assert.equal(h.calls.writes,0);assert.equal(h.nodes.psVaultAuthLock,undefined);assert.equal(h.nodes.boardView.inert,false);
});
test('confirmed ownership permits normal library rendering without any login notice',async()=>{
  const h=harness({unlocked:true});h.run(renders[0][2]);
  assert.equal(h.c.psVaultRenderReady(),true);assert.equal(h.c.psVaultRequireLogin(),true);
  await h.c.renderLib();assert.equal(h.calls.reads,1);assert.match(h.nodes.libGrid.innerHTML,/저장된 드릴이 없어요/);assert.deepEqual(h.calls.toasts,[]);assert.equal(h.nodes.psVaultAuthLock,undefined);
});

test('library lock during an awaited read stops rendering without an unhandled rejection',async()=>{
  const h=harness({unlocked:true,view:'session'});h.run(renders[0][2]);
  let reject;h.c.libGet=()=>new Promise((_,r)=>{reject=r;});
  const pending=h.c.renderLib();h.state.unlocked=false;reject(h.c.psVaultLockedError());
  await pending;assert.ok(h.nodes.psVaultAuthLock);assert.equal(h.nodes.libGrid.innerHTML,'');assert.equal(h.calls.writes,0);
});
test('late library reads from another account or workspace never render',async()=>{
  for(const key of ['uid','wid']){
    const h=harness({unlocked:true});h.run(renders[0][2]);let resolve;
    h.c.libGet=()=>new Promise(r=>{resolve=r;});
    const pending=h.c.renderLib();h.state[key]='synthetic-other';resolve([{name:'old private item'}]);
    await pending;assert.equal(h.nodes.libGrid.innerHTML,'');assert.equal(h.calls.writes,0);
  }
});
test('unrelated library read failures remain visible to callers',async()=>{
  const h=harness({unlocked:true});h.c.libGet=async()=>{throw Error('disk read failed');};
  await assert.rejects(h.c.psVaultReadForRender(),/disk read failed/);
});

test('a late lock rejection cannot cover a newly unlocked account',async()=>{
  const h=harness({unlocked:true,view:'session'});let reject;
  h.c.libGet=()=>new Promise((_,r)=>{reject=r;});
  const pending=h.c.psVaultReadForRender();h.state.uid='synthetic-b';reject(h.c.psVaultLockedError());
  assert.equal(await pending,null);assert.equal(h.nodes.psVaultAuthLock,undefined);
});
