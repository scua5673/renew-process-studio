'use strict';
// 2.908 — 요청 «선수한테는 코치의 평가표가 보이지 않게». 주간 초점 제안(props)의 근거 문구는 선수의 일요일 카드에 간다 —
// 코치 점수(셀프 s · 코치 c · 갭)를 싣지 않고, 서버에 이미 있는 옛 문구도 선수 화면에서는 숫자를 지운다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=section('  function olAutoProps(','  /* ══ 2.619 · 한 줄 왕복 4·5단계');
function harness(){
  const c=vm.createContext({Date,JSON,ymd:d=>d.toISOString().slice(0,10),addDays:(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;}});
  vm.runInContext(code,c);return c;
}
test('the saved proposal reason carries no coach score; the coach-only detail does',()=>{
  const c=harness();
  const p=c.olAutoProps({log:{}},'2026-09-07','공 받기 전 두 번 확인',{name:'스캔·판단',s:2,c:4});
  assert.equal(p.b,'스캔·판단');
  assert.doesNotMatch(p.rb,/\d/,'reason sent to the player has no numbers');
  assert.doesNotMatch(p.rb,/코치\s*\d/);
  assert.match(p.rbx,/셀프 2 · 코치 4 · 갭/,'coach table keeps the detail (never saved)');
});
test('old stored reasons lose the coach score on the player screen',()=>{
  const c=harness();
  assert.equal(c.propRbSafe('셀프 2 · 코치 4 · 갭'),'내 평가와 코치 평가가 다른 항목');
  assert.equal(c.propRbSafe('셀프 3.5 · 코치 4 · 갭'),'내 평가와 코치 평가가 다른 항목');
  assert.equal(c.propRbSafe('계속 3일 · 조건 올리기'),'계속 3일 · 조건 올리기','other reasons unchanged');
  assert.equal(c.propRbSafe(''),'');
});
test('the quarterly meeting record keeps gap item names only',()=>{
  const line=source.split('\n').find(l=>l.includes('hearts:ev.hearts.slice(-6),gaps:'));
  assert.ok(line,'qmeet record line exists');
  assert.match(line,/gaps:\(ev\.gaps\|\|\[\]\)\.map\(function\(g\)\{return \{name:g\.name\};\}\)/);
});
test('both player-facing renderers scrub the reason',()=>{
  assert.ok(source.includes("sub:'코치 제안 2'+(pr.rb?' · '+propRbSafe(pr.rb):'')"),'Sunday wrap card');
  assert.ok(source.includes("(p.rb?' <small>'+E(propRbSafe(p.rb))+'</small>':'')"),'story thread');
});
