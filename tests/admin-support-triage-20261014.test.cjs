const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const support = require('../studio/admin-support.js');

/* 20261014 — 관리자 오류 제보 접수함의 처리 상태.
   제보 30건이 모두 «열림»이었다(닫는 길이 없었다). 서버(20261014_support_triage)가 줄마다 stage 와 단계별 개수를 주면
   «답변 필요 · 답변함 · 닫힘 · 전체»로 거르고, 제보마다 닫기 · 다시 열기 · 고친 판을 적는다. 옛 서버면 예전 화면 그대로. */
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
const R1 = '11111111-1111-4111-8111-111111111111', R2 = '22222222-2222-4222-8222-222222222222', R3 = '33333333-3333-4333-8333-333333333333';
const tick = () => new Promise(resolve => setImmediate(resolve));
const click = (root, dataset) => root.emit('click', {target: {closest: () => ({dataset, disabled: false})}});
const input = (root, name, value) => root.emit('input', {target: {name, value}});
const row = (id, title, stage, extra = {}) => ({id, title, created_at: '2026-10-14T00:00:00Z', is_own: false, reply_count: stage === 'needs' ? 0 : 1, status: stage === 'closed' ? 'closed' : 'open', stage, has_admin_reply: stage !== 'needs', fixed_in: null, ...extra});

function setup({legacy = false, statusError = null} = {}) {
  const host = new Element(), calls = [], counted = [];
  let reports = [row(R1, '새 제보', 'needs'), row(R2, '답변함', 'answered'), row(R3, '재문의', 'needs', {has_admin_reply: true, reply_count: 2})];
  const window = {
    document: {createElement: () => new Element()},
    sessionStorage: {getItem: () => null, setItem() {}, removeItem() {}},
    navigator: {clipboard: {writeText: async () => {}}}, crypto: {randomUUID: () => '44444444-4444-4444-8444-444444444444'},
    addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {}
  };
  const counts = () => ({needs: reports.filter(r => r.stage === 'needs').length, answered: reports.filter(r => r.stage === 'answered').length, closed: reports.filter(r => r.stage === 'closed').length, total: reports.length});
  const controller = support.create({window, host, context: () => ({uid: UID, epoch: 1, ready: true}), format: () => '', copyText: v => v.body, onCounts: c => counted.push(c),
    rpc: async (name, args) => {
      calls.push({name, args});
      if (name === 'ps_support_list') {
        if (legacy) return {is_admin: true, reports: reports.map(({stage, has_admin_reply, fixed_in, ...r}) => r), next_cursor: null};
        return {is_admin: true, reports: reports.filter(r => !args.p_filter || r.stage === args.p_filter), next_cursor: null, counts: counts()};
      }
      if (name === 'ps_support_get') return {report: {...reports.find(r => r.id === args.p_report_id), body: '본문', diagnostics: {}}, replies: []};
      if (name === 'ps_support_set_status') {
        if (statusError) throw statusError;
        const r = reports.find(x => x.id === args.p_report_id);
        r.status = args.p_status; r.fixed_in = args.p_fixed_in; r.stage = args.p_status === 'closed' ? 'closed' : (r.has_admin_reply ? 'answered' : 'needs');
        return {id: r.id, status: r.status, fixed_in: r.fixed_in, closed_at: r.status === 'closed' ? '2026-10-14T01:00:00Z' : null, stage: r.stage, has_admin_reply: r.has_admin_reply, last_role: null};
      }
      throw new Error('unexpected ' + name);
    }});
  return {controller, root: host.child, calls, counted};
}

test('stage badges and filter counts come from the server', async t => {
  const f = setup(); t.after(() => f.controller.destroy());
  await f.controller.load();
  const h = f.root.innerHTML;
  assert.match(h, /data-adm-filter="needs"[^>]*>답변 필요 <b>2<\/b>/);
  assert.match(h, /data-adm-filter="answered"[^>]*>답변함 <b>1<\/b>/);
  assert.match(h, /data-adm-filter="closed"[^>]*>닫힘 <b>0<\/b>/);
  assert.match(h, /data-adm-filter="all"[^>]*>전체 <b>3<\/b>/);
  assert.match(h, /admSupportCount is-needs">새 제보</);
  assert.match(h, /admSupportCount is-needs">재문의</, 'reporter wrote again after an answer');
  assert.match(h, /admSupportCount is-answered">답변함</);
  assert.deepEqual(f.counted.at(-1), {needs: 2, answered: 1, closed: 0, total: 3}, 'the nav badge hears the counts');
  assert.equal(f.calls[0].args.p_filter, undefined, 'first load works with the old function signature too');
});

test('a filter tab reloads only that stage', async t => {
  const f = setup(); t.after(() => f.controller.destroy());
  await f.controller.load();
  click(f.root, {admFilter: 'needs'}); await tick(); await tick();
  assert.equal(f.calls.at(-1).args.p_filter, 'needs');
  assert.doesNotMatch(f.root.innerHTML, /data-adm-report="22222222/);
  assert.match(f.root.innerHTML, /data-adm-filter="needs" aria-pressed="true"|admSupportFilter is-on is-alert" data-adm-filter="needs"/);
  click(f.root, {admFilter: 'all'}); await tick(); await tick();
  assert.equal(f.calls.at(-1).args.p_filter, undefined);
  assert.match(f.root.innerHTML, /data-adm-report="22222222/);
});

test('closing with a fixed version moves the count and the badge', async t => {
  const f = setup(); t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: R2}); await tick();
  assert.match(f.root.innerHTML, /처리 상태/);
  assert.match(f.root.innerHTML, /data-adm-status="closed"[^>]*>닫기</);
  input(f.root, 'fixed', 'v3.029');
  click(f.root, {admStatus: 'closed'}); await tick();
  assert.equal(f.calls.filter(c => c.name === 'ps_support_set_status').length, 0, 'a malformed version is caught before the server');
  assert.match(f.root.innerHTML, /3\.029처럼/);
  input(f.root, 'fixed', '3.029');
  click(f.root, {admStatus: 'closed'}); await tick(); await tick();
  assert.deepEqual(f.calls.at(-1), {name: 'ps_support_set_status', args: {p_report_id: R2, p_status: 'closed', p_fixed_in: '3.029'}});
  assert.match(f.root.innerHTML, /제보를 닫았습니다/);
  assert.match(f.root.innerHTML, /고침 3\.029 · 닫힘/);
  assert.match(f.root.innerHTML, /data-adm-status="open"[^>]*>다시 열기</);
  assert.match(f.root.innerHTML, /data-adm-filter="closed"[^>]*>닫힘 <b>1<\/b>/);
  assert.match(f.root.innerHTML, /data-adm-filter="answered"[^>]*>답변함 <b>0<\/b>/);
  assert.deepEqual(f.counted.at(-1), {needs: 2, answered: 0, closed: 1, total: 3});
  click(f.root, {admStatus: 'open'}); await tick(); await tick();
  assert.match(f.root.innerHTML, /제보를 다시 열었습니다/);
  assert.equal(f.calls.at(-1).args.p_status, 'open');
});

test('only the fixed version can be saved without changing the status', async t => {
  const f = setup(); t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: R1}); await tick();
  input(f.root, 'fixed', '3.031');
  click(f.root, {admStatus: 'keep'}); await tick(); await tick();
  assert.deepEqual(f.calls.at(-1).args, {p_report_id: R1, p_status: 'open', p_fixed_in: '3.031'});
  assert.match(f.root.innerHTML, /고친 판을 저장했습니다/);
});

test('a missing server function says so and keeps the report open', async t => {
  const f = setup({statusError: Object.assign(new Error('missing'), {status: 404, code: 'PGRST202'})}); t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: R1}); await tick();
  click(f.root, {admStatus: 'closed'}); await tick(); await tick();
  assert.match(f.root.innerHTML, /20261014_support_triage/);
  assert.match(f.root.innerHTML, /admSupportCount is-needs">새 제보</);
});

test('an old server without stages keeps the old inbox', async t => {
  const f = setup({legacy: true}); t.after(() => f.controller.destroy());
  await f.controller.load();
  assert.doesNotMatch(f.root.innerHTML, /data-adm-filter=/);
  assert.match(f.root.innerHTML, /대화 2개/);
  click(f.root, {admReport: R1}); await tick();
  assert.doesNotMatch(f.root.innerHTML, /처리 상태|data-adm-status=/);
  assert.deepEqual(f.counted, []);
});

test('admin.html shows the needs count on the nav and home card', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  assert.match(a, /<span class="navBadge" id="supportBadge" hidden><\/span><\/button>/);
  assert.match(a, /onCounts:setSupportCounts/);
  assert.match(a, /function reloadAll\(\)\{\n  if\(curTab==='support'\)\{loadAdminSupport\(\);return;\}\n  if\(curTab==='comm'\)\{loadComm\(\);return;\}\n  refreshSupportBadge\(\);refreshCommBadge\(\);/);
  assert.match(a, /adminRpc\('ps_support_list',\{p_limit:1\}\)/);
  assert.match(a, /studio\/admin-support\.js\?v=20261014/);
});
