'use strict';
// 3.137 — 오류 제보 0ce6d0cc «경기준비 글씨 넣는 상자에 글씨가 안 넣어집니다». 경기 화면이 잠기면 까닭을 말하고, 서버 확인 대기면 다시 맞춘다.
// 화면 흐름은 tests/browser/match-lock-3137.mjs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const L=require('../studio/match-lock.js');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('까닭 차례 — 서버 확인 대기가 먼저 · 다 풀리면 빈 값',()=>{
  const w=(o)=>Object.assign({matchDocPending:()=>false,matchRole:()=>'executive',matchCanEdit:()=>true,matchCanEditOne:()=>true},o);
  assert.equal(L.reason(w({matchDocPending:()=>true,matchCanEdit:()=>false})),'pending','대기 중엔 권한보다 대기를 말한다');
  assert.equal(L.reason(w({matchRole:()=>'player',matchCanEdit:()=>false})),'player');
  assert.equal(L.reason(w({matchCanEdit:()=>false})),'perm');
  assert.equal(L.reason(w({matchCanEditOne:()=>false})),'owner');
  assert.equal(L.reason(w({})),'','고칠 수 있으면 빈 값(화면만 옛 상태 — 다시 그린다)');
  assert.equal(L.reason(w({matchDocPending:()=>{throw new Error('x');}})),'pending','모르면 대기로 본다');
  for(const k of ['pending','player','perm','owner'])assert.ok(L.TXT[k]&&L.TXT[k].length>8,k);
});

test('잠긴 칸은 scout.html 의 pointer-events 규칙과 같은 칸',()=>{
  const s=read('studio/scout.html');
  assert.ok(s.includes('.match-shell.readonly [data-match-field],.match-shell.readonly #matchPrivateNote{pointer-events:none}'),'잠금 규칙이 그대로');
  assert.equal(L.FIELD,'[data-match-field],#matchPrivateNote');
});

test('준비 모양은 숫자만(내용 없음)',()=>{
  const ls=new Map([['ps_active_ws','W1'],['ps_sync_meta',JSON.stringify({r:{cs_team_matches_v1:{w:'W1',present:true,h:'1:2'}}})],['cs_team_matches_v1','{"matches":[{"attack":"비밀"}]}']]);
  const win={localStorage:{getItem:k=>ls.has(k)?ls.get(k):null},PSSync:{keyReady:()=>false},scoutStore:{hasFailed:()=>true}};
  const o=L.readyInfo(win);
  assert.deepEqual(o,{r:1,w:1,present:1,mirror:1,kr:0,failed:1});
  assert.ok(!JSON.stringify(o).includes('비밀'));
  ls.delete('cs_team_matches_v1');ls.set('ps_sync_meta','{}');
  assert.deepEqual(L.readyInfo(win),{r:0,mirror:0,kr:0,failed:1});
});

test('scout.html 은 <script> 한 줄 · 서비스워커 CORE',()=>{
  const s=read('studio/scout.html');
  assert.ok(s.includes('<script src="match-meet-parts.js"></script><script src="match-lock.js"></script>'));
  assert.ok(s.indexOf('function matchDocPending(')<s.indexOf('<script src="match-lock.js">'),'잠금 함수보다 뒤에서 읽는다');
  assert.ok(read('sw.js').includes("'/studio/match-lock.js'"));
});

test('회차가 도는 중에 친 글 — 본문의 두 길이 그대로라 모듈이 지킨다(renderMatch 감싸기 · typed)',()=>{
  const s=read('studio/scout.html'),m=read('studio/match-lock.js');
  assert.match(s,/^function renderMatch\(\)\{/m,'renderMatch 는 function 선언(window 속성) — 감쌀 수 있다');
  assert.ok(s.includes('}).then(function(){matchSyncing=false;matchState=null;renderMatch();},function(){matchSyncing=false;});'),'syncMatchFromCloud 는 회차 뒤 focus 를 안 보고 다시 그린다 — 이 길을 지킨다');
  assert.ok(s.includes('el.addEventListener(ev,function(){var m=matchGet();if(!m||!matchCanEdit())return;var k=el.dataset.matchField;'),'본문 입력 처리기는 matchCanEdit 거짓이면 글을 버린다');
  assert.match(s,/^function matchGet\(\)/m);assert.match(s,/^function matchQueueSave\(\)/m);assert.match(s,/^function matchCanEdit\(\)/m);
  assert.ok(m.includes("g.__psLock = 1; win.renderMatch = g;")&&m.includes("doc.addEventListener('input'"),'감싼다 · 친 글을 적는다');
  assert.ok(m.includes('now - e.t > 60000'),'60초 지난 값은 버린다(다른 기기의 편집을 영영 덮지 않게)');
  assert.ok(!/win\.renderMatch\s*=\s*function/.test(m.replace('win.renderMatch = g;','')),'원래 함수를 부른다');
});
