'use strict';
/* 3.266 — 세션 없는 경기 날의 «시간 ＋»는 경기 시각을 정한다(studio/schedule-match-time.js). 예전엔 wksPickSes(di,'','time') 가 ensureSlotSession 으로
   경기 날에 훈련 세션(RPE 5)을 만들고 경기 시각은 비워 두었다 — 선수 «오늘»에 «경기 … RPE 5». 훈련 날 · 세션 있는 날은 예전 길 그대로. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MOD=fs.readFileSync(path.join(__dirname,'../studio/schedule-match-time.js'),'utf8');
const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
function setup(o={}){
  const sheet={innerHTML:'',querySelector(sel){return sel==='#sheet .wf-time'?c.wfTime:null;}},scrim={cls:[],classList:{add(x){scrim.cls.push(x);}}};
  const match={d:'일',rest:true,trainings:[],match:o.matchTime!==undefined?{time:o.matchTime,opp:'컵 상대',kind:'cup'}:undefined,board:{sched:'경기'}};
  if(!match.match)delete match.match;
  const train={d:'화',rest:false,trainings:[{slot:'',time:'17:00'}],board:{sched:'훈련'}};
  const c={calls:[],picks:[],week:[train,match],wfTime:{textContent:'시간 ＋',attrs:{},setAttribute(k,v){this.attrs[k]=v;}},__fillDi:1,__fillNoSes:true,
    document:{getElementById:id=>id==='sheet'?sheet:id==='scrim'?scrim:null,querySelector:sel=>sheet.querySelector(sel)},
    dayBoard:d=>d.board,schedEditBlocked:()=>!!o.blocked,schedBlockNotice(){c.calls.push('notice');},wkbdEsc:x=>String(x).replace(/</g,'&lt;'),
    toast(m){c.calls.push('toast:'+m);},psAct(n){c.calls.push('act:'+n);},save(){c.calls.push('save');},closeSheet(){c.calls.push('close');},syncViews(){c.calls.push('sync');},
    wksPickSes(di,slot,kind){c.picks.push([di,slot,kind]);c.week[di].trainings.push({slot:slot,time:'18:00',load:{rpe:5}});},
    wksFillRender(keep){c.calls.push('render');return 'R';}};
  c.window=c;vm.createContext(c);vm.runInContext(MOD,c);return {c,sheet,scrim,match,train};
}
test('경기 날의 시간 단추는 경기 시각 고르개를 열고 훈련 세션을 만들지 않는다',()=>{
  const h=setup({matchTime:''});h.c.wksPickSes(1,'','time');
  assert.equal(h.c.picks.length,0,'원래 wksPickSes 로 가지 않는다');
  assert.equal(h.match.trainings.length,0,'ensureSlotSession 이 세션을 만들지 않는다');
  assert.match(h.sheet.innerHTML,/일요일 경기 — 시간/);assert.match(h.sheet.innerHTML,/PSSchedMatchTime\.set\(1,'14:00'\)/);assert.match(h.sheet.innerHTML,/id="psMtFree"/);
  assert.doesNotMatch(h.sheet.innerHTML,/지우기/,'시각이 없으면 지우기 없음');assert.deepEqual(h.scrim.cls,['show']);
});
test('set 은 경기 시각 · 옛 보드 시각을 쓰고 저장 · 닫기 · 다시 그린다; 빈 값은 지운다; 모양이 틀리면 거부',()=>{
  const h=setup({matchTime:''});h.c.PSSchedMatchTime.set(1,'14:00');
  assert.equal(h.match.match.time,'14:00');assert.equal(h.match.board.time,'14:00');assert.equal(h.match.board.sched,'경기');assert.equal(h.match.rest,false);
  assert.deepEqual(h.c.calls,['act:a_week','save','close','sync']);assert.equal(h.match.trainings.length,0);
  h.c.calls.length=0;h.c.PSSchedMatchTime.set(1,'');assert.equal(h.match.match.time,'');assert.deepEqual(h.c.calls,['act:a_week','save','close','sync']);
  h.c.calls.length=0;h.c.PSSchedMatchTime.set(1,'오후 두시');assert.equal(h.match.match.time,'');assert.deepEqual(h.c.calls,['toast:시각은 14:00 처럼']);
});
test('시각이 있으면 고르개에 지우기와 현재 값이 보인다',()=>{
  const h=setup({matchTime:'15:00'});h.c.PSSchedMatchTime.open(1);
  assert.match(h.sheet.innerHTML,/class="fp on" onclick="PSSchedMatchTime\.set\(1,'15:00'\)"/);assert.match(h.sheet.innerHTML,/지우기/);assert.match(h.sheet.innerHTML,/value="15:00"/);
});
test('훈련 날 · 세션이 있는 날 · 세션 시간(슬롯 있음)은 예전 wksPickSes 그대로',()=>{
  const h=setup({matchTime:''});
  h.c.wksPickSes(0,'','time');assert.deepEqual(h.c.picks,[[0,'','time']]);
  h.match.trainings.push({slot:'',time:'09:00'});h.c.wksPickSes(1,'','time');assert.deepEqual(h.c.picks[1],[1,'','time'],'경기 날이라도 슬롯 없는 세션이 이미 있으면 그 세션의 시간');
  h.c.wksPickSes(1,'Sabc','time');assert.deepEqual(h.c.picks[2],[1,'Sabc','time']);
  h.c.wksPickSes(1,'','rpe');assert.deepEqual(h.c.picks[3],[1,'','rpe']);
});
test('편집이 막힌 상태에서는 열지도 쓰지도 않는다',()=>{
  const h=setup({matchTime:'',blocked:true});h.c.wksPickSes(1,'','time');h.c.PSSchedMatchTime.set(1,'14:00');
  assert.equal(h.sheet.innerHTML,'');assert.equal(h.match.match.time,'');assert.deepEqual(h.c.calls,['notice','notice']);
});
test('세션 없는 경기 날의 채우기 시트 머리는 «경기 시간 ＋» / «경기 14:00»',()=>{
  const h=setup({matchTime:''});assert.equal(h.c.wksFillRender(true),'R');assert.equal(h.c.wfTime.textContent,'경기 시간 ＋');assert.equal(h.c.wfTime.attrs.onclick,"wksPickSes(1,'','time')");
  h.match.match.time='14:00';h.c.wksFillRender(true);assert.equal(h.c.wfTime.textContent,'경기 14:00');
  h.c.__fillDi=0;h.c.wfTime.textContent='17:00';h.c.wksFillRender(true);assert.equal(h.c.wfTime.textContent,'17:00','훈련 날은 손대지 않는다');
});
test('process.html 본문 뒤에 싣고 sw CORE 에 있다',()=>{
  const i=P.indexOf('<script src="schedule-match-time.js"'),j=P.indexOf('function wksFillRender(');
  assert.ok(i>0&&j>0&&i>j,'본문 함수 선언 뒤에 읽혀야 감쌀 수 있다');
  assert.ok(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').includes("'/studio/schedule-match-time.js'"));
});
