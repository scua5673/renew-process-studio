// 3.083 — 실제 비율 크기(사용자 «실제 비율에서 원하는 만큼 키울 수 있게 해줘 공도 사람도»)
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const rs=require('../studio/board-real-size.js');
test('values: "선수|공" kept per board, clamped to ×1…×6 in quarter steps',()=>{
  assert.deepStrictEqual(rs.parse('3|1.5'),[3,1.5]);
  assert.deepStrictEqual(rs.parse('9|0.2'),[6,1]);
  assert.deepStrictEqual(rs.parse('x'),[1.5,6],'3.087 — 모르는 값은 기본(선수 ×1.5 · 공 ×6)');
  assert.strictEqual(rs.fmt([2.3,1]),'2.25|1');
  assert.ok(rs.ok('2|1')&&!rs.ok(true)&&!rs.ok('2'));
});
test('wiring: the board multiplies real size by __rk, loads the module, caches it, top bar has the button',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.match(b,/return m\*0\.11\/REAL_BALL_R\*k\(1\);/);
  assert.match(b,/return m\/REAL_TOK_M\*k\(0\); \}/);
  assert.match(b,/<script src="board-real-size\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-real-size\.js'/);
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board-topbar.js'),'utf8'),/class="tb-rsize"/);
});
test('3.087 default: 선수 ×1.5 · 공 ×6 — old untouched "1|1" reads as the new default, a chosen real size is kept',()=>{
  assert.strictEqual(rs.DEF,'1.5|6');
  assert.deepStrictEqual(rs.parse('1|1'),[1.5,6],'3.083~3.086 이 손대지 않은 보드에 적던 값 → 새 기본');
  assert.strictEqual(rs.fmt([1,1]),'1.0|1.0','일부러 실제 크기로 줄인 보드는 다르게 적는다');
  assert.deepStrictEqual(rs.parse(rs.fmt([1,1])),[1,1],'… 다시 열어도 실제 크기');
  assert.ok(rs.ok('1.0|1.0'),'옛 판의 모양 검사도 통과한다(옛 판에서도 실제 크기)');
  assert.deepStrictEqual(rs.parse('3|2'),[3,2],'키워 둔 보드는 그대로');
  const src=fs.readFileSync(path.join(__dirname,'../studio/board-real-size.js'),'utf8');
  assert.match(src,/ext\.realK = \{ def: DEF, ok: ok \}/,'작전판보다 먼저 등록부에 올린다(보드 여는 길이 언제 돌든 값이 들어온다)');
  assert.match(src,/data-rk-reset', r\[1\]/);assert.match(src,/\['기본으로', 'def'\]/);
});
