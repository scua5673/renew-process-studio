'use strict';
/* 2.915 — 일정 «보관함에서 가져오기»가 훈련마다 보관함에 적힌 분 × 세트를 복사해 온다(사용자 «시간도 가져오게»).
   보관함 줄(libData)은 0 그대로 — 합계를 거기에도 담으면 하루 분을 두 번 센다(2.303 실측 67+67=134). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
function cut(a,b){const i=S.indexOf(a),j=S.indexOf(b,i);assert.ok(i>0&&j>i,a);return S.slice(i,j);}
const SET=cut('window.wkbdSetLibItem=function','/* 보관함 전체에서 고르기');
const CHOOSE=cut('window.wkbdLibChoose=function','window.wkbdAddTrain=function');
const PSMIN=cut('function psMin(d){','\n');
function run(item){
  const board={};const toasts=[];
  const ctx=vm.createContext({Array,String,Math,parseInt,JSON,Object,
    week:[{}],dayBoard:()=>board,psLibraryRequireUnlocked:()=>true,libDrills:()=>[item],FOCUS2THEME:{},__pendSlot:'S1',
    toast:t=>toasts.push(t),wkbdAutoTheme:()=>false,save(){},syncViews(){},closeSheet(){},wksFillBack(){}});
  ctx.window=ctx;   /* 브라우저처럼 window.x = 전역 */
  vm.runInContext(PSMIN+'\n'+SET+'\n'+CHOOSE+'\nthis.psMin=psMin;',ctx);
  ctx.window.wkbdLibChoose(0,null,0);
  return {board,toasts,psMin:ctx.psMin};
}
test('훈련마다 보관함의 분 × 세트가 따라온다',()=>{
  const {board,toasts,psMin}=run({name:'9월 30일 훈련',libId:'L1',minutes:67,trainings:[
    {name:'론도 4v2',minutes:12,sets:1},{name:'SSG 5v5',minutes:8,sets:3},{name:'마무리 슈팅',minutes:15,sets:2}]});
  assert.deepEqual([...board.trains],['론도 4v2','SSG 5v5','마무리 슈팅']);
  assert.deepEqual([...board.trainData.map(d=>[d.minutes,d.sets])],[[12,undefined],[8,3],[15,2]],'1세트는 sets 를 적지 않는다(2.308)');
  assert.equal(board.trainData.reduce((a,d)=>a+psMin(d),0),12+24+30);
  assert.deepEqual([...board.trainSlot],['S1','S1','S1'],'가져온 세션에 붙는다');
  assert.match(toasts[0],/보관함에 적힌 시간도 함께/);
});
test('보관함 줄은 0 — 하루 분을 두 번 세지 않는다',()=>{
  const {board}=run({name:'파일',libId:'L1',minutes:67,trainings:[{name:'A',minutes:20}]});
  assert.equal(board.libData[0].minutes,0);assert.equal(board.libs[0],'파일');
});
test('시간이 없는 훈련은 비워 두고, 그 수만큼 정해 달라고 말한다',()=>{
  const {board,toasts}=run({name:'파일',libId:'L1',trainings:[{name:'A',minutes:10,sets:2},{name:'B'}]});
  assert.deepEqual([...board.trainData.map(d=>[d.minutes,d.sets])],[[10,2],[0,undefined]]);
  assert.match(toasts[0],/1개는 시간을 정해 주세요/);
});
test('훈련 목록 없는 옛 카드 한 장도 카드의 분 × 세트를 가져온다',()=>{
  const {board}=run({name:'옛 카드',libId:'L2',minutes:25,sets:2});
  assert.deepEqual([...board.trainData.map(d=>[d.minutes,d.sets])],[[25,2]]);
});
test('이상한 값은 버린다(음수·글자·과대)',()=>{
  const {board}=run({name:'파일',libId:'L1',trainings:[{name:'A',minutes:-5},{name:'B',minutes:'abc',sets:4},{name:'C',minutes:9999,sets:99}]});
  assert.deepEqual([...board.trainData.map(d=>[d.minutes,d.sets])],[[0,undefined],[0,undefined],[600,20]]);
});
