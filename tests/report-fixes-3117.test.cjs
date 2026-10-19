'use strict';
/* 3.117 — 오류 제보 세 건.
   5a574320 «경기 준비 포메이션이 11v11 만 — 유소년 8v8 도»: 상대 포메이션 고르개에 8인제(studio/match-formats.js).
   9c924c4e «스카우팅 목록이 초기화»: 빈 옛 기기본이 서버 후보를 다 숨기지 않는다(sync.js scoutSyncPlan — tests/scouting-sync.test.cjs).
   cae91d4f «다른 팀으로의 전환 오류»: 전환이 멈춘 까닭을 서버(ps_events)와 오류 보고에 남긴다.
   화면은 tests/browser/match-formats-8.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../studio/match-formats.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('8인제 formations: four shapes, 8 slots each, GK first, numbers 1~8 in line order (same as the board)',()=>{
  assert.deepEqual(F.LABELS8.map(x=>x[1]),['2-3-2','3-3-1','3-2-2','2-4-1']);
  for(const [k] of F.LABELS8){
    const pts=F.FORMS8[k],slots=F.SLOTS8[k];
    assert.equal(pts.length,8,k);assert.equal(slots.length,8,k);
    assert.deepEqual(slots.map(s=>s[1]),[1,2,3,4,5,6,7,8],k);assert.equal(slots[0][0],'GK');assert.deepEqual(pts[0],[6,50]);
    assert.ok(pts.every(p=>p[0]>=6&&p[0]<=66&&p[1]>=4&&p[1]<=96),k+' 우리 쪽 틀 안');
    assert.equal(new Set(pts.map(p=>p.join(','))).size,8,k+' 겹치지 않는다');
    // 줄(라인) 차례: 뒤에서 앞으로
    const line=pts.map(p=>p[0]);assert.ok(line.every((x,i)=>i===0||x>=line[i-1]-3),k+' '+line);
  }
  // 작전판(board.html FORM)과 같은 넷 · 같은 줄 수
  const b=read('studio/board.html');
  for(const [k] of F.LABELS8)assert.match(b,new RegExp('"'+k+'":\\[\\[\\.045,\\.5,1,"GK"\\]'),k);
});
test('the denominator follows the starters, else the chosen opponent shape',()=>{
  assert.equal(F.denom(0,'442'),11);assert.equal(F.denom(0,'232'),8);assert.equal(F.denom(8,'433'),8);assert.equal(F.denom(11,'241'),11);
  assert.equal(F.is8('gk4'),false);assert.equal(F.is8('331'),true);
});
test('extend adds the 8인제 keys without touching the 11-a-side tables',()=>{
  const forms={'442':[[6,50]]},slots={'442':[['GK',1]],'232':[['X',9]]};
  F.extend(forms,slots);
  assert.deepEqual(forms['442'],[[6,50]]);assert.deepEqual(slots['232'],[['X',9]],'이미 있는 키는 그대로');
  assert.equal(forms['232'].length,8);forms['232'][0][0]=99;assert.equal(F.FORMS8['232'][0][0],6,'사본을 넣는다');
});
test('groupSelect wraps the old options as «11인제», adds «8인제», keeps the chosen value',()=>{
  const mk=(tag)=>({tagName:tag.toUpperCase(),children:[],label:'',value:'',textContent:'',appendChild(c){const i=this.children.indexOf(c);if(i<0)this.children.push(c);return c;}});
  const opts=['gk4','442','352'].map(v=>Object.assign(mk('option'),{value:v}));
  const sel=Object.assign(mk('select'),{children:opts.slice(),value:'442',querySelector:q=>sel.children.find(c=>c.tagName==='OPTGROUP')||null});
  const doc={createElement:mk};
  // option 을 다른 묶음으로 옮기면 select.children 에서 빠진다
  const appendTo=g=>{const orig=g.appendChild.bind(g);g.appendChild=c=>{const i=sel.children.indexOf(c);if(i>=0){sel.children.splice(i,1);sel.value='352';}return orig(c);};return g;};
  const docW={createElement:t=>t==='optgroup'?appendTo(mk(t)):mk(t)};
  assert.equal(F.groupSelect(docW,sel),true);
  assert.deepEqual(sel.children.map(g=>g.label+':'+g.children.map(o=>o.value).join(',')),['11인제:gk4,442,352','8인제:232,331,322,241']);
  assert.equal(sel.value,'442','옮기는 동안 바뀐 값을 되돌린다');
  assert.equal(F.groupSelect(doc,sel),false,'두 번 묶지 않는다');
});
test('wiring: scout.html loads the module after its main script, service worker caches it, browser test is in a suite',()=>{
  const s=read('studio/scout.html');
  assert.match(s,/<script src="match-formats\.js"><\/script><script src="perms\.js"><\/script>/);
  assert.ok(s.indexOf('function mb2Counts(')<s.indexOf('<script src="match-formats.js">'),'mb2Counts 를 감싸려면 본문 뒤에서 읽는다');
  assert.ok(Buffer.byteLength(s)<=1900*1024,'scout.html budget '+Buffer.byteLength(s));
  assert.match(read('sw.js'),/'\/studio\/match-formats\.js'/);
  assert.match(read('tests/browser/run-critical.mjs'),/'match-formats-8'/);
});
test('team switch: a stopped switch is reported to the server with its code (busy / old browser too)',()=>{
  const s=read('studio/sync.js');
  assert.match(s,/function recSwitchFail\(msg,code\)\{[^\n]*eventTrack\('workspace_switch_failed',\{status:'error',feature:'sync',error_code:String\(code\|\|'unknown'\)\}\);/);
  assert.match(s,/setStatus\('다른 창의 자료 준비가 끝난 뒤 다시 시도해 주세요'\);recSwitchFail\('','lock-busy'\);/);
  assert.match(s,/setStatus\('브라우저를 업데이트한 뒤 팀을 바꿀 수 있어요'\);recSwitchFail\('','lock-unsupported'\);/);
  // 메시지 원문(m)은 서버로 보내지 않는다 — 코드만
  assert.doesNotMatch(s,/eventTrack\('workspace_switch_failed',[^)]*msg/);
  assert.ok(Buffer.byteLength(s)<=832*1024,'sync.js budget '+Buffer.byteLength(s));
  // 오류 보고: 전환 표시(guard)는 기록 주인이 아니다
  assert.doesNotMatch(read('studio/support-diagnostics.js'),/getItem\('ps_ws_switch_guard_v1'\)/);
});
