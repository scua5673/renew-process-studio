'use strict';
/* 3.264 — 판 파일 하나가 한 번 안 받아지면 install 전체가 실패해 옛 판에 남았다(7일 sw_redundant 78번). 끊김·5xx 는 세 번, 4xx 는 바로. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
function slice(a,b){const i=sw.indexOf(a),j=sw.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return sw.slice(i,j);}
const CODE=sw.match(/^const CACHE = '[^']+';/m)[0]+'\n'+slice('async function fetchFresh','const MANIFEST');
function run(responses){
  const calls=[],messages=[],delays=[];
  const ctx={self:{clients:{matchAll:async()=>[{postMessage:m=>messages.push(m)}]}},setTimeout:(f,ms)=>{delays.push(ms);f();},Error,String,Promise,
    fetch:async(path)=>{calls.push(path);const r=responses.shift();if(r instanceof Error)throw r;return r;}};
  vm.createContext(ctx);vm.runInContext(CODE+'\nthis.api={fetchFresh,notifyInstallFailed};',ctx);
  return {api:ctx.api,calls,messages,delays};
}
const ok={ok:true,status:200},net=()=>new TypeError('Failed to fetch');
test('끊긴 연결은 두 번 더 받아 본다(500ms · 1000ms) 그리고 성공한 응답을 돌려준다',async()=>{
  const f=run([net(),{ok:false,status:503},ok]);
  assert.equal(await f.api.fetchFresh('/studio/app.html'),ok);assert.equal(f.calls.length,3);assert.deepEqual(f.delays,[500,1000]);
});
test('세 번 다 끊기면 마지막 오류로 실패한다',async()=>{
  const f=run([net(),net(),net()]);
  await assert.rejects(f.api.fetchFresh('/studio/x.js'),/Failed to fetch/);assert.equal(f.calls.length,3);
});
test('없는 파일(404)은 다시 받지 않고 바로 실패한다 — 배포에 빠진 파일을 기다리지 않는다',async()=>{
  const f=run([{ok:false,status:404},ok]);
  await assert.rejects(f.api.fetchFresh('/studio/missing.js'),/precache-failed:\/studio\/missing.js:404/);assert.equal(f.calls.length,1);assert.deepEqual(f.delays,[]);
});
test('막은 파일 이름과 까닭만 열린 화면에 알린다(내용 없음)',async()=>{
  const f=run([]);await f.api.notifyInstallFailed('/studio/board-phone-view.js',new Error('precache-failed:/studio/board-phone-view.js:503'));
  assert.equal(f.messages.length,1);
  assert.equal(f.messages[0].type,'ps-sw-install-failed');assert.equal(f.messages[0].path,'board-phone-view.js');assert.match(f.messages[0].reason,/503/);assert.match(f.messages[0].release,/^process-3\.\d{3}$/);
});

/* 실제 install 로 — 필수 파일이 503 두 번 뒤 받아지면 설치가 되고, 404 면 설치가 실패하며 열린 화면이 파일 이름을 받는다 */
function installHarness(status){
  const store=new Map(),fetched=[],messages=[];
  const mk=name=>{if(!store.has(name))store.set(name,new Map());const m=store.get(name);return {match:async p=>{const r=m.get(typeof p==='string'?p:p.url);return r?r.clone():undefined;},put:async(p,r)=>{m.set(typeof p==='string'?p:p.url,r);},keys:async()=>[...m.keys()].map(u=>({url:u})),delete:async p=>m.delete(p)};};
  const caches={open:async n=>mk(n),keys:async()=>[...store.keys()],delete:async n=>store.delete(n)};
  const fetchFn=async(p)=>{fetched.push(p);if(p==='/sw-manifest.json')return new Response('nope',{status:404});
    if(p==='/studio/storage.js'){const n=fetched.filter(x=>x===p).length;const st=status(n);if(st!==200)return new Response('x',{status:st});}
    return new Response('body:'+p);};
  const listeners={};
  const self={addEventListener:(t,f)=>{listeners[t]=f;},location:{origin:'https://x.test'},skipWaiting:async()=>{},clients:{matchAll:async()=>[{postMessage:m=>messages.push(m)}],claim:async()=>{}},crypto:globalThis.crypto};
  const ctx={self,caches,fetch:fetchFn,Response,URL,crypto:globalThis.crypto,console,setTimeout:(f)=>f(),Promise,Uint8Array,Array,JSON,Date,Set,Map,Object,Error,String};
  vm.createContext(ctx);vm.runInContext(sw,ctx);
  return {fetched,messages,install:async()=>{let p;listeners.install({waitUntil:x=>{p=x;}});await p;}};
}
test('install — 필수 파일이 503 두 번 뒤 받아지면 설치가 된다',async()=>{
  const h=installHarness(n=>n<3?503:200);await h.install();
  assert.equal(h.fetched.filter(p=>p==='/studio/storage.js').length,3);assert.equal(h.messages.filter(m=>m.type==='ps-sw-install-failed').length,0);
});
test('install — 필수 파일이 404 면 바로 실패하고 열린 화면이 파일 이름을 받는다',async()=>{
  const h=installHarness(()=>404);await assert.rejects(h.install(),/precache-failed:\/studio\/storage\.js:404/);
  assert.equal(h.fetched.filter(p=>p==='/studio/storage.js').length,1);
  const m=h.messages.filter(m=>m.type==='ps-sw-install-failed');assert.equal(m.length,1);assert.equal(m[0].path,'storage.js');
});
