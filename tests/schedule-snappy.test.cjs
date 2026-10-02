'use strict';
/* 2.933 — 일정 편집이 굳던 것(사용자 «세션 추가 누르고 만들다 보면 딜레이 · 아이패드는 더»).
   실측 원인: ① PSSchedule.anchor() 가 날짜 칸마다 일정 문서 전체를 JSON.parse — 숨은 «오늘» 화면이 한 번 그리는 데 729번
   ② 숨은 iframe(콕핏·IDP·플레이북)이 일정 저장마다 통째로 다시 그림 ③ 클릭마다 문서 전체 저장 2~3번.
   곁에서 잡은 것: ⌘Z 뒤에는 저장이 옛 객체(__schedBase)를 써서 그 뒤 편집이 저장되지 않았다.
   실제 소스에서 구간을 잘라 실행한다(다른 회귀 테스트와 같은 방식). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
function part(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
const S=read('storage.js'),P=read('process.html'),SC=read('scout.html'),I=read('idp.html'),PB=read('playbook.html'),B=read('board.html');
const plain=x=>JSON.parse(JSON.stringify(x));

function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function thisMonday(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d;}
function doc(extra){
  const day=(o)=>Object.assign({d:'월',n:1,rest:false,trainings:[]},o||{});
  return Object.assign({weeks:{0:[day({trainings:[{slot:'S1',grp:['A팀'],aims:'a'},{slot:'S2',grp:['B팀'],aims:'b'},{slot:'S3',aims:'공통'}],board:{sched:'훈련',theme:'공격',trains:['칩']}}),day({off:true,board:{sched:'OFF'}}),day(),day(),day(),day({match:{opp:'상대'},mid:'m1',board:{sched:'경기'}}),day()]},
    templates:[],anchorMonday:ymd(thisMonday()),scheduleRev:3},extra||{});
}
function scheduleApi(local){
  const i=S.indexOf("var SCHED_KEY='process_coach_v1'"),start=S.lastIndexOf('(function(){',i);
  const endMark="try{ normalize(); }catch(e){ note('schedule-normalize',e); }\n})();",end=S.indexOf(endMark,i)+endMark.length;
  assert.ok(start>=0&&end>start);
  let parses=0;
  const J={parse:(s,r)=>{parses++;return JSON.parse(s,r);},stringify:JSON.stringify};
  const c=vm.createContext({JSON:J,Date,Math,Object,Array,String,Number,parseInt,isNaN,isFinite,
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)}});
  c.window=c;vm.runInContext(S.slice(start,end),c);
  return {api:c.PSSchedule,parses:()=>parses};
}

test('anchor() parses the schedule once per stored text, not once per date cell',()=>{
  const local=new Map([['process_coach_v1',JSON.stringify(doc())]]);
  const {api,parses}=scheduleApi(local);
  const p0=parses();
  for(let k=0;k<300;k++){api.anchor();api.cellOf(new Date(Date.now()+k*864e5));}
  assert.ok(parses()-p0<=1,'같은 원문이면 한 번만 읽는다 ('+(parses()-p0)+'번 읽음)');
  assert.equal(ymd(api.anchor()),ymd(thisMonday()));
  const a=api.anchor();a.setDate(a.getDate()+3);
  assert.equal(ymd(api.anchor()),ymd(thisMonday()),'돌려준 날짜를 고쳐도 다음 값은 그대로');
  const later=new Date(thisMonday());later.setDate(later.getDate()-7);
  local.set('process_coach_v1',JSON.stringify(doc({anchorMonday:ymd(later)})));
  assert.equal(ymd(api.anchor()),ymd(later),'원문이 바뀌면 새 기준선을 읽는다');
  local.delete('process_coach_v1');
  assert.equal(ymd(api.anchor()),ymd(thisMonday()),'일정이 없으면 이번 주 월요일');
});

test('view() is one shared read-only copy per stored text and group, equal to a fresh read',()=>{
  const local=new Map([['process_coach_v1',JSON.stringify(doc())]]);
  const {api,parses}=scheduleApi(local);
  const v=api.view('A팀');
  const p0=parses();
  for(let k=0;k<50;k++)assert.equal(api.view('A팀'),v);
  assert.equal(parses(),p0,'같은 원문·같은 조면 다시 읽지 않는다');
  assert.deepEqual(plain(v),plain(api.readFor('A팀')),'조로 본 사본은 readFor 와 같다');
  assert.deepEqual(plain(v.weeks[0][0].trainings.map(t=>t.aims)),['a','공통']);
  assert.deepEqual(plain(api.view('')),plain(api.read()),'조가 없으면 read() 와 같다');
  assert.notEqual(api.readFor('A팀'),api.readFor('A팀'),'readFor 는 예전처럼 매번 새 사본(고쳐 쓰는 곳용)');
  const d=doc();d.weeks[0][0].trainings[0].aims='바뀜';
  local.set('process_coach_v1',JSON.stringify(d));
  const v2=api.view('A팀');
  assert.notEqual(v2,v);assert.equal(v2.weeks[0][0].trainings[0].aims,'바뀜','원문이 바뀌면 새 사본');
  local.delete('process_coach_v1');assert.equal(api.view('A팀'),null);
});

test('screens that only read the schedule use the shared copy',()=>{
  assert.match(part(SC,'function schedReadCur(){','function plGrpOf('),/PS\.view\(schedGrpCur\(\)\)/);
  assert.match(part(SC,'function avDayKind(','/* ══ 2.538'),/PS\.view\?PS\.view\(key\)/);
  assert.match(part(I,'function teamScheduleRead(){','function teamScheduleDay('),/ps\.view\(myGrp\(\)\)/);
  assert.match(part(PB,'var PS=window.PSSchedule; if(!PS||!PS.readFor)return out;','var today='),/PS\.view\?PS\.view\(grp\)/);
});

function scoutRefresh(win){
  const calls=[],intervals=[],listeners={};
  const c=vm.createContext({matchBoardGesture:null,matchSaveTimer:0,_mprT:0,MATCH_KEY:'cs_team_matches_v1',
    store:{hasPending:()=>false,hasFailed:()=>false},matchState:{},matchCurrent:'',matchPendingOpen:null,
    matchLoad(){calls.push('load');return {matches:[]};},matchDocPending:()=>false,matchRefreshLater(){calls.push('later');},
    renderMatch(){calls.push('match');},renderTeamHome(){calls.push('home');},renderAvail(){calls.push('avail');},
    setInterval(fn){intervals.push(fn);return intervals.length;},clearInterval(){intervals.length=0;},setTimeout(fn){fn();},
    addEventListener(n,fn){(listeners[n]||(listeners[n]=[])).push(fn);},removeEventListener(n,fn){listeners[n]=(listeners[n]||[]).filter(f=>f!==fn);},
    document:{activeElement:null,querySelector:s=>s==='.view.on'?{id:'homeView'}:null}});
  Object.assign(c,win);c.window=c;
  vm.runInContext(part(SC,'function __matchRefresh(){','window.addEventListener("storage",function(e){\n  if(e.key==="ps_sync_meta"){'),c);
  return {c,calls,intervals,listeners};
}
test('a hidden team frame keeps match records in step but draws the cockpit only when it is shown',()=>{
  const parent={};
  const h=scoutRefresh({parent,innerWidth:0,innerHeight:0});
  h.c.__matchRefresh();h.c.__matchRefresh();
  assert.deepEqual(h.calls,['load','load'],'숨어 있으면 경기 맞추기만 하고 그리지 않는다');
  assert.equal(h.c.__matchRenderStale,true);assert.equal(h.intervals.length,1,'확인은 하나만');
  h.intervals[0]();assert.deepEqual(h.calls,['load','load'],'아직 숨어 있으면 그대로 기다린다');
  h.c.innerWidth=1024;h.c.innerHeight=700;h.intervals[0]();
  assert.deepEqual(h.calls,['load','load','home'],'보이면 한 번 그린다');
  assert.equal(h.c.__matchRenderStale,false);assert.equal(h.intervals.length,0,'그린 뒤 확인을 멈춘다');
  const v=scoutRefresh({parent,innerWidth:1024,innerHeight:700});v.c.__matchRefresh();
  assert.deepEqual(v.calls,['load','home'],'보이는 화면은 예전처럼 바로 그린다');
  assert.match(part(SC,'function setView(v){','/* ===== 이미지노트'),/window\.__matchRenderStale=false;[\s\S]*if\(v==="home"\)\{renderTeamHome\(\);\}/,'화면을 열면 미뤄 둔 그리기를 푼다');
});
test('hidden IDP and playbook frames wait until shown; playbook re-reads the library only for library changes',()=>{
  const idpRule=part(I,"if(e.key==='process_coach_v1'){","if(squadView&&sqPanel==='matches'");
  assert.ok(idpRule.indexOf('idpFrameHidden()')>=0&&idpRule.indexOf('idpFrameHidden()')<idpRule.indexOf('render()'));
  const pb=part(PB,"window.addEventListener('storage',function(e){ if(!e||!e.key||/cs_gamemodel_v1","function refreshPlaybook(){");
  assert.match(pb,/kind=\(!e\|\|!e\.key\|\|e\.key==='cs_lib_rev'\)\?'lib':'render'/);
  assert.match(pb,/if\(pbHidden\(\)\)\{ pbLater\(kind\); return; \}/);
});

function saver(over){
  const writes=[],hist=[];
  const local=new Map();
  const c=vm.createContext(Object.assign({JSON,Date,Math,Object,Promise,
    weeksMap:{0:[{d:'월',trainings:[{slot:'S1',_open:true,note:'x'}]}]},__schedBase:null,__schedGrpWeeks:{},myTemplates:[],ddayLabel:'',
    __ANCHOR:thisMonday(),__schedRev:2,__schedSavedRaw:'',__schedWritePending:false,__schedWriteStartGen:0,__schedLocalGen:0,__schedWriteSeq:0,
    __histRawNext:null,STORE_KEY:'process_coach_v1',
    document:{getElementById:()=>null},
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v))},
    PSSchedule:{stampIds(){return false;}},PSSaveState:{begin(){},ok(){},fail(){}},PSStorage:{sharedReady:()=>Promise.resolve(true)},
    psSaveShared(k,raw){writes.push(raw);local.set(k,raw);return true;},
    schedThumbDiet(){},saveCursor(){},__schedTouch(){},__schedUpdateSignal(){},__schedDrainIncoming(){},toast(){},setTimeout(fn){},
    pushHist(){hist.push(c.__histRawNext);c.__histRawNext=null;}},over||{}));
  c.window=c;c.window.queueMicrotask=f=>Promise.resolve().then(f);
  vm.runInContext(part(P,'var __saveQueued=false;','function loadState(opt){'),c);
  return {c,writes,hist};
}
test('several save() calls in one action write the schedule once, with the same text JSON.stringify would make',async()=>{
  const h=saver();
  h.c.save();h.c.save();h.c.save();
  assert.equal(h.writes.length,0,'같은 일 안에서는 아직 쓰지 않는다');
  await Promise.resolve();await Promise.resolve();
  assert.equal(h.writes.length,1,'한 번만 쓴다');
  const raw=h.writes[0],o=JSON.parse(raw);
  assert.equal(raw,JSON.stringify(o),'원문 모양은 JSON.stringify 그대로');
  assert.equal(Object.keys(o)[0],'weeks');assert.equal(o.weeks[0][0].trainings[0]._open,undefined,'_open 은 빠진다');
  assert.equal(o.weeks[0][0].trainings[0].note,'x');
  assert.equal(h.hist[0],JSON.stringify(o.weeks),'되돌리기 기록은 다시 직렬화하지 않고 같은 weeks 원문을 받는다');
  h.c.save();assert.equal(h.c.saveFlush(),true);assert.equal(h.writes.length,2,'saveFlush 는 지금 쓴다');
  await Promise.resolve();await Promise.resolve();assert.equal(h.writes.length,2,'밀어낸 뒤 남은 쓰기는 없다');
});
test('after undo the saver writes what is on screen, not the pre-undo object',async()=>{
  const h=saver();
  h.c.__schedBase={0:[{d:'월',trainings:[{note:'되돌리기 전'}]}]};
  h.c.weeksMap={0:[{d:'월',trainings:[{note:'화면'}]}]};
  h.c.save();await Promise.resolve();await Promise.resolve();
  assert.equal(JSON.parse(h.writes[0]).weeks[0][0].trainings[0].note,'화면');
  assert.equal(h.c.__schedBase,h.c.weeksMap);
  assert.match(part(P,'function doUndo(){','try{ document.addEventListener'),/weeksMap=JSON\.parse\(prev\); __schedBase=weeksMap;/);
});
test('opening the session sheet saves only when it had to create the session',()=>{
  const body=part(P,'window.wksFill=function(di,slot,focus){','window.wksFillPick=');
  assert.match(body,/var __nb=\(\(week\[di\]\|\|\{\}\)\.trainings\|\|\[\]\)\.length;\s*ensureSlotSession\(di,__fillSlot\);\s*if\(\(\(week\[di\]\|\|\{\}\)\.trainings\|\|\[\]\)\.length!==__nb\)\{ try\{save\(\);\}catch\(_\)\{\} \}/);
  const sv=part(P,'function syncViews(shouldSave){','function updateTopMini(){');
  assert.match(sv,/if\(shouldSave!==false&&__sheetCovering\(\)\)\{ __viewsStale=true; return; \}/,'시트가 덮고 있으면 뒤 보드는 닫을 때 그린다');
});

test('meeting pitch edit keeps the slide title above the pitch, never over it',()=>{
  const css=part(B,'/* ══ 2.933 · 운동장 편집에서 슬라이드 제목 칸','</style>');
  const num=re=>{const m=css.match(re);assert.ok(m,String(re));return +m[1];};
  const pad=num(/#boardStage\{padding-top:(\d+)px!important;\}/),top=num(/#ksHead\{top:(\d+)px;\}/),h=num(/#ksHead input\{font-size:16px;padding:6px 12px;height:(\d+)px;\}/);
  assert.ok(top+h<=pad,'넓은 화면: 제목 아래('+(top+h)+') ≤ 운동장 시작('+pad+')');
  const phone=css.slice(css.indexOf('@media(max-width:600px)'));
  const pPad=+phone.match(/padding-top:(\d+)px!important/)[1],pTop=+phone.match(/#ksHead\{top:(\d+)px;\}/)[1];
  assert.ok(pTop+h<=pPad,'폰: 제목 아래('+(pTop+h)+') ≤ 운동장 시작('+pPad+')');
  assert.match(css,/:not\(\.focus-board\):not\(\.meeting-page-mode\)/,'슬라이드쇼·페이지 보기는 건드리지 않는다');
});
