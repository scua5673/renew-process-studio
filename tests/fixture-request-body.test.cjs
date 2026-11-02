'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const reader=import('./fixtures/request-body.mjs');
async function* chunks(values){for(const value of values)yield value;}
test('fixture request body preserves Korean and emoji across every byte boundary',async()=>{
 const {readRequestBody}=await reader,raw=JSON.stringify({v:'장도현 · 김민준 ⚽️ 🏃🏽'}),bytes=Buffer.from(raw);
 for(let split=1;split<bytes.length;split++)assert.equal(await readRequestBody(chunks([bytes.subarray(0,split),bytes.subarray(split)])),raw,'split '+split);
 assert.equal(await readRequestBody(chunks([...bytes].map(b=>Buffer.from([b])))),raw);
});
test('fixture request body preserves empty and ordinary JSON bodies',async()=>{
 const {readRequestBody}=await reader;assert.equal(await readRequestBody(chunks([])),'');
 assert.equal(await readRequestBody(chunks([Buffer.from('{"n":'),Buffer.from('14}')])),'{"n":14}');
});
test('fixture request body propagates interrupted requests without accepting partial JSON',async()=>{
 const {readRequestBody}=await reader,error=Error('connection reset');
 async function* broken(){yield Buffer.from('{"v":');throw error;}
 await assert.rejects(readRequestBody(broken()),e=>e===error);
});
