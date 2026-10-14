const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const actions = require('../studio/admin-actions.js');

/* 20261014 — 관리자 작업 기록(백엔드 탭). 팀 삭제 · 멤버 내보내기 · 콘텐츠 삭제/복구는 운영 함수가 원래부터
   ps_admin_log 로 남겨 왔지만 읽는 곳이 없었다. 오류 제보 상태 · 커뮤니티 숨김도 같은 표에 남는다. */
const row = (id, action, extra = {}) => ({id, action, at: '2026-10-14T08:00:00Z', admin_email: 'admin@example.test', workspace_id: null, workspace_name: null, workspace_gone: false, target_id: null, target_name: '', meta: {}, ...extra});

test('each action reads as a sentence: what, on what, with what', () => {
  assert.equal(actions.label('workspace_delete'), '팀 삭제');
  assert.equal(actions.label('community_hide'), '커뮤니티 글 숨김');
  assert.equal(actions.label('mystery'), 'mystery', 'unknown actions still show their code');
  assert.equal(actions.target(row(1, 'workspace_delete', {workspace_name: '지울팀', workspace_gone: true})), '지울팀 (삭제된 팀)');
  assert.equal(actions.detail(row(1, 'workspace_delete', {meta: {name: '지울팀', members: 3, library: 12}})), '멤버 3 · 콘텐츠 12');
  assert.equal(actions.target(row(2, 'member_remove', {target_name: 'coach@example.test', workspace_name: '프로세스FC'})), 'coach@example.test · 프로세스FC');
  assert.equal(actions.target(row(3, 'library_soft_delete', {target_name: '전방압박 론도', workspace_name: '프로세스FC'})), '전방압박 론도 · 프로세스FC');
  assert.equal(actions.detail(row(4, 'support_status', {meta: {status: 'closed', fixed_in: '3.029'}})), '닫음 · 고침 3.029');
  assert.equal(actions.detail(row(5, 'support_status', {meta: {status: 'open', fixed_in: null}})), '다시 엶');
  assert.equal(actions.target(row(6, 'support_status', {target_id: '11111111-2222', target_name: ''})), '11111111', 'a gone report falls back to its id');
});

test('every server value is escaped', () => {
  const html = actions.render([row(1, 'library_soft_delete', {admin_email: '<b>x</b>', target_name: '<img src=x onerror=alert(1)>', workspace_name: '"팀"'})]);
  assert.doesNotMatch(html, /<img|<b>x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&quot;팀&quot;/);
  assert.match(html, /admActDanger">콘텐츠 삭제</);
});

test('an empty log explains what will appear', () => {
  assert.match(actions.render([]), /아직 기록된 관리자 작업이 없어요/);
});

function host() {
  return {innerHTML: '', listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('pages load with before_id and a missing server function says how to install it', async () => {
  const h = host(), calls = [];
  const pages = [{rows: [row(9, 'member_remove'), row(8, 'library_restore')], next_before: 8}, {rows: [row(7, 'workspace_delete')], next_before: null}];
  const c = actions.create({host: h, rpc: async (name, args) => { calls.push({name, args}); return pages.shift(); }});
  await c.load();
  assert.deepEqual(calls[0], {name: 'ps_admin_actions_list', args: {p_limit: 50, p_before_id: null}});
  assert.match(h.innerHTML, /data-adm-act-more/);
  h.listeners.click({target: {closest: () => ({})}}); await tick(); await tick();
  assert.deepEqual(calls[1].args, {p_limit: 50, p_before_id: 8});
  assert.deepEqual(c.rows().map(r => r.id), [9, 8, 7]);
  assert.doesNotMatch(h.innerHTML, /data-adm-act-more/);

  const missing = host();
  await actions.create({host: missing, rpc: async () => { throw Object.assign(new Error('Could not find the function'), {status: 404, code: 'PGRST202'}); }}).load();
  assert.match(missing.innerHTML, /20261014_admin_actions_view\.sql/);
  const broken = host();
  await actions.create({host: broken, rpc: async () => ({rows: [{id: 'x'}]})}).load();
  assert.match(broken.innerHTML, /불러오지 못했어요/);
});

test('admin.html loads the log with the backend tab and forgets it on session lock', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  assert.match(a, /<script src="studio\/admin-actions\.js\?v=20261014"><\/script>/);
  assert.match(a, /function loadBack\(\)\{\n  loadIncidents\(\);\n  loadAdminActions\(\);/);
  assert.match(a, /<div id="admActBody">/);
  assert.match(a, /adminActions=null;if\(\$\('admActBody'\)\)\$\('admActBody'\)\.innerHTML='';/);
});
