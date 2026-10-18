/* 3.091 — 커뮤니티 카드를 누르면 미리보기 창 없이 바로 크게 재생(사용자 «커뮤니티에서 누르면 바로 크게 재생이 나오게 하자 미리보고 없애자»).
   코치 자료 · 엘미하 · 프로세스 · FIFA 네 칸 모두 카드 → 뷰어. 미리보기 창 코드(community-tax.js open · close)와 그 스타일은 없앴다. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');
const tax=fs.readFileSync(path.join(root,'studio','community-tax.js'),'utf8');
const css=fs.readFileSync(path.join(root,'studio','community-tax.css'),'utf8');

test('every community card opens the viewer directly — no preview window in between',()=>{
  assert.doesNotMatch(comm,/\btx(Coach|Proc|Fifa)\(/,'미리보기 창을 여는 함수가 남지 않는다');
  assert.doesNotMatch(comm,/TX\.open\(/);
  assert.match(comm,/if\(_pv&&getComputedStyle\(_pv\)\.display==='none'\)\{ openPost\(p\); \}/,'코치 자료 · 엘미하 카드 → 뷰어');
  assert.match(comm,/if\(li\)procPick\(p,s,c,\+li\.getAttribute\('data-k'\)\);[^\n]*\n\s*procOpen\(p,c\); \};/,'프로세스 카드 → 고른 훈련부터 뷰어');
  assert.match(comm,/onOpen:fifaOpen,/,'FIFA 애니메이션 카드 → 뷰어');
});

test('the preview window code and styles are gone, the filters stay',()=>{
  const T=require(path.join(root,'studio','community-tax.js'));
  assert.equal(T.open,undefined); assert.equal(T.close,undefined); assert.equal(T.isOpen,undefined);
  for(const k of ['draw','badge','ok','fit','fromCoach','fromProc','fromFifa','upForm','hideOld'])assert.equal(typeof T[k],'function',k);
  assert.doesNotMatch(tax,/tx-sheet|tx-mask|'▶ 크게 재생'/);
  assert.doesNotMatch(css,/\.tx-(sheet|mask|sh-|btn|tr\b|x\b)/);
  assert.match(css,/\.tx-bar\{/,'고르개 스타일은 남는다');
});
