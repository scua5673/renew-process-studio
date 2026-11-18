'use strict';
/* 저장 계층 정리 0단계 ③ — 기기별 사용량 보고(studio/storage.js usageReport + 파일 끝의 하루 한 번 예약).
   10월 이후 «저장공간 부족» 제보 넷(a4d77bba · 095358c2 · 419fead1 · e6fc5d26)은 매번 작은 저장소를 채운 주인이 달랐는데,
   storage_full 은 가득 찬 뒤에야 남아 «누가 채워 가는지»를 미리 볼 수 없었다. 이제 로그인한 기기가 하루 한 번 ps_events storage_usage 에
   «누가 얼마나»(키 표 이름 · KB)만 남긴다 — 내용 · 키 전체 이름(선수 id · 계정 id)은 보내지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','studio','storage.js'),'utf8');
const K=require('../studio/storage-keys.js');
const MB=1048576;
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
const tick=()=>new Promise(r=>setImmediate(r));
function fakeLocal(entries,opts){
  const m=new Map(entries),o=opts||{};
  return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(k)?m.get(k):null,
    setItem:(k,v)=>{if(o.full)throw new Error('QuotaExceededError');m.set(k,String(v));},removeItem:k=>{m.delete(k);},map:m};
}
function reporter({local,estimate,installed=false}){
  const events=[],timers=[];
  const c=vm.createContext({Promise,Object,String,JSON,Date,Math,console:{warn(){}},localStorage:local,
    navigator:{storage:estimate===undefined?null:{estimate:()=>estimate}},
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
    PSStorageKeys:K,PSSync:{event:(name,opts)=>events.push({name,opts})}});
  c.window=c;c.top=c;c.PSStorage={isInstalled:()=>installed};
  vm.runInContext(section('  function fullName(k){','  function fullReadContext(){'),c);
  return {c,events,timers};
}
const bytes=(k,v)=>(k.length+v.length)*2;
const kb=(k,v)=>Math.round(bytes(k,v)/1024);

test('storage_usage carries table names and kilobytes only — no content, no full key names',async()=>{
  const rows=[['scout_tool_v1','x'.repeat(3000)],['ps_private_board_draft_v1:u-77:unsaved','y'.repeat(2000)],['ps_private_board_draft_v1:u-77:kept:1','z'.repeat(1000)],
    ['sq:pl-abc','w'.repeat(500)],['weird key','q'.repeat(100)],['ps_tm_view','week'],['cs_theme','d']];
  const h=reporter({local:fakeLocal(rows),estimate:Promise.resolve({usage:50*MB,quota:1000*MB})});
  assert.equal(h.c.usageReport(),true);
  await tick();await tick();
  assert.equal(h.events.length,1);
  const {name,opts}=h.events[0];
  assert.equal(name,'storage_usage');assert.equal(opts.status,'ok');assert.equal(opts.feature,'storage');
  const meta=opts.meta,tot=rows.reduce((a,[k,v])=>a+bytes(k,v),0);
  assert.equal(meta.ls,Math.round(tot/1024));assert.equal(meta.n,rows.length);
  assert.equal(meta.useMb,50);assert.equal(meta.quotaMb,1000);assert.equal(meta.standalone,false);
  assert.equal(meta['k:scout_tool_v1'],kb(...rows[0]));
  assert.equal(meta['k:ps_private_board_draft_v1:unsaved'],kb(...rows[1]),'접두사 키는 표의 이름으로 뭉친다');
  assert.equal(meta['k:ps_private_board_draft_v1:kept'],kb(...rows[2]));
  assert.equal(meta['k:sq:'],kb(...rows[3]),'선수별 행은 sq: 하나로');
  assert.equal(meta['k:other'],kb(...rows[4]),'표에 없고 키 모양도 아닌 것은 other');
  assert.equal(meta['k:ps_tm_view'],kb(...rows[5]));
  assert.ok(!('k:cs_theme' in meta),'일곱째(가장 작은 것)는 빠진다 — 여섯까지');
  assert.ok(Object.keys(meta).length<=12,'safeEventMeta 는 12칸까지');
  const flat=JSON.stringify(meta);
  for(const bad of ['u-77','pl-abc','xxxx','yyyy','weird'])assert.ok(!flat.includes(bad),'보내지 않는다: '+bad);
});

test('an estimate that never answers still sends after the 3-second fallback, once',async()=>{
  const h=reporter({local:fakeLocal([['cs_theme','dark']]),estimate:new Promise(()=>{})});
  h.c.usageReport();await tick();
  assert.equal(h.events.length,0);
  const fb=h.timers.find(t=>t.ms===3000);assert.ok(fb,'3초 뒤 보낸다');fb.fn();
  assert.equal(h.events.length,1);assert.equal('useMb' in h.events[0].opts.meta,false);
  fb.fn();assert.equal(h.events.length,1,'한 번만');
});

test('no navigator.storage sends at once; an unreadable localStorage sends nothing and says so',()=>{
  const h=reporter({local:fakeLocal([['cs_theme','dark']])});
  assert.equal(h.c.usageReport(),true);assert.equal(h.events.length,1);
  const broken=reporter({local:{get length(){throw new Error('denied');}}});
  assert.equal(broken.c.usageReport(),false);assert.equal(broken.events.length,0);
});

test('storage_full and storage_usage add up with the same helper; the stamp is a device diag key that never latches a quota warning',()=>{
  assert.match(section('  function fullReport(key,r){','  function fullReadContext(){'),/var us=localSummary\(\)/);
  assert.match(section('  function usageReport(){','  function fullReadContext(){'),/us=localSummary\(\)/);
  assert.match(source,/\n    reportUsage:function\(\)\{ return usageReport\(\); \},/);
  const row=K.info('ps_storage_usage_at');assert.ok(row&&row.sync==='device'&&row.home==='ls'&&row.role==='diag');
  assert.match(source,/key==='ps_storage_usage_at'/,'warnFull — 표시를 못 적어도 저장 실패 경고를 걸지 않는다');
  const sq=K.info('sq:pl-1');assert.ok(sq&&sq.key==='sq:'&&sq.sync==='item'&&sq.home==='idb'&&sq.role==='data','0단계 ② — 선수별 행이 표에 있다');
});

/* 파일 끝의 예약 — 맨 위 창 · 로그인한 기기 · 하루 한 번 */
function scheduler({local,top=true}){
  const timers=[],calls=[];
  const c=vm.createContext({Date,String,console:{warn(){}},localStorage:local,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;}});
  c.window=c;c.top=top?c:{};c.PSStorage={reportUsage:()=>{calls.push(Date.now());return true;}};
  vm.runInContext(section('/* 저장 계층 정리 0단계 ③ — 하루 한 번 작은 저장소 사용량','/* PROCESS STUDIO — 저장 상태(PSSaveState)'),c);
  return {c,timers,calls,fire(){for(const t of timers)t.fn();}};
}
test('the daily report runs in the top window only, for a signed-in device, once a day, and only when the stamp was written',()=>{
  const signedIn=(o)=>fakeLocal([['ps_sync_session','{"uid":"u"}']],o);
  let s=scheduler({local:signedIn(),top:false});assert.equal(s.timers.length,0,'iframe 은 예약하지 않는다');
  s=scheduler({local:fakeLocal([])});assert.equal(s.timers.length,1);assert.equal(s.timers[0].ms,20000);s.fire();
  assert.equal(s.calls.length,0,'세션이 없으면 보내지 않는다');assert.equal(s.c.localStorage.getItem('ps_storage_usage_at'),null,'표시도 안 적는다');
  const local=signedIn();s=scheduler({local});s.fire();
  assert.equal(s.calls.length,1);assert.ok(+local.getItem('ps_storage_usage_at')>0,'보낸 시각을 적는다');
  s=scheduler({local});s.fire();assert.equal(s.calls.length,0,'같은 날은 다시 보내지 않는다');
  local.setItem('ps_storage_usage_at',String(Date.now()-86400001));s=scheduler({local});s.fire();assert.equal(s.calls.length,1,'하루가 지나면 다시');
  s=scheduler({local:signedIn({full:true})});s.fire();assert.equal(s.calls.length,0,'표시를 못 적으면 보내지 않는다');
});
