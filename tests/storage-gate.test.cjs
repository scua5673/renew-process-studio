// 저장 계층의 문(0단계) — «저장했는데 사라졌다 · 저장공간이 부족하다»가 되풀이된 구조를 더 키우지 않는다.
// 10월 이후 저장공간 제보 넷(a4d77bba · 095358c2 · 419fead1 · e6fc5d26)은 매번 작은 저장소(localStorage)를 채운 주인이 달랐다.
// 내용 자료를 localStorage 에 직접 쓰는 곳과 실패를 삼키는 빈 catch 는 지금 숫자에서 늘어나지 않는다.
//   숫자 보기 · 기준 고쳐 쓰기: node scripts/storage-gate-scan.cjs [--write]
const test=require('node:test');
const assert=require('node:assert/strict');
const K=require('../studio/storage-keys.js');
const G=require('../scripts/storage-gate-scan.cjs');
const now=G.counts(), base=G.baseline();
const lines=kind=>G.over(now,base).filter(r=>r.kind===kind).map(r=>r.file+'  '+r.was+' → '+r.now);

test('내용 자료를 localStorage 에 직접 쓰는 곳이 늘지 않는다 — 내용 자료는 psSaveShared · psSaveSharedAsync 로 쓴다',()=>{
  assert.deepEqual(lines('direct'),[],
    '직접 localStorage.setItem 이 늘었다. 내용 자료면 psSaveShared 로 쓰고, 화면 설정이면 studio/storage-keys.js 에 pref · seen · session · cache 로 적은 글자 그대로의 키를 쓴다(그런 키는 세지 않는다)');
});

test('아무것도 하지 않는 catch 가 늘지 않는다 — 실패를 삼키면 화면은 «직전 그대로»가 된다',()=>{
  assert.deepEqual(lines('silent'),[],
    '빈 catch 가 늘었다. 실패했을 때 할 일(되돌리기 · 알리기 · 기록)을 적거나, 정말 무시해도 되면 그 까닭을 catch 안에 주석 아닌 코드로 남긴다(예: 기본값 대입)');
});

test('세는 규칙 — 설정 키는 빼고, 내용 키와 글자 그대로가 아닌 키는 센다',()=>{
  assert.equal(K.info('ps_tm_view').role,'pref');
  assert.ok(G.CONTENT[K.info('scout_tool_v1').role],'선수 DB 는 내용 자료');
  assert.ok(G.CONTENT[K.info('ps_ws_stash_x').role],'복구 사본도 작은 저장소를 채운다');
  const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
  assert.ok(sum(now.direct)>0&&sum(now.silent)>0,'센 것이 있다(규칙이 조용히 비지 않았다)');
  assert.ok(sum(now.direct)<=sum(base.direct)&&sum(now.silent)<=sum(base.silent),'합계도 기준 아래');
});

// 화면마다 따로 적어 둔 «IndexedDB 에 사는 키» 목록은 키 표와 같은 말을 해야 한다.
// 아래는 2026-11-05 에 이미 어긋나 있던 것 — 고치면 이 목록에서 지운다. 새 어긋남은 여기 더하지 말고 표나 목록을 고친다.
const KNOWN=[
  'studio/app.html KNOWN_IDB: 표에 없는 키 cs_board_stash_v1',
  'studio/app.html KNOWN_IDB: 표에 없는 키 cs_snap_match_v1',
  'studio/app.html KNOWN_IDB: 표에서는 localStorage 정본 cs_editor_draft_v1',
  'studio/app.html KNOWN_IDB: 표에서는 localStorage 정본 cs_editor_work_v1',
  'studio/app.html KNOWN_IDB: 표에서는 localStorage 정본 training_session_cur_v1',
  'studio/storage-keys.js: 선수별 행 접두사 sq: 가 표에 없음'
];
test('정본 목록 = 키 표 — scout.html SHARED_IDB · team-files.js IDB_MIRROR · app.html KNOWN_IDB · MIRRORED_IDB',()=>{
  for(const L of G.truthLists())assert.ok(L.keys&&L.keys.length,L.file+' 의 '+L.name+' 을 읽었다');
  assert.deepEqual(G.gaps(),KNOWN.slice().sort(),'목록과 표가 새로 어긋났거나, 알려진 어긋남을 고쳤다(고쳤으면 KNOWN 에서 지운다)');
});
