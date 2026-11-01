const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(require('node:path').join(__dirname,'../studio/sync.js'),'utf8'),a=s.indexOf('function safeEventMeta(meta){'),b=s.indexOf('\n/*',a),c={};vm.createContext(c);vm.runInContext(s.slice(a,b),c);
test('real event serialization preserves only validated update identity and versions',()=>{
 const clean=JSON.parse(JSON.stringify(c.safeEventMeta({from:'4.001',to:'4.002',update_id:'m1234567-a89bcdef',stage:'deferred',reason:'flush_fail:fBoard',mins:10})));
 assert.equal(clean.from,'4.001');assert.equal(clean.to,'4.002');assert.equal(clean.update_id,'m1234567-a89bcdef');assert.equal(clean.mins,10);
 const bad=JSON.parse(JSON.stringify(c.safeEventMeta({from:'private draft',to:'https://example.com?token=secret',update_id:'coach@example.com',access_token:'secret',draft:'private'})));
 assert.deepEqual(bad,{});
});
