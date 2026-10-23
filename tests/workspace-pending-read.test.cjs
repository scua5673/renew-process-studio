const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(require('node:path').join(__dirname,'../studio/sync.js'),'utf8');
const part=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const code=part('function outboxRead(', 'function outboxUpdateSummary(')+part('function workspaceBlockingPendingKeys(', '/* 실제 동기화 요청은');
function harness(fail){
 const c=vm.createContext({Promise,JSON,Array,Object,String,OUTBOXKEY:'queue',PERSONAL:{},localStorage:{getItem:()=>null},pJSON:(s,d)=>s==null?d:JSON.parse(s),outboxNormalizePersonal:q=>q,outboxOwner:()=> 'owner',outboxScope:(u,w)=>u+'|'+w,personalWid:()=>'',window:{storage:{get:async()=>{if(fail)throw Error('IndexedDB unavailable');return {value:JSON.stringify([{id:'one',uid:'owner',wid:'team',key:'roster'}])};}}}});
 vm.runInContext(code,c);return c;
}
for(const name of ['workspaceBlockingPendingKeys','logoutBlockingPendingKeys'])test(name+' must not treat unread IndexedDB queue as empty',async()=>{
 const c=harness(true);await assert.rejects(name==='workspaceBlockingPendingKeys'?c[name]('team'):c[name]('owner','team'),/IndexedDB unavailable/);
});
test('a verified IndexedDB-only queue still blocks switching',async()=>{const c=harness(false);assert.deepEqual(Array.from(await c.workspaceBlockingPendingKeys('team')),['roster']);});
test('ordinary non-destructive queue display keeps its offline fallback',async()=>{const c=harness(true);assert.deepEqual(Array.from(await c.outboxRead()),[]);});
