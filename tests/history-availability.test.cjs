'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../studio/sync.js'), 'utf8');
const start = source.indexOf('function histRestore(k,v){');
const end = source.indexOf('function dataReviewOpen(){', start);
assert.ok(start >= 0 && end > start);

function harness() {
  const current = new Map([['scout_tool_v1', '{"players":[{"name":"현재 선수"}]}']]);
  let confirmations = 0;
  const context = vm.createContext({
    Promise,
    kvWrite(key, raw) { current.set(key, raw); return true; },
    meta() { return { h: {} }; },
    setMeta() { confirmations++; },
    hash(raw) { return raw; },
    syncBaseSet() { confirmations++; },
    localStorage: { setItem() { confirmations++; } }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, current, confirmations: () => confirmations };
}

for (const missing of [null, undefined, '', '  ']) {
  test(`history without a retained body cannot replace current data (${String(missing)})`, async () => {
    const h = harness(), before = h.current.get('scout_tool_v1');
    assert.equal(await h.context.histRestore('scout_tool_v1', missing), false);
    assert.equal(h.current.get('scout_tool_v1'), before);
    assert.equal(h.confirmations(), 0, 'unavailable history cannot authorize an upload or advance metadata');
  });
}

test('history with a retained body keeps the existing restore path available', async () => {
  const h = harness(), body = '{"players":[{"name":"복구할 선수"}]}';
  assert.equal(await h.context.histRestore('scout_tool_v1', body), true);
  assert.equal(h.current.get('scout_tool_v1'), body);
  assert.ok(h.confirmations() > 0);
});
