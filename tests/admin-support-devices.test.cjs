/* 3.201 — 제보 상세의 «제보자 기기 현황»(ps_support_reporter_devices). 제보 열기 · 답변 흐름은 tests/admin-support.test.cjs 그대로. */
const test = require('node:test');
const assert = require('node:assert/strict');
const support = require('../studio/admin-support.js');

class Element {
  constructor() { this.listeners = {}; this.dataset = {}; this.parts = new Map(); this.innerHTML = ''; this.scrollTop = 0; }
  setAttribute() {}
  appendChild(child) { this.child = child; }
  remove() {}
  addEventListener(name, fn) { this.listeners[name] = fn; }
  removeEventListener(name) { delete this.listeners[name]; }
  querySelector(selector) { if (!this.parts.has(selector)) this.parts.set(selector, new Element()); return this.parts.get(selector); }
  contains() { return true; }
  emit(name, event) { this.listeners[name]?.(event); }
}
const UID = '99999999-9999-4999-8999-999999999999';
const RID = '11111111-1111-4111-8111-111111111111';
const report = {id: RID, title: 'T', body: 'B', created_at: '2026-10-27T02:00:00Z', is_own: false, reply_count: 0, diagnostics: {}};
const tick = () => new Promise(resolve => setImmediate(resolve));
function click(root, dataset) { root.emit('click', {target: {closest: () => ({dataset, disabled: false})}}); }

function setup(devicesAnswer) {
  const host = new Element(), store = new Map(), calls = [];
  const window = {
    document: {createElement: () => new Element()},
    sessionStorage: {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key)},
    navigator: {clipboard: {writeText: async () => {}}},
    crypto: {randomUUID: () => '22222222-2222-4222-8222-222222222222'},
    matchMedia: () => ({matches: false}),
    addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {}
  };
  const controller = support.create({window, host, context: () => ({uid: UID, epoch: 1, ready: true}), format: () => '', copyText: value => value.body,
    rpc: async (name, args) => {
      calls.push({name, args});
      if (name === 'ps_support_list') return {is_admin: true, reports: [report], next_cursor: null};
      if (name === 'ps_support_get') return {report, replies: []};
      if (name === 'ps_support_reporter_devices') return devicesAnswer();
      throw new Error('Unexpected fixture RPC: ' + name);
    }});
  return {controller, root: host.child, calls};
}

test('a report shows the reporter devices with the stale version marked against the latest seen version', async t => {
  const f = setup(() => ({days: 7, latest: '3.197', devices: [
    {device: 'tablet', app_version: '3.131', last_at: new Date(Date.now() - 3600e3).toISOString(), events: 13, crashes: 5, storage_full: 0, standalone: true},
    {device: 'desktop', app_version: '3.195', last_at: new Date(Date.now() - 600e3).toISOString(), events: 40, crashes: 0, storage_full: 3, standalone: false}
  ]}));
  t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: RID}); await tick(); await tick();
  assert.deepEqual(f.calls.at(-1), {name: 'ps_support_reporter_devices', args: {p_report_id: RID}});
  const html = f.root.innerHTML;
  assert.match(html, /제보자 기기 · 최근 7일 · 최신 판 3\.197/);
  assert.match(html, /태블릿 · 설치 앱<\/span><b>3\.131<\/b><span class="adm-stale-tag warn">옛 판<\/span>/);
  assert.match(html, /비정상 종료 5/);
  assert.match(html, /컴퓨터<\/span><b>3\.195<\/b><small>10분 전/, 'a version within ten releases is not marked');
  assert.match(html, /저장공간 가득 3/);
  assert.match(html, /<p>B<\/p>/, 'the report body still renders after the device list');
});

test('a missing or malformed devices function hides the panel without touching the report', async t => {
  const missing = setup(() => { throw Object.assign(new Error('function missing'), {code: 'PGRST202'}); });
  t.after(() => missing.controller.destroy());
  await missing.controller.load(); click(missing.root, {admReport: RID}); await tick(); await tick();
  assert.doesNotMatch(missing.root.innerHTML, /admSupportDevices/);
  assert.match(missing.root.innerHTML, /<p>B<\/p>/);

  const malformed = setup(() => ({devices: [{device: 7}]}));
  t.after(() => malformed.controller.destroy());
  await malformed.controller.load(); click(malformed.root, {admReport: RID}); await tick(); await tick();
  assert.doesNotMatch(malformed.root.innerHTML, /admSupportDevices/);
});

test('an empty device history is said plainly instead of pretending the reporter never used the app', async t => {
  const f = setup(() => ({days: 7, latest: null, devices: []}));
  t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: RID}); await tick(); await tick();
  assert.match(f.root.innerHTML, /최근 7일 기기 기록 없음/);
});
