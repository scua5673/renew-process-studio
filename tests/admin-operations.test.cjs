const test=require('node:test');const assert=require('node:assert/strict');const O=require('../studio/admin-operations.js');
const now=Date.parse('2026-09-13T12:00:00Z');const clear={received_at:new Date(now).toISOString(),pending_team:0,pending_personal:0,held:0,skipped:0,deferred:0,conflicts:0,error_code:null};
test('old clean reports never imply current health',()=>{assert.equal(O.classifyReport({...clear,received_at:new Date(now-601000).toISOString()},now).kind,'stale');});
test('unknown counts do not coerce to clear',()=>{assert.equal(O.classifyReport({...clear,pending_personal:null},now).kind,'unknown');assert.equal(O.classifyReport({...clear,held:'0'},now).kind,'unknown');});
test('personal or conflict failures remain visible with team queue zero',()=>{assert.equal(O.classifyReport({...clear,pending_personal:1},now).kind,'attention');assert.equal(O.classifyReport({...clear,conflicts:1},now).kind,'attention');});
test('invalid timestamp never means recent',()=>{assert.equal(O.classifyReport({...clear,received_at:'bad'},now).kind,'stale');});
test('verified and closed followups leave the action queue',()=>{const rows=[{id:1,status:'closed'},{id:2,status:'verified'},{id:3,status:'open',next_check_at:'2026-10-01'},{id:4,status:'deployed',next_check_at:'2026-09-14'}];assert.deepEqual(O.dueFollowups(rows,now).map(x=>x.id),[4,3]);});
