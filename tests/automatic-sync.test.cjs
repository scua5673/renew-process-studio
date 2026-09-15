'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {webcrypto} = require('node:crypto');

// Reuse only the existing fixture declarations, without registering its tests.
// That harness runs the real core, kvWrite, CAS HTTP transport, and outbox ACK.
const fixtureFile = path.join(__dirname, 'team-data-consistency.test.cjs');
const fixtureSource = fs.readFileSync(fixtureFile, 'utf8');
const declarations = fixtureSource.slice(0, fixtureSource.indexOf('\nconst pushed='));
assert.ok(declarations.length > 1000);
const {harness: legacyHarness, fn, section, sync} = new Function('require', '__dirname', declarations + '\nreturn {harness,fn,section,sync};')(createRequire(fixtureFile), __dirname);
const bridge = section(sync, 'var autosaveRunner=', 'function syncNow(reason)');
const KEY = 'cs_team_match_private_v1', META = 'ps_sync_meta';
const raw = JSON.stringify, parse = JSON.parse;
const tick = () => new Promise(resolve => setImmediate(resolve));
function gate() { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; }
const baseDoc = raw({v: 1, entries: {a: {good: 'base A'}, b: {good: 'base B'}}});
function edit(source, id, text) { const doc = parse(source); doc.entries[id].good = text; return raw(doc); }

function harness(options = {}) {
  const h = legacyHarness({server: null, ...options});
  const c = h.c;
  Object.assign(c, {
    crypto: webcrypto, dispatchEvent() {}, CustomEvent: class { constructor(name) { this.type = name; } },
    ITEMP: 'sq:', MATCH_DEL_KEY: 'cs_match_del_v1', ITEMS_ACTIVE: !!options.items,
    idbBacked: k => !c.PERSONAL[k],
    itemsServerCheck: async () => true, itemsPushAllowed: () => true,
    itemsObserveServer: () => false, itemsDeleteReviews: () => [],
  });
  c.storage.keys = async prefix => [...h.idb.keys()].filter(k => !prefix || k.startsWith(prefix));
  // The production storage contract checks the supplied owner guard inside its
  // transaction. Test hooks can suspend that exact boundary.
  c.storage.set = async (k, value, guard) => {
    if (typeof guard === 'function') guard();
    if (h.hooks.idbWrite) await h.hooks.idbWrite(k, value);
    if (typeof guard === 'function') guard();
    h.idb.set(k, value); return true;
  };
  for (const name of ['autosave-merge.js', 'autosave-journal.js', 'autosave-runtime.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../studio', name), 'utf8'), c, {filename: name});
  vm.runInContext([fn('isItemKey'), fn('itemsDeletedLive'), fn('itemsCreateAllowed'), bridge].join('\n'), c, {filename: 'actual autosave bridge'});
  return Object.assign(h, {
    run: () => c.autosaveSyncRun('fixture'),
    async archives() { await tick(); const ctx = c.autosaveContext(); return c.autosaveJournal(ctx.wid).list(ctx); },
    async archiveBodies() { const ctx = c.autosaveContext(), journal = c.autosaveJournal(ctx.wid); return Promise.all((await journal.list(ctx)).map(row => journal.read(ctx, row.id))); },
    async seed(k, local, remote, baseline, cupd = 2) {
      if (!c.isItemKey(k) && !c.KEYS.includes(k)) c.KEYS.push(k);
      h.local.set(k, local); h.idb.set(k, local);
      h.server.set(k, {workspace_id: 'team-a', k, v: remote, cupd});
      if (baseline !== undefined) {
        h.base.set(k, baseline); const m = c.meta(); m.h[k] = c.hash(baseline); m.c[k] = cupd - 1; c.setMeta(m);
      }
      await c.outboxMark('team-a', k, c.hash(local), 'fixture');
    },
  });
}
async function success(h) { const result = await h.run(); assert.equal(result.error, undefined, raw({result, errors: h.errors})); return result; }
function assertSources(h, key, local, remote) { assert.equal(h.local.get(key), local); assert.equal(h.idb.get(key), local); assert.equal(h.server.get(key).v, remote); }

test('actual automatic wrapper merges different coach fields and confirms only the conditional server write', async () => {
  const h = harness(), local = edit(baseDoc, 'b', 'local B'), remote = edit(baseDoc, 'a', 'remote A');
  await h.seed(KEY, local, remote, baseDoc); const result = await success(h);
  const expected = edit(remote, 'b', 'local B');
  assert.deepEqual(parse(h.server.get(KEY).v), parse(expected)); assert.equal(h.local.get(KEY), h.server.get(KEY).v); assert.equal(h.idb.get(KEY), h.server.get(KEY).v);
  assert.equal(h.c.holdList().length, 0); assert.equal(h.queue.length, 0); assert.ok(result.rebased >= 1); assert.equal((await h.archives()).length, 0);
  const writes = h.requests.filter(r => r.stage === 'kv_push_cas'); assert.equal(writes.length, 1); assert.equal(writes[0].options.method, 'PATCH'); assert.match(writes[0].url, /cupd=eq\.2/);
});

test('a same-field conflict keeps server content after durably archiving both exact originals', async () => {
  const h = harness(), local = edit(baseDoc, 'a', 'local A'), remote = ' ' + edit(baseDoc, 'a', 'remote A') + '\n';
  await h.seed(KEY, local, remote, baseDoc); await success(h);
  assertSources(h, KEY, remote, remote); assert.equal(h.queue.length, 0); assert.equal(h.c.holdList().length, 0);
  const saved = await h.archiveBodies(); assert.equal(saved.length, 1); assert.equal(saved[0].localRaw, local); assert.equal(saved[0].remoteRaw, remote);
});

test('27 stale deleted-player rows drain over three nine-key rounds without reviving any server player or dropping archives', async () => {
  const h = harness({items: true}); h.c.KEYS.length = 0;
  const live = Array.from({length: 44}, (_, i) => ({id: 'live-' + i, name: '선수 ' + i, grp: i < 26 ? 'A' : 'B'}));
  for (const player of live) h.server.set('sq:' + player.id, {workspace_id: 'team-a', k: 'sq:' + player.id, v: raw(player), cupd: 1});
  const originals = new Map();
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 9; i++) {
      const n = round * 9 + i, key = 'sq:stale-' + n, local = raw({id: 'stale-' + n, name: '선수 ' + n, grp: '', note: 'unsent-' + n}), remote = raw({_del: 100 + n});
      originals.set(key, {local, remote}); await h.seed(key, local, remote, raw({id: 'stale-' + n, name: '선수 ' + n, grp: ''}));
    }
    await success(h);
    assert.equal(h.c.holdList().length, 0); assert.equal(h.queue.length, 0);
    assert.equal([...h.server.entries()].filter(([k, row]) => k.startsWith('sq:') && !parse(row.v)._del).length, 44);
    for (const [key, pair] of originals) assertSources(h, key, pair.remote, pair.remote);
    assert.equal((await h.archives()).length, (round + 1) * 9, 'The recovery journal must not inherit the old 12-item review cap');
  }
  const saved = await h.archiveBodies(); assert.equal(saved.length, 27);
  for (const record of saved) { const pair = originals.get(record.metadata.k); assert.equal(record.localRaw, pair.local); assert.equal(record.remoteRaw, pair.remote); }
  await success(h); assert.equal((await h.archives()).length, 27, 'Already reconciled records are not archived again');
});

test('unknown local lineage cannot use a newly remembered remote as the base for a 71-player union', async () => {
  const rosterKey = 'scout_tool_v1', h = harness({key: rosterKey}), remote = raw({players: Array.from({length: 44}, (_, i) => ({id: 'p' + i, name: '선수 ' + i}))});
  const doc = parse(remote); doc.players.push(...Array.from({length: 27}, (_, i) => ({id: 'old' + i, name: '선수 ' + i})));
  const local = raw(doc); await h.seed(rosterKey, local, remote);
  // A journal can contain a recently confirmed body even when this device's
  // local metadata has no trustworthy link to its old unsent snapshot.
  const ctx = h.c.autosaveContext(); await h.c.autosaveJournal(ctx.wid).remember(ctx, rosterKey, remote, h.c.hash(remote), 2);
  h.base.set(rosterKey, remote);
  await success(h); assertSources(h, rosterKey, remote, remote); assert.equal(parse(h.server.get(rosterKey).v).players.length, 44); assert.equal((await h.archives()).length, 1);
});

test('archive storage failure leaves local originals, server version, and pending review intact', async () => {
  const h = harness(), local = edit(baseDoc, 'a', 'local A'), remote = edit(baseDoc, 'a', 'remote A'); await h.seed(KEY, local, remote, baseDoc);
  h.hooks.idbWrite = key => { if (key.includes(':archive:')) throw new Error('fixture disk quota'); };
  const result = await h.run(); assert.ok(result.error); assertSources(h, KEY, local, remote); assert.equal(h.queue.length, 1); assert.equal(h.c.holdList().length, 1);
  assert.equal(h.c.meta().h[KEY], h.c.hash(baseDoc)); assert.equal((await h.archives()).length, 0);
});

test('an edit typed during archive persistence is not replaced by the older planned result', async () => {
  const h = harness(), local = edit(baseDoc, 'a', 'local A'), remote = edit(baseDoc, 'a', 'remote A'), later = edit(baseDoc, 'a', 'later keystrokes'); await h.seed(KEY, local, remote, baseDoc);
  let changed = false; h.hooks.idbWrite = key => { if (!changed && key.includes(':archive:')) { changed = true; h.local.set(KEY, later); h.idb.set(KEY, later); } };
  await success(h); assertSources(h, KEY, later, remote); assert.equal(h.queue.length, 1); assert.equal(h.c.meta().h[KEY], h.c.hash(baseDoc));
  const saved = await h.archiveBodies(); assert.equal(saved.length, 1); assert.equal(saved[0].localRaw, local);
});

test('account switch while an archive write is suspended cannot overwrite new-account data or metadata', async () => {
  const h = harness(), local = edit(baseDoc, 'a', 'local A'), remote = edit(baseDoc, 'a', 'remote A'); await h.seed(KEY, local, remote, baseDoc);
  const started = gate(), release = gate(); h.hooks.idbWrite = async key => { if (key.includes(':archive:')) { started.resolve(); await release.promise; } };
  const running = h.run(); await started.promise;
  h.switch(); const newer = raw({account: 'coach-b'}), metadata = raw({h: {[KEY]: 'new-account-hash'}, c: {[KEY]: 77}, n: {}, r: {}});
  h.local.set(KEY, newer); h.idb.set(KEY, newer); h.local.set(META, metadata); release.resolve();
  const result = await running; assert.ok(result.error); assert.equal(h.local.get(KEY), newer); assert.equal(h.idb.get(KEY), newer); assert.equal(h.local.get(META), metadata); assert.equal(h.server.get(KEY).v, remote);
  assert.equal([...h.idb.keys()].filter(key => key.includes(':archive:')).length, 0);
});

test('account switch inside the final local CAS does not install a prior-account candidate', async () => {
  const h = harness(), local = edit(baseDoc, 'b', 'local B'), remote = edit(baseDoc, 'a', 'remote A'); await h.seed(KEY, local, remote, baseDoc);
  const newer = raw({account: 'coach-b'}); let switched = false;
  h.hooks.idbReplace = key => { if (key === KEY && !switched) { switched = true; h.switch(); h.local.set(KEY, newer); h.idb.set(KEY, newer); } };
  const result = await h.run(); assert.ok(result.error || result.rebased === 0); assert.equal(switched, true);
  assert.equal(h.local.get(KEY), newer); assert.equal(h.idb.get(KEY), newer); assert.equal(h.server.get(KEY).v, remote);
});

test('an invalid server body is never installed over a valid pending local document', async () => {
  const h = harness(), local = edit(baseDoc, 'a', 'local A'), remote = '{invalid'; await h.seed(KEY, local, remote, baseDoc);
  const result = await h.run(); assertSources(h, KEY, local, remote); assert.equal(h.queue.length, 1); assert.equal(h.c.holdList().length, 1);
  assert.equal(h.c.meta().h[KEY], h.c.hash(baseDoc)); assert.equal(result.rebased || 0, 0);
  assert.equal(h.requests.filter(request => request.stage === 'kv_push_cas').length, 0);
});

test('a racing server edit survives a merged candidate CAS miss and is included on retry', async () => {
  const h = harness(), local = edit(baseDoc, 'b', 'local B'), remote = edit(baseDoc, 'a', 'remote A'); await h.seed(KEY, local, remote, baseDoc);
  const later = parse(remote); later.serverOnly = 'newer remote edit'; let raced = false;
  h.hooks.fetch = stage => { if (stage === 'kv_push_cas' && !raced) { raced = true; h.server.set(KEY, {workspace_id: 'team-a', k: KEY, v: raw(later), cupd: 3}); } };
  await h.run(); assert.equal(raced, true); assert.equal(parse(h.server.get(KEY).v).serverOnly, 'newer remote edit');
  delete h.hooks.fetch; await success(h);
  const saved = parse(h.server.get(KEY).v); assert.equal(saved.serverOnly, 'newer remote edit'); assert.equal(saved.entries.a.good, 'remote A'); assert.equal(saved.entries.b.good, 'local B');
  assert.equal(h.queue.length, 0); assert.equal(h.c.holdList().length, 0); assert.equal(h.c.meta().h[KEY], h.c.hash(h.server.get(KEY).v));
});

test('a successful HTTP response with no matching CAS acknowledgement leaves the merged draft pending', async () => {
  const h = harness({casZero: true}), local = edit(baseDoc, 'b', 'local B'), remote = edit(baseDoc, 'a', 'remote A'); await h.seed(KEY, local, remote, baseDoc);
  const result = await h.run(); assert.ok(result.error || result.pending);
  assert.equal(h.server.get(KEY).v, remote); assert.equal(parse(h.idb.get(KEY)).entries.b.good, 'local B'); assert.equal(h.queue.length, 1);
  assert.equal(h.c.meta().h[KEY], h.c.hash(remote), 'Only the downloaded server body is confirmed; a planned merge is not a server ACK');
  assert.notEqual(h.c.meta().h[KEY], h.c.hash(h.idb.get(KEY)));
});

for (const change of ['permissions', 'workspace role']) test(`changing ${change} during archival stops the prior authority before local application`, async () => {
  const h = harness(), local = edit(baseDoc, 'a', 'local A'), remote = edit(baseDoc, 'a', 'remote A'); await h.seed(KEY, local, remote, baseDoc);
  let changed = false;
  h.hooks.idbWrite = key => {
    if (key.includes(':archive:') && !changed) {
      changed = true;
      if (change === 'permissions') h.state.role = 'player'; else h.state.teamRole = 'member';
    }
  };
  const result = await h.run(); assert.equal(changed, true); assert.equal(result.code, 'sync_workspace_changed');
  assertSources(h, KEY, local, remote); assert.equal(h.queue.length, 1); assert.equal(h.c.meta().h[KEY], h.c.hash(baseDoc));
  assert.equal([...h.idb.keys()].filter(key => key.includes(':archive:')).length, 0);
});

test('the whole wrapper rejects an account changed after core completion before capturing or reconciling again', async () => {
  const h = harness(), local = edit(baseDoc, 'a', 'local A'), remote = edit(baseDoc, 'a', 'remote A'); await h.seed(KEY, local, remote, baseDoc);
  const originalCore = h.c.syncNowCore, newRaw = raw({account: 'coach-b'});
  h.c.syncNowCore = async reason => {
    const result = await originalCore(reason); h.switch(); h.local.set(KEY, newRaw); h.idb.set(KEY, newRaw); return result;
  };
  const result = await h.run(); assert.equal(result.code, 'sync_workspace_changed');
  assert.equal(h.local.get(KEY), newRaw); assert.equal(h.idb.get(KEY), newRaw); assert.equal(h.server.get(KEY).v, remote);
  assert.equal(h.requests.filter(request => request.stage === 'kv_pull').length, 1, 'No extra old-context remote read follows core');
});

for (const race of ['new local input', 'unrelated metadata']) test(`the asynchronous IDP ancestor commit preserves ${race}`, async () => {
  const idpKey = 'cs_idp_v1_coach-a', h = harness(), base = raw({v: 1, goal: 'before', note: 'before'});
  const local = raw({v: 1, goal: 'local', note: 'before'}), remote = raw({v: 1, goal: 'before', note: 'remote'}), candidate = raw({v: 1, goal: 'local', note: 'remote'});
  await h.seed(idpKey, local, remote, base); h.c.idbBacked = key => key !== idpKey;
  const row = h.server.get(idpKey); h.c.holdConflictRecord(idpKey, local, row);
  const review = h.c.autosavePending().find(item => item.k === idpKey), version = h.c.autosaveVersion(review.wid, idpKey), ctx = raw(h.c.autosaveContext());
  const current = () => { assert.equal(raw(h.c.autosaveContext()), ctx); return true; };
  const started = gate(), release = gate(); h.c.syncIdpBaseSet = async () => { started.resolve(); await release.promise; };
  const applying = h.c.autosaveApply(review, local, candidate, row, current, version); await started.promise;
  const later = raw({v: 1, goal: 'later keystrokes', note: 'remote'});
  if (race === 'new local input') h.local.set(idpKey, later);
  else { const next = h.c.meta(); next.h.other = 'independently-confirmed'; next.c.other = 99; h.c.setMetaExact(next); }
  release.resolve(); const applied = await applying;
  if (race === 'new local input') {
    assert.equal(applied, false); assert.equal(h.local.get(idpKey), later); assert.equal(h.c.meta().h[idpKey], h.c.hash(base));
    assert.equal(h.c.holdList().length, 1);
  } else {
    assert.equal(applied, true); assert.equal(h.local.get(idpKey), candidate); assert.equal(h.c.meta().h[idpKey], h.c.hash(remote));
    assert.equal(h.c.meta().h.other, 'independently-confirmed'); assert.equal(h.c.meta().c.other, 99);
  }
});

test('the actual preswitch metadata preparation retains every known ancestor when automatic saving is enabled', () => {
  const h = harness(), metadata = {h: {board: 'board hash', 'sq:p1': 'player hash', cs_team_match_private_v1: 'match hash'}, c: {board: 2, 'sq:p1': 3}, r: {scout_tool_v1: {wid: 'team-a'}}, p: {h: {private: 'own hash'}, c: {private: 8}}, n: {board: 2}, last: 100};
  h.local.set(META, raw(metadata));
  Object.assign(h.c, {SWITCH_META_KEEP: {process_coach_v1: 1, cs_team_matches_v1: 1}, preMetaRaw: null, preMetaCaptured: false});
  vm.runInContext(section(sync, '  try{\n    preMetaRaw=localStorage.getItem(MKEY);', '  var _pre ='), h.c, {filename: 'actual preswitch metadata preparation'});
  assert.deepEqual(parse(h.local.get(META)), metadata); assert.equal(h.c.preMetaCaptured, true);
});

test('the real IDP ancestor envelope retains its prior confirmed body across an autosave metadata failure', async () => {
  const key = 'cs_idp_v1_coach-a', h = harness(), base = raw({v: 1, goal: 'before'}), local = raw({v: 1, goal: 'local'}), remote = raw({v: 1, goal: 'remote'});
  await h.seed(key, local, remote, base); h.c.idbBacked = k => k !== key;
  const tag = 'PSIDPBASE1:'; let stored = tag + raw({v: 1, c: {r: base, h: h.c.hash(base), u: 1}});
  Object.assign(h.c, {IDP_BASE_TAG: tag, syncBaseStored: () => stored, syncBaseStore: async (_key, next) => { stored = next; }});
  vm.runInContext([fn('idpBaseEnvelope'), fn('idpBasePickEntry'), fn('syncIdpBaseSet')].join('\n'), h.c);
  const row = h.server.get(key); h.c.holdConflictRecord(key, local, row);
  const review = h.c.autosavePending().find(item => item.k === key), version = h.c.autosaveVersion(review.wid, key);
  h.c.setMetaExact = () => { throw new Error('fixture metadata disk failure'); };
  await assert.rejects(h.c.autosaveApply(review, local, remote, row, () => true, version), /metadata disk failure/);
  const envelope = parse(stored.slice(tag.length));
  assert.equal(envelope.c.r, remote); assert.equal(envelope.p?.r, base, 'A failed metadata commit must still be able to select the previous confirmed IDP ancestor');
  assert.equal(h.c.idpBasePickEntry(key, stored, h.c.meta()).r, base);
});

test('a legacy bulk review cannot bypass remote schedule shape validation', () => {
  const h = harness(), key = 'process_coach_v1', local = raw({anchorMonday: '2026-09-14', weeks: {'0': []}});
  for (const remote of ['{}', '[]', 'null', '{"weeks":[]}']) {
    const prepared = h.c.autosavePrepare({channel: 'team', kind: 'bulk', k: key}, {raw: remote, needsArchive: true, reason: 'base-missing'}, null, local, {v: remote, cupd: 2});
    assert.equal(prepared, null, remote);
  }
});

test('a legacy bulk review validates private and public IDP server bodies before the server fallback', () => {
  const h = harness();
  for (const [key, remote] of [['cs_idp_v1_coach-a', '{}'], ['cs_idp_v1_coach-a', '{"v":1,"imgNotes":{}}'], ['cs_idp_pub_v1_coach-a', '{"v":2}'], ['cs_idp_pub_v1_coach-a', '[]']]) {
    const prepared = h.c.autosavePrepare({channel: 'team', kind: 'bulk', k: key}, {raw: remote, needsArchive: true, reason: 'base-missing'}, null, '{"v":1}', {v: remote, cupd: 2});
    assert.equal(prepared, null, key + ' ' + remote);
  }
});

test('a legacy bulk review cannot install another player ID or a nonobject item body', () => {
  const h = harness({items: true}), key = 'sq:player-a', local = raw({id: 'player-a', name: 'Local'});
  for (const remote of ['{}', '[]', 'null', '{"id":"player-b"}']) {
    const prepared = h.c.autosavePrepare({channel: 'team', kind: 'bulk', k: key}, {raw: remote, needsArchive: true, reason: 'base-missing'}, null, local, {v: remote, cupd: 2});
    assert.equal(prepared, null, remote);
  }
  const tomb = '{"_del":100}';
  const prepared = h.c.autosavePrepare({channel: 'team', kind: 'bulk', k: key}, {raw: tomb, needsArchive: true, reason: 'base-missing'}, null, local, {v: tomb, cupd: 2});
  assert.equal(prepared.raw, tomb); assert.equal(prepared.needsArchive, true);
});

test('folder reconciliation finishes when its mirror already contains the exact server candidate', async () => {
  const key='cs_vault_folders_v1',h=harness({key}),local=raw(['Training','Shared']),remote=raw(['Training','Shared','New folder']);
  await h.seed(key,local,remote);h.local.set(key,remote);
  await success(h);
  assertSources(h,key,remote,remote);assert.equal(h.queue.length,0);
  const count=(await h.archives()).length;await success(h);assert.equal((await h.archives()).length,count);
});

for(const race of ['mirror','idb'])test('convergent folder repair preserves a newer '+race+' edit',async()=>{
  const key='cs_vault_folders_v1',h=harness({key}),old=raw(['A']),candidate=raw(['A','B']),fresh=raw(['A','B','C']);
  await h.seed(key,old,candidate);h.local.set(key,race==='mirror'?fresh:candidate);
  if(race==='idb')h.hooks.idbReplace=k=>{if(k===key)h.idb.set(key,fresh);};
  const writes=[],guard={stale:false};assert.equal(h.c.kvWrite(key,candidate,writes,old,guard,()=>true),true);
  await Promise.allSettled(writes);assert.equal(guard.stale,true);
  assert.equal(race==='mirror'?h.local.get(key):h.idb.get(key),fresh);
});

test('folder reconciliation completes an intermediate mirror when the newer server includes every name in the same order',async()=>{
  const key='cs_vault_folders_v1',h=harness({key}),local=raw(['A']),mirror=raw(['A','B']),remote=raw(['A','B','C']);
  await h.seed(key,local,remote);h.local.set(key,mirror);await success(h);
  assertSources(h,key,remote,remote);assert.equal(h.queue.length,0);
  const count=(await h.archives()).length;await success(h);assert.equal((await h.archives()).length,count);
});
for(const [label,old,mirror,candidate] of [
 ['unique local name',['A'],['A','Mine'],['A','B']],
 ['reordered mirror',['A','B'],['B','A'],['A','B','C']],
 ['local deletion',['A','B'],['A'],['A','B','C']],
 ['remote deletion',['A'],['A','B'],['A','C']],
 ['duplicate names',['A'],['A','B','B'],['A','B','C']],
 ['invalid shape',['A'],{folder:'A'},['A','B']]
])test('folder intermediate repair protects '+label,async()=>{
 const key='cs_vault_folders_v1',h=harness({key});await h.seed(key,raw(old),raw(candidate));h.local.set(key,raw(mirror));
 const writes=[],guard={stale:false};h.c.kvWrite(key,raw(candidate),writes,raw(old),guard,()=>true);await Promise.allSettled(writes);
 assert.equal(guard.stale,true);assert.equal(h.local.get(key),raw(mirror));assert.equal(h.idb.get(key),raw(old));
});

test('storage mismatch diagnostics contain shape/count only, never folder contents',async()=>{
 const key='cs_vault_folders_v1',h=harness({key}),events=[];h.c.syncDiagnostic=(stage,error)=>events.push({stage,code:error.psCode,message:error.message});
 const old=raw(['private old folder']),mirror=raw(['private new folder','private note']),candidate=raw(['server folder']);
 await h.seed(key,old,candidate);h.local.set(key,mirror);const writes=[],guard={stale:false};h.c.kvWrite(key,candidate,writes,old,guard,()=>true);await Promise.all(writes);
 assert.deepEqual(events,[{stage:'kv-write-source-mismatch',code:'mirror-array2_idb-array1_expected-array1_next-array1_extra2',message:'storage copies disagree'}]);
 assert.equal(guard.stale,true);assert.equal(h.idb.get(key),old);assert.equal(h.local.get(key),mirror);
});
