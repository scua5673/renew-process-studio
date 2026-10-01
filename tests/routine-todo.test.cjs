'use strict';
/* 2.923 — 루틴 = 투두리스트. 틀(doc.rtDay)과 그날 체크(doc.rtDone)를 가르고,
   개인 훈련 완료(doc.done)와 섞지 않는다 — 그 배열은 «개인 훈련을 한 날»로 세어진다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
function fn(name){   /* 중괄호 짝으로 함수 하나를 잘라 낸다(문자열 속 괄호는 이 함수들에 없다) */
  const i=src.indexOf('  function '+name+'(');assert.ok(i>=0,name);
  let j=src.indexOf('{',i),depth=0;for(;j<src.length;j++){if(src[j]==='{')depth++;else if(src[j]==='}'&&--depth===0)break;}
  return src.slice(i,j+1);}
function load(doc,readonly=false){
  const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  let saves=0;
  const api=new Function('doc','ymd','addDays','ro','save',[fn('rtKey'),fn('rtChecked'),fn('rtToggle'),fn('rtParseAdd')].join('\n')+'\nreturn {rtKey,rtChecked,rtToggle,rtParseAdd};')(doc,ymd,addDays,()=>readonly,()=>{saves++;});
  return Object.assign(api,{saves:()=>saves});
}
const day=new Date(2026,9,1);
test('체크는 doc.rtDone[날짜] 에 내용 키로 — doc.done(개인 훈련) 에는 안 들어간다',()=>{
  const doc={v:1,done:{}},a=load(doc);const k=a.rtKey({t:'06:30',s:'기상 · 스트레칭'});
  assert.equal(k,'06:30|기상 · 스트레칭');
  a.rtToggle(day,k);assert.deepEqual(doc.rtDone,{'2026-10-01':[k]});assert.deepEqual(doc.done,{});assert.equal(a.rtChecked(day,k),true);
  a.rtToggle(day,k);assert.equal(doc.rtDone['2026-10-01'],undefined,'빈 날은 지운다');assert.equal(a.rtChecked(day,k),false);
  assert.equal(a.saves(),2);
});
test('다른 날 체크는 그날만 — 오늘 체크가 내일로 넘어가지 않는다',()=>{
  const doc={v:1},a=load(doc),k=a.rtKey({t:'',s:'물 2L'});
  a.rtToggle(day,k);assert.equal(a.rtChecked(new Date(2026,9,2),k),false);
});
test('120일 지난 체크 기록은 정리한다',()=>{
  const doc={v:1,rtDone:{'2026-01-01':['x|y'],'2026-09-30':['a|b']}},a=load(doc);
  a.rtToggle(day,'c|d');assert.deepEqual(Object.keys(doc.rtDone).sort(),['2026-09-30','2026-10-01']);
});
test('코치(읽기 전용)는 체크할 수 없다',()=>{
  const doc={v:1},a=load(doc,true);a.rtToggle(day,'a|b');assert.equal(doc.rtDone,undefined);assert.equal(a.saves(),0);
});
test('한 줄 추가: «9:00 패스 100개» → 09:00 / 시간 없으면 내용만',()=>{
  const a=load({v:1});
  assert.deepEqual(a.rtParseAdd('9:00 패스 벽치기 100개'),{t:'09:00',s:'패스 벽치기 100개'});
  assert.deepEqual(a.rtParseAdd('21:30 폼롤러'),{t:'21:30',s:'폼롤러'});
  assert.deepEqual(a.rtParseAdd('스트레칭 영상 보기'),{t:'',s:'스트레칭 영상 보기'});
  assert.deepEqual(a.rtParseAdd('25:00 이상한 시간'),{t:'',s:'25:00 이상한 시간'});
  assert.equal(a.rtParseAdd('   '),null);
});
test('화면: 오늘 요일에만 체크, 코치는 목록만, 체크 문구에 재촉 없음',()=>{
  const r=fn('rRoutine');
  assert.match(r,/canCk=isToday&&!ro\(\)/);
  assert.match(r,/체크는 그날만 남아요 — 내일은 새로 시작합니다/);
  assert.doesNotMatch(r,/못 했|놓쳤|연속/);
  assert.match(src,/\.rtd-ck\{/);
});
