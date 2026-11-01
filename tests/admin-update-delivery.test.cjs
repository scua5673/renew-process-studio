const test=require('node:test'),assert=require('node:assert/strict'),{group,html,create}=require('../studio/admin-update-delivery.js');
const now=Date.now();
const event=(stage,minutes,extra={})=>({id:'1',user_id:'coach',device:'tablet',created_at:new Date(now).toISOString(),meta:{stage,mins:minutes,update_id:'session-a',from:'4.001',to:'4.002',reason:'flush_fail:fScout',...extra}});
test('elapsed delay, recent signals and completion decide the list, not release distance',()=>{
 const rows=[event('deferred',20),event('available',0,{update_id:'new'}),{...event('deferred',80,{update_id:'old'}),created_at:new Date(now-3*3600000).toISOString()}];
 assert.equal(group(rows,now).length,1);assert.equal(group(rows,now)[0].id,'session-a');assert.equal(group([...rows,event('applied',20)],now).length,0);
 assert.equal(group([event('check_failed',0)],now).length,1);
});
test('same device type with different sessions remains separate and partial results are explicit',()=>{
 const rows=[event('deferred',20),event('deferred',30,{update_id:'session-b',reason:'<script>'})];assert.equal(group(rows,now).length,2);
 const out=html(rows,now,true);assert.match(out,/일부 기록/);assert.match(out,/&lt;script&gt;/);assert.match(out,/기기 대수나 현재 온라인 여부를 뜻하지/);
});
test('query failure and changed administrator never turn into an empty success',async()=>{
 const host={innerHTML:'',querySelectorAll:()=>[]};await create({host,request:async()=>{throw Error('denied');}}).load();assert.match(host.innerHTML,/확인하지 못했습니다/);
 let valid=true;await create({host,request:async()=>{valid=false;return [];}}).load(()=>valid);assert.doesNotMatch(host.innerHTML,/장기 대기 세션이 확인되지/);
});
