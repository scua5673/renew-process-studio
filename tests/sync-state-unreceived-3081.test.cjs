'use strict';
/* 3.081 — 이 기기가 이 공간의 자료를 아직 받지 못했는데 «팀과 같아요 · 저장됨»이라 하던 것.
   팀 전환 안의 받기가 실패하면 meta 가 빈 채로 열리고(meta.last 0), 공간을 가리지 않는 ps_last_pull_at 이 이전 팀에서
   받은 시각을 그대로 보여 줬다(가상 팀 재현: 아무것도 못 받은 채 «팀과 같아요 · 1분 전»). 닫기 정리 뒤 첫 받기 전도 같다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {view}=require('../studio/autosave-status.js');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(start,end){const a=sync.indexOf(start),b=sync.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return sync.slice(a,b);}
const code=section('function syncState(){','\nfunction classifySyncError(');

function state({last=0,lastPull=Date.now()-60000,wiped=false,issue=null,pending=0,online=true}={}){
  const store=new Map([['ps_last_pull_at',String(lastPull)]]);
  const c=vm.createContext({
    getSess:()=>({uid:'synthetic-coach'}),activeWs:()=>'team-a',visiblePendingInfo:()=>({count:pending}),meta:()=>({h:{},c:{},last}),
    holdList:()=>[],personalReviewList:()=>[],dataUnlocked:()=>true,isTeamWs:()=>true,ITEMS_ACTIVE:false,
    navigator:{onLine:online},personalIssue:null,lastIssue:issue,busy:false,agoText:()=>'1분 전',rtConnected:()=>false,rtLast:0,rtHits:0,
    syncReasonText:code=>code==='sync_network'?'인터넷을 확인해 주세요':code,cacheWipedFlag:()=>wiped,Date,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null},
  });
  vm.runInContext(code,c,{filename:'actual syncState'});
  return c.syncState();
}

test('이 공간에서 받은 적이 없으면 이전 팀의 받은 시각이 있어도 «저장됨»이 아니다',()=>{
  const s=state({last:0});
  assert.equal(s.kind,'wait');assert.doesNotMatch(s.text,/팀과 같아요/);
  const shown=view(s);assert.equal(shown.text,'자료 받는 중…');assert.equal(shown.complete,false);assert.equal(shown.action,'retry');
});
test('닫기 정리 뒤 첫 받기 전에도 «받는 중»이다 — 받은 뒤에는 평소처럼 «저장됨»',()=>{
  assert.equal(state({last:Date.now()-5000,wiped:true}).kind,'wait');
  const done=state({last:Date.now()-5000});assert.equal(done.kind,'ok');assert.equal(view(done).text,'저장됨');
});
test('받기가 실패했으면 «아직 못 받았어요»로 이유와 다시 시도를 준다',()=>{
  const s=state({last:0,issue:{code:'sync_network',at:Date.now()-1000}});
  assert.equal(s.kind,'wait');assert.equal(s.reason,'sync_network');assert.match(s.text,/아직 못 받았어요/);
  const shown=view(s);assert.equal(shown.kind,'bad');assert.equal(shown.attention,true);assert.equal(shown.action,'retry');
  assert.doesNotMatch(shown.text+shown.detail,/저장됨|저장했/);
});
test('올릴 것 · 오프라인은 받기 전이어도 지금처럼 먼저 말한다',()=>{
  assert.equal(state({last:0,pending:2}).kind,'pending');
  assert.equal(state({last:0,online:false}).kind,'bad');
});
