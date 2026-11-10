'use strict';
// 세션 × 뒤의 «되돌리기» 알림 · × 가 칸 밖으로 잘리지 않게(studio/schedule-del-undo.js). 되돌리기는 process.html 의 원래 기록(__hist · pushHist · doUndo) 하나만 쓴다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../studio/schedule-del-undo.js');
const MOD=fs.readFileSync(path.join(__dirname,'../studio/schedule-del-undo.js'),'utf8');
const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
const cut=(a,b)=>{const i=P.indexOf(a),j=P.indexOf(b,i+a.length);assert.ok(i>0&&j>i,a);return P.slice(i,j);};
// process.html 의 실제 기록 · 되돌리기 · 지우기를 가짜 화면에서 돌린다
function setup({confirm='ok'}={}){
  const day=()=>({d:'목',trainings:[{slot:'S1',time:'17:00',grp:['A팀','B팀'],note:'메모'}],board:{sched:'훈련',trains:[],trainSlot:[],trainData:[],trainThemes:[],meets:[],meetSlot:[],meetsData:[],warms:[],warmSlot:[],warmsData:[],libs:[],libSlot:[],libData:[]}});
  const timers=[];
  const c={weeksMap:{0:[day(),day()]},wk:0,toasts:[],undoToast:null,asked:[],saves:0,__schedBase:null,
    schedEditBlocked:()=>false,schedBlockNotice(){},dayBoard:d=>d.board,wksSlotLabel:()=>'오후',recomputeMD(){},syncViews(){},renderMix(){},blankWeek:()=>[],
    toast(m){c.toasts.push(m);},psConfirm(msg,ok,cancel){c.asked.push(msg);if(confirm==='ok')ok();else if(cancel)cancel();},
    _mpUndoToast(msg,undo){c.undoToast={msg,undo};},setTimeout(f){timers.push(f);return timers.length;},clearTimeout(){},
    document:{getElementById:()=>null,createElement:()=>({}),head:{appendChild(){}}},console,JSON};
  c.window=c;vm.createContext(c);
  vm.runInContext('var week=weeksMap[0];'+cut('var __hist=[], __undoing=false;','\n')+'\nvar __histRawNext=null;\n'+cut('function __snap(){','function doUndo(){')+cut('function doUndo(){','\n}\n')+'\n}\n'
    +'function save(){saves++;pushHist();}\n'+cut('function wksSlotCount(di,slot){','/* ══ 2.135')+'\nthis.hist=()=>__hist;this.wk0=()=>week;',c);
  vm.runInContext(MOD,c);
  return {c,run(){while(timers.length)timers.shift()();}};
}
test('count · canUndo',()=>{
  const d={trainings:[{slot:'a'},{slot:'b'}],board:{trains:['x','y'],trainSlot:['a',''],libs:['z'],libSlot:['a']}};
  assert.equal(api.count(d,'a'),3);assert.equal(api.count(d,'b'),1);assert.equal(api.count(d,''),1);assert.equal(api.count(null,'a'),0);
  assert.equal(api.canUndo(['p','q'],'q'),true);assert.equal(api.canUndo(['p','q'],'p'),false);assert.equal(api.canUndo(['q'],'q'),false,'돌아갈 판이 없다');assert.equal(api.canUndo(null,'q'),false);
});
test('빈 세션: × 한 번에 지워지고(확인 없음) 알림 — 앱을 열고 처음 한 편집이어도 되돌리면 지우기 직전 그대로',()=>{
  const h=setup(),before=JSON.stringify(h.c.wk0()[0]);
  assert.equal(h.c.hist().length,0,'기록은 저장할 때만 쌓인다(전제)');
  h.c.wksDelSlot(0,'S1');assert.equal(h.c.wk0()[0].trainings.length,0);assert.equal(h.c.asked.length,0);assert.equal(h.c.undoToast,null,'저장 기록이 남은 뒤에 띄운다');
  h.run();assert.equal(h.c.undoToast.msg,'세션을 지웠어요');assert.equal(h.c.hist().length,2);
  h.c.undoToast.undo();assert.equal(JSON.stringify(h.c.wk0()[0]),before);assert.deepEqual(h.c.toasts,['되돌렸어요 ↺']);
  assert.equal(JSON.stringify(h.c.wk0()[1]),before,'다른 날은 그대로');
});
test('내용이 있는 세션: 확인 창 «확인» 뒤에만 알림 · «취소»면 아무 일도 없다 · 확인 창은 제자리로',()=>{
  const fill=h=>{const b=h.c.wk0()[0].board;b.trains=['론도'];b.trainSlot=['S1'];b.trainData=[{minutes:10}];b.trainThemes=[''];};
  let h=setup();fill(h);const pc=h.c.psConfirm,before=JSON.stringify(h.c.wk0()[0]);
  h.c.wksDelSlot(0,'S1');h.run();assert.equal(h.c.asked.length,1);assert.match(h.c.asked[0],/오후 17:00 세션을 지울까요\? 훈련 1/);assert.equal(h.c.psConfirm,pc);
  assert.equal(h.c.wk0()[0].trainings.length,0);assert.ok(h.c.undoToast);h.c.undoToast.undo();assert.equal(JSON.stringify(h.c.wk0()[0]),before,'칩까지 돌아온다');
  h=setup({confirm:'cancel'});fill(h);h.c.wksDelSlot(0,'S1');h.run();assert.equal(h.c.wk0()[0].trainings.length,1);assert.equal(h.c.undoToast,null);assert.equal(h.c.asked.length,1);
});
test('그 사이 다른 편집이 있었으면 되돌리지 않고 길을 알려 준다(엉뚱한 편집을 되돌리지 않는다)',()=>{
  const h=setup();h.c.wksDelSlot(0,'S1');h.run();
  vm.runInContext("week[1].meeting='다른 편집';save();",h.c);
  h.c.undoToast.undo();assert.equal(h.c.wk0()[0].trainings.length,0);assert.equal(h.c.wk0()[1].meeting,'다른 편집');assert.match(h.c.toasts[0],/다른 편집이 있어요.*되돌리기/);
});
test('없는 시간대 · 편집 막힘은 알림을 만들지 않는다',()=>{
  const h=setup();h.c.wksDelSlot(0,'nope');h.run();assert.equal(h.c.undoToast,null);assert.equal(h.c.wk0()[0].trainings.length,1);
  h.c.schedEditBlocked=()=>true;h.c.wksDelSlot(0,'S1');h.run();assert.equal(h.c.wk0()[0].trainings.length,1);assert.equal(h.c.undoToast,null);
});
test('두 번째 되돌리기 기록을 만들지 않는다 · × 모양 규칙은 머리줄의 × 에만',()=>{
  const src=MOD.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.match(src,/W\.doUndo\(\)/);assert.match(src,/W\.pushHist\(\)/);assert.match(src,/W\._mpUndoToast\('세션을 지웠어요'/);
  assert.doesNotMatch(src,/JSON\.stringify|JSON\.parse|weeksMap\s*=/,'판을 스스로 떠 두거나 되쓰지 않는다');
  assert.match(api.CSS,/\.wks-sh:not\(#_\)\{flex-wrap:wrap/);assert.match(api.CSS,/\.wks-sh>\.wks-x:not\(#_\)\{position:absolute/);
  assert.match(api.CSS,/@media \(pointer:coarse\)\{[\s\S]*width:44px;height:44px/);assert.doesNotMatch(api.CSS,/\.wks-chip/,'칩의 작은 × 는 건드리지 않는다');
  assert.doesNotMatch(api.CSS,/\.wks-x[^{]*\{[^}]*(font-size|color|background)/,'× 의 글자 · 색은 그대로');
});
test('process.html 본문 뒤에 싣고 sw.js CORE 에 있다',()=>{
  const i=P.indexOf('<script src="schedule-del-undo.js"');assert.ok(i>P.indexOf('window.wksDelSlot=function(di,slot){')&&i>P.indexOf('function _mpUndoToast(msg,undo){')&&i>P.indexOf('function doUndo(){'));
  assert.ok(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').includes("'/studio/schedule-del-undo.js'"));
});
