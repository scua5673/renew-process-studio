// 3.281 — 가용인원 기록이 멈춘 까닭(autosave-status.js reason) · 저장 추적기의 키 고르기(storage.js createTracker ready(retryFailed, only)).
// 제보 e6fc5d26 · de2e508c: 보관된 선수 행(sq:<id>) 하나가 가용인원 기록을 막았고, 창에는 «기록하지 못했습니다» 한 문장만 보였다.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const status=require('../studio/autosave-status.js');
const HELD='앱 설정 › 데이터 › 보관된 변경 › «보관 내용 보기»',DIAG='앱 설정 › 데이터 › «진단 보기»';
const issue=(code,stage,msg,extra)=>Object.assign(new Error(msg),{psCode:code,psStage:stage},extra||{});
const label=k=>k==='sq:vp01'?'선수 가상 선수 1':k==='scout_tool_v1'?'선수단 자료':'';

test('reason — 길 상수는 한 곳(PATH_HELD · PATH_DIAG)에서 나온다',()=>{
  assert.deepEqual(status.paths,{diag:DIAG,held:HELD});
});

test('reason — 보관된 선수 행(sync_local_changed · items_stale_review)이면 보관된 변경으로 가는 길과 선수 이름',()=>{
  const r=status.reason(issue('sync_local_changed','items_stale_review','선수 입력 원문을 보관했습니다. 저장 진단에서 확인해 주세요.',{psKey:'sq:vp01'}),{label});
  assert.equal(r.code,'sync_local_changed');assert.equal(r.path,HELD);
  assert.equal(r.text,'선수 가상 선수 1 · 앞선 입력을 이 기기에 보관해 두었습니다. 입력은 이 창에 남아 있습니다. '+HELD+'에서 남길 쪽을 고른 뒤 다시 기록해 주세요.');
  // 아직 보관 전(items_write_stale_job)도 같은 길 — 다음 배경 회차가 보관한다
  assert.match(status.reason(issue('sync_local_changed','items_write_stale_job','입력 뒤 선수 정보가 바뀌었습니다.')).text,/^앞선 입력을 이 기기에 보관해 두었습니다\. 입력은 이 창에 남아 있습니다\. 앱 설정 › 데이터 › 보관된 변경/);
  // 다른 단계의 sync_local_changed 는 엔진 문장 그대로 + 길
  assert.equal(status.reason(issue('sync_local_changed','schedule_ready_exact','일정 서버 확인 원문·기기 저장소·화면 사본이 다릅니다')).text,'일정 서버 확인 원문·기기 저장소·화면 사본이 다릅니다 입력은 이 창에 남아 있습니다. '+HELD+'에서 남길 쪽을 고른 뒤 다시 기록해 주세요.');
});

test('reason — 기기 저장(sync_storage · 저장 공간 · psKey 만 있는 기기 확인)이면 진단 보기로 가는 길',()=>{
  assert.equal(status.reason(issue('sync_storage','items_stale_module','선수 보관 확인 기능을 다시 불러와 주세요')).text,'선수 보관 확인 기능을 다시 불러와 주세요 입력은 이 창에 남아 있습니다. '+DIAG+'에서 이유를 본 뒤 다시 기록해 주세요.');
  const q=Object.assign(new Error('The quota has been exceeded.'),{name:'QuotaExceededError'});
  assert.equal(status.reason(q).text,'기기 저장 공간이 모자라 기록을 멈췄습니다. 입력은 이 창에 남아 있습니다. '+DIAG+'에서 이유를 본 뒤 다시 기록해 주세요.');
  assert.equal(status.reason(new Error('저장 실패'),{quota:()=>true}).code,'sync_storage');
  // psCode 없이 추적기가 단 psKey 만 있으면(통짜 문서의 앞선 기기 저장 확인) 그 자료 이름과 진단 보기
  const k=Object.assign(new Error('저장 내용이 바뀌어 다시 확인해야 합니다'),{psKey:'scout_tool_v1'});
  assert.equal(status.reason(k,{label}).text,'선수단 자료 · 저장 내용이 바뀌어 다시 확인해야 합니다 입력은 이 창에 남아 있습니다. '+DIAG+'에서 이유를 본 뒤 다시 기록해 주세요.');
});

test('reason — 계정·팀이 바뀌면 다시 열기 · 모르는 오류는 예전 한 문장 · 문구는 «~않습니다» 없이',()=>{
  assert.equal(status.reason(issue('sync_workspace_changed','items_delete_review','삭제 확인 중 계정이나 팀이 바뀌었습니다')).text,'삭제 확인 중 계정이나 팀이 바뀌었습니다 기록 창을 닫고 다시 열어 주세요.');
  const plain=status.reason(new Error('이 선수의 기록이 바뀌었습니다. 다시 열어 확인해 주세요.'));
  assert.equal(plain.code,'');assert.equal(plain.text,'기록하지 못했습니다. 입력은 남아 있습니다. 다시 시도하거나 창을 닫고 최신 기록을 확인해 주세요.');
  assert.equal(status.reason(null).text,plain.text);assert.equal(status.reason('문자열').text,plain.text);
  const src=fs.readFileSync(path.join(root,'studio/autosave-status.js'),'utf8'),fn=src.slice(src.indexOf('function reason('),src.indexOf('return {view:view'));
  assert.doesNotMatch(fn,/않습니다|않고/,'하는 일을 긍정형으로(feedback-positive-copy)');
  // 셸 flush(psFlushPendingReady)가 단 합성 코드도 읽는다 — 운영 기록의 모양 그대로
  const tagged=Object.assign(new Error('선수 입력 원문을 보관했습니다.'),{psTagged:true,psCode:'store_ready.sync_local_changed:sq:vp01',psStage:'items_stale_review'});
  assert.equal(status.reason(tagged,{label}).text,'선수 가상 선수 1 · 앞선 입력을 이 기기에 보관해 두었습니다. 입력은 이 창에 남아 있습니다. '+HELD+'에서 남길 쪽을 고른 뒤 다시 기록해 주세요.');
  assert.equal(status.reason(Object.assign(new Error('저장 내용이 바뀌어 다시 확인해야 합니다'),{psTagged:true,psCode:'store_ready.raw_changed:scout_tool_v1'}),{label}).path,DIAG);
  assert.match(status.reason(Object.assign(new Error('storage owner changed'),{psTagged:true,psCode:'store_ready.owner_changed'})).text,/기록 창을 닫고 다시 열어 주세요\.$/);
  // label·quota 가 던져도 문장은 나온다
  assert.match(status.reason(issue('sync_local_changed','items_stale_review','x',{psKey:'sq:vp01'}),{label(){throw Error('x');},quota(){throw Error('x');}}).text,/^앞선 입력을/);
});

/* storage.js 의 저장 추적기(createTracker)를 그대로 잘라 돌린다 — ready(retryFailed, only) 가 고른 키만 기다리고, 고른 키만 재시도한다 */
function tracker(){
  const src=fs.readFileSync(path.join(root,'studio/storage.js'),'utf8');
  const a=src.indexOf('createTracker:function(scope,ownerOf){'),b=src.indexOf('\n  };\n',a);
  assert.ok(a>0&&b>a,'createTracker 구간');
  const states=[];
  const c=vm.createContext({Promise,Object,String,Error,set:(scope,state)=>states.push(state)});
  const api=vm.runInContext('({'+src.slice(a,b)+'})',c);
  return {t:api.createTracker('team',()=>'owner-a'),states};
}
test('createTracker.ready(retryFailed, only) — 고른 키의 실패·대기만 기다리고 그 키만 재시도한다',async()=>{
  const {t}=tracker();
  let rowRetries=0,docRetries=0;
  const rowError=Object.assign(new Error('선수 입력 원문을 보관했습니다.'),{psCode:'sync_local_changed',psStage:'items_stale_review'});
  t.track('sq:vp01',Promise.reject(rowError),()=>{rowRetries++;return Promise.reject(rowError);}).catch(()=>{});
  t.track('scout_tool_v1',Promise.resolve(true),()=>{docRetries++;return Promise.resolve(true);});
  t.track('cs_squad_v1',Promise.resolve(true));
  await new Promise(r=>setTimeout(r,0));
  const whole=k=>String(k).indexOf('sq:')!==0;
  assert.equal(await t.ready(true,whole),true,'통짜 문서만 고르면 보관된 행의 실패는 기다리지 않는다');
  assert.equal(rowRetries,0,'고르지 않은 행은 재시도하지 않는다');assert.equal(docRetries,0,'성공한 키는 재시도할 것이 없다');
  await assert.rejects(t.ready(true),e=>e===rowError&&e.psKey==='sq:vp01','전부 기다리면 예전처럼 그 행의 실패가 psKey 와 함께 온다');
  assert.equal(rowRetries,1,'전부 기다릴 때만 실패한 행을 다시 돌린다');
  assert.equal(t.hasFailed('sq:vp01'),true,'고른 키만 기다린 뒤에도 행의 실패 표시는 그대로');
  // 고른 키가 실패면 예전처럼 막는다
  const docError=new Error('저장 내용이 바뀌어 다시 확인해야 합니다');
  t.track('scout_tool_v1',Promise.reject(docError),()=>{docRetries++;return Promise.reject(docError);}).catch(()=>{});
  await new Promise(r=>setTimeout(r,0));
  await assert.rejects(t.ready(true,whole),e=>e===docError&&e.psKey==='scout_tool_v1');
  assert.equal(docRetries,1);
  // 고른 키에 대기 중인 쓰기가 있으면 그 쓰기까지 기다린다
  let release;t.track('scout_tool_v1',new Promise(r=>{release=r;}));
  let done=false;const wait=t.ready(false,whole).then(()=>{done=true;});
  await new Promise(r=>setTimeout(r,10));assert.equal(done,false);release(true);await wait;assert.equal(done,true);
});
test('createTracker.ready — only 없이 부르면 예전 그대로(모든 키)',async()=>{
  const {t,states}=tracker();
  t.track('a',Promise.resolve(true));t.track('b',Promise.resolve(true));
  assert.equal(await t.ready(),true);assert.equal(states[states.length-1],'saved');
});
