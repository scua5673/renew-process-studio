'use strict';

// 2.996 — field report (app 2.989, macOS Chrome, coach with one personal and one team
// workspace): 20 pairs of `kv-write-source-mismatch` + `personal-channel` in six minutes.
//
// The personal channel plans against the IndexedDB copy (currentValueForKey), but kvWrite's
// IndexedDB path compared against `localStorage ?? IndexedDB`. Notes and the match desk
// document are IndexedDB-only on every screen; a leftover localStorage copy (pre-1.504 notes,
// pre-v309 match desk, or the storage.get fallback in storage.js, which copies into IndexedDB
// but keeps the localStorage copy) is never read and never refreshed. Once such a copy
// differs from IndexedDB, every server pull of that key fails the comparison, meta never
// advances, and the next round plans the same pull again — while the failure also blocks
// every other personal key's upload.
//
// Executes the shipped personal planner, personal sync, kvWrite, CAS transport, meta and
// outbox code. Only browser storage, auth and server I/O are simulated.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../studio/sync.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Can extract ${start}`);
  return source.slice(a, b);
}
function fn(name) { return section(`function ${name}(`, '\nfunction '); }
const code = [
  fn('hash'),
  section('function meta()', 'function keyReady('),
  fn('syncIssue'), fn('syncHttpError'),
  fn('currentValueForKey'), fn('outboxMarkForOwner'),
  section('function outboxAckPersonal(', '/* 워크스페이스를 바꿀 때'),
  section('function kvPushRows(', '/* ── 1.568 안전장치'),
  section('function kvWrite(', 'function libLoad('),
  section('function personalWid()', '/* 1.504 — 충돌 사본 청소'),
  fn('visiblePendingInfo'), fn('syncCodeText'), fn('syncReasonText'), fn('syncState'),
].join('\n');

const MATCHDESK = 'cs_analysis_workspaces_v1';
const NOTES = 'cs_notes_v1';
const LIBRARY = 'cs_analysis_team_library_v1';   // screen reads the localStorage mirror first
const MEMO = 'cs_team_match_private_v1';          // localStorage-only (scout.html store)
const META = 'ps_sync_meta';
const copy = value => JSON.parse(JSON.stringify(value));
const response = (rows, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => copy(rows), text: async () => JSON.stringify(rows)});

// keys: {key: {idb?, mirror?, server?, cupd?, base?, baseCupd?}}
function harness(keys, {team = true} = {}) {
  const session = {uid: 'coach-a'}, active = team ? 'team-a' : 'personal-a';
  const local = new Map(), idb = new Map(), server = new Map(), requests = [], diagnostics = [], hooks = {};
  let queue = [], queueTail = Promise.resolve();
  local.set('ps_cache_owner_v1', 'owner-a');
  const h = {}, c = {}, lsOnly = {};
  for (const [k, o] of Object.entries(keys)) {
    if (o.lsOnly) lsOnly[k] = 1;
    if (o.idb != null) idb.set(k, o.idb);
    if (o.mirror != null) local.set(k, o.mirror);
    if (o.server != null) server.set(k, {workspace_id: 'personal-a', k, v: o.server, cupd: o.cupd ?? 1});
    if (o.base !== undefined) { h[k] = o.base; c[k] = o.baseCupd ?? 1; }
  }
  const ctx = vm.createContext({
    Promise, console, setTimeout, clearTimeout, isFinite,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options && options.detail; } },
    navigator: {onLine: true}, document: {querySelectorAll: () => [], getElementById: () => null}, dispatchEvent() {},
    localStorage: {
      getItem(k) { return local.has(k) ? local.get(k) : null; },
      setItem(k, v) { local.set(k, String(v)); },
      removeItem(k) { local.delete(k); },
    },
    storage: {
      async get(k) {
        if (hooks.idbRead) await hooks.idbRead(k);
        if (idb.has(k)) return {value: idb.get(k)};
        // storage.js: an empty IndexedDB falls back to localStorage and copies it in,
        // keeping the localStorage copy (not a DEVICE_LOCAL key).
        if (local.has(k)) { idb.set(k, local.get(k)); return {value: local.get(k)}; }
        return null;
      },
      async set(k, v) { idb.set(k, v); return true; },
      async replaceIfValue(k, expected, replacement) {
        if (hooks.idbReplace) await hooks.idbReplace(k);
        const before = idb.has(k) ? idb.get(k) : null;
        if (before !== expected) return false;
        if (replacement == null) idb.delete(k); else idb.set(k, replacement);
        return true;
      },
      async delIfValue(k, value) { if (idb.get(k) === value) idb.delete(k); },
    },
    getSess: () => session, activeWs: () => active, dataUnlocked: () => true, isTeamWs: () => team,
    wsList: () => [{id: 'personal-a', kind: 'personal', owner_id: 'coach-a'}, {id: 'team-a', kind: 'team'}],
    workspaceSwitchGuardRaw: () => '', workspaceSwitchEpochRaw: () => '',
    signOutEpoch: 0, OWNERKEY: 'ps_cache_owner_v1', MKEY: META, matchReadyPending: false,
    MATCH_KEY: 'cs_team_matches_v1', SCHEDULE_KEY: 'process_coach_v1',
    KEYS: Object.keys(keys), PERSONAL: Object.fromEntries(Object.keys(keys).map(k => [k, 1])), MAXLEN: 1500000,
    idbBacked: k => !lsOnly[k],
    isIdpPrivateKey: () => false, isIdpPubKey: () => false,
    outboxOwner: () => session.uid, outboxScope: (uid, wid) => `${uid}|${wid}`,
    async outboxTxn(change) {
      queueTail = queueTail.catch(() => {}).then(async () => { queue = copy(await change(copy(queue))); return copy(queue); });
      return queueTail;
    },
    pendingInfo(wid) { const found = queue.filter(x => x.uid === session.uid && x.wid === wid); return {count: found.length, oldest: found.length ? found[0].at : 0}; },
    async outboxFail() {},
    syncDiagnostic(stage) { diagnostics.push(stage); },
    classifySyncError: e => ({code: e.psCode || 'sync_network', stage: e.psStage || 'test'}),
    importApproved: () => false, importApprovalClear() {}, holdClear() {}, rescueStash() {},
    BASE: 'https://test.invalid', hj: () => ({}), prefBuild: x => x, KV_PUSH_BYTES: 1000000, KV_PUSH_ROWS: 15,
    async blobPrepRows() {},
    kvInFilter: ks => 'k=in.(' + ks.join(',') + ')',
    async syncFetch(stage, url, opts) {
      const u = new URL(url), method = opts.method || 'GET';
      requests.push({stage, method});
      if (method === 'GET') {
        const full = u.searchParams.get('select').includes('v'), filter = u.searchParams.get('k');
        const selected = filter && filter.startsWith('in.(') ? filter.slice(4, -1).split(',') : Object.keys(keys);
        const rows = selected.flatMap(k => server.has(k) ? [copy(server.get(k))] : []);
        const result = full ? rows : rows.map(({k, cupd}) => ({k, cupd}));
        if (hooks.readResponse) await hooks.readResponse(stage, result);
        return response(result);
      }
      const body = JSON.parse(opts.body);
      let result = [];
      if (method === 'PATCH') {
        const k = u.searchParams.get('k').slice(3), expected = u.searchParams.get('cupd').slice(3), before = server.get(k);
        if (before && String(before.cupd) === expected) { const saved = {...before, ...body}; server.set(k, saved); result = [{workspace_id: saved.workspace_id, k, cupd: saved.cupd}]; }
      } else if (!server.has(body.k)) { server.set(body.k, copy(body)); result = [{workspace_id: body.workspace_id, k: body.k, cupd: body.cupd}]; }
      return response(result);
    },
    holdList: () => [], rescueList: () => [], conflictList: () => [], COPIES_OFF: true,
    busy: false, lastIssue: null, agoText: () => '', rtConnected: () => false, rtLast: 0, rtHits: 0,
    keyLabel: k => k, esc: x => String(x), psModal: () => ({close() {}}),
    renderUI() {}, renderDataLock() {}, syncNow: async () => {}, itemsHoldList: () => [], HIST_KEYS: [], ITEMS_ACTIVE: false,
  });
  ctx.window = ctx;
  vm.runInContext(code, ctx);
  for (const k of Object.keys(h)) h[k] = h[k] == null ? '' : ctx.hash(h[k]);
  local.set(META, JSON.stringify(team ? {h: {teamKey: 'keep'}, c: {teamKey: 9}, p: {h, c}, n: {}, r: {}, last: 10} : {h, c, n: {}, r: {}, last: 10}));
  return {
    c: ctx, local, idb, server, requests, diagnostics, hooks,
    get queue() { return copy(queue); },
    channel() { const m = JSON.parse(local.get(META)); return team ? m.p : m; },
    addPending(k, raw) { queue.push({id: `coach-a|personal-a|${k}`, uid: 'coach-a', wid: 'personal-a', key: k, hash: ctx.hash(raw), at: 1}); },
    writes() { return requests.filter(r => r.method !== 'GET').length; },
    run() { return Promise.resolve().then(() => ctx.syncPersonal('not-a-real-token', () => true)); },
  };
}

// The stale copy is what a pre-v309 match desk (or pre-1.504 notes) left behind; the
// IndexedDB copy is the last version this device confirmed with the server; another device
// changed the server afterwards. Nothing changes during the rounds themselves.
const LEFTOVER = JSON.stringify({matches: [{id: 'old-1'}], savedAt: 1}); // only in localStorage
const CONFIRMED = JSON.stringify({matches: [{id: 'm1'}], teamDocs: [], savedAt: 2});
const SERVER = JSON.stringify({matches: [], teamDocs: [], savedAt: 1758067200000});
assert.equal(SERVER.length, 52); // the size of the reported server row

for (const team of [true, false]) {
  for (const key of [MATCHDESK, NOTES]) {
    test(`${key}: a leftover localStorage copy no longer blocks a server pull forever (${team ? 'team' : 'personal'} workspace)`, async () => {
      const h = harness({[key]: {idb: CONFIRMED, mirror: LEFTOVER, server: SERVER, cupd: 2, base: CONFIRMED, baseCupd: 1}}, {team});
      await h.run();
      assert.deepEqual(h.diagnostics, [], 'no kv-write-source-mismatch / personal-channel pair');
      assert.equal(h.idb.get(key), SERVER);
      assert.equal(h.channel().h[key], h.c.hash(SERVER));
      assert.equal(h.channel().c[key], 2);
      assert.equal(h.local.get(key), LEFTOVER, 'the unread leftover copy is preserved, not overwritten');
      assert.equal(h.writes(), 0);
      assert.notEqual(h.c.syncState().kind, 'bad');
      // Converged: the next round neither writes nor fails.
      await h.run();
      assert.deepEqual(h.diagnostics, []);
      assert.equal(h.idb.get(key), SERVER);
    });
  }
}

test('one stuck personal pull no longer blocks the coach private match memo upload', async () => {
  const h = harness({
    [MATCHDESK]: {idb: CONFIRMED, mirror: LEFTOVER, server: SERVER, cupd: 2, base: CONFIRMED, baseCupd: 1},
    [MEMO]: {lsOnly: true, mirror: '{"m1":"new memo"}', server: '{"m1":"old memo"}', cupd: 1, base: '{"m1":"old memo"}', baseCupd: 1},
  });
  h.addPending(MEMO, '{"m1":"new memo"}');
  await h.run();
  assert.equal(h.server.get(MEMO).v, '{"m1":"new memo"}');
  assert.equal(h.queue.length, 0);
  assert.equal(h.idb.get(MATCHDESK), SERVER);
});

test('a faithful localStorage copy of an IndexedDB-only key still follows the pulled value', async () => {
  const h = harness({[NOTES]: {idb: CONFIRMED, mirror: CONFIRMED, server: SERVER, cupd: 2, base: CONFIRMED, baseCupd: 1}});
  await h.run();
  assert.equal(h.idb.get(NOTES), SERVER);
  assert.equal(h.local.get(NOTES), SERVER);
  assert.deepEqual(h.diagnostics, []);
});

test('an IndexedDB edit after the plan read is still protected when a leftover copy exists', async () => {
  const h = harness({[NOTES]: {idb: CONFIRMED, mirror: LEFTOVER, server: SERVER, cupd: 2, base: CONFIRMED, baseCupd: 1}});
  const before = copy(h.channel());
  // note.html saves (IndexedDB only) after syncPersonal read its plan value.
  h.hooks.readResponse = stage => { if (stage === 'personal_pull') h.idb.set(NOTES, 'NEW NOTE STROKE'); };
  await assert.rejects(h.run(), e => e.psCode === 'sync_local_changed');
  assert.equal(h.idb.get(NOTES), 'NEW NOTE STROKE');
  assert.equal(h.local.get(NOTES), LEFTOVER);
  assert.deepEqual(h.channel(), before);
  assert.ok(h.diagnostics.includes('kv-write-source-mismatch'));
});

test('an IndexedDB edit racing the comparison write is still protected when a leftover copy exists', async () => {
  const h = harness({[MATCHDESK]: {idb: CONFIRMED, mirror: LEFTOVER, server: SERVER, cupd: 2, base: CONFIRMED, baseCupd: 1}});
  const before = copy(h.channel());
  h.hooks.idbReplace = () => h.idb.set(MATCHDESK, 'RACING EDIT');
  await assert.rejects(h.run(), e => e.psCode === 'sync_local_changed');
  assert.equal(h.idb.get(MATCHDESK), 'RACING EDIT');
  assert.deepEqual(h.channel(), before);
});

test('a personal key whose screen reads the localStorage mirror keeps the newer mirror edit', async () => {
  // team-library.js reads localStorage first; a mirror that differs from IndexedDB is the
  // newest screen copy and must never be replaced by a server pull.
  const h = harness({[LIBRARY]: {idb: '[]', mirror: '[{"id":"t1"}]', server: '[{"id":"srv"}]', cupd: 2, base: '[]', baseCupd: 1}});
  const before = copy(h.channel());
  await assert.rejects(h.run(), e => e.psCode === 'sync_local_changed');
  assert.equal(h.idb.get(LIBRARY), '[]');
  assert.equal(h.local.get(LIBRARY), '[{"id":"t1"}]');
  assert.deepEqual(h.channel(), before);
  assert.ok(h.diagnostics.includes('kv-write-source-mismatch'));
});

test('an IndexedDB-only key with an empty IndexedDB still uses the localStorage copy as its value', async () => {
  // storage.get copies the old localStorage value into IndexedDB; both copies agree.
  const h = harness({[NOTES]: {mirror: CONFIRMED, server: SERVER, cupd: 2, base: CONFIRMED, baseCupd: 1}});
  await h.run();
  assert.equal(h.idb.get(NOTES), SERVER);
  assert.equal(h.local.get(NOTES), SERVER);
  assert.deepEqual(h.diagnostics, []);
});
