'use strict';
/* 3.012 — 기기 오류 기록기(storage.js «초경량 에러 리포터», cs_errlog_v1 → ps_err)는 무해한 ResizeObserver 경고를 쌓지 않는다.
   앱 전체 점검(폰 크기에서 탭 오가기)에서 이 경고만 ps_err 로 세 번 나갔다 — 화면 오류 막대(app.html·board.html)는 2.737 부터 거른다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ST=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
function slice(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i+1);assert.ok(i>=0&&j>i,'block '+a);return src.slice(i,j);}
const CODE=slice(ST,'/* ── 초경량 에러 리포터','/* PROCESS STUDIO — 사진 보관소');
function run(){
  const store={},listeners={},timers=[];
  const localStorage={getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);}};
  const window={addEventListener:(t,f)=>{listeners[t]=f;},PS_SYNC:null,parent:null};
  window.parent=window;
  const c=vm.createContext({window,localStorage,location:{pathname:'/studio/board.html'},navigator:{onLine:false,userAgent:'test'},setTimeout:(f)=>{timers.push(f);return timers.length;},fetch(){throw new Error('no fetch');},JSON,String,Date,Math});
  vm.runInContext(CODE,c);
  return {fire:(t,e)=>listeners[t](e),log:()=>JSON.parse(store.cs_errlog_v1||'[]')};
}
test('ResizeObserver loop warnings are not recorded or sent',()=>{
  const h=run();
  h.fire('error',{message:'ResizeObserver loop completed with undelivered notifications.',filename:'board.html',lineno:0});
  h.fire('error',{message:'ResizeObserver loop limit exceeded',filename:'board.html',lineno:0});
  assert.deepEqual(h.log(),[]);
});
test('real errors are still recorded',()=>{
  const h=run();
  h.fire('error',{message:"Cannot read properties of null (reading 'x')",filename:'https://x/studio/board.html?v=3.012',lineno:12});
  h.fire('unhandledrejection',{reason:new Error('save failed')});
  const log=h.log();
  assert.equal(log.length,2);assert.equal(log[0].m,"Cannot read properties of null (reading 'x')");assert.equal(log[0].s,'board.html?v=3.012');assert.equal(log[1].k,'rej');
});
