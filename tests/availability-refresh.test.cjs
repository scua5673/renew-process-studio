'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/scout.html'),'utf8');
function part(from,to){const start=source.indexOf(from),end=source.indexOf(to,start+from.length);assert.ok(start>=0&&end>start,from);return source.slice(start,end);}
const refreshCode=part('function itemsRerender(){','var scoutReadOnlyLoad=')+'\n'+
  part('window.addEventListener("storage",e=>{','var matchPendingOpen=')+'\n'+
  part('function __matchRefresh(){','/* 2.022 — 핵심 행동 핑');
function fixture(view='availView'){
  const handlers={},timers=[],calls=[],state={view,raw:'old',row:null,schedule:'old',data:'old',pending:false,failed:false};
  const root={innerHTML:'old',querySelectorAll:()=>[]};
  const note={tagName:'TEXTAREA',value:'아직 저장하지 않은 사유',isConnected:true};
  const dialog={note,isConnected:true};
  const document={activeElement:null,body:{children:[root,dialog]},querySelector:selector=>selector==='.view.on'?{id:state.view}:null,
    getElementById:()=>null,addEventListener(name,fn){(handlers[name]||(handlers[name]=[])).push(fn);}};
  const c=vm.createContext({Promise,Date,Math,JSON,Set,document,KEY:'scout_tool_v1',PDKEY:'cs_player_del_v1',TM_KEY:'cs_squad_v1',
    IDP_PREFIX:'private-idp:',IDP_PUB_PREFIX:'public-idp:',MATCH_KEY:'cs_team_matches_v1',matchBoardGesture:null,matchSaveTimer:0,_mprT:0,
    matchState:{},matchCurrent:'',matchPendingOpen:null,
    setTimeout(fn){timers.push(fn);return timers.length;},addEventListener(name,fn){(handlers[name]||(handlers[name]=[])).push(fn);},
    load(){calls.push('load');state.data=state.raw;},
    itemsApply:async reason=>{calls.push('items:'+reason);if(state.row===null)return false;state.data=state.row;return true;},
    renderAvail(){calls.push('avail:'+state.data+':'+state.schedule);},renderTeam(){calls.push('team');},renderTeamHome(){calls.push('home');},renderMatch(){calls.push('match');},
    renderGrowth(){calls.push('growth');},store:{hasPending:()=>state.pending,hasFailed:()=>state.failed},
    matchLoad(){calls.push('schedule');return {matches:[]};},matchDocPending:()=>false,matchRefreshLater(){calls.push('later');},matchOpenAtRequest(){calls.push('open');}
  });c.window=c;vm.runInContext(refreshCode,c);
  return {c,state,calls,root,note,dialog,storage(key){for(const fn of handlers.storage||[])fn({key});},
    focusout(){for(const fn of handlers.focusout||[])fn();},flushTimers(){while(timers.length)timers.shift()();}};
}
async function settle(){await Promise.resolve();await Promise.resolve();}
for(const key of ['scout_tool_v1','cs_player_del_v1','ps_items_rev'])test(key+' refreshes the open availability list after incoming player data',async()=>{
  const h=fixture();h.state.raw='new document';h.state.row='new confirmed row';h.storage(key);await settle();
  assert.equal(h.calls.includes('load'),key!=='ps_items_rev');
  assert.ok(h.calls.includes('items:sync'));assert.equal(h.calls.at(-1),'avail:new confirmed row:old');
  assert.equal(h.calls.includes('team'),false);assert.equal(h.calls.includes('home'),false);
});
for(const tagName of ['INPUT','TEXTAREA','SELECT'])test(tagName+' input defers roster updates until editing ends',async()=>{
  const h=fixture();h.c.document.activeElement={tagName,value:'draft'};h.state.raw='new document';h.state.row='new row';
  h.storage('scout_tool_v1');h.storage('ps_items_rev');assert.deepEqual(h.calls,[]);assert.equal(h.c.__teamStale,1);
  h.focusout();h.flushTimers();assert.deepEqual(h.calls,[],'moving between editor fields must not redraw');
  h.c.document.activeElement=null;h.focusout();h.flushTimers();await settle();
  assert.equal(h.c.__teamStale,0);assert.deepEqual(h.calls,['load','avail:new document:old','items:sync','avail:new row:old']);
});
test('contenteditable drafts defer both roster and schedule refresh',async()=>{
  const h=fixture();const draft={tagName:'DIV',isContentEditable:true,textContent:'draft'};h.c.document.activeElement=draft;
  h.storage('ps_items_rev');h.storage('process_coach_v1');assert.deepEqual(h.calls,[]);assert.equal(draft.textContent,'draft');
  h.state.row='new row';h.state.schedule='match';h.c.document.activeElement=null;h.focusout();h.flushTimers();await settle();
  assert.equal(h.calls.at(-1),'avail:new row:match');assert.equal(h.c.__teamStale,0);assert.equal(h.c.__matchStale,0);
});
for(const key of ['process_coach_v1','cs_team_matches_v1','ps_sync_meta'])test(key+' refreshes availability schedule context',()=>{
  const h=fixture();h.state.schedule='off';h.storage(key);
  assert.deepEqual(h.calls,['schedule','avail:old:off']);
});
test('schedule refresh preserves a focused memo until focus leaves the editor',()=>{
  const h=fixture();h.c.document.activeElement=h.note;h.state.schedule='match';h.storage('process_coach_v1');
  assert.deepEqual(h.calls,[]);assert.equal(h.note.value,'아직 저장하지 않은 사유');assert.equal(h.c.__matchStale,1);
  h.c.document.activeElement={tagName:'BUTTON'};h.focusout();h.flushTimers();
  assert.deepEqual(h.calls,['schedule','avail:old:match']);assert.equal(h.note.value,'아직 저장하지 않은 사유');
});
test('pending or failed local match writes still defer availability schedule refresh',()=>{
  for(const key of ['pending','failed']){const h=fixture();h.state[key]=true;h.storage('process_coach_v1');assert.deepEqual(h.calls,['later']);}
});
test('refresh routing keeps existing team, home, match and unrelated views separate',async()=>{
  for(const [view,expected]of [['teamView','team'],['homeView','home'],['matchView',null],['reportView',null]]){
    const h=fixture(view);h.storage('scout_tool_v1');await settle();
    assert.deepEqual(h.calls,['load',...(expected?[expected]:[]),'items:sync']);
  }
  for(const [view,expected]of [['teamView',null],['homeView','home'],['matchView','match'],['reportView',null]]){
    const h=fixture(view);h.storage('process_coach_v1');assert.deepEqual(h.calls,['schedule',...(expected?[expected]:[])]);
  }
  const h=fixture();h.storage('unrelated-key');h.focusout();h.flushTimers();assert.deepEqual(h.calls,[]);
});
test('actual availability render leaves the open editor and its unsaved memo in place',async()=>{
  const h=fixture(),context={owner:'same team'};
  Object.assign(h.c,{$:id=>id==='availRoot'?h.root:null,availView:'grp',avPickerState:{ctx:context},avUiNotice:null,
    availRange:14,availDay:null,availMode:'players',avEditCurrent:ctx=>ctx===context,avCanEdit:()=>true,
    avClosePicker(){h.dialog.isConnected=false;h.note.value='';},tmOurs:()=>[],stYmd:()=> '2026-09-17',
    stAddDays:()=> '2026-09-04',PSParticipation:{},renderAvailPlayers:()=> '<p>최신 가용 인원</p>'});
  vm.runInContext(part('function renderAvail(){','function teamHomeTodayLine(){'),h.c);
  h.c.document.activeElement=h.note;h.storage('scout_tool_v1');assert.equal(h.root.innerHTML,'old');
  h.c.document.activeElement={tagName:'BUTTON'};h.focusout();h.flushTimers();await settle();
  assert.match(h.root.innerHTML,/최신 가용 인원/);assert.equal(h.dialog.isConnected,true);
  assert.equal(h.note.value,'아직 저장하지 않은 사유');assert.equal(h.c.avPickerState.ctx,context);
  assert.equal(h.c.document.body.children[1],h.dialog);
  // The editor is mounted outside availRoot, which is the only replaced subtree.
  assert.match(part('function avOpenPicker(button){','/* 2.215 —'),/document\.body\.appendChild\(pk\)/);
});
