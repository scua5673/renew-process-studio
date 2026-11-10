'use strict';
// 폰 보기 전용에서 장면이 있는 가로 작전판이 빈 화면이던 것 — 숨은 장면 줄(#animBar display:none)을 재서 판 높이를 0 으로 만들었다.
// 브라우저 시험 tests/browser/phone-drill-blank.mjs 가 실제 화면을 본다. 여기서는 두 자리의 모양만 지킨다.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../studio/board.html'), 'utf8');
function body(name) { const i = html.indexOf('function ' + name + '('); assert.ok(i > 0, name); return html.slice(i, html.indexOf('\nfunction ', i + 10)); }

test('_animBarPad: 그려지지 않은 장면 줄은 0 — 판 영역 높이를 예약으로 돌려주지 않는다', () => {
  const src = body('_animBarPad');
  assert.match(src, /abR=ab\.getBoundingClientRect\(\),stR=st\.getBoundingClientRect\(\);if\(!abR\.height\)return 0;/);
  // 같은 식을 가짜 DOM 으로 돌려 본다
  const run = (bar, stage, pad) => {
    const document = { getElementById: id => id === 'animBar' ? { classList: { contains: () => true }, getBoundingClientRect: () => bar } : { getBoundingClientRect: () => stage } };
    const getComputedStyle = () => ({ paddingBottom: pad + 'px' });
    return new Function('document', 'getComputedStyle', src + ';return _animBarPad();')(document, getComputedStyle);
  };
  assert.equal(run({ top: 0, height: 0 }, { top: 124, height: 502 }, 0), 0, '숨은 줄(예전엔 626)');
  assert.equal(run({ top: 560, height: 48 }, { top: 124, height: 502 }, 0), 68, '보이는 줄은 예전 그대로');
});

test('applyView: 장면 줄 몫은 줄이 켜져 있고 숨지 않았을 때만', () => {
  const src = body('applyView');
  assert.match(src, /__ab && __ab\.classList\.contains\("on"\) && getComputedStyle\(__ab\)\.display!=="none"\)\{ _abH=/);
});
