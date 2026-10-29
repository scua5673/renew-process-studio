const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../studio/idp-weekly-growth.js');
test('weekly scenes use the local Monday, omit future/empty entries, and preserve input',()=>{
  const d={log:{'2026-10-25':{memo:'last week'},'2026-10-26':{memo:'Monday'},'2026-10-29':{memo:'today',try:2},'2026-10-30':{memo:'future'},'2026-10-28':{next:'only next'}}};
  const before=JSON.stringify(d),w=W.weekData(d,{reacts:{'day:2026-10-26':{t:'why?',tAt:5}}},'2026-10-29');
  assert.equal(w.start,'2026-10-26');assert.equal(w.end,'2026-11-01');assert.deepEqual(w.scenes.map(s=>s.day),['2026-10-29','2026-10-26']);assert.equal(w.question.day,'2026-10-26');assert.equal(JSON.stringify(d),before);
});
test('no opportunity is separate from zero tries; evidence snapshots are immutable',()=>{
  const action={text:'scan',behavior:{id:'b',text:'scan'},revision:'v1'};
  assert.deepEqual(W.attemptPatch({},'none',action),{try:null,tryOpportunity:false});
  assert.equal(W.state({try:2}),'1');assert.equal(W.state({try:0}),'0');assert.equal(W.state({tryOpportunity:false}),'none');
  const first=W.attemptPatch({},'1',action);assert.deepEqual(first.visionEvidence,{id:'b',text:'scan',revision:'v1'});
  assert.equal(W.attemptPatch({visionEvidence:first.visionEvidence},'1',{...action,revision:'v2'}).visionEvidence,undefined);
  assert.equal(W.attemptPatch({},'1',{text:''}),null);assert.equal(W.attemptPatch({},'bad',action),null);
});
test('malformed and future public docs never become empty writable docs',()=>{
  for(const raw of ['{','[]','null','{"v":2}','{"v":null}','{"v":"1"}','{"reacts":[]}'])assert.equal(W.publicDoc(raw),null);
  assert.deepEqual(W.publicDoc(null),{});assert.deepEqual(W.publicDoc('{"reacts":{}}'),{reacts:{}});
});
test('calendar week is correct over year and DST boundaries',()=>{
  assert.equal(W.weekData({},null,'2027-01-01').start,'2026-12-28');
  assert.equal(W.weekData({},null,'2026-11-01').start,'2026-10-26');
});
