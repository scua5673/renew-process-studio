const test = require('node:test');
const assert = require('node:assert/strict');
const {plan} = require('../studio/autosave-merge.js');
const raw = JSON.stringify;
function merge(base, local, remote) { return plan({key: 'fixture', base: raw(base), local: raw(local), remote: raw(remote)}); }
function value(result) { return JSON.parse(result.raw); }
function ids(result) { return value(result).map(item => item.id); }
function rows(order) { return [...order].map(id => ({id, name: id, score: 0})); }

test('independent nested fields, additions, and removals preserve both devices edits', () => {
  const result = merge({name: 'A', profile: {color: 'blue', size: 1}, old: true}, {name: 'B', profile: {color: 'blue', size: 1}, added: null}, {name: 'A', profile: {color: 'gray', size: 1}, old: true, server: 2});
  assert.deepEqual(value(result), {name: 'B', profile: {color: 'gray', size: 1}, added: null, server: 2});
  assert.equal(result.needsArchive, false);
});

test('same-field conflicts use remote while retaining unrelated local edits', () => {
  const result = merge({name: 'A', number: 1}, {name: 'B', number: 2}, {name: 'C', number: 1});
  assert.deepEqual(value(result), {name: 'C', number: 2});
  assert.equal(result.needsArchive, true);
  assert.deepEqual(result.conflicts, [{path: '/name', reason: 'same-field', winner: 'remote'}]);
});

test('ordinary field deletion conflicts also prefer remote', () => {
  const result = merge({note: 'before'}, {}, {note: 'remote edit'});
  assert.deepEqual(value(result), {note: 'remote edit'});
  assert.equal(result.needsArchive, true);
});

test('JSON object key order and whitespace are semantic equality, preserving exact remote bytes', () => {
  const remote = ' { "nested": {"b":2,"a":1}, "title": "server" }\n';
  const result = plan({base: '{"title":"old","nested":{"a":1,"b":2}}', local: '{ "nested":{"b":2,"a":1}, "title":"old"}', remote});
  assert.equal(result.raw, remote); assert.equal(result.needsArchive, false);
  const same = plan({base: null, local: '{"title":"server","nested":{"a":1,"b":2}}', remote});
  assert.equal(same.raw, remote); assert.equal(same.needsArchive, false);
});

test('a local-only safe change can retain its exact raw string', () => {
  const local = ' {"a":2, "b":1}\n';
  const result = plan({base: '{"a":1,"b":1}', local, remote: '{"b":1,"a":1}'});
  assert.equal(result.raw, local); assert.equal(result.needsArchive, false);
});

test('missing or malformed baselines never authorize overwriting the server', () => {
  for (const base of [null, undefined, '', '{', {a: 1}]) {
    const result = plan({base, local: '{"a":2}', remote: ' {"a":3} '});
    assert.equal(result.raw, ' {"a":3} '); assert.equal(result.needsArchive, true); assert.match(result.reason, /^base-/);
  }
  const missingServer = plan({base: null, local: '{"a":2}', remote: null});
  assert.equal(missingServer.raw, null); assert.equal(missingServer.needsArchive, true);
});

test('an unknown-base stale 71-player snapshot never unions extra players into the authoritative 44', () => {
  const remote = raw({players: Array.from({length: 44}, (_, i) => ({id: 'player-' + i, name: '선수 ' + i, grp: i < 26 ? 'A' : 'B'}))});
  const old = JSON.parse(remote);
  old.players.push(...Array.from({length: 27}, (_, i) => ({id: 'stale-copy-' + i, name: '선수 ' + i, grp: ''})));
  for (const base of [null, undefined, 'untrusted baseline']) {
    const result = plan({key: 'scout_tool_v1', base, local: raw(old), remote});
    assert.equal(result.raw, remote); assert.equal(value(result).players.length, 44); assert.equal(result.needsArchive, true);
    assert.ok(!value(result).players.some(player => player.id.startsWith('stale-copy-')));
  }
});

test('a trusted 44-player baseline accepts one stable new ID without duplicating the existing roster', () => {
  const base = {players: Array.from({length: 44}, (_, i) => ({id: 'player-' + i, name: '선수 ' + i, grp: i < 26 ? 'A' : 'B'}))};
  const local = JSON.parse(raw(base)), remote = JSON.parse(raw(base));
  local.players.push({id: 'new-player', name: '선수 0', grp: 'B'}); remote.players[0].grp = 'B';
  const result = merge(base, local, remote), roster = value(result).players;
  assert.equal(roster.length, 45); assert.equal(new Set(roster.map(player => player.id)).size, 45);
  assert.equal(roster.find(player => player.id === 'player-0').grp, 'B'); assert.equal(roster.filter(player => player.id === 'new-player').length, 1);
  assert.equal(result.needsArchive, false);
});

test('invalid local or remote JSON stays untouched for recovery, including unrepresentable numbers', () => {
  for (const [local, remote, reason] of [['{', '{"a":3}', 'local-invalid-json'], ['{"a":2}', '{', 'remote-invalid-json'], ['2', '1e400', 'remote-invalid-json']]) {
    const result = plan({base: '{}', local, remote});
    assert.equal(result.raw, remote); assert.equal(result.reason, reason); assert.equal(result.needsArchive, true);
  }
});

test('primitive values, JSON null, and arrays without IDs are atomic', () => {
  assert.deepEqual(value(merge(null, {created: true}, null)), {created: true});
  assert.equal(value(merge(1, 2, 3)), 3);
  const result = merge({tags: ['a'], steps: [{text: 'old'}]}, {tags: ['a', 'local'], steps: [{text: 'local'}]}, {tags: ['a', 'remote'], steps: [{text: 'remote'}]});
  assert.deepEqual(value(result), {tags: ['a', 'remote'], steps: [{text: 'remote'}]}); assert.equal(result.conflicts.length, 2);
  assert.deepEqual(value(merge(['a'], ['a', 'b'], ['a'])), ['a', 'b']);
});

test('ID arrays merge item fields and independent memberships without duplicating existing players', () => {
  const base = rows('ac'), local = rows('abc'), remote = rows('adc');
  local[0].name = 'local name'; remote[0].score = 8;
  const result = merge(base, local, remote);
  assert.deepEqual(ids(result), ['a', 'd', 'b', 'c']);
  assert.deepEqual(value(result)[0], {id: 'a', name: 'local name', score: 8});
  assert.equal(result.needsArchive, false);
});

test('independent reorder edits are combined instead of forcing server order', () => {
  const result = merge(rows('abcd'), rows('bacd'), rows('abdc'));
  assert.deepEqual(ids(result), ['b', 'a', 'd', 'c']); assert.equal(result.needsArchive, false);
});

test('a local reorder survives concurrent remote item field changes', () => {
  const remote = rows('abc'); remote[1].score = 10;
  const result = merge(rows('abc'), rows('cab'), remote);
  assert.deepEqual(ids(result), ['c', 'a', 'b']); assert.equal(value(result)[2].score, 10); assert.equal(result.needsArchive, false);
});

test('incompatible order edits keep server order and all nondeleted items while requesting an archive', () => {
  const local = rows('baxc'); local[0].name = 'local edited B';
  const result = merge(rows('abc'), local, rows('acb'));
  assert.deepEqual(ids(result).filter(id => id !== 'x'), ['a', 'c', 'b']);
  assert.equal(new Set(ids(result)).size, 4); assert.equal(value(result).find(row => row.id === 'b').name, 'local edited B');
  assert.equal(result.needsArchive, true); assert.ok(result.conflicts.some(c => c.reason === 'order-conflict'));
});

test('server membership deletion cannot resurrect from a stale edited device', () => {
  const local = rows('abc'); local[1].name = 'stale B edit';
  const result = merge(rows('abc'), local, rows('ac'));
  assert.deepEqual(ids(result), ['a', 'c']); assert.equal(result.needsArchive, true);
  assert.ok(result.conflicts.some(c => c.reason === 'deleted-on-remote' && c.path === '/@id=string:b'));
});

test('local membership deletion wins a competing remote edit and explicitly requires remote archival too', () => {
  const remote = rows('abc'); remote[1].score = 9;
  const result = merge(rows('abc'), rows('ac'), remote);
  assert.deepEqual(ids(result), ['a', 'c']);
  assert.deepEqual(result.conflicts, [{path: '/@id=string:b', reason: 'delete-edit', winner: 'local-deletion', archiveRemote: true}]);
});

test('nonconflicting membership deletions on both devices do not require an archive', () => {
  const result = merge(rows('abcd'), rows('acd'), rows('abc'));
  assert.deepEqual(ids(result), ['a', 'c']); assert.equal(result.needsArchive, false);
});

test('remote tombstones prevent resurrection even when they are the trusted base', () => {
  const tomb = '{ "_del": 123 }';
  const result = plan({base: tomb, local: '{"id":"a","name":"stale"}', remote: tomb});
  assert.equal(result.raw, tomb); assert.equal(result.needsArchive, true);
  const nested = merge([{id: 'a', _del: 123}], [{id: 'a', name: 'stale'}], [{id: 'a', _del: 123}]);
  assert.deepEqual(value(nested), [{id: 'a', _del: 123}]); assert.equal(nested.needsArchive, true);
});

test('local tombstones win live edits but require exact remote archival', () => {
  const result = merge({id: 'a', name: 'old'}, {_del: 456}, {id: 'a', name: 'new'});
  assert.deepEqual(value(result), {_del: 456});
  assert.ok(result.conflicts.some(c => c.archiveRemote === true && c.winner === 'local-deletion'));
  assert.equal(merge({id: 'a'}, {_del: 456}, {id: 'a'}).needsArchive, false);
});

test('concurrent tombstones retain server deletion bytes', () => {
  const remote = '{"_del":222}';
  const result = plan({base: '{"id":"a"}', local: '{"_del":111}', remote});
  assert.equal(result.raw, remote); assert.equal(result.needsArchive, true);
});

test('duplicate or mixed ambiguous IDs cannot silently collapse an array', () => {
  for (const local of [[{id: 'a'}, {id: 'a'}], [{id: 'a'}, {name: 'missing ID'}], [{id: ''}], [{id: null}], [{id: true}]]) {
    const result = merge([{id: 'a'}], local, [{id: 'a'}]);
    assert.deepEqual(value(result), [{id: 'a'}]); assert.equal(result.needsArchive, true); assert.equal(result.conflicts[0].reason, 'ambiguous-array-ids');
  }
});

test('numeric and string identifiers are distinct and dangerous-looking IDs are harmless Map keys', () => {
  const result = merge([], [{id: 1}, {id: '__proto__'}], [{id: '1'}, {id: 'constructor'}]);
  assert.equal(value(result).length, 4); assert.equal(new Set(value(result).map(row => typeof row.id + ':' + row.id)).size, 4);
  assert.equal(Object.prototype.polluted, undefined); assert.equal(result.needsArchive, false);
});

test('unsafe property names at any depth are rejected without prototype mutation', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const local = '{"nested":{"' + key + '":{"polluted":true}}}';
    const result = plan({base: '{}', local, remote: ' {"safe":true} '});
    assert.equal(result.raw, ' {"safe":true} '); assert.equal(result.reason, 'local-unsafe-key'); assert.equal(result.needsArchive, true);
    assert.equal(Object.prototype.polluted, undefined);
  }
});

test('conflict paths safely distinguish slash and tilde field names', () => {
  const result = merge({'a/b~c': 1}, {'a/b~c': 2}, {'a/b~c': 3});
  assert.equal(result.conflicts[0].path, '/a~1b~0c');
});

test('pathological nesting fails closed rather than overflowing or emitting partial JSON', () => {
  let local = '1'; for (let i = 0; i < 100; i++) local = '{"n":' + local + '}';
  const result = plan({base: '{}', local, remote: '{}'});
  assert.equal(result.raw, '{}'); assert.equal(result.reason, 'local-document-limit'); assert.equal(result.needsArchive, true);
});

test('merging the same saved result again is idempotent and does not mutate caller inputs', () => {
  const base = rows('ab'), local = rows('abc'), remote = rows('abd'); local[0].score = 3; remote[1].name = 'remote';
  const original = raw({base, local, remote}), first = merge(base, local, remote);
  const again = plan({base: raw(base), local: first.raw, remote: first.raw});
  assert.equal(again.raw, first.raw); assert.equal(again.needsArchive, false); assert.equal(raw({base, local, remote}), original);
});
