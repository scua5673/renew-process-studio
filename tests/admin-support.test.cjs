const test = require('node:test');
const assert = require('node:assert/strict');
const support = require('../studio/admin-support.js');

// Small event/DOM surface: requests and storage stay entirely synthetic.
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
const REPLY = '22222222-2222-4222-8222-222222222222';
const report = {id: RID, title: 'PRIVATE_REPORT_TITLE', body: 'PRIVATE_REPORT_BODY', created_at: '2026-09-15T00:00:00Z', is_own: false, reply_count: 0, diagnostics: {}};
const tick = () => new Promise(resolve => setImmediate(resolve));
function click(root, dataset) { root.emit('click', {target: {closest: () => ({dataset, disabled: false})}}); }

function setup(options = {}) {
  const host = new Element(), store = new Map(), calls = [], copies = [];
  let revoked = false, storedReply = null;
  const window = {
    document: {createElement: () => new Element()},
    sessionStorage: {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key)},
    navigator: {clipboard: {writeText: async value => copies.push(value)}},
    crypto: {randomUUID: () => REPLY},
    addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {}
  };
  const controller = support.create({window, host, context: () => ({uid: UID, epoch: 1, ready: true}), format: () => '', copyText: value => value.body,
    rpc: async (name, args) => {
      calls.push({name, args});
      if (name === 'ps_support_list') return {is_admin: !revoked, reports: options.rows ?? [report], next_cursor: null};
      if (name === 'ps_support_get') {
        if (options.missingDetail) throw Object.assign(new Error('report_not_found'), {status: 404, code: 'PT404'});
        return {report: options.detailReport ?? report, replies: storedReply ? [storedReply] : []};
      }
      // Real SQL hides inaccessible reports as PT404 after an admin is revoked.
      if (name === 'ps_support_reply') {
        if (options.reporterAck || options.adminAck) {
          storedReply = {id: args.p_id, report_id: args.p_report_id, body: args.p_body, author_role: options.reporterAck ? 'reporter' : 'admin', is_own: true, created_at: report.created_at};
          return storedReply;
        }
        throw Object.assign(new Error('report_not_found'), {status: 404, code: 'PT404'});
      }
      throw new Error('Unexpected fixture RPC: ' + name);
    }});
  return {controller, root: host.child, store, calls, copies, revoke: () => { revoked = true; }};
}

test('PT404 on reply removes private detail and copy access despite a still-current local session', async t => {
  const f = setup(); t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: RID}); await tick();
  assert.match(f.root.innerHTML, /PRIVATE_REPORT_BODY/);
  f.root.emit('input', {target: {name: 'reply', value: 'Unsent administrator reply'}});
  f.revoke();
  f.root.emit('submit', {target: {matches: () => true}, preventDefault() {}}); await tick();
  assert.equal(f.calls.filter(call => call.name === 'ps_support_reply').length, 1);
  assert.doesNotMatch(f.root.innerHTML, /PRIVATE_REPORT_BODY|PRIVATE_REPORT_TITLE|data-adm-support="copy"|<textarea name="reply"/);
  assert.match(f.root.innerHTML, /role="alert"/);
  click(f.root, {admSupport: 'copy'}); await tick();
  assert.deepEqual(f.copies, [], 'A previously rendered copy button cannot copy revoked report data');
  assert.match(f.store.get('ps_admin_support_reply_v1:' + UID + ':' + RID), /Unsent administrator reply/, 'The administrator draft stays recoverable under its original account');
});

test('PT404 while opening a report clears the formerly authorized list', async t => {
  const f = setup({missingDetail: true}); t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: RID}); await tick();
  assert.doesNotMatch(f.root.innerHTML, /PRIVATE_REPORT_TITLE|PRIVATE_REPORT_BODY|data-adm-report=/);
  assert.match(f.root.innerHTML, /role="alert"/);
});

test('a reporter-role reply acknowledgement clears admin access and preserves the attempt until a verified read', async t => {
  const f = setup({reporterAck: true}); t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: RID}); await tick();
  f.root.emit('input', {target: {name: 'reply', value: 'Saved after administrator role changed'}});
  f.root.emit('submit', {target: {matches: () => true}, preventDefault() {}}); await tick();
  assert.doesNotMatch(f.root.innerHTML, /PRIVATE_REPORT_BODY|data-adm-support="copy"|운영자 답변을 저장했습니다/);
  assert.match(f.root.innerHTML, /role="alert"/);
  const key = 'ps_admin_support_reply_v1:' + UID + ':' + RID;
  const draft = JSON.parse(f.store.get(key));
  assert.equal(draft.attempt.p_id, REPLY);
  assert.equal(draft.body, 'Saved after administrator role changed');
  click(f.root, {admSupport: 'copy'}); await tick(); assert.deepEqual(f.copies, []);
  // A later authorized list + GET proves the exact own reply was saved. The
  // reply is shown as reporter content without issuing a duplicate write.
  await f.controller.load(); click(f.root, {admReport: RID}); await tick();
  assert.match(f.root.innerHTML, /답변 저장을 확인했습니다|제보자 · 나/);
  assert.equal(f.store.get(key), undefined);
  assert.equal(f.calls.filter(call => call.name === 'ps_support_reply').length, 1);
});

test('malformed nonempty support lists fail explicitly instead of reporting zero reports', async t => {
  for (const rows of [[{id: 'bad', title: 'Invalid row'}], [report, {...report, id: REPLY, reply_count: '1'}]]) {
    const f = setup({rows}); t.after(() => f.controller.destroy());
    await f.controller.load();
    assert.match(f.root.innerHTML, /role="alert"/);
    assert.doesNotMatch(f.root.innerHTML, /아직 접수된 제보가 없습니다|data-adm-report=/, 'Partial or corrupt results must not appear as a complete inbox');
  }
});

test('only a valid authorized empty list shows the empty inbox message', async t => {
  const f = setup({rows: []}); t.after(() => f.controller.destroy());
  await f.controller.load();
  assert.match(f.root.innerHTML, /아직 접수된 제보가 없습니다/);
  assert.doesNotMatch(f.root.innerHTML, /role="alert"/);
  f.revoke(); await f.controller.load();
  assert.match(f.root.innerHTML, /role="alert"/);
  assert.doesNotMatch(f.root.innerHTML, /아직 접수된 제보가 없습니다/);
});

test('all unsent drafts guard tab closing even after sessionStorage succeeds, until ACK or account destruction', async t => {
  const f = setup({adminAck: true}); t.after(() => f.controller.destroy());
  await f.controller.load(); click(f.root, {admReport: RID}); await tick();
  assert.equal(f.controller.pendingUnsafe(), false);
  f.root.emit('input', {target: {name: 'reply', value: 'A draft that would disappear on tab close'}});
  assert.ok(f.store.has('ps_admin_support_reply_v1:' + UID + ':' + RID));
  assert.equal(f.controller.pendingUnsafe(), true, 'Session storage cannot survive closing this browser tab');
  f.controller.deactivate();
  assert.equal(f.controller.pendingUnsafe(), true, 'Navigating to another admin section does not discard the draft');
  await f.controller.load(); click(f.root, {admReport: RID}); await tick();
  f.root.emit('submit', {target: {matches: () => true}, preventDefault() {}}); await tick();
  assert.match(f.root.innerHTML, /운영자 답변을 저장했습니다/);
  assert.equal(f.controller.pendingUnsafe(), false, 'Verified reply acknowledgement releases the closing guard');
  f.root.emit('input', {target: {name: 'reply', value: 'Another account-scoped draft'}});
  assert.equal(f.controller.pendingUnsafe(), true);
  f.controller.destroy();
  assert.equal(f.controller.pendingUnsafe(), false, 'Destroyed account state cannot block the next account');
});

test('20261017 보낸 사람 — 목록은 이름 · 첫 팀, 제보 머리와 전체 복사는 이메일 · 팀 모두, 이상한 값은 예전처럼', async t => {
  const OWN = '33333333-3333-4333-8333-333333333333', BAD = '44444444-4444-4444-8444-444444444444', NONAME = '55555555-5555-4555-8555-555555555555';
  const reporter = {user_id: UID, name: '<b>김코치</b>', email: 'coach@example.test', teams: [{name: '풋볼A', role: 'owner'}, {name: '가나 FC', role: 'member'}]};
  const rows = [
    {...report, reporter},
    {...report, id: OWN, title: '내 시험', is_own: true, reporter: {user_id: UID, name: '운영자'}},
    {...report, id: BAD, title: '모양 이상', reporter: 'not-an-object'},
    {...report, id: NONAME, title: '이름 없음', reporter: {user_id: NONAME, teams: []}}
  ];
  const f = setup({rows, detailReport: {...report, reporter}}); t.after(() => f.controller.destroy());
  await f.controller.load();
  assert.match(f.root.innerHTML, /&lt;b&gt;김코치&lt;\/b&gt; · 풋볼A 외 1/, 'list row: escaped name · first team + count');
  assert.doesNotMatch(f.root.innerHTML, /<b>김코치<\/b>/, 'name is escaped');
  assert.match(f.root.innerHTML, /내 제보/, 'own report keeps «내 제보»');
  assert.match(f.root.innerHTML, /모양 이상[\s\S]*?사용자 제보/, 'malformed reporter falls back');
  assert.match(f.root.innerHTML, /이름 없음 · 55555555/, 'no name → short id');
  click(f.root, {admReport: RID}); await tick();
  assert.match(f.root.innerHTML, /admSupportWho">보낸 사람 <b>&lt;b&gt;김코치&lt;\/b&gt; · coach@example\.test · 풋볼A, 가나 FC<\/b>/, 'detail header: name · email · all teams');
  click(f.root, {admSupport: 'copy'}); await tick(); await tick();
  assert.equal(f.copies.length, 1);
  assert.match(f.copies[0], /^보낸 사람: <b>김코치<\/b> · coach@example\.test · 풋볼A, 가나 FC\nPRIVATE_REPORT_BODY/, 'copy starts with the reporter line');
});

test('20261017 옛 서버(보낸 사람 없음)는 예전 화면 그대로', async t => {
  const f = setup(); t.after(() => f.controller.destroy());
  await f.controller.load();
  assert.match(f.root.innerHTML, /사용자 제보/);
  click(f.root, {admReport: RID}); await tick();
  assert.doesNotMatch(f.root.innerHTML, /admSupportWho/);
});
