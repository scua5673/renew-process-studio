'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../studio/sync-size.js');
const KEY='process_coach_v1',keys={[KEY]:1},limit=3500000;
const pictures=()=>JSON.stringify({weeks:{0:[{trainings:[{blocks:Array.from({length:64},(_,i)=>({name:'가상 '+i,thumb:'<svg>'+i+'x'.repeat(56000)+'</svg>'}))}]}]}});
test('a large hydrated schedule is eligible for its existing image extraction',()=>{
  const raw=pictures();assert.ok(raw.length>limit);assert.equal(S.fits(raw,limit,true),true);
  assert.equal(S.fits(raw,limit,false),false);assert.equal(S.fits(raw,limit,undefined),false);
});
test('large non-image text, unsupported images and oversized pictures remain blocked',()=>{
  for(const raw of [JSON.stringify({note:'x'.repeat(limit)}),JSON.stringify({photo:'x'.repeat(limit)}),JSON.stringify({thumb:'x'.repeat(limit)}),JSON.stringify({thumbs:Array(300).fill({thumb:'x'.repeat(56000)})})])assert.equal(S.fits(raw,limit,true),false);
});
test('projection includes reference overhead and preserves whitespace and escaped contents',()=>{
  for(const key of ['thumb','emblem']){
    const raw='{ "'+key+'":  '+JSON.stringify('a"b\\c'.repeat(300))+', "note":"kept" }';
    const wire=raw.replace(/"(thumb|emblem)":(\s*)"((?:[^"\\]|\\.){512,})"/g,(_,k,ws)=>'"'+k+'":'+ws+'"","'+k+'Ref":"'+'0'.repeat(24)+'"');
    assert.equal(S.fits(raw,wire.length,true),true);assert.equal(S.fits(raw,wire.length-1,true),false);
  }
});
test('failed extraction cannot send a hydrated oversized fallback or acknowledge it',()=>{
  const raw=pictures(),row={k:KEY,v:raw};
  assert.throws(()=>S.check([row],keys,()=>limit),e=>e.psCode==='sync_storage'&&e.psStage==='kv_wire_size');
  assert.equal(row.v,raw);
  assert.doesNotThrow(()=>S.check([{k:KEY,v:'{"weeks":{},"thumbRef":"fixture"}'}],keys,()=>limit));
  assert.doesNotThrow(()=>S.check([{k:'private-document',v:raw}],keys,()=>limit),'private channel has its own larger limit');
});
