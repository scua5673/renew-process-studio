const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../studio/participation.js');
const today = '2026-09-15';
const pid = 'player-a';
const run = (s, from, to = from, extra = {}) => ({ s, from, to, ...extra });
const metaOf = (runs) => ({ statusRuns: { [pid]: runs } });
function freeze(o) {
  if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); }
  return o;
}

test('UMD publishes the same pure API without browser storage or a clock', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../studio/participation.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.window.PSParticipation), ['record', 'resolve', 'totals']);
});

test('past-day edit is immutable and preserves every other date, player, run note, and unknown field', () => {
  const meta = freeze({
    custom: { season: '2026', nested: [1, 2] },
    statusRuns: { [pid]: [run('injury', '2026-09-01', today, { n: 'ankle', treatment: { code: 'ice' } })] },
    participationDays: {
      '2026-09-02': { [pid]: { s: 'injury', kind: 'off', at: 1, n: 'original note', unknown: [9] }, 'player-b': { s: 'ok', kind: 'match', at: 2 } },
      '2026-09-03': { [pid]: { s: 'rehab', kind: 'train', at: 3 } }
    }
  });
  const original = JSON.stringify(meta);
  const next = P.record(meta, pid, '2026-09-02', 'rest', 'off', 5, today);
  assert.equal(JSON.stringify(meta), original);
  assert.notEqual(next, meta);
  assert.notEqual(next.participationDays, meta.participationDays);
  assert.notEqual(next.participationDays['2026-09-02'], meta.participationDays['2026-09-02']);
  assert.equal(next.statusRuns, meta.statusRuns);
  assert.equal(next.custom, meta.custom);
  assert.equal(next.participationDays['2026-09-03'], meta.participationDays['2026-09-03']);
  assert.equal(next.participationDays['2026-09-02']['player-b'], meta.participationDays['2026-09-02']['player-b']);
  assert.deepEqual(next.participationDays['2026-09-02'][pid], { s: 'rest', kind: 'off', at: 5, n: 'original note', unknown: [9] });
  assert.equal(P.resolve(next, pid, '2026-09-01', 'train', 'injury', today).s, 'injury');
  assert.equal(P.resolve(next, pid, '2026-09-04', 'train', 'injury', today).s, 'injury');
});

test('same-name players remain separate by exact ID', () => {
  let meta = { names: { 'player-a': '같은 이름', 'player-b': '같은 이름' } };
  meta = P.record(meta, 'player-a', today, 'injury', 'train', 1, today);
  meta = P.record(meta, 'player-b', today, 'ok', 'match', 2, today);
  assert.equal(P.resolve(meta, 'player-a', today, 'train', 'injury', today).s, 'injury');
  assert.equal(P.resolve(meta, 'player-b', today, 'train', 'ok', today).s, 'ok');
  assert.equal(P.resolve(meta, 'missing', today, 'train', undefined, today).source, 'none');
});

for (const kind of ['off', 'none']) {
  test(`explicit training on ${kind} keeps its training snapshot after schedule changes`, () => {
    const meta = P.record({}, pid, today, 'ok', kind, 1, today, '개인 훈련');
    assert.deepEqual(P.resolve(meta, pid, today, 'match', 'ok', today), { s: 'ok', kind: 'train', source: 'record', note: '개인 훈련' });
    assert.equal(P.totals(meta, pid, today, today, 'off', 'ok', today).training, 1);
  });
}

test('recorded match and non-participation keep the schedule kind at the time of editing', () => {
  let meta = P.record({}, pid, '2026-09-14', 'ok', 'match', 1, today);
  meta = P.record(meta, pid, today, 'rest', 'off', 2, today);
  const total = P.totals(meta, pid, '2026-09-14', today, 'train', 'rest', today);
  assert.equal(total.match, 1);
  assert.equal(total.training, 0);
  assert.equal(total.rest, 0);
});

test('explicit empty note clears that day note without touching the injury episode', () => {
  const meta = metaOf([run('injury', '2026-09-01', today, { n: 'episode note' })]);
  let next = P.record(meta, pid, today, 'injury', 'train', 1, today, 'day note');
  next = P.record(next, pid, today, 'injury', 'train', 2, today, '');
  assert.equal(P.resolve(next, pid, today, 'train', 'injury', today).note, '');
  assert.equal(P.resolve(next, pid, '2026-09-14', 'train', 'injury', today).note, 'episode note');
  assert.equal(next.statusRuns, meta.statusRuns);
});

test('all five supported states record and resolve independently', () => {
  for (const s of ['ok', 'rest', 'rehab', 'injury', 'out']) {
    const meta = P.record(null, pid, today, s, 'train', 0, today);
    assert.equal(P.resolve(meta, pid, today, 'train', undefined, today).s, s);
  }
});

test('calendar validation rejects rollover, invalid leap days, timezone/date-time forms and future edits', () => {
  for (const day of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-9-01', '2026-09-15Z', '2026-09-15T00:00:00+09:00', '0000-01-01', '2026-09-16', '', null]) {
    assert.throws(() => P.record({}, pid, day, 'ok', 'train', 1, today), RangeError, String(day));
    assert.equal(P.resolve({}, pid, day, 'train', 'ok', today).source, 'none');
  }
  assert.throws(() => P.record({}, pid, today, 'ok', 'train', 1, undefined), RangeError);
  assert.throws(() => P.record({}, pid, today, 'ok', 'train', 1, '2026-02-29'), RangeError);
  assert.equal(P.record({}, pid, '2024-02-29', 'ok', 'train', 1, today).participationDays['2024-02-29'][pid].s, 'ok');
});

test('IDs, state, kind, timestamp and note are validated before modification', () => {
  const meta = freeze({ statusRuns: {} });
  for (const bad of ['', ' ', '__proto__', 'constructor', 'prototype', 'a\n', 12, null]) {
    assert.throws(() => P.record(meta, bad, today, 'ok', 'train', 1, today), TypeError);
  }
  for (const bad of ['unknown', 'train', '', null]) assert.throws(() => P.record(meta, pid, today, bad, 'train', 1, today), TypeError);
  for (const bad of ['training', '', null]) assert.throws(() => P.record(meta, pid, today, 'ok', bad, 1, today), TypeError);
  for (const bad of [-1, NaN, Infinity, '1', null]) assert.throws(() => P.record(meta, pid, today, 'ok', 'train', bad, today), TypeError);
  assert.throws(() => P.record(meta, pid, today, 'ok', 'train', 1, today, {}), TypeError);
  assert.deepEqual(meta, { statusRuns: {} });
});

test('malformed target containers are not silently overwritten', () => {
  for (const meta of [[], 'bad', { participationDays: null }, { participationDays: [] }, { participationDays: { [today]: null } }, { participationDays: { [today]: { [pid]: 'bad' } } }]) {
    const before = JSON.stringify(meta);
    assert.throws(() => P.record(meta, pid, today, 'ok', 'train', 1, today), TypeError);
    assert.equal(JSON.stringify(meta), before);
  }
});

test('prototype fields cannot create records or leak an inherited status', () => {
  const inherited = Object.create({ participationDays: { [today]: { [pid]: { s: 'ok', kind: 'train', at: 1 } } } });
  assert.equal(P.resolve(inherited, pid, today, 'train', undefined, today).source, 'none');
  assert.deepEqual(P.resolve(inherited, pid, today, 'train', 'injury', today), { s: 'injury', kind: 'train', source: 'current', note: '' });
  const meta = JSON.parse('{"__proto__":{"polluted":true},"statusRuns":{}}');
  const next = P.record(meta, pid, today, 'ok', 'train', 1, today);
  assert.equal(Object.getPrototypeOf(next), Object.prototype);
  assert.deepEqual(next.__proto__, { polluted: true });
  assert.equal({}.polluted, undefined);
});

test('direct day record overrides only that date of an injury episode', () => {
  const meta = metaOf([run('injury', '2026-09-10', today, { n: 'ankle' })]);
  const next = P.record(meta, pid, '2026-09-12', 'ok', 'train', 1, today);
  const total = P.totals(next, pid, '2026-09-10', today, 'train', 'injury', today);
  assert.equal(total.injury, 5);
  assert.equal(total.training, 1);
  assert.equal(total.recorded, 1);
  assert.equal(total.statusDays, 5);
});

test('malformed explicit observations are unknown rather than overwritten by a known run', () => {
  for (const bad of [null, {}, { s: 'ok', kind: 'train' }, { s: 'ok', kind: 'train', at: Infinity }, { s: 'bad', kind: 'train', at: 1 }]) {
    const meta = { ...metaOf([run('ok', today)]), participationDays: { [today]: { [pid]: bad } } };
    assert.equal(P.resolve(meta, pid, today, 'train', 'ok', today).source, 'none');
    assert.equal(P.totals(meta, pid, today, today, 'train', 'ok', today).unknown, 1);
  }
});

test('injury continues across unopened days and weekends only with a matching current status', () => {
  const meta = freeze(metaOf([run('injury', '2026-09-10', '2026-09-11', { n: 'ankle', provider: 'legacy' })]));
  for (const day of ['2026-09-12', '2026-09-13', today]) {
    assert.deepEqual(P.resolve(meta, pid, day, 'off', 'injury', today), { s: 'injury', kind: 'off', source: 'status', note: 'ankle' });
  }
  assert.deepEqual(P.resolve(meta, pid, today, 'off', 'ok', today), { s: 'ok', kind: 'off', source: 'current', note: '' });
  assert.equal(P.resolve(meta, pid, today, 'off', undefined, today).source, 'none');
  assert.equal(P.resolve(meta, pid, today, 'off', 'injury').source, 'none');
  assert.equal(meta.statusRuns[pid][0].to, '2026-09-11');
  assert.equal(P.totals(meta, pid, '2026-09-10', today, 'off', 'injury', today).injury, 6);
});

test('return today closes the previous injury and later dates never count', () => {
  const meta = metaOf([run('injury', '2026-09-10', '2026-09-14'), run('ok', today)]);
  const next = P.record(meta, pid, today, 'ok', 'train', 1, today);
  assert.equal(P.resolve(next, pid, today, 'train', 'ok', today).s, 'ok');
  assert.equal(P.resolve(next, pid, '2026-09-16', 'train', 'ok', today).source, 'none');
  const total = P.totals(next, pid, '2026-09-10', '2026-09-20', 'train', 'ok', today);
  assert.equal(total.injury, 5);
  assert.equal(total.exercise, 1);
  assert.equal(total.days, 6);
});

test('current status alone invents no history before the first run or in earlier gaps', () => {
  const meta = metaOf([run('injury', '2026-09-10', '2026-09-11'), run('injury', '2026-09-14')]);
  for (const day of ['2026-09-09', '2026-09-12', '2026-09-13']) assert.equal(P.resolve(meta, pid, day, 'train', 'injury', today).source, 'none');
  assert.equal(P.resolve({}, pid, today, 'train', 'injury', today).source, 'current');
  assert.equal(P.resolve(meta, pid, today, 'train', 'injury', today).s, 'injury');
});

test('valid availability fills only the explicitly supplied today with its current schedule', () => {
  for (const s of ['ok', 'rest', 'rehab', 'injury', 'out']) {
    assert.deepEqual(P.resolve({}, pid, today, 'match', s, today), { s, kind: 'match', source: 'current', note: '' });
    assert.equal(P.resolve({}, pid, '2026-09-14', 'train', s, today).source, 'none');
    assert.equal(P.resolve({}, pid, '2026-09-16', 'train', s, today).source, 'none');
    assert.equal(P.resolve({}, pid, today, 'train', s).source, 'none');
    assert.equal(P.resolve({}, pid, today, 'train', s, '2026-02-29').source, 'none');
  }
  for (const s of ['', 'unknown', 'train', undefined, null]) {
    assert.equal(P.resolve({}, pid, today, 'train', s, today).source, 'none');
  }
  assert.deepEqual(P.resolve({}, pid, today, 'invalid', 'ok', today), { s: 'ok', kind: 'none', source: 'current', note: '' });
});

test('today availability overrides stale records, runs and legacy snapshots without changing past evidence', () => {
  const previous = '2026-09-14';
  const cases = [
    { participationDays: { [previous]: { [pid]: { s: 'injury', kind: 'off', at: 1, n: 'past note' } }, [today]: { [pid]: { s: 'injury', kind: 'off', at: 2, n: 'stale note' } } } },
    metaOf([run('injury', previous, today, { n: 'injury episode' })]),
    { statusLog: { [previous]: { [pid]: 'injury' }, [today]: { [pid]: 'injury' } } }
  ];
  for (const meta of cases.map(freeze)) {
    const original = JSON.stringify(meta);
    assert.deepEqual(P.resolve(meta, pid, today, 'match', 'ok', today), { s: 'ok', kind: 'match', source: 'current', note: '' });
    assert.equal(P.resolve(meta, pid, previous, 'train', 'ok', today).s, 'injury');
    assert.equal(P.resolve(meta, pid, today, 'train', undefined, today).s, 'injury');
    const total = P.totals(meta, pid, today, today, 'match', 'ok', today);
    assert.equal(total.match, 1);
    assert.equal(total.injury, 0);
    assert.equal(total.recorded, 0);
    assert.equal(total.statusDays, 0);
    assert.equal(total.currentDays, 1);
    assert.equal(JSON.stringify(meta), original);
  }
});

test('matching today evidence retains record, run and legacy precedence and notes', () => {
  const direct = { s: 'ok', kind: 'train', at: 1, n: 'personal session' };
  const meta = { ...metaOf([run('injury', today, today, { n: 'stale episode' })]), statusLog: { [today]: { [pid]: 'rest' } }, participationDays: { [today]: { [pid]: direct } } };
  assert.deepEqual(P.resolve(meta, pid, today, 'off', 'ok', today), { s: 'ok', kind: 'train', source: 'record', note: 'personal session' });
  const matchingRun = { ...metaOf([run('rehab', today, today, { n: 'recovery' })]), statusLog: meta.statusLog };
  assert.deepEqual(P.resolve(matchingRun, pid, today, 'off', 'rehab', today), { s: 'rehab', kind: 'off', source: 'status', note: 'recovery' });
  assert.deepEqual(P.resolve({ statusLog: meta.statusLog }, pid, today, 'train', 'rest', today), { s: 'rest', kind: 'train', source: 'status', note: '' });
});

test('repeated reads and refreshes do not stamp current availability into historical data', () => {
  const raw = JSON.stringify({ statusRuns: {}, participationDays: {}, statusLog: {}, custom: { keep: true } });
  for (let refresh = 0; refresh < 3; refresh++) {
    const meta = freeze(JSON.parse(raw));
    assert.equal(P.resolve(meta, pid, today, 'train', 'ok', today).source, 'current');
    const total = P.totals(meta, pid, '2026-09-14', today, 'train', 'ok', today);
    assert.equal(total.training, 1);
    assert.equal(total.unknown, 1);
    assert.equal(total.recorded, 0);
    assert.equal(total.statusDays, 0);
    assert.equal(total.currentDays, 1);
    assert.equal(JSON.stringify(meta), raw);
    assert.equal(P.resolve(meta, pid, today, 'train', 'ok', '2026-09-16').source, 'none');
  }
});

test('today totals use availability while off days create neither exercise nor missed participation', () => {
  for (const k of ['off', 'none', 'train', 'match']) {
    const scheduled = k === 'train' || k === 'match';
    for (const s of ['ok', 'rest', 'rehab', 'injury', 'out']) {
      const total = P.totals({}, pid, today, '2026-09-16', k, s, today);
      assert.equal(total.exercise, s === 'ok' && scheduled ? 1 : 0);
      assert.equal(total.rest, s !== 'ok' && scheduled ? 1 : 0);
      assert.equal(total.injury, s === 'injury' ? 1 : 0);
      assert.equal(total.rehab, s === 'rehab' ? 1 : 0);
      assert.equal(total.out, s === 'out' ? 1 : 0);
      assert.equal(total.unknown, 0);
      assert.equal(total.days, 1);
      assert.equal(total.recorded, 0);
      assert.equal(total.statusDays, 0);
      assert.equal(total.currentDays, 1);
    }
  }
  const weekend = '2026-09-13';
  const total = P.totals({}, pid, '2026-09-11', weekend, day => day === '2026-09-11' ? 'train' : 'off', 'ok', weekend);
  assert.equal(total.unknown, 1);
  assert.equal(total.exercise, 0);
  assert.equal(total.rest, 0);
  assert.equal(total.currentDays, 1);
});

test('malformed last run cannot extend an earlier episode accidentally', () => {
  const meta = metaOf([run('injury', '2026-09-10'), { s: 'injury', from: '2026-09-14', to: 'broken' }]);
  assert.deepEqual(P.resolve(meta, pid, today, 'train', 'injury', today), { s: 'injury', kind: 'train', source: 'current', note: '' });
  assert.equal(P.resolve(meta, pid, '2026-09-14', 'train', 'injury', today).source, 'none');
  assert.equal(P.resolve(meta, pid, '2026-09-10', 'train', 'injury', today).s, 'injury');
});

test('reverse run precedence counts overlapping days once and preserves notes', () => {
  const meta = metaOf([run('injury', '2026-09-10', today, { n: 'first' }), run('rehab', '2026-09-12', '2026-09-14', { n: 'second' })]);
  const total = P.totals(meta, pid, '2026-09-10', today, 'train', undefined, today);
  assert.equal(total.injury, 3);
  assert.equal(total.rehab, 3);
  assert.equal(total.rest, 6);
  assert.equal(total.statusDays, 6);
  assert.equal(P.resolve(meta, pid, '2026-09-13', 'train', undefined, today).note, 'second');
});

test('multiple injury episodes count cumulatively with recovery and rehab in between', () => {
  const meta = metaOf([
    run('injury', '2026-09-01', '2026-09-03', { n: 'first episode' }),
    run('ok', '2026-09-04', '2026-09-06'),
    run('rehab', '2026-09-07', '2026-09-08'),
    run('injury', '2026-09-09', '2026-09-11', { n: 'second episode' }),
    run('ok', '2026-09-12', today)
  ]);
  const total = P.totals(meta, pid, '2026-09-01', today, day => day.endsWith('05') ? 'match' : ['2026-09-06', '2026-09-07', '2026-09-10'].includes(day) ? 'off' : 'train', 'ok', today);
  assert.deepEqual(total, { training: 5, match: 1, exercise: 6, rest: 6, injury: 6, rehab: 2, out: 0, unknown: 0, recorded: 0, statusDays: 15, currentDays: 0, days: 15, first: '2026-09-01', last: today });
});

test('unknown counts scheduled dates only, and all empty states contribute no activity', () => {
  const total = P.totals({}, pid, '2026-09-12', today, day => ({ '2026-09-12': 'off', '2026-09-13': 'none', '2026-09-14': 'match', [today]: 'train' }[day]), undefined, today);
  assert.deepEqual(total, { training: 0, match: 0, exercise: 0, rest: 0, injury: 0, rehab: 0, out: 0, unknown: 2, recorded: 0, statusDays: 0, currentDays: 0, days: 4, first: null, last: null });
});

test('rest counts every known non-ok scheduled day; injury rehab and out retain calendar counts', () => {
  let meta = {};
  ['rest', 'injury', 'rehab', 'out'].forEach((s, i) => { meta = P.record(meta, pid, `2026-09-${12 + i}`, s, i === 1 ? 'off' : 'train', i, today); });
  const total = P.totals(meta, pid, '2026-09-12', today, 'match', 'out', today);
  assert.equal(total.rest, 3);
  assert.equal(total.injury, 1);
  assert.equal(total.rehab, 1);
  assert.equal(total.out, 1);
  assert.equal(total.exercise, 0);
});

test('range bounds are inclusive and clip both episode spans and future end dates', () => {
  const meta = metaOf([run('injury', '2026-09-01', '2026-09-30')]);
  const total = P.totals(meta, pid, '2026-09-13', '2026-10-01', 'off', 'injury', today);
  assert.equal(total.injury, 3);
  assert.equal(total.first, '2026-09-13');
  assert.equal(total.last, today);
  for (const [from, to] of [['2026-09-16', '2026-09-20'], [today, '2026-09-14'], ['bad', today], ['2026-02-29', today]]) {
    assert.equal(P.totals(meta, pid, from, to, 'train', 'injury', today).days, 0);
  }
});

test('UTC calendar arithmetic counts DST transitions, leap days, year boundaries and early years exactly', () => {
  for (const [from, to, days] of [['2026-03-07', '2026-03-09', 3], ['2026-10-31', '2026-11-02', 3], ['2024-02-28', '2024-03-01', 3], ['2025-12-31', '2026-01-02', 3], ['0001-01-01', '0001-01-03', 3], ['0099-12-31', '0100-01-01', 2]]) {
    const total = P.totals(metaOf([run('injury', from, to)]), pid, from, to, 'off', 'injury', to);
    assert.equal(total.injury, days, `${from}..${to}`);
  }
});

test('schedule callback receives exact day and ID and errors remain visible', () => {
  const calls = [];
  const meta = metaOf([run('ok', '2026-09-14', today)]);
  const total = P.totals(meta, pid, '2026-09-14', today, (day, id) => { calls.push([day, id]); return day === today ? 'match' : 'train'; }, 'ok', today);
  assert.deepEqual(calls, [['2026-09-14', pid], [today, pid]]);
  assert.equal(total.training, 1);
  assert.equal(total.match, 1);
  assert.throws(() => P.totals(meta, pid, today, today, () => { throw new Error('schedule unavailable'); }, 'ok', today), /schedule unavailable/);
});

test('legacy day snapshots remain readable without migration or invented continuation', () => {
  const meta = freeze({ statusLog: { '2026-09-12': { [pid]: 'injury' }, '2026-09-14': { [pid]: 'rehab' } }, unknown: { preserved: true } });
  const before = JSON.stringify(meta);
  const total = P.totals(meta, pid, '2026-09-12', today, 'train', 'rehab', today);
  assert.equal(total.injury, 1);
  assert.equal(total.rehab, 2);
  assert.equal(total.unknown, 1);
  assert.equal(total.statusDays, 2);
  assert.equal(total.currentDays, 1);
  assert.equal(JSON.stringify(meta), before);
  assert.equal(P.resolve({ ...meta, statusRuns: {} }, pid, '2026-09-12', 'train', 'injury', today).s, 'injury');
});

test('partial status runs preserve exact legacy dates but take priority where they prove a state', () => {
  const meta = {
    statusLog: { '2026-09-10': { [pid]: 'injury' }, '2026-09-12': { [pid]: 'injury' }, '2026-09-14': { [pid]: 'injury' } },
    statusRuns: { [pid]: [run('rehab', '2026-09-12')] }
  };
  assert.equal(P.resolve(meta, pid, '2026-09-10', 'train', 'rehab', today).s, 'injury');
  assert.equal(P.resolve(meta, pid, '2026-09-11', 'train', 'rehab', today).source, 'none');
  assert.equal(P.resolve(meta, pid, '2026-09-12', 'train', 'rehab', today).s, 'rehab');
  assert.equal(P.resolve(meta, pid, '2026-09-14', 'train', 'rehab', today).s, 'rehab');
  assert.equal(P.resolve(meta, pid, '2026-09-14', 'train', 'out', today).s, 'injury');
  assert.equal(P.resolve(meta, pid, today, 'train', 'out', today).source, 'current');
});

test('actual today status creation retains both players legacy history without modifying its raw content', () => {
  const scout = fs.readFileSync(path.join(__dirname, '../studio/scout.html'), 'utf8');
  const start = scout.indexOf('function avCurrentStatus(');
  const end = scout.indexOf('async function stSetAt(', start);
  assert.ok(start >= 0 && end > start);
  const c = vm.createContext({});
  vm.runInContext(scout.slice(start, end), c);
  const meta = freeze({ statusLog: { '2026-09-10': { p: 'injury', q: 'rehab' }, '2026-09-12': { p: 'injury' } }, unknown: { preserved: true } });
  const original = JSON.stringify(meta);
  const next = P.record(meta, 'p', today, 'ok', 'train', 1, today, '복귀');
  c.avCurrentStatus(next, 'p', 'ok', today, '복귀');
  assert.equal(P.resolve(next, 'p', '2026-09-10', 'train', 'ok', today).s, 'injury');
  assert.equal(P.resolve(next, 'q', '2026-09-10', 'train', 'rehab', today).s, 'rehab');
  assert.equal(P.resolve(next, 'p', '2026-09-11', 'train', 'ok', today).source, 'none');
  assert.equal(P.resolve(next, 'q', today, 'train', 'rehab', today).source, 'current');
  assert.equal(P.resolve(next, 'p', today, 'train', 'ok', today).s, 'ok');
  assert.equal(P.totals(next, 'p', '2026-09-10', today, 'train', 'ok', today).injury, 2);
  assert.equal(P.totals(next, 'q', '2026-09-10', today, 'train', 'rehab', today).rehab, 2);
  assert.equal(JSON.stringify(meta), original);
  assert.equal(next.statusLog, meta.statusLog);
  assert.equal(next.unknown, meta.unknown);
});

for (const entry of ['stSet', 'tmStatusApply']) {
  test(`actual ${entry} return updates today's observation while preserving prior dates and metadata`, () => {
    const scout = fs.readFileSync(path.join(__dirname, '../studio/scout.html'), 'utf8');
    function block(from, to) {
      const start = scout.indexOf(from), end = scout.indexOf(to, start);
      assert.ok(start >= 0 && end > start); return scout.slice(start, end);
    }
    let writes = 0;
    let meta = metaOf([run('injury', '2026-09-10', today, { n: 'episode note', custom: { keep: true } })]);
    meta = P.record(meta, pid, '2026-09-11', 'injury', 'off', 1, today, 'past note');
    meta = P.record(meta, pid, today, 'injury', 'off', 2, today, 'day note');
    meta.participationDays[today][pid].unknown = { keep: true };
    const c = vm.createContext({
      PSParticipation: P, window: { PSParticipation: P },
      data: { players: [{ id: pid, status: 'injury' }], meta },
      stYmd: () => today,
      stAddDays: (d, n) => { const date = new Date(d + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + n); return date.toISOString().slice(0, 10); },
      plStatusOf: p => p.status, tmCanApprove: () => true, tmProposalOf: () => null,
      save: () => { writes++; }, renderTeam() {}, renderTeamHome() {}, renderStatusView() {}, toast() {}
    });
    vm.runInContext(block('function stRuns(){', 'function stStampToday(') + '\n' + block('function avUpdateTodayRecord(', 'function avCurrentStatus(') + '\n' +
      (entry === 'stSet' ? block('function stSet(pid,k)', 'function stMedToggle(') : block('function tmStatusApply(', 'function posPickOpen(')), c);
    if (entry === 'stSet') c.stSet(pid, 'ok'); else c.tmStatusApply(c.data.players[0], 'ok');
    assert.equal(writes, 1);
    assert.equal(c.data.players[0].status, 'ok');
    assert.deepEqual({ ...c.data.meta.participationDays[today][pid] }, { s: 'ok', kind: 'off', at: c.data.meta.participationDays[today][pid].at, n: 'day note', unknown: { keep: true } });
    assert.equal(c.data.meta.participationDays['2026-09-11'][pid].n, 'past note');
    assert.equal(c.data.meta.statusRuns[pid][0].n, 'episode note');
    // Legacy stRunStamp leaves the earlier run's already-stamped end in place.
    // The newer run wins that overlap, so the cumulative model counts once.
    assert.equal(c.data.meta.statusRuns[pid][0].to, today);
    assert.equal(c.data.meta.statusRuns[pid][0].custom.keep, true);
    assert.equal(P.resolve(c.data.meta, pid, today, 'train', 'ok', today).s, 'ok');
    assert.equal(P.resolve(c.data.meta, pid, '2026-09-13', 'train', 'ok', today).s, 'injury');
    assert.equal(P.totals(c.data.meta, pid, '2026-09-10', today, 'train', 'ok', today).injury, 5);
  });
}

test('independent edits merge at the exact date/player field without losing either record', () => {
  const Merge = require('../studio/autosave-merge.js');
  const base = { players: [], meta: { statusRuns: { [pid]: [run('injury', '2026-09-10', today, { n: 'preserved' })] } } };
  const local = { ...base, meta: P.record(base.meta, pid, '2026-09-12', 'rest', 'train', 1, today) };
  const remote = { ...base, meta: P.record(base.meta, 'player-b', '2026-09-12', 'ok', 'match', 2, today) };
  const merged = Merge.plan({ key: 'scout_tool_v1', base: JSON.stringify(base), local: JSON.stringify(local), remote: JSON.stringify(remote) });
  const value = JSON.parse(merged.raw);
  assert.equal(merged.needsArchive, false);
  assert.equal(value.meta.participationDays['2026-09-12'][pid].s, 'rest');
  assert.equal(value.meta.participationDays['2026-09-12']['player-b'].s, 'ok');
  assert.deepEqual(value.meta.statusRuns, base.meta.statusRuns);
});
