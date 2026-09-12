'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../studio/daily-effort.js'),F=require('../studio/session-focus.js');
const source=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
function fn(name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\n}',a);assert.ok(a>=0&&b>a,name);return source.slice(a,b+2);}
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
const refs=section("var __trainingReferenceLocked=false,",'/* ══ 2.108 · 블록');
const functions=['feltRpeByDay','renderDailyEffort','wkDayYmd','schedGrpList','wksFillRender','renderSession'].map(fn).join('\n');
const copy=v=>JSON.parse(JSON.stringify(v));
function harness(){
  const state={uid:'coach',wid:'team-a',role:'staff',ready:true,kind:'team'},reads=[],writes=[],events={},intervals=[],refsInDOM=[];
  const roster={players:[{id:'p1',name:'하나',grp:'A팀'},{id:'p2',name:'둘',grp:'B팀'}],positions:[]};
  const perms={members:{u1:{playerId:'p1'},u2:{playerId:'p2'}}};
  const docs={u1:{v:1,focusByWk:{'2026-08-31':{text:'A 지난주'},'2026-09-07':{text:'A 이번주'}},log:{'2026-09-02':{rpe:4,t:'team'}}},u2:{v:1,focusByWk:{'2026-08-31':{text:'B 지난주'},'2026-09-07':{text:'B 이번주'}},log:{'2026-09-02':{rpe:8,t:'team'}}}};
  const local=new Map([['scout_tool_v1',JSON.stringify(roster)],['cs_perms_v1',JSON.stringify(perms)],['cs_player_del_v1','{}'],...Object.entries(docs).flatMap(([uid,doc])=>[['cs_idp_v1_'+uid,JSON.stringify(doc)],['cs_idp_pub_v1_'+uid,'{}']])]);
  const select={},effortRows={};
  const host={innerHTML:'',style:{display:'none'},querySelector(q){return q==='[data-effort-group]'?select:q==='.daily-effort-list'?effortRows:null;}};
  const sheet={innerHTML:'',scrollTop:0},scrim={classList:{add(){}}},time={addEventListener(){}};
  const tr={slot:'PM',grp:['A팀'],blocks:[],time:'18:00',load:{rpe:5}};
  const days=Array.from({length:7},(_,i)=>({d:'월화수목금토일'[i],grp:'B팀',board:{sched:'훈련'},trainings:i===2?[tr]:[]}));
  const parent={PSSync:{session:()=>state.uid?{uid:state.uid,at:'fake-token',rt:'fake-refresh'}:null,activeWs:()=>state.wid,activeWsObj:()=>({id:state.wid,kind:state.kind}),dataUnlocked:()=>state.ready},PSPerms:{role:()=>state.role}};
  const c={PSDailyEffort:E,PSSessionFocus:F,parent,location:{origin:'https://local.test'},
    localStorage:{getItem(k){reads.push(k);if(c.onRead)c.onRead(k);return local.has(k)?local.get(k):null;},setItem(k,v){writes.push([k,v]);throw Error('reference must not write');},removeItem(k){writes.push([k]);throw Error('reference must not delete');}},
    addEventListener(type,callback){(events[type]||(events[type]=[])).push(callback);},
    setInterval(callback,delay){intervals.push({callback,delay});},setTimeout(){},
    document:{getElementById(id){return {trainingEffortCard:host,sheet,scrim,sTime:time}[id]||null;},querySelectorAll(q){return q==='.session-focus-reference'?refsInDOM.filter(x=>!x.removed):[];}},
    __dailyEffortGroup:null,__dailyEffortOwner:'',__schedGrp:'B팀',wk:-1,week:days,
    __fillDi:2,__fillSlot:'PM',__fillNoSes:false,__fillPickOpen:false,__fillTimeOpen:-1,__fillDraft:-1,__fillNameOpen:-1,__fillFocusEl:'',
    curSession:{di:2,ti:0,draft:false,wizard:false},
    mondayOfWeek0:()=>new Date('2026-09-07T00:00:00'),
    _fillTr:()=>tr,curTr:()=>tr,dayBoard:d=>d.board,
    schedDayGrp:i=>days[i].grp,schedGroups:()=>['A팀','B팀'],
    wksSlotLabel:t=>t.slot,wksTopicsOf:()=>[],wksTopicOpts:()=>[],wksSesMinutes:()=>0,wksEndTime:()=>'',
    wkbdEsc:F.esc,_fillEsc:F.esc,_fillFree:()=>'',_fillList:()=>[],_fillChips:()=>'',bMap:()=>[],trainChipMerge:()=>[],
    trMinutes:()=>0,endTime:()=>'',blockCard:()=>'',sessMetaHTML:()=>'',sessIntroHTML:()=>'',sessReviewHTML:()=>'',
    renderDrillShelf(){},bindAimsInput(){},bindTimePlayers(){},save(){writes.push(['save']);throw Error('must not save');},
  };c.window=c;
  vm.createContext(c);vm.runInContext(refs+'\n'+functions,c,{filename:'process.html training reference functions'});
  return {c,state,reads,writes,local,host,sheet,tr,days,select,intervals,
    input:()=>({date:'2026-09-02',session:tr,day:days[2]}),
    event(type,event={}){for(const handler of events[type]||[])handler(event);},
    showSensitive(){const el={removed:false,remove(){this.removed=true;}};refsInDOM.push(el);host.innerHTML='private intensity';host.style.display='';return el;},
  };
}

test('actual focus adapter reads selected date and group only, without touching storage',()=>{
  const h=harness(),before=[...h.local];const result=h.c.focusRows(h.input());
  assert.equal(result.week,'2026-08-31');assert.equal(result.rows.length,1);assert.equal(result.rows[0].weekly.text,'A 지난주');
  assert.ok(h.reads.includes('cs_idp_v1_u1'));assert.ok(!h.reads.includes('cs_idp_v1_u2'));
  assert.deepEqual([...h.local],before);assert.deepEqual(h.writes,[]);
});
test('actual main editor uses its selected week/day/session instead of today or active group filter',()=>{
  const h=harness(),before=copy(h.days);h.c.curSession.di=0;h.c.wksFillRender(false);
  assert.match(h.sheet.innerHTML,/2026-09-02 · A팀/);assert.match(h.sheet.innerHTML,/A 지난주/);
  assert.doesNotMatch(h.sheet.innerHTML,/A 이번주|B 지난주/);assert.deepEqual(h.days,before);assert.deepEqual(h.writes,[]);
});
test('actual legacy editor passes the same explicit session context',()=>{
  const h=harness();h.tr.grp=[];h.c.__fillDi=4;h.c.__fillSlot='another';h.c.renderSession();
  assert.match(h.sheet.innerHTML,/2026-09-02 · B팀/);assert.match(h.sheet.innerHTML,/B 지난주/);
  assert.doesNotMatch(h.sheet.innerHTML,/A 지난주|B 이번주/);assert.deepEqual(h.writes,[]);
});
test('main editor with empty session groups inherits saved day group',()=>{
  const h=harness();h.tr.grp=[];h.c.wksFillRender(false);
  assert.match(h.sheet.innerHTML,/2026-09-02 · B팀/);assert.match(h.sheet.innerHTML,/B 지난주/);
});
test('main OFF/match/pick-only flows do not read IDP reference keys',()=>{
  for(const mode of ['OFF','경기','pick']){
    const h=harness();if(mode==='pick')h.c.__fillNoSes=true;else h.days[2].board.sched=mode;
    h.c.wksFillRender(false);assert.doesNotMatch(h.sheet.innerHTML,/session-focus-reference/);
    assert.ok(!h.reads.some(k=>k.startsWith('cs_idp_')));
  }
});
for(const change of [{uid:''},{role:'player'},{role:'unknown'},{ready:false},{kind:'personal'}])test('adapter denies private-key reads for '+JSON.stringify(change),()=>{
  const h=harness();Object.assign(h.state,change);assert.equal(h.c.focusRows(h.input()),null);assert.deepEqual(h.reads,[]);
  assert.equal(h.c.sessFocusHTML(h.input()),'');assert.deepEqual(h.writes,[]);
});
for(const change of [{uid:'other'},{wid:'team-b'},{role:'player'},{ready:false}])test('owner change during a mirror read discards the complete result: '+JSON.stringify(change),()=>{
    const h=harness();h.c.onRead=k=>{if(k==='cs_idp_v1_u1')Object.assign(h.state,change);};
  assert.equal(h.c.focusRows(h.input()),null);assert.deepEqual(h.writes,[]);
});
test('missing and malformed mirrors remain unknown instead of claiming an empty weekly focus',()=>{
  for(const raw of [undefined,'null','[]','not-json','{}','{"v":2,"focusByWk":{"2026-08-31":{"text":"unsupported"}}}']){
    const h=harness();if(raw===undefined)h.local.delete('cs_idp_v1_u1');else h.local.set('cs_idp_v1_u1',raw);
    h.local.set('cs_idp_pub_v1_u1',JSON.stringify({reviews:[{at:'2026-09-01',goals:[{t:'코치 참고'}]}]}));
    const result=h.c.focusRows(h.input()),html=h.c.sessFocusHTML(h.input());
    assert.equal(result.rows[0].weeklyState,'unavailable');assert.match(html,/주간 초점을 아직 확인하지 못했습니다/);
    assert.doesNotMatch(html,/해당 주에 저장된 초점 없음/);
  }
});
test('present empty document can show no saved focus without falling back to another date',()=>{
  const h=harness();h.local.set('cs_idp_v1_u1','{"v":1}');const result=h.c.focusRows(h.input());
  assert.equal(result.status,'empty');assert.equal(result.rows.length,0);
});
test('actual adapter never fetches a target, deleted or ambiguous-account private document',()=>{
  for(const modify of [
    roster=>{roster.players[0].type='target';},
    (roster,h)=>h.local.set('cs_player_del_v1',JSON.stringify({p1:123})),
    (roster,h)=>h.local.set('cs_perms_v1',JSON.stringify({members:{u1:{playerId:'p1'},other:{playerId:'p1'}}})),
  ]){
    const h=harness(),roster=JSON.parse(h.local.get('scout_tool_v1'));modify(roster,h);h.local.set('scout_tool_v1',JSON.stringify(roster));
    assert.equal(h.c.focusRows(h.input()).rows.length,0);assert.ok(!h.reads.some(k=>k.startsWith('cs_idp_')));
  }
});
test('duplicate player IDs across groups are excluded before any private key is read',()=>{
  const h=harness(),roster=JSON.parse(h.local.get('scout_tool_v1'));
  roster.players.push({id:'p1',name:'다른 조의 중복 선수',grp:'B팀'});h.local.set('scout_tool_v1',JSON.stringify(roster));
  const result=h.c.focusRows(h.input());assert.equal(result.rows.length,0);
  assert.ok(!h.reads.some(k=>k.startsWith('cs_idp_')));
  assert.ok(result.warnings.some(w=>w.code==='player-identity-ambiguous'));
});
test('adapter and helper agree on trimmed legacy group and player IDs',()=>{
  const h=harness(),roster=JSON.parse(h.local.get('scout_tool_v1'));
  roster.players[0].grp=' A팀 ';roster.players[0].id=' p1 ';h.local.set('scout_tool_v1',JSON.stringify(roster));
  const result=h.c.focusRows(h.input());assert.equal(result.rows.length,1);assert.equal(result.rows[0].weekly.text,'A 지난주');
});
test('trusted auth lock clears already-rendered references even while the parent still reports ready',()=>{
  const h=harness();h.c.trainingReferenceAccess();const el=h.showSensitive();
  h.event('ps-auth-state',{detail:{unlocked:false}});
  assert.equal(el.removed,true);assert.equal(h.host.innerHTML,'');assert.equal(h.host.style.display,'none');
  assert.equal(h.c.focusRows(h.input()),null);h.event('ps-auth-state',{detail:{unlocked:true}});
  assert.ok(h.c.focusRows(h.input()));assert.deepEqual(h.writes,[]);
});
test('iframe auth messages require exact parent, origin, source and message type',()=>{
  const h=harness();h.event('ps-auth-state',{detail:{unlocked:false}});
  const data={source:'process-studio',type:'ps-auth-state',unlocked:true};
  for(const event of [{source:{},origin:h.c.location.origin,data},{source:h.c.parent,origin:'https://elsewhere.test',data},{source:h.c.parent,origin:h.c.location.origin,data:{...data,source:'wrong'}},{source:h.c.parent,origin:h.c.location.origin,data:{...data,type:'wrong'}}]){
    h.event('message',event);assert.equal(h.c.focusRows(h.input()),null);
  }
  h.event('message',{source:h.c.parent,origin:h.c.location.origin,data});assert.ok(h.c.focusRows(h.input()));
});
test('unlock event cannot grant private access to a player or locked account',()=>{
  const h=harness();h.state.role='player';h.event('ps-auth-state',{detail:{unlocked:true}});
  assert.equal(h.c.focusRows(h.input()),null);h.state.role='staff';h.state.ready=false;
  h.event('ps-auth-state',{detail:{unlocked:true}});assert.equal(h.c.focusRows(h.input()),null);
});
for(const change of [{uid:'other'},{wid:'team-b'},{role:'executive'},{role:'player'},{ready:false}])test('focus/page checks clear earlier owner or role content: '+JSON.stringify(change),()=>{
  const h=harness();h.c.trainingReferenceAccess();const el=h.showSensitive();Object.assign(h.state,change);h.event('focus');
  assert.equal(el.removed,true);assert.equal(h.host.innerHTML,'');assert.equal(h.host.style.display,'none');
});
test('800ms fallback clears references when auth changes without a storage event',()=>{
  const h=harness();h.c.trainingReferenceAccess();const el=h.showSensitive();h.state.uid='';
  assert.equal(h.intervals.length,1);assert.equal(h.intervals[0].delay,800);h.intervals[0].callback();
  assert.equal(el.removed,true);assert.equal(h.host.innerHTML,'');
});
test('relevant storage events remove old focus references and do not write content',()=>{
  for(const key of ['ps_sync_session','ps_active_ws','cs_perms_v1','scout_tool_v1','cs_player_del_v1','cs_idp_v1_u1','cs_idp_pub_v1_u1',null]){
    const h=harness();h.c.trainingReferenceAccess();const el=h.showSensitive();h.state.role='player';h.event('storage',{key});
    assert.equal(el.removed,true);assert.equal(h.host.innerHTML,'');assert.deepEqual(h.writes,[]);
  }
});
test('unrelated storage events do not remove a visible reference',()=>{
  const h=harness();h.c.trainingReferenceAccess();const el=h.showSensitive();h.event('storage',{key:'ps_theme'});
  assert.equal(el.removed,false);
});
test('actual daily card uses viewed-week dates and an independent group selector without writes',()=>{
  const h=harness(),before=[...h.local];h.c.renderDailyEffort();
  assert.match(h.host.innerHTML,/09\/02/);assert.match(h.host.innerHTML,/>8\.0 <small>\/ 10/);
  assert.equal(h.select.id,'effortGroup');h.select.value='A팀';h.select.onchange();
  assert.match(h.host.innerHTML,/>4\.0 <small>\/ 10/);assert.equal(h.c.__schedGrp,'B팀');
  assert.deepEqual([...h.local],before);assert.deepEqual(h.writes,[]);
});
test('daily selector state is cleared on owner/role changes',()=>{
  const h=harness();h.c.renderDailyEffort();h.select.value='A팀';h.select.onchange();assert.equal(h.c.__dailyEffortGroup,'A팀');
  h.state.wid='team-b';h.event('pageshow');assert.equal(h.c.__dailyEffortGroup,null);assert.equal(h.c.__dailyEffortOwner,'');
  assert.equal(h.host.innerHTML,'');
});
test('shared-data storage refresh preserves the chosen intensity group for the same owner',()=>{
  const h=harness();h.c.renderDailyEffort();h.select.value='A팀';h.select.onchange();
  const doc=JSON.parse(h.local.get('cs_idp_v1_u1'));doc.log['2026-09-02'].rpe=6;h.local.set('cs_idp_v1_u1',JSON.stringify(doc));
  h.event('storage',{key:'cs_idp_v1_u1'});
  assert.equal(h.c.__dailyEffortGroup,'A팀');assert.match(h.host.innerHTML,/>6\.0 <small>\/ 10/);assert.deepEqual(h.writes,[]);
});
