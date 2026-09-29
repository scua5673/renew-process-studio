'use strict';
/* 2.912 — 일정의 경기 칸에 경기장·홈/원정(경기 문서 cs_team_matches_v1 에서 읽기만). 찾는 규칙은 «경기 준비 →» 문과 같다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=fs.readFileSync(require.resolve('../studio/process.html'),'utf8');
const part=(a,b)=>{const i=S.indexOf(a);assert.ok(i>=0,a);const j=S.indexOf(b,i+a.length);assert.ok(j>i,b);return S.slice(i,j);};
function ctx(matches){
  const store={cs_team_matches_v1:JSON.stringify({matches})};
  const c=vm.createContext({localStorage:{getItem:k=>store[k]??null},window:{}});
  vm.runInContext(part('function wkbdMatchDoc(','window.wkbdGoMatchX='),c);
  return c;
}
test('venue and home/away come from the match document of that date',()=>{
  const c=ctx([{date:'2026-10-03',opponent:'광주FC U15',venue:'광주 월드컵 보조구장',homeAway:'away'}]);
  assert.equal(c.wkbdMatchPlace('2026-10-03','광주FC U15'),'원정 · 광주 월드컵 보조구장');
  assert.equal(c.wkbdMatchPlace('2026-10-03',''),'원정 · 광주 월드컵 보조구장','상대 미정이어도 그 날 하나면');
  assert.equal(c.wkbdMatchPlace('2026-10-04','광주FC U15'),'','다른 날은 없음');
});
test('two matches on one day are told apart by opponent',()=>{
  const c=ctx([{date:'2026-10-03',opponent:'A',venue:'A 구장',homeAway:'홈'},{date:'2026-10-03',opponent:'B',venue:'B 구장',homeAway:''}]);
  assert.equal(c.wkbdMatchPlace('2026-10-03','A'),'홈 · A 구장');assert.equal(c.wkbdMatchPlace('2026-10-03','B'),'B 구장');
  assert.equal(c.wkbdMatchPlace('2026-10-03',''),'홈 · A 구장','상대가 비면 그날 첫 경기 — «경기 준비 →» 문과 같은 규칙(2.758)');
  assert.equal(c.wkbdMatchPlace('2026-10-03','C'),'','상대가 다르면 둘 중 아무것도 고르지 않는다');
});
test('no venue and no home/away draws nothing; the match door keeps its rule',()=>{
  const c=ctx([{date:'2000-01-01',opponent:'X'}]);
  assert.equal(c.wkbdMatchPlace('2000-01-01','X'),'');
  assert.equal(c.wkbdMatchDoor('2000-01-01','X').step,'review','지난 경기는 리뷰 문(2.758 그대로)');
});
test('every schedule view draws the venue line',()=>{
  assert.equal((S.match(/wkbdMatchPlace\(mymd,opp\)/g)||[]).length,2,'보드 보기·세션 보기');
  assert.ok(S.includes('wkbdMatchPlace(mymdC,oppC)'),'목록 보기');assert.ok(S.includes('/* 2.912 — 경기장 */'),'하루 보기');
});
