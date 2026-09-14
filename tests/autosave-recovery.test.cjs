'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {artifact}=require('../studio/autosave-recovery.js');
const row={id:'11111111-1111-4111-8111-111111111111',k:'sq:fixture',at:100,cupd:2,reason:'conflict',localHash:'local',remoteHash:'remote',wid:'synthetic-team'};
const value={metadata:{...row},localRaw:'  {"name":"</textarea><img src=x>","v":"한글"}\r\n\u0000',remoteRaw:'\n { "name": "다른 원문" } \t'};
test('recovery artifact round-trips both original strings without parsing or normalization',()=>{
  const before=JSON.stringify(value),result=JSON.parse(artifact(row,value));
  assert.equal(result.type,'process-studio-autosave-recovery');assert.equal(result.localRaw,value.localRaw);assert.equal(result.remoteRaw,value.remoteRaw);
  assert.equal(result.metadata.wid,row.wid);assert.equal(JSON.stringify(value),before);
});
test('recovery artifact rejects a different selected snapshot instead of exporting it',()=>{
  for(const key of ['id','k','at','cupd','reason','localHash','remoteHash'])assert.throws(()=>artifact(row,{...value,metadata:{...row,[key]:key==='at'||key==='cupd'?999:'changed'}}));
  assert.throws(()=>artifact(row,{...value,localRaw:null}));assert.throws(()=>artifact(row,{...value,remoteRaw:{}}));
});
test('empty original strings are preserved as exact values and metadata is allowlisted',()=>{
  const result=JSON.parse(artifact(row,{metadata:{...row,unrelatedPrivateField:'omit'},localRaw:'',remoteRaw:''}));
  assert.equal(result.localRaw,'');assert.equal(result.remoteRaw,'');assert.equal('unrelatedPrivateField' in result.metadata,false);
});
