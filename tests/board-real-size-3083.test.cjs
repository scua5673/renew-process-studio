// 3.083 — 실제 비율 크기(사용자 «실제 비율에서 원하는 만큼 키울 수 있게 해줘 공도 사람도»)
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const rs=require('../studio/board-real-size.js');
test('values: "선수|공" kept per board, clamped to ×1…×6 in quarter steps',()=>{
  assert.deepStrictEqual(rs.parse('3|1.5'),[3,1.5]);
  assert.deepStrictEqual(rs.parse('9|0.2'),[6,1]);
  assert.deepStrictEqual(rs.parse('x'),[1,1]);
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
