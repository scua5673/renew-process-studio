/* 관리자 «오류 제보» 옆 칸(studio/admin-support-context.js · ps_support_context · ps_support_list_flags).
   제보 열기 · 답변 흐름은 tests/admin-support.test.cjs, 기기 현황은 tests/admin-support-devices.test.cjs 그대로. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const support = require('../studio/admin-support.js');
const view = require('../studio/admin-support-context.js');

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
const WHO = '33333333-3333-4333-8333-333333333333';
const AT = '2026-11-19T12:14:00Z';
const at = min => new Date(Date.parse(AT) + min * 60000).toISOString();
const report = {id: RID, title: 'T', body: 'B', created_at: AT, is_own: false, reply_count: 0, diagnostics: {}, reporter: {user_id: WHO, name: '가상 코치', teams: [{name: '가상 FC'}]}};
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 6; i++) await tick(); };
function click(root, dataset) { root.emit('click', {target: {closest: () => ({dataset, disabled: false})}}); }
const event = (min, name, extra) => Object.assign({at: at(min), event_name: name, feature: 'board', device: 'tablet', app_version: '3.330', error_code: null, status: 'ok'}, extra);
const CONTEXT = () => ({report_at: AT, minutes: 30, sync: {received_at: at(1), device: 'tablet', app_version: '3.330', pending_team: 0, pending_personal: 0, held: 0, conflicts: 0, oldest_pending_at: null},
  events: [event(-22, 'feature_opened'), event(-5, 'app_error', {status: 'error', error_code: 'anim_pause_state'}), event(-5, 'app_error', {status: 'error', error_code: 'anim_pause_state'}),
    event(-4, 'app_error', {status: 'error', error_code: 'anim_pause_state'}), event(1, 'content_saved')],
  errors: [{code: 'anim_pause_state', mine: 3, users: 4, count: 11, min_version: '3.326', max_version: '3.334'}], fixed: null});

function setup(answers, options) {
  const host = new Element(), store = new Map(), calls = [], opened = [];
  const window = {
    document: {createElement: () => new Element()},
    sessionStorage: {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key)},
    navigator: {clipboard: {writeText: async () => {}}},
    crypto: {randomUUID: () => '22222222-2222-4222-8222-222222222222'},
    matchMedia: () => ({matches: false}),
    addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {}
  };
  if (!options || options.module !== false) window.PSAdminSupportContext = view;
  const row = Object.assign({}, report, {stage: 'needs', status: 'open', has_admin_reply: false, fixed_in: null}, options && options.row);
  const controller = support.create({window, host, context: () => ({uid: UID, epoch: 1, ready: true}), format: () => '', copyText: value => value.body,
    openUser: uid => opened.push(uid),
    rpc: async (name, args) => {
      calls.push({name, args});
      if (name === 'ps_support_list') return {is_admin: true, reports: [row], next_cursor: null, counts: {needs: 1, answered: 0, closed: 0, total: 1}};
      if (name === 'ps_support_get') return {report, replies: []};
      if (name === 'ps_support_reporter_devices') return {days: 7, latest: '3.334', devices: [{device: 'tablet', app_version: '3.330', last_at: at(1), events: 9, crashes: 0, storage_full: 0}]};
      if (name === 'ps_support_set_status') return {id: RID, status: args.p_status, stage: 'needs', fixed_in: args.p_fixed_in, has_admin_reply: false};
      if (answers[name]) return answers[name](args);
      throw new Error('Unexpected fixture RPC: ' + name);
    }});
  return {controller, root: host.child, calls, opened};
}

test('opening a report shows what happened around it in a side panel', async t => {
  const f = setup({ps_support_context: CONTEXT, ps_support_list_flags: () => ({[RID]: {version: '3.330', seen_version: '3.330', fixed_seen: null}})});
  t.after(() => f.controller.destroy());
  await f.controller.load(); await settle();
  assert.deepEqual(f.calls.find(c => c.name === 'ps_support_list_flags').args, {p_ids: [RID]});
  assert.match(f.root.innerHTML, /<small class="admCtxTags"><i class="">제보 때 3\.330<\/i><\/small>/);
  click(f.root, {admReport: RID}); await settle();
  assert.deepEqual(f.calls.find(c => c.name === 'ps_support_context').args, {p_report_id: RID});
  const html = f.root.innerHTML;
  assert.equal(f.root.dataset.rail, 'true');
  assert.match(html, /<\/section><aside class="admSupportRail"/, 'the panel sits beside the report, not inside it');
  assert.match(html, /보낸 사람<button type="button" data-adm-support="user">사용자 상세<\/button>/);
  assert.match(html, /제보 앞뒤 30분/);
  assert.match(html, /<li class="is-err">.*?<b>anim_pause_state ×3<\/b><small>앱 오류 · 작전판<\/small>/s, 'repeated events collapse into one line');
  assert.ok(html.indexOf('anim_pause_state ×3') < html.indexOf('제보 접수') && html.indexOf('제보 접수') < html.indexOf('<b>작전판 저장</b>'), 'the report is placed in time order');
  assert.match(html, /<b class="is-good">대기 0<\/b>/);
  assert.match(html, /이 제보 직전 <b>3건<\/b> · 전체 <b>4명 11건<\/b> · 판 3\.326 ~ 3\.334/);
  assert.doesNotMatch(html, /고친 판 3\./, 'no «fixed» box before a fixed version is recorded');
  const article = html.slice(html.indexOf('admSupportReport'), html.indexOf('admSupportRail'));
  assert.doesNotMatch(article, /admSupportDevices/, 'the device list moved from the report to the panel');
  assert.match(html.slice(html.indexOf('admSupportRail')), /admSupportDevices/);
  click(f.root, {admSupport: 'user'});
  assert.deepEqual(f.opened, [WHO]);
});

test('recording a fixed version re-reads the context and shows whether the device received it', async t => {
  let fixed = null;
  const f = setup({ps_support_context: () => Object.assign(CONTEXT(), {fixed: fixed && {version: fixed, devices: [{device: 'tablet', received_at: at(600), latest_version: '3.336', last_at: at(700)}, {device: 'desktop', received_at: null, latest_version: '3.334', last_at: at(650)}], after: {mine: 0, users: 2, count: 5}}}),
    ps_support_list_flags: () => ({[RID]: {version: '3.330', seen_version: '3.336', fixed_seen: fixed ? true : null}})});
  t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: RID}); await settle();
  f.root.emit('input', {target: {name: 'fixed', value: '3.335'}});
  fixed = '3.335';
  click(f.root, {admStatus: 'keep'}); await settle();
  assert.equal(f.calls.filter(c => c.name === 'ps_support_context').length, 2);
  const html = f.root.innerHTML;
  assert.match(html, /<h3>고친 판 3\.335<\/h3>/);
  assert.match(html, /<span>태블릿<\/span><b class="is-good">받음 · [^<]+<\/b><em>지금 3\.336<\/em>/);
  assert.match(html, /<span>컴퓨터<\/span><b class="is-warn">아직 3\.334<\/b>/);
  assert.match(html, /<b class="is-good">이 사람 0건<\/b><em>3\.335 이상 전체 2명 5건<\/em>/);
  assert.match(html, /<i class="is-good">고친 판 받음<\/i>/, 'the list tag follows');
});

test('a missing server function hides the new boxes; a failed read says so instead of showing zero', async t => {
  const missing = setup({ps_support_context: () => { throw Object.assign(new Error('missing'), {code: 'PGRST202'}); }, ps_support_list_flags: () => { throw Object.assign(new Error('missing'), {code: 'PGRST202'}); }});
  t.after(() => missing.controller.destroy());
  await missing.controller.load(); click(missing.root, {admReport: RID}); await settle();
  assert.doesNotMatch(missing.root.innerHTML, /제보 앞뒤|같은 오류|admCtxTags/);
  assert.match(missing.root.innerHTML, /admSupportRail.*admSupportDevices/s, 'the sender and devices still show');
  assert.match(missing.root.innerHTML, /<p>B<\/p>/);

  let fail = true;
  const failed = setup({ps_support_context: () => { if (fail) throw new Error('offline'); return CONTEXT(); }, ps_support_list_flags: () => ({})});
  t.after(() => failed.controller.destroy());
  await failed.controller.load(); click(failed.root, {admReport: RID}); await settle();
  assert.match(failed.root.innerHTML, /앞뒤 기록을 확인하지 못했습니다\./);
  assert.doesNotMatch(failed.root.innerHTML.slice(failed.root.innerHTML.indexOf('admSupportRail')), /대기 0|0건|0명/, 'nothing unread is counted as zero');
  fail = false; click(failed.root, {admSupport: 'context'}); await settle();
  assert.match(failed.root.innerHTML, /제보 앞뒤 30분/);

  const malformed = setup({ps_support_context: () => ({events: 'x'}), ps_support_list_flags: () => ['x']});
  t.after(() => malformed.controller.destroy());
  await malformed.controller.load(); click(malformed.root, {admReport: RID}); await settle();
  assert.match(malformed.root.innerHTML, /앞뒤 기록을 확인하지 못했습니다\./);
});

test('without the module the screen is the earlier one', async t => {
  const f = setup({}, {module: false});
  t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: RID}); await settle();
  assert.ok(!f.calls.some(c => c.name === 'ps_support_context' || c.name === 'ps_support_list_flags'));
  assert.doesNotMatch(f.root.innerHTML, /admSupportRail/);
  assert.match(f.root.innerHTML, /admSupportDevices/);
});

test('values from the server are escaped and odd shapes are dropped', () => {
  const ctx = view.clean({report_at: AT, minutes: 30, events: [event(-1, 'app_error', {status: 'error', error_code: '<img src=x onerror=1>', feature: '"><b>'}), {at: 'nope', event_name: 'x'}, null, event(2, '<script>')],
    errors: [{code: '<i>', mine: 1, users: 1, count: 1, min_version: '99', max_version: '<b>'}, {code: 'no-counts'}], sync: {received_at: 'x'}, fixed: {version: 'latest'}});
  assert.equal(ctx.events.length, 2); assert.equal(ctx.errors.length, 1); assert.equal(ctx.sync, null); assert.equal(ctx.fixed, null);
  const html = view.rail({who: '<b>who</b>', canUser: false, devices: '', ctx});
  assert.doesNotMatch(html, /<img|<script|<b>who|"><b>|<i>/);
  assert.match(html, /&lt;img src=x onerror=1&gt;/);
  assert.equal(view.clean(null), null); assert.equal(view.clean({report_at: AT}), null);
  assert.deepEqual(view.flags({[RID]: {version: '3.330', seen_version: 'x', fixed_seen: 'yes'}, bad: {version: '3.1'}}), {[RID]: {version: '3.330', seen: '', fixed: null}});
  assert.equal(view.tags({stage: 'answered', fixed_in: '3.335'}, {version: '3.330', seen: '3.329', fixed: false}), '<small class="admCtxTags"><i class="is-wait">아직 3.329</i></small>');
  assert.equal(view.tags({stage: 'answered', fixed_in: '3.335'}, {version: '3.330', seen: '', fixed: null}), '', 'unknown is not shown as «not received»');
});

test('the admin page loads the module before the inbox and pins both', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  assert.ok(page.indexOf('studio/admin-support-context.js?v=') > 0 && page.indexOf('studio/admin-support-context.js?v=') < page.indexOf('studio/admin-support.js?v='));
  assert.match(page, /studio\/admin-support-context\.css\?v=[0-9.]+/);
  assert.match(page, /openUser:function\(uid\)\{openAdminUser\(uid\);\}/);
});
