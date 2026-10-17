const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.075 — 커뮤니티 공통 분류(사용자 «E안으로 앱에 적용해줘 · 커뮤니티에 전부 적용해줘 다른 탭에도»).
   경기 4국면 타일 + 경기 밖 주제 + 연령 + «오늘 인원», 카드를 누르면 미리보기 창. 분류 · 걸러내기 · 그리기는 studio/community-tax.js 모듈. */
const root=path.join(__dirname,'..');
const T=require(path.join(root,'studio','community-tax.js'));
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');
const keysOf=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
const plain=o=>JSON.parse(JSON.stringify(o));
const reset=()=>T.set({topic:'',age:'',n:12,any:true});

test('eight topics: the four game phases first, then set pieces, technique, goalkeeping, physical',()=>{
  assert.deepEqual(T.TOPICS.map(t=>t[0]),['att','trd','tra','def','set','tech','gk','phys']);
  assert.deepEqual(T.PHASES,['att','trd','tra','def']); assert.deepEqual(T.AGES,['U8','U10','U12','U15','U18','성인']);
  for(const v of Object.values(T.COACH))assert.ok(T.TOPICS.some(t=>t[0]===v),'코치 분류는 새 주제 8개 중 하나로');
});

test('each tab\'s own labels map onto the same topics, ages and player counts',()=>{
  assert.deepEqual(plain(T.fromCoach({cat:'rondo,poss',age:'U12,U15',players:'8'},keysOf)),{topics:['att'],ages:['U12','U15'],min:8,max:8});
  assert.deepEqual(plain(T.fromCoach({cat:'match',age:'',players:''},keysOf)),{topics:[],ages:null,min:0,max:0},'경기 분석은 주제 없음 · 모르는 연령 · 인원');
  assert.deepEqual(T.fromProc({n:4,theme:'공격 → 수비 전환 › 카운터프레스'}).topics,['trd']);
  assert.deepEqual(T.fromProc({n:8,theme:'수비 → 공격 전환 › 역습'}).topics,['tra']);
  assert.deepEqual(T.fromProc({n:6,theme:'세트피스 › 코너킥'}).topics,['set']);
  assert.deepEqual([T.fromProc({n:2,theme:'공격 조직 › 빌드업'}).min,T.fromProc({n:2,theme:'공격 조직'}).max],[6,13],'세션의 훈련 인원');
  const yb={g:'yb',ko:'8–12세 · 주 1회 훈련용 세션'},u8={g:'u8',ko:'슈팅'},el={g:'def',ko:'한 덩어리'};
  assert.deepEqual(T.fromFifa(yb,null).ages,['U10','U12']); assert.deepEqual(T.fromFifa(u8,null).ages,['U8']); assert.deepEqual(T.fromFifa(el,null).ages,['U15','U18','성인']);
  assert.deepEqual(plain(T.fromFifa({g:'club',ko:'x'},{focus:'tr_def',players:[7,14]})),{topics:['trd'],ages:['U15','U18','성인'],min:7,max:14},'애니메이션 팩의 주제 · 인원이 먼저');
});

test('filtering: one topic, one age, and «today\'s players» shows only what can be run; unknown age or players never hides a post',()=>{
  reset(); const a={topics:['att'],ages:['U12'],min:6,max:14},b={topics:['def'],ages:null,min:0,max:0};
  assert.ok(T.ok(a)&&T.ok(b),'처음엔 전부');
  T.set({topic:'att'}); assert.ok(T.ok(a)); assert.ok(!T.ok(b));
  T.set({topic:'',age:'U8'}); assert.ok(!T.ok(a)); assert.ok(T.ok(b),'연령을 모르는 글은 보인다');
  T.set({age:'',any:false,n:5}); assert.ok(!T.ok(a),'가장 작은 훈련도 6명'); assert.ok(T.ok(b));
  T.set({n:10}); assert.ok(T.ok(a)); assert.deepEqual(T.fit(a),{text:'마지막 훈련은 14명 — 줄여서 진행',kind:'warn'});
  T.set({n:14}); assert.equal(T.fit(a).kind,'ok'); T.set({any:true}); assert.equal(T.fit(a),null,'«상관없음»이면 맞춤 표시 없음');
  T.set({n:999}); assert.equal(T.state().n,30); T.set({topic:'nope',age:'U99'}); assert.deepEqual([T.state().topic,T.state().age],['','']);
  reset(); assert.deepEqual(T.counts([a,b,{topics:['att'],ages:null,min:0,max:0}]),{att:2,def:1});
});

test('the community page uses it on every tab — coach, process, FIFA filter; elmiha only gets the preview window',()=>{
  assert.match(comm,/<script src="community-tax\.js"><\/script>/); assert.match(comm,/<link rel="stylesheet" href="community-tax\.css">/);
  assert.match(comm,/<div class="tx-bar" id="txBar" hidden><\/div>/);
  assert.match(comm,/if\(TX&&!TX\.ok\(txC\(p\)\)\)return false;/,'코치 자료');
  assert.match(comm,/procMatch\(s,procG,searchF\)&&\(!TX\|\|TX\.ok\(TX\.fromProc\(s\)\)\)/,'프로세스');
  assert.match(comm,/ok:TX&&function\(e\)\{ return TX\.ok\(TX\.fromFifa\(e,F\.animOf\(e\)\)\); \}/,'FIFA');
  assert.match(comm,/txDraw\(elmTab\?null:posts\.map\(txC\)\);/,'엘미하 칸에는 고르개가 없다');
  assert.match(comm,/txCoach\(p,elmTab\)/,'엘미하 · 코치 자료 카드도 미리보기 창');
  const tax=fs.readFileSync(path.join(root,'studio','community-tax.js'),'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage/.test(tax),'서버 · 저장소를 쓰지 않는다');
  assert.equal((tax.match(/\.innerHTML=/g)||[]).length,1,'HTML 을 넣는 곳은 코치 글 그림(thumbImg 결과) 하나');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'); assert.match(sw,/'\/studio\/community-tax\.js', '\/studio\/community-tax\.css'/);
});
