'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const evidence=require('../studio/idp-evidence.js');
const source=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const code=section('  function visionCore(','  /* 시간은 자유 입력')+section('  function rVisionDaily(','  function rOneLine(');
function harness(){
  const c=vm.createContext({doc:{vision:{statement:'현재 방향',revision:'new',focusId:'scan',behaviors:[{id:'scan',text:'현재 바뀐 문구'}]}},PSIDPEvidence:evidence,esc:evidence.esc,ro:()=>false});
  c.window=c;vm.runInContext(code,c);return c;
}
test('legacy id-only evidence remains an explicit current reference in the daily view after wording changes',()=>{
  const c=harness(),html=c.rVisionDaily({visionBehaviorId:'scan'},'현재 바뀐 문구');
  assert.match(html,/현재 문구 참고/);assert.doesNotMatch(html,/이 행동을 오늘 기록에 연결했어요/);
  assert.doesNotMatch(html,/class="on" data-vd-b="scan"/);
});
test('an actual current snapshot may use the compact connected indicator and selected action',()=>{
  const c=harness(),html=c.rVisionDaily({visionEvidence:{id:'scan',text:'현재 바뀐 문구',revision:'new'}},'현재 바뀐 문구');
  assert.match(html,/이 행동을 오늘 기록에 연결했어요/);assert.match(html,/class="on" data-vd-b="scan"/);
});
test('a historical snapshot with the same ID keeps its saved wording and does not select the new action',()=>{
  const c=harness(),html=c.rVisionDaily({visionEvidence:{id:'scan',text:'옛 문구',revision:'old'}},'현재 바뀐 문구');
  assert.match(html,/옛 문구/);assert.doesNotMatch(html,/class="on" data-vd-b="scan"/);
});
