const test = require('node:test');
const assert = require('node:assert/strict');
const mod = require('../studio/admin-stale-clients.js');

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const NOW = Date.parse('2026-10-28T03:00:00Z');
const sample = {hours: 48, behind: 20, latest: '3.197', clients: [
  {user_id: U1, who: {name: '<b>코치</b>', email: 'coach@example.com', teams: [{name: '풋볼A'}, {name: '두번째'}]}, device: 'tablet', app_version: '3.131', last_at: '2026-10-27T15:30:00Z', events: 13, crashes: 5, storage_full: 0, newer_seen: false},
  {user_id: U2, who: {email: 'second@example.com', teams: []}, device: 'mobile', app_version: '2.846', last_at: '2026-10-27T15:58:00Z', events: 3, crashes: 0, storage_full: 2, newer_seen: true}
]};

test('validate accepts the server shape and rejects malformed rows instead of counting them as zero', () => {
  assert.ok(mod.validate(sample));
  assert.equal(mod.validate(null), null);
  assert.equal(mod.validate({clients: 'nope'}), null);
  assert.equal(mod.validate({clients: [{user_id: 'x', app_version: '3.131', device: 'tablet', last_at: 'now'}]}), null, 'user id must be a uuid');
  assert.equal(mod.validate({clients: [{user_id: U1, app_version: '3.1', device: 'tablet', last_at: 'now'}]}), null, 'version must be N.NNN');
  assert.equal(mod.validate({latest: 'abc', clients: []}), null);
});

test('html lists stale devices with escaped names, crash counts and the moved-on state', () => {
  const html = mod.html(mod.validate(sample), NOW);
  assert.match(html, /최신 판 3\.197/);
  assert.match(html, /&lt;b&gt;코치&lt;\/b&gt; · 풋볼A 외 1/, 'names are escaped and the first team is shown');
  assert.doesNotMatch(html, /<b>코치<\/b>/);
  assert.match(html, /data-stale-user="11111111-1111-4111-8111-111111111111"/);
  assert.match(html, /태블릿<\/td><td><b>3\.131<\/b><\/td><td>12시간 전/);
  assert.match(html, /<b class="adm-stale-bad">5<\/b>/, 'crash count is highlighted');
  assert.match(html, /아직 옛 판/);
  assert.match(html, /<details class="adm-stale-moved-box"><summary>그 뒤 새 판으로 올라온 기기 1<\/summary>[\s\S]*그 뒤 새 판 확인/, 'a device that later reported a new version is folded away');
  assert.ok(html.indexOf('아직 옛 판') < html.indexOf('<details'), 'still-stale devices come first');
  assert.match(html, /second<\/button>/, 'email local part stands in for a missing name');
});

test('html says so when nothing is stale, and shows an unknown state rather than zero when the answer was unusable', () => {
  assert.match(mod.html({hours: 48, behind: 20, latest: '3.197', clients: []}, NOW), /없음 — 모든 기기가 최신 판 근처/);
  assert.match(mod.html(null, NOW), /확인하지 못했습니다/);
});

test('create loads through the given rpc, renders into the host and wires user buttons; failures keep the host readable', async () => {
  const opened = [];
  function fakeHost() { return {innerHTML: '', buttons: [], querySelectorAll() { return this.buttons; }}; }
  const host = fakeHost();
  host.buttons = [{getAttribute: () => U1, onclick: null}];
  const calls = [];
  const view = mod.create({host, rpc: async (name, args) => { calls.push({name, args}); return sample; }, openUser: uid => opened.push(uid), now: () => NOW});
  await view.load();
  assert.deepEqual(calls, [{name: 'ps_admin_stale_clients', args: {p_hours: 48, p_behind: 20}}]);
  assert.match(host.innerHTML, /3\.131/);
  host.buttons[0].onclick();
  assert.deepEqual(opened, [U1]);

  const broken = fakeHost();
  const failing = mod.create({host: broken, rpc: async () => { throw new Error('PGRST202'); }, missing: fn => 'MISSING ' + fn});
  await failing.load();
  assert.match(broken.innerHTML, /불러오지 못했습니다/);
  assert.match(broken.innerHTML, /MISSING ps_admin_stale_clients/);
});
