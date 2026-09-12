const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the shipped functions. Only rendering and persistence side effects are stubbed;
// the session mutation, draft creation, and draft acceptance rules are actual app code.
const source = fs.readFileSync(path.join(__dirname, '../studio/process.html'), 'utf8');
function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\nfunction ', start + 10);
  assert.ok(start >= 0 && end > start, 'Can extract ' + name);
  return source.slice(start, end);
}
const appCode = ['openSession', 'sessionDraftHasContent', 'commitSession', 'cancelSession'].map(functionSource).join('\n');
const copy = value => JSON.parse(JSON.stringify(value));
function harness(day = {trainings:[], rest:true, off:true}) {
  const calls = {closed:0, synced:0, rendered:0, defaults:0};
  const context = vm.createContext({
    week:[day], curSession:null, draftSession:null,
    SLOTS:['09:00', '10:30', '16:00', '19:30'], PHASE_DUR:{'메인훈련':30},
    renderSession(){ calls.rendered++; },
    sesDefaults(tr){ calls.defaults++; return tr; },
    syncViews(){ calls.synced++; },
    document:{getElementById(id){ assert.equal(id, 'scrim'); return {classList:{remove(value){assert.equal(value, 'show'); calls.closed++;}}}; }},
  });
  vm.runInContext(appCode, context);
  return {context, calls, day};
}

for (const close of ['commitSession', 'cancelSession']) {
  const existingCases = {
    'only review':{time:'16:00', blocks:[], review:{said:'스캔', key:'주변 보기'}},
    'only introduction':{blocks:[], intro:{explore:'공을 잃은 직후', watch:'첫 움직임'}},
    'current schedule schema':{slot:'S1', time:'16:00', load:{rpe:6}, blocks:[]},
    'missing legacy blocks':{slot:'S1', time:'16:00'},
    'empty existing session':{},
    'legacy aim control':{blocks:[], aims:'압박 전 스캔'},
  };
  for (const [name, tr] of Object.entries(existingCases)) {
    test(close + ' preserves an existing session: ' + name, () => {
      const sibling = {time:'18:00', aims:'다른 세션', blocks:[]};
      const day = {trainings:[tr, sibling], rest:false, off:false,
        board:{trains:['Rondo'], trainSlot:['S1'], trainData:[{psMin:15}]}};
      const before = copy(day);
      const {context:c, calls} = harness(day);
      c.openSession(0, 0);
      c[close]();
      assert.deepEqual(day, before);
      assert.equal(day.trainings[0], tr, 'Keep the existing object and all metadata');
      assert.equal(c.curSession, null);
      assert.equal(calls.closed, 1);
      assert.equal(calls.synced, 1);
      assert.equal(calls.defaults, 0);
    });
  }
}

test('completing an untouched wizard does not save seeded time, RPE, and blank block', () => {
  const {context:c, calls, day} = harness();
  const before = copy(day);
  c.openSession(0, null);
  assert.equal(c.draftSession.time, '09:00');
  assert.equal(c.draftSession.load.rpe, 5);
  assert.equal(c.draftSession.blocks[0].dur, 30);
  c.commitSession();
  assert.deepEqual(day, before);
  assert.equal(c.draftSession, null);
  assert.equal(calls.defaults, 0);
});

const draftChanges = {
  'memo only':tr => {tr.blocks=[]; tr.note='코칭 포인트';},
  'introduction only':tr => {tr.blocks=[]; tr.intro={watch:'가까운 동료'};},
  'review only':tr => {tr.blocks=[]; tr.review={said:'공간을 봤다'};},
  'participant count':tr => {tr.players=18;},
  'changed time':tr => {tr.time='17:30';},
  'changed RPE':tr => {tr.load={rpe:7};},
  'recovery intensity':tr => {tr.load={rec:true};},
  'game-model phase':tr => {tr.gmPhases=['ao'];},
  'game-model principle':tr => {tr.gmTags=['전진 공간'];},
  'changed block duration':tr => {tr.blocks[0].dur=20;},
  'changed block phase':tr => {tr.blocks[0].phase='웜업';},
  'block description':tr => {tr.blocks[0].desc='Rondo 4v2';},
  'board-only block':tr => {tr.blocks=[{board:{snap:{tokens:[{id:'p1',x:10,y:20}]}}}];},
};
for (const [name, change] of Object.entries(draftChanges)) {
  test('completing a new draft keeps ' + name, () => {
    const {context:c, calls, day} = harness();
    c.openSession(0, null);
    change(c.draftSession);
    const draft = c.draftSession;
    c.commitSession();
    assert.equal(day.trainings.length, 1);
    assert.equal(day.trainings[0], draft);
    assert.equal(day.rest, false);
    assert.equal(day.off, false);
    assert.equal(c.draftSession, null);
    assert.equal(c.curSession, null);
    assert.equal(calls.defaults, 1);
    assert.equal('draftSeed' in day.trainings[0], false, 'Draft bookkeeping is not persisted');
  });
}

for (const [names, slots, data] of [
  ['trains','trainSlot','trainData'], ['warms','warmSlot','warmsData'],
  ['meets','meetSlot','meetsData'], ['libs','libSlot','libData'],
]) {
  test('new draft accepts only its own board slot: ' + names, () => {
    const {context:c, day} = harness();
    c.openSession(0, null);
    c.draftSession.slot='S-new';
    day.board={[names]:['Rondo'], [slots]:['S-other'], [data]:[{minutes:15}]};
    assert.equal(c.sessionDraftHasContent(c.draftSession, day, c.curSession.draftSeed), false);
    day.board[slots][0]='S-new';
    assert.equal(c.sessionDraftHasContent(c.draftSession, day, c.curSession.draftSeed), true);
    c.commitSession();
    assert.equal(day.trainings.length, 1);
    assert.equal(day.board[names][0], 'Rondo');
  });
}

test('clearing defaults or adding blank text does not turn an untouched draft into content', () => {
  const {context:c, day} = harness();
  c.openSession(0, null);
  c.draftSession.blocks=[];
  c.draftSession.intro={watch:'  '};
  c.draftSession.review={said:''};
  c.draftSession.note='\n ';
  c.draftSession.load=null;
  c.draftSession.time='';
  c.commitSession();
  assert.equal(day.trainings.length, 0);
  assert.equal(day.rest, true);
});

test('changing RPE and returning to the initial value leaves the draft untouched', () => {
  const {context:c, day} = harness();
  c.openSession(0, null);
  c.draftSession.load={rpe:8};
  assert.equal(c.sessionDraftHasContent(c.draftSession, day, c.curSession.draftSeed), true);
  c.draftSession.load={rpe:5};
  c.commitSession();
  assert.equal(day.trainings.length, 0);
});

test('cancel discards a newly edited draft and preserves existing sessions and day flags', () => {
  const day = {trainings:[{aims:'기존 훈련'}], rest:false, off:false};
  const before = copy(day);
  const {context:c, calls} = harness(day);
  c.openSession(0, null);
  c.draftSession.review={said:'새 초안'};
  c.cancelSession();
  assert.deepEqual(day, before);
  assert.equal(c.draftSession, null);
  assert.equal(c.curSession, null);
  assert.equal(calls.defaults, 0);
});

test('late duplicate close events do nothing after the editor has closed', () => {
  const {context:c, calls, day} = harness();
  c.commitSession();
  c.cancelSession();
  assert.equal(day.trainings.length, 0);
  assert.equal(calls.closed, 0);
  assert.equal(calls.synced, 0);
});
