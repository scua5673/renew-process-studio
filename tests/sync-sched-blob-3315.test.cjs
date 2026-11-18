'use strict';
/* 3.315 — 일정(BLOB_KEYS 2)은 기기 사본도 참조만: 받을 때 그림은 캐시에만(schedHydrate keep), 올릴 때 이 기기에서 만든 참조의 그림을 서버에(PSSchedBlob.ensure),
   그림을 품은 옛 기기 사본은 회차가 뗀 같은 문서로(PSSchedBlob.diet — 회차 시험은 schedule-readiness). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const PSSchedBlob=require('../studio/sync-sched-blob.js');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
const H='0123456789abcdef01234567',G='fedcba9876543210fedcba98',segment=s=>JSON.stringify(s).slice(1,-1);
const THUMB='<svg viewBox="0 0 10 10">'+'<circle r="1"/>'.repeat(60)+'</svg>',LOGO='data:image/png;base64,'+'Q'.repeat(900);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,24);
function harness(cacheEntries=[],serverEntries=[],opt={}){
  const cache=new Map(cacheEntries.map(([h,v])=>['ps_blob:'+h,v])),server=new Map(serverEntries),calls=[],writes=[],rows=[],pushed=[];
  const c={console,Promise,JSON,Uint8Array,TextEncoder,crypto:crypto.webcrypto,BASE:'https://synthetic.invalid',KV_PULL_CHUNK:40,PSSchedBlob,
    storage:{async get(k){return cache.has(k)?{value:cache.get(k)}:null;},async set(k,v){writes.push(k);cache.set(k,v);return {value:v};}},
    hj:()=>({}),kvInFilter:keys=>'k=in.('+keys.join(',')+')',syncDiagnostic(){},syncHttpError:(stage,status)=>Error(stage+' '+status),
    ensureToken:async()=>'token',activeWs:()=>'team-a',
    async syncFetch(stage,url,o){calls.push({stage,url});
      if(stage==='kv_pull')return {ok:true,json:async()=>rows.map(x=>({...x}))};
      if(stage==='blob_have')return {ok:true,status:opt.haveStatus||200,json:async()=>[...server.keys()].map(h=>({h}))};
      if(stage==='blob_push'){JSON.parse(o.body).forEach(b=>{pushed.push(b.h);server.set(b.h,b.v);});return {ok:true,status:200};}
      assert.equal(stage,'blob_pull');const filter=decodeURIComponent(url);return {ok:true,json:async()=>[...server].filter(([h])=>filter.includes(h)).map(([h,v])=>({h,v}))};}
  };c.window=c;vm.createContext(c);
  vm.runInContext(section('var BLOB_MIN=','/* ══ 2.727')+'\n'+section('function kvPullValues(','/* 청크 하나가'),c);
  return {c,cache,calls,writes,rows,server,pushed};
}
const schedRaw=JSON.stringify({anchorMonday:'2026-09-28',weeks:{'0':{'1':[{id:'s1',thumb:'',thumbRef:G,title:'훈련'}]}}});
const hydratedRaw=JSON.stringify({anchorMonday:'2026-09-28',weeks:{'0':{'1':[{id:'s1',thumb:THUMB,title:'훈련'}]}}});

test('BLOB_KEYS marks the schedule as reference-only on device (2) and the roster as hydrated (1)',()=>{
  const h=harness();assert.equal(h.c.BLOB_KEYS.process_coach_v1,2);assert.equal(h.c.BLOB_KEYS.scout_tool_v1,1);
});

test('kvPullValues keeps the schedule references and only fills this device cache from the server',async()=>{
  const h=harness([],[[G,segment(THUMB)]]);
  h.rows.push({k:'process_coach_v1',v:schedRaw,cupd:7});
  const result=await h.c.kvPullValues('token','team-a',['process_coach_v1']);
  assert.equal(result[0].v,schedRaw,'문서는 서버 모양 그대로');assert.equal(result[0].cupd,7);
  assert.equal(h.calls.filter(x=>x.stage==='blob_pull').length,1);assert.equal(h.cache.get('ps_blob:'+G),segment(THUMB),'그림은 캐시에');
  const again=await h.c.kvPullValues('token','team-a',['process_coach_v1']);assert.equal(again[0].v,schedRaw);assert.equal(h.calls.filter(x=>x.stage==='blob_pull').length,1,'캐시에 있으면 다시 받지 않는다');
});

test('kvPullValues still restores the roster emblem into the document',async()=>{
  const h=harness([],[[H,segment(LOGO)]]);
  h.rows.push({k:'scout_tool_v1',v:JSON.stringify({meta:{emblem:'',emblemRef:H},players:[]}),cupd:1});
  const result=await h.c.kvPullValues('token','team-a',['scout_tool_v1']);assert.equal(JSON.parse(result[0].v).meta.emblem,LOGO);
});

test('schedHydrate(keep) caches and returns the original bytes; without keep it restores as before',async()=>{
  const h=harness([],[[G,segment(THUMB)]]);
  assert.equal(await h.c.schedHydrate('token','team-a',schedRaw,true),schedRaw);assert.equal(h.cache.get('ps_blob:'+G),segment(THUMB));
  assert.equal(JSON.parse(await h.c.schedHydrate('token','team-a',schedRaw)).weeks['0']['1'][0].thumb,THUMB);
});

test('PSSchedBlob.inline / diet: a hydrated device copy is stripped once, its pictures cached, and the same copy is not stripped again',async()=>{
  PSSchedBlob.reset();const h=harness();let strips=0;const strip=raw=>{strips++;return h.c.schedStrip(raw);};
  assert.equal(PSSchedBlob.inline(schedRaw),false);assert.equal(PSSchedBlob.inline(hydratedRaw),true);assert.equal(PSSchedBlob.inline(null),false);
  assert.equal(await PSSchedBlob.diet(schedRaw,strip,h.c.blobCacheSet),null);assert.equal(strips,0);
  const d=await PSSchedBlob.diet(hydratedRaw,strip,h.c.blobCacheSet);
  assert.equal(d.from,hydratedRaw);assert.equal(strips,1);
  const ref=sha(segment(THUMB));assert.ok(d.v.includes('"thumb":"","thumbRef":"'+ref+'"'));assert.equal(h.cache.get('ps_blob:'+ref),segment(THUMB));
  assert.equal(JSON.parse(d.v).weeks['0']['1'][0].title,'훈련');
  const d2=await PSSchedBlob.diet(hydratedRaw,strip,h.c.blobCacheSet);assert.equal(d2,d);assert.equal(strips,1,'같은 원문은 한 번만');
  assert.equal(await h.c.schedHydrate('token','team-a',d.v),hydratedRaw,'캐시로 되돌리면 원문 그대로(바이트 정확)');
});

test('PSSchedBlob.ensure uploads only the referenced pictures this device holds, once per workspace',async()=>{
  PSSchedBlob.reset();const h=harness([[H,segment(THUMB)]],[[G,segment(LOGO)]]);
  const row={workspace_id:'team-a',k:'process_coach_v1',v:JSON.stringify({weeks:{'0':{'1':[{thumb:'',thumbRef:H},{thumb:'',thumbRef:G},{thumb:'',thumbRef:'ffffffffffffffffffffffff'}]}}})};
  const io={refs:h.c.schedRefs,get:h.c.blobCacheGet,ensure:h.c.blobEnsure,parts:h.c.schedRefParts,restore:h.c.schedRestore};
  assert.equal(await PSSchedBlob.ensure('token',row,io),true);
  assert.deepEqual(h.pushed,[H],'서버에 없고 이 기기 캐시에 있는 그림만 올린다');assert.equal(h.calls.filter(x=>x.stage==='blob_have').length,1);
  const before=row.v;assert.equal(await PSSchedBlob.ensure('token',row,io),true);assert.equal(h.calls.filter(x=>x.stage==='blob_have').length,1,'확인한 참조는 다시 묻지 않는다');assert.equal(row.v,before);
});

test('PSSchedBlob.ensure leaves the row as references when the server cannot take blobs, and retries on the next push',async()=>{
  PSSchedBlob.reset();const h=harness([[H,segment(THUMB)]],[],{haveStatus:404});
  const raw=JSON.stringify({weeks:{'0':{'1':[{id:'s1',thumb:'',thumbRef:H}]}}}),row={workspace_id:'team-a',k:'process_coach_v1',v:raw};
  const io={refs:h.c.schedRefs,get:h.c.blobCacheGet,ensure:h.c.blobEnsure,parts:h.c.schedRefParts,restore:h.c.schedRestore};
  assert.equal(await PSSchedBlob.ensure('token',row,io),false);
  assert.equal(row.v,raw,'행은 참조 그대로 — 캐시의 서버 그림까지 되넣어 큰 문서를 만들지 않는다');assert.equal(h.c.blobOff,true);
  h.c.blobOff=false;assert.equal(await PSSchedBlob.ensure('token',row,io),false,'서버가 아직 404 — 다음에 또');assert.equal(h.calls.filter(x=>x.stage==='blob_have').length,2);
});

test('blobPrepRows asks PSSchedBlob to ensure a stripped schedule row and leaves other rows alone',async()=>{
  PSSchedBlob.reset();const h=harness([[H,segment(THUMB)]],[]);
  const rows=[{workspace_id:'team-a',k:'process_coach_v1',v:JSON.stringify({weeks:{'0':{'1':[{thumb:'',thumbRef:H}]}}})},{workspace_id:'team-a',k:'cs_squad_v1',v:'{"players":[]}'}];
  await h.c.blobPrepRows('token',rows);
  assert.deepEqual(h.pushed,[H]);assert.ok(rows[0].v.includes('"thumbRef":"'+H+'"'));assert.equal(rows[1].v,'{"players":[]}');
});

test('blobPrepRows strips a hydrated schedule row as before, then nothing more is uploaded for it',async()=>{
  PSSchedBlob.reset();const h=harness([],[]);
  const rows=[{workspace_id:'team-a',k:'process_coach_v1',v:hydratedRaw}];
  await h.c.blobPrepRows('token',rows);
  const ref=sha(segment(THUMB));assert.ok(rows[0].v.includes('"thumbRef":"'+ref+'"'));assert.deepEqual(h.pushed,[ref]);assert.equal(h.calls.filter(x=>x.stage==='blob_push').length,1);
});

test('the PSSync.blob export keeps schedule references, exposes fetch and the sync hash',()=>{
  const line=section('  blob:{hydrate:function(raw){','syncObservationStart();');
  assert.match(line,/schedHydrate\(at,activeWs\(\),raw,\/"thumbRef"\\s\*:\/\.test\(raw\)\)/);
  assert.match(line,/fetch:function\(hs\)\{ return ensureToken\(\)\.then\(function\(at\)\{ return blobFetchMap\(at,activeWs\(\),hs\); \}\)/);
  assert.match(line,/hash:blobHash/);
});
