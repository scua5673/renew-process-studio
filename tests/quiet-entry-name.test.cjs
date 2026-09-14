'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=[section("var DNKEY='ps_display_name';",'/* 1.583'),section('function setDisplayName(v){','/* 1.533'),
  section('function uiSetName(){','/* 관리 페이지'),section('var _dnHydratePromise=','function uiJoin(){')].join('\n');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function harness(){
  const state={uid:'synthetic-a',wid:'synthetic-team',ready:true,team:true,now:100000,rows:[],fail:false,storageFail:false};
  const local=new Map(),calls={reads:[],modals:[],renders:0,pushes:0},hooks={};
  const c=vm.createContext({Promise,String,Date:{now:()=>state.now},
    localStorage:{getItem:k=>local.get(k)||null,setItem(k,v){if(state.storageFail)throw Error('synthetic storage unavailable');local.set(k,String(v));},removeItem:k=>local.delete(k)},
    getSess:()=>state.uid?{uid:state.uid}:null,activeWs:()=>state.wid,isTeamWs:()=>state.team,dataUnlocked:()=>state.ready,
    membersOf(wid){calls.reads.push(wid);return hooks.read?hooks.read(wid):state.fail?Promise.reject(Error('synthetic offline')):Promise.resolve(state.rows);},
    renderUI(){calls.renders++;},pushMyName(){calls.pushes++;},psModal(opts){calls.modals.push(opts);},toast(){assert.fail('automatic entry must stay quiet');}});
  vm.runInContext(code,c);return{c,state,local,calls,hooks};
}
test('nameless team entry stays quiet across repeated renders and fresh entries',async()=>{
  for(let entry=0;entry<3;entry++){
    const h=harness();
    for(let render=0;render<5;render++){await h.c.ensureDisplayName();h.state.now+=60000;}
    assert.deepEqual(h.calls.modals,[]);assert.equal(h.calls.reads.length,1);assert.equal(h.local.size,0);assert.equal(h.calls.pushes,0);
  }
});
test('a stored server name is silently restored from the current member only',async()=>{
  const h=harness();h.state.rows=[{user_id:'someone-else',name:'Other member'},{user_id:h.state.uid,name:'Existing coach'}];
  await h.c.ensureDisplayName();await h.c.ensureDisplayName();
  assert.equal(h.c.getDisplayName(),'Existing coach');assert.equal(h.calls.reads.length,1);assert.equal(h.calls.renders,1);assert.equal(h.calls.pushes,0);assert.deepEqual(h.calls.modals,[]);
});
for(const boundary of ['account','workspace','logout','lock'])test('a late name response is inert after '+boundary,async()=>{
  const h=harness(),g=deferred();h.hooks.read=()=>g.promise;const pending=h.c.ensureDisplayName();
  if(boundary==='account')h.state.uid='synthetic-b';
  if(boundary==='workspace')h.state.wid='another-team';
  if(boundary==='logout')h.state.uid='';
  if(boundary==='lock')h.state.ready=false;
  g.resolve([{user_id:'synthetic-a',name:'Old account name'}]);await pending;
  assert.equal(h.c.getDisplayName(),'');assert.equal(h.calls.renders,0);assert.deepEqual(h.calls.modals,[]);assert.equal(h.c._dnHydrateDoneKey,'');
});
test('a completed nameless lookup does not block restoration for the next account',async()=>{
  const h=harness();await h.c.ensureDisplayName();h.state.uid='synthetic-b';h.state.rows=[{user_id:'synthetic-b',name:'Next account'}];
  await h.c.ensureDisplayName();assert.equal(h.c.getDisplayName(),'Next account');assert.equal(h.calls.reads.length,2);assert.deepEqual(h.calls.modals,[]);
});
test('failed lookup retries after thirty seconds without presenting a prompt',async()=>{
  const h=harness();h.state.fail=true;await h.c.ensureDisplayName();
  h.state.now+=29999;await h.c.ensureDisplayName();assert.equal(h.calls.reads.length,1);
  h.state.now++;h.state.fail=false;h.state.rows=[{user_id:h.state.uid,name:'Recovered name'}];await h.c.ensureDisplayName();
  assert.equal(h.calls.reads.length,2);assert.equal(h.c.getDisplayName(),'Recovered name');assert.deepEqual(h.calls.modals,[]);
});
test('concurrent entry renders share one member lookup',async()=>{
  const h=harness(),g=deferred();h.hooks.read=()=>g.promise;
  const pending=[h.c.ensureDisplayName(),h.c.ensureDisplayName(),h.c.ensureDisplayName()];assert.equal(h.calls.reads.length,1);
  g.resolve([]);await Promise.all(pending);assert.deepEqual(h.calls.modals,[]);
});
test('local storage failure neither prompts nor repeats a known name lookup',async()=>{
  const h=harness();h.state.storageFail=true;h.state.rows=[{user_id:h.state.uid,name:'Server name'}];
  await h.c.ensureDisplayName();h.state.now+=60000;await h.c.ensureDisplayName();
  assert.equal(h.c.getDisplayName(),'');assert.equal(h.calls.reads.length,1);assert.deepEqual(h.calls.modals,[]);
});
test('manual display-name editing still opens and saves through the account action',()=>{
  const h=harness();h.c.uiSetName();assert.equal(h.calls.modals.length,1);assert.equal(h.calls.modals[0].title,'표시 이름');
  h.calls.modals[0].onOk('My chosen name');assert.equal(h.c.getDisplayName(),'My chosen name');assert.equal(h.calls.pushes,1);
});
