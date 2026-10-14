const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const community = require('../studio/admin-community.js');

/* 20261014 — 관리자 «커뮤니티» 탭. 앱의 «신고»는 ps_comm_reports 에 쌓이기만 했고(2026-10-14 기준 2건) 관리자가 글을 내릴 길이 없었다. */
const post = (pid, extra = {}) => ({pub_id: pid, reports: 3, reporters: 1, anonymous: 1, last_report_at: '2026-08-02T05:59:39Z', reasons: [], exists: true,
  title: '4vs4 halfspace game', summary: '하프스페이스', owner_name: '코치A', owner_email: 'owner@example.test', created_at: '2026-07-14T13:16:40Z', views: 10, likes: 2, copies: 1, deleted: false, hidden_at: null, ...extra});
const queue = (reported, hidden = []) => ({reported, hidden, counts: {open_reports: reported.reduce((a, r) => a + r.reports, 0), reported_posts: reported.length, hidden_posts: hidden.length}});
const tick = () => new Promise(resolve => setImmediate(resolve));
function host() { return {innerHTML: '', listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }}; }
function button(attrs) { return {disabled: false, getAttribute: k => attrs[k] ?? null}; }
const click = (h, attrs) => h.listeners.click({target: {closest: () => button(attrs)}});
const type = (h, pid, value) => h.listeners.input({target: {value, getAttribute: k => k === 'data-comm-reason' ? pid : null}});

test('a reported post shows who, how many, and the two ways out', () => {
  const html = community.render(queue([post('P1', {reasons: ['광고성']}), post('GONE', {exists: false, title: null, reports: 1, reporters: 1, anonymous: 0})]));
  assert.match(html, /열린 신고 4건 · 글 2개/);
  assert.match(html, /<b>4vs4 halfspace game<\/b>/);
  assert.match(html, /코치A · owner@example\.test/);
  assert.match(html, /신고 3건 · 로그인 1명 · 익명 1건 · 마지막 /);
  assert.match(html, /<li>광고성<\/li>/);
  assert.match(html, /data-comm-hide="P1"[^>]*>글 숨기기</);
  assert.match(html, /data-comm-resolve="P1"[^>]*>문제 없음 · 신고 닫기</);
  assert.match(html, /이미 지워진 글/);
  assert.doesNotMatch(html, /data-comm-hide="GONE"/, 'a deleted post can only have its reports closed');
  assert.match(html, /data-comm-resolve="GONE"[^>]*>신고 닫기</);
  assert.match(html, /검토할 신고/);assert.match(html, /숨긴 글이 없어요/);
});

test('everything from the server is escaped', () => {
  const x = '<img src=x onerror=alert(1)>';
  const html = community.render(queue([post('P"1', {title: x, summary: x, owner_name: x, reasons: [x]})], [post('H1', {title: x, hidden_at: '2026-10-14T00:00:00Z', hidden_reason: x, hidden_by_email: x})]));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /data-comm-hide="P&quot;1"/);
});

test('hiding asks first, sends the reason, then reloads the queue', async () => {
  const h = host(), calls = [], counted = [];let asked = '';
  let state = queue([post('P1')]);
  const c = community.create({host: h, onCounts: x => counted.push(x), confirm: m => { asked = m; return true; },
    rpc: async (name, args) => {
      calls.push({name, args});
      if (name === 'ps_admin_comm_queue') return state;
      if (name === 'ps_admin_comm_hide') { state = queue([], [post('P1', {hidden_at: '2026-10-14T00:00:00Z', hidden_reason: args.p_reason})]); return {pub_id: 'P1', hidden_at: '2026-10-14T00:00:00Z', reports_closed: 3}; }
      throw new Error('unexpected ' + name);
    }});
  await c.load();
  assert.deepEqual(counted.at(-1), {open_reports: 3, reported_posts: 1, hidden_posts: 0});
  type(h, 'P1', '  광고  ');
  click(h, {'data-comm-hide': 'P1'}); await tick(); await tick(); await tick();
  assert.match(asked, /올린 사람 포함/);
  assert.deepEqual(calls.find(x => x.name === 'ps_admin_comm_hide').args, {p_pub_id: 'P1', p_hidden: true, p_reason: '광고'});
  assert.match(h.innerHTML, /글을 숨겼어요 · 신고 3건 닫음/);
  assert.match(h.innerHTML, /data-comm-unhide="P1"/);
  assert.deepEqual(counted.at(-1), {open_reports: 0, reported_posts: 0, hidden_posts: 1});
});

test('declining the confirm sends nothing', async () => {
  const h = host(), calls = [];
  const c = community.create({host: h, confirm: () => false, rpc: async (name, args) => { calls.push(name); return queue([post('P1')]); }});
  await c.load();
  click(h, {'data-comm-hide': 'P1'}); await tick();
  assert.deepEqual(calls, ['ps_admin_comm_queue']);
});

test('resolve keeps the post, a vanished post explains itself, a missing function says how to install', async () => {
  const h = host();let n = 0;
  const c = community.create({host: h, rpc: async name => {
    if (name === 'ps_admin_comm_queue') return queue(n++ ? [] : [post('P1')]);
    if (name === 'ps_admin_comm_resolve') return {pub_id: 'P1', reports_closed: 3};
  }});
  await c.load();
  click(h, {'data-comm-resolve': 'P1'}); await tick(); await tick(); await tick();
  assert.match(h.innerHTML, /신고 3건을 닫았어요\. 글은 그대로예요/);

  const gone = host();
  const g = community.create({host: gone, confirm: () => true, rpc: async name => {
    if (name === 'ps_admin_comm_queue') return queue([post('P1')]);
    throw Object.assign(new Error('post_not_found'), {code: 'PT404', status: 404});
  }});
  await g.load(); click(gone, {'data-comm-hide': 'P1'}); await tick(); await tick();
  assert.match(gone.innerHTML, /이미 지워졌을 수 있어요/);

  const missing = host();
  await community.create({host: missing, rpc: async () => { throw Object.assign(new Error('x'), {code: 'PGRST202', status: 404}); }}).load();
  assert.match(missing.innerHTML, /20261014_community_moderation\.sql/);
});

test('admin.html has the community tab, badge and session cleanup', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  assert.match(a, /data-admin-tab="comm"[^>]*>.*커뮤니티<span class="navBadge" id="commBadge" hidden><\/span><\/button>/);
  assert.match(a, /<div class="wrap hide" id="viewComm"/);
  assert.match(a, /if\(t==='comm'\) loadComm\(\);/);
  assert.match(a, /<script src="studio\/admin-community\.js\?v=20261014"><\/script>/);
  assert.match(a, /adminCommunity=null;if\(\$\('commBody'\)\)\$\('commBody'\)\.innerHTML='';setCommCounts\(null\);/);
  assert.match(a, /confirm:function\(m\)\{return window\.confirm\(m\);\}/);
});
