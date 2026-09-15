'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/scout.html'),'utf8');
function part(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+1);assert.ok(i>=0&&j>i);return source.slice(i,j);}
function setup(){
 const timers=[],m={id:'m',phaseBoards:{cur:'atk'},oppPB:{cur:'atk'}},state={m,owner:'team-a',pending:false,failed:false,edit:true,renders:0,loads:0};
 const c=vm.createContext({console,Promise,JSON,Math,setTimeout(fn){timers.push(fn);return timers.length;},
  store:{owner:()=>state.owner,hasPending:()=>state.pending,hasFailed:()=>state.failed,ready:()=>state.ready||Promise.resolve()},
  matchGet:()=>state.m,matchCanEditOne:()=>state.edit,mb2Ensure:m=>m.phaseBoards,obEnsure:m=>m.oppPB,
  matchSaveTimer:0,_mprT:0,matchState:m,matchCurrent:'m',matchPendingOpen:null,MATCH_KEY:'matches',
  matchLoad:()=>{state.loads++;return {matches:[state.m]};},renderMatch:()=>state.renders++,renderTeamHome(){},
  document:{activeElement:null,querySelector:()=>({id:'matchView'})}});c.window=c;
 vm.runInContext(part('var matchBoardGesture=null','window.addEventListener("storage",function(e){\n  if(e.key==="ps_sync_meta")'),c);
 return {c,state,timers,m,pit:{id:'mb2Pitch'}};
}
test('ACK cannot replace the match object or tokens during a held pointer',()=>{
 const {c,m,pit,state,timers}=setup(),ctx=c.matchBoardBegin(m,pit,{pointerId:1,button:0});
 c.__matchRefresh();assert.equal(state.loads,0);assert.equal(c.matchState,m);assert.equal(state.renders,0);
 c.matchBoardEnd(ctx);timers.shift()();assert.equal(state.renders,1);assert.equal(state.loads,1);
});
test('debounced save and IDB commit both finish before deferred refresh',async()=>{
 const {c,m,pit,state,timers}=setup(),ctx=c.matchBoardBegin(m,pit,{pointerId:1});
 c.__matchRefresh();c.matchSaveTimer=7;c.matchBoardEnd(ctx);timers.shift()();assert.equal(state.loads,0);
 c.matchSaveTimer=0;state.pending=true;let done;state.ready=new Promise(r=>done=r);timers.shift()();assert.equal(state.loads,0);
 state.pending=false;done();await Promise.resolve();timers.shift()();assert.equal(state.loads,1);
});
test('failed local storage leaves the in-memory lineup intact',()=>{
 const {c,m,state,timers}=setup();state.failed=true;c.__matchRefresh();timers.shift()();assert.equal(state.loads,0);assert.equal(c.matchState,m);assert.equal(timers.length,0);
});
test('owner, permission, match and phase changes invalidate a captured drag',()=>{
 for(const change of [s=>s.owner='team-b',s=>s.edit=false,s=>s.m={...s.m},s=>s.m.phaseBoards.cur='def']){
  const {c,m,pit,state}=setup(),ctx=c.matchBoardBegin(m,pit,{pointerId:7});assert.equal(c.matchBoardCurrent(ctx),true);change(state);assert.equal(c.matchBoardCurrent(ctx),false);
 }
});
test('right button, secondary pointers and competing gestures are ignored',()=>{
 const {c,m,pit}=setup();assert.equal(c.matchBoardBegin(m,pit,{button:2}),null);assert.equal(c.matchBoardBegin(m,pit,{isPrimary:false}),null);
 const ctx=c.matchBoardBegin(m,pit,{pointerId:1});assert.ok(ctx);assert.equal(c.matchBoardBegin(m,pit,{pointerId:2}),null);c.matchBoardEnd(ctx);assert.equal(c.matchBoardGesture,null);
});
test('delayed refresh from another workspace cannot redraw this workspace',()=>{
 const {c,state,timers}=setup();c.matchRefreshLater();state.owner='team-b';timers.shift()();assert.equal(state.loads,0);
});
test('portrait projection and inverse preserve asymmetric canonical coordinates',()=>{
 const pit={id:'mb2Pitch',getBoundingClientRect:()=>({left:10,top:20,right:690,bottom:1070,width:680,height:1050})};
 const c=vm.createContext({Math,$:()=>pit});vm.runInContext(part('var mb2Portrait=false;','function mb2AddTok('),c);c.mb2Portrait=true;
 for(const t of [{x:13,y:26},{x:82.4,y:67.5},{x:50,y:50}]){
  const p=c.mb2DisplayPoint(t,pit),back=c.mb2Pct({clientX:10+p.x*6.8,clientY:20+p.y*10.5},pit);
  assert.ok(Math.abs(back.x-t.x)<1e-10);assert.ok(Math.abs(back.y-t.y)<1e-10);assert.equal(back.inside,true);
 }
 const other={...pit,id:'obPitch'};assert.deepEqual(JSON.parse(JSON.stringify(c.mb2DisplayPoint({x:13,y:26},other))),{x:13,y:26});
 assert.equal(c.mb2Pct({clientX:0,clientY:0},pit).inside,false);
});
