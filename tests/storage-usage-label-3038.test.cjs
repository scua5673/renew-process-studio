'use strict';
/* 3.038 — 앱 설정 › 기기 › 저장 공간 줄이 «큰 항목 5.0MB» 크기만 말해 무엇을 줄일지 몰랐다(사용자 «이름도 보이게»).
   이제 «큰 항목 선수단·스카우트 5.0MB» + (주황 · 빨강일 때) 줄이는 길 한 줄. 안전 정리 결과 창도 같은 이름. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const app=R('studio/app.html'),storage=R('studio/storage.js'),sync=R('studio/sync.js');
function part(src,start,end){const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return src.slice(a,b);}
const labels=part(storage,'  var SPACE_LABEL={','  /* 비동기 본 저장 전에');
const usage=part(app,"  function mb(n){return (Math.max(0,+n||0)/1048576).toFixed(n>=10485760?0:1)+'MB';}\n  /* 3.038","  window.__psUpdateStorageUsage=updateStorageUsage;");
const MB=1048576;
function run({local,largest,syncLabels={}}){
  const el={style:{},children:[],_t:'',set textContent(v){this._t=v;this.children=[];},get textContent(){return this._t+this.children.map(c=>c.textContent).join('');},
    appendChild(c){this.children.push(c);}};
  const c={Promise,document:{getElementById:id=>id==='psStorageUsage'?el:null,createElement:()=>({style:{},textContent:''})}};
  c.window=c;vm.createContext(c);
  vm.runInContext(labels+'\nthis.PSStorage={localBytes:()=>'+local+',estimate:()=>Promise.resolve({usage:'+(108*MB)+'}),largestLocal:()=>'+JSON.stringify(largest)+',spaceLabel:k=>spaceLabel(k)};\n'+usage+'\nthis.update=updateStorageUsage;',c);
  c.PSSync={keyLabel:k=>syncLabels[k]||k};
  c.update();
  return new Promise(r=>setImmediate(()=>r({text:el._t,hint:el.children.map(x=>x.textContent),color:el.style.color})));
}

test('the largest item is named, with how to shrink it, when the line is red', async () => {
  const r=await run({local:7.2*MB,largest:[{key:'scout_tool_v1',bytes:5*MB}]});
  assert.equal(r.text,'빠른 저장 7.2MB · 전체 108MB · 큰 항목 선수단·스카우트 5.0MB');
  assert.deepEqual(r.hint,['선수 사진이 대부분입니다 — 선수 프로필에서 사진을 지우면 크게 줄어요']);
  assert.equal(r.color,'#C24A46');
});

test('keys storage.js has no name for fall back to the sync name, then the raw key', async () => {
  let r=await run({local:4.5*MB,largest:[{key:'cs_meet_sit_v1',bytes:2*MB}],syncLabels:{cs_meet_sit_v1:'미팅'}});
  assert.equal(r.text,'빠른 저장 4.5MB · 전체 108MB · 큰 항목 미팅 2.0MB');
  assert.deepEqual(r.hint,[],'no shrink hint when none is known');
  r=await run({local:1*MB,largest:[{key:'cs_unknown_v9',bytes:0.6*MB}]});
  assert.equal(r.text,'빠른 저장 1.0MB · 전체 108MB · 큰 항목 cs_unknown_v9 0.6MB');
});

test('the shrink hint stays hidden while the line is grey', async () => {
  const r=await run({local:2*MB,largest:[{key:'cs_board_live_v1',bytes:1.2*MB}]});
  assert.equal(r.text,'빠른 저장 2.0MB · 전체 108MB · 큰 항목 작업 중인 작전판 1.2MB');
  assert.deepEqual(r.hint,[]);
  assert.equal(r.color,'#646A73');
});

test('the safe-cleanup result names the largest item and both helpers are exported', () => {
  assert.match(app,/var L0=bigLabel\(r\.largest\[0\]\.key\);[^\n]*\n\s*msg\+='\\n가장 큰 빠른 저장 항목은 «'\+L0\[0\]\+'» '/);
  assert.match(storage,/\n    spaceLabel:function\(k\)\{ return spaceLabel\(k\); \},/);
  assert.match(sync,/\n  keyLabel:keyLabel,/);
});
