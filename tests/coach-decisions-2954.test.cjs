'use strict';
/* 2.954 — 코치 점검(10/7) 뒤 사용자가 고른 화면 구조 셋. 자리를 옮긴 판이라 원문 규칙으로 지킨다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
const A=read('app.html'),SC=read('scout.html');

test('scouting is a top-row team tab (B안): between 선수단 and IDP, not in the 선수단 sub row',()=>{
  const seg=A.slice(A.indexOf('<span class="tn-seg">'),A.indexOf('</span>',A.indexOf('data-team-key="attrs" data-app="scout" data-team-view="attrs" data-tn-grp="setup"')));
  const keys=[...seg.matchAll(/<button data-team-key="([a-z]+)"/g)].map(m=>m[1]);
  assert.deepEqual(keys,['today','match','training','players','scouting','idp','attrs']);
  const squad=A.slice(A.indexOf('data-sub-grp="squad"'),A.indexOf('data-sub-grp="setup"'));
  assert.ok(!/data-team-key="scouting"/.test(squad),'선수단 서브 줄엔 스카우팅이 없다');
  assert.ok(/var TEAM_GRP=\{squad:\{players:1,avail:1\},/.test(A));
  assert.ok(/<i>팀<\/i><button type="button" data-tb="scouting">스카우팅<\/button>/.test(A),'폰은 더보기 › 팀');
});

test('scouting inner tab row is gone; one toggle goes to points and back',()=>{
  assert.ok(!/role="tab" data-sbtab=/.test(SC),'후보 DB · 스카우팅 포인트 탭 줄을 걷었다');
  assert.ok(/id="sbPtsToggle"/.test(SC));
  /* 2.963 — 버튼이 카드 도구 줄로 옮겨 다니므로 탭 줄 위임 대신 버튼에 직접 단다(같은 토글) */
  assert.ok(/ptb0\.addEventListener\("click",function\(\)\{ sbSetTab\(sbTab==="crit"\?"cands":"crit"\); \}\)/.test(SC));
  assert.ok(/ptb\.textContent=_cr\?"‹ 후보 DB":"스카우팅 포인트 ›"/.test(SC));
  assert.ok(/body\.sb-meet #sbPtsToggle/.test(SC),'회의 모드에서는 숨는다');
});

test('squad group filter lives once in the head; the list no longer draws its own bar, a floating copy follows',()=>{
  assert.ok(!/appendChild\(tmGrpBarEl\(\)\)/.test(SC),'명단 위 조 줄을 다시 붙이지 않는다');
  assert.equal((SC.match(/setTimeout\(tmGrpFloatSync,0\)/g)||[]).length,2);
  assert.ok(/function tmGrpFloatVis\(\)/.test(SC)&&/show=chips\.getBoundingClientRect\(\)\.bottom<0/.test(SC),'머리 칩이 화면 위로 지나간 뒤에만');
  assert.ok(/!document\.body\.classList\.contains\("tb-meet"\)/.test(SC),'회의 모드에서는 안 뜬다');
  assert.ok(/document\.addEventListener\("scroll",function\(\)\{ tmGrpFloatVis\(\); \},\{capture:true,passive:true\}\)/.test(SC));
  assert.ok(/\.tm-grpfloat\{position:fixed;top:10px;right:16px;/.test(SC));
});

test('phone team screen has one header row: app header folds its logo, ⇄·⚙ sit on the team row',()=>{
  const css=(A.match(/<style id="ps-2954-phonehead">([\s\S]*?)<\/style>/)||[])[1]||'';
  assert.ok(css,'블록이 있다');
  assert.ok(/@media \(max-width:600px\)/.test(css),'하단 팀 탭과 같은 경계');
  assert.ok(/body\.ps-team-open:not\(\.ps-player-idp-only\) header\.appbar:not\(#_\)\{position:fixed!important/.test(css),'지우지 않고 자리만 옮긴다(팝업이 그 안에 산다)');
  assert.ok(!/header\.appbar:not\(#_\)\{display:none/.test(css));
  assert.ok(/#psBrand,[\s\S]*?\{display:none!important\}/.test(css));
  assert.ok(/#teamNav:not\(#_\)\{min-height:52px!important;[^}]*padding-right:96px!important/.test(css));
  assert.ok(/document\.body\.classList\.toggle\('ps-tn-dark',tn\.classList\.contains\('tn-dark'\)\)/.test(A),'어두운 팀 색 위에서 ⇄·⚙ 를 밝게');
});

test('a deleted player copy takes the server deletion instead of looping in review (방성환, 9/28)',()=>{
  const SY=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
  const vm=require('node:vm');const a=SY.indexOf('function itemsServerDeleted('),b=SY.indexOf('\nfunction ',a+10);
  const c=vm.createContext({});vm.runInContext(SY.slice(a,b),c);
  assert.equal(c.itemsServerDeleted({v:'{"_del":1790564322535}'}),true);
  assert.equal(c.itemsServerDeleted({v:'{"id":"p1","name":"live"}'}),false);
  assert.equal(c.itemsServerDeleted({v:'not json'}),false);
  assert.equal(c.itemsServerDeleted(null),false);
  const br=SY.slice(SY.indexOf('if(itemsDeletedLive(k,loc)){'),SY.indexOf("'roster-deleted-conflict'"));
  assert.ok(/if\(!dirty&&typeof itemsServerDeleted==='function'&&itemsServerDeleted\(row\)\)/.test(br),'안 올린 변경이 없을 때만');
  assert.ok(br.indexOf('itemsServerDeleted(row)')>=0&&br.indexOf('itemsServerDeleted(row)')<br.indexOf('resolveTeamConflict(k,loc,row,true)'),'지움을 받는 길이 충돌 검토보다 먼저');
  assert.ok(/if\(roundKvWrite\(k,row\.v,writes,loc\)\)\{ applied\+\+; m\.h\[k\]=hash\(row\.v\); m\.c\[k\]=row\.cupd; \}\n\s+return;/.test(br));
});
