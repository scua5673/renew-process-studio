'use strict';
/* 3.315 — 일정 사본의 훈련 그림은 참조만(studio/schedule-thumb-ref.js).
   저장 replacer 가 긴 thumb 를 "thumb":"","thumbRef":"<해시>" 로 떼고(그림은 IDB ps_blob:<해시>), 읽을 때 메모리 → IDB 캐시 → 서버 차례로 채운다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../studio/schedule-thumb-ref.js');
const SVG='<svg viewBox="0 0 10 10">'+'<circle r="1"/>'.repeat(60)+'</svg>';   /* 512자 넘는 그림 */
const SMALL='<svg data-td="1"><rect/></svg>';
const H='0123456789abcdef01234567',G='fedcba9876543210fedcba98';
const seg=api.seg;
function store(init){
  const m=new Map(Object.entries(init||{})),log={get:[],set:[]};
  return {m,log,get:async k=>{log.get.push(k);return m.has(k)?{value:m.get(k)}:null;},set:async(k,v)=>{log.set.push(k);m.set(k,v);}};
}
const REF=/^[0-9a-f]{24}$/;

test('replacer strips a long thumb into an adjacent empty value + reference and caches the escaped segment',async()=>{
  const st=store(),inst=api.create({storage:st});
  const cell={title:'훈련',thumb:SVG,minutes:20,_open:true},doc={weeks:{0:[{trainings:[cell]}]}};
  const raw=JSON.stringify(doc,inst.replacer);
  const out=JSON.parse(raw).weeks[0][0].trainings[0];
  assert.equal(out.thumb,'');assert.match(out.thumbRef,REF);assert.equal(out.title,'훈련');assert.equal(out.minutes,20);assert.equal(out._open,undefined);
  assert.ok(raw.includes('"thumb":"","thumbRef":"'+out.thumbRef+'"'),'참조는 빈 값 바로 다음(sync.js schedStrip 과 같은 모양)');
  assert.equal(cell.thumb,SVG,'메모리의 그림은 그대로');assert.equal(cell.thumbRef,out.thumbRef,'메모리 객체에 참조가 붙어 다음 저장이 같은 해시를 쓴다');
  assert.equal(out.thumbRef,api.hashSync(seg(SVG)),'sync.js blobHash 폴백과 같은 해시');
  await Promise.resolve();
  assert.deepEqual(st.log.set,['ps_blob:'+out.thumbRef]);assert.equal(st.m.get('ps_blob:'+out.thumbRef),seg(SVG),'캐시에는 JSON 이스케이프된 조각');
  const again=JSON.stringify(doc,inst.replacer);assert.equal(again,raw);assert.equal(st.log.set.length,1,'같은 그림은 다시 쓰지 않는다');
});

test('short thumbs and documents without thumbs are byte-identical to the old replacer',()=>{
  const st=store(),inst=api.create({storage:st}),old=(k,v)=>k==='_open'?undefined:v;
  const doc={weeks:{0:[{trainings:[{title:'a',thumb:SMALL,_open:1},{title:'b',thumb:''}],meets:[{name:'m'}]}]},templates:[{n:1}]};
  assert.equal(JSON.stringify(doc,inst.replacer),JSON.stringify(doc,old));assert.equal(st.log.set.length,0);
});

test('a reference from the server is reused without re-hashing; a changed picture after binding gets a new one',async()=>{
  const st=store(),inst=api.create({storage:st});
  const cell={thumb:SVG,thumbRef:H,title:'서버 그림'};
  const raw=JSON.stringify({a:[cell]},inst.replacer);
  assert.equal(JSON.parse(raw).a[0].thumbRef,H,'서버 참조 그대로');assert.equal(st.log.set.length,0,'서버 그림은 캐시에 다시 쓰지 않는다');
  cell.thumb=SVG+'<!-- 다시 그림 -->';
  const raw2=JSON.stringify({a:[cell]},inst.replacer),ref2=JSON.parse(raw2).a[0].thumbRef;
  assert.notEqual(ref2,H);assert.match(ref2,REF);assert.equal(cell.thumbRef,ref2);
  await Promise.resolve();assert.deepEqual(st.log.set,['ps_blob:'+ref2]);
});

test('without an image cache the document keeps its pictures inline (old behaviour)',()=>{
  const inst=api.create({storage:null}),cell={thumb:SVG};
  assert.equal(JSON.stringify([cell],inst.replacer),JSON.stringify([cell]));assert.equal(cell.thumbRef,undefined);
});

test('hydrate fills reference-only cells from the IDB cache, then the server, and reports the asynchronous count',async()=>{
  const st=store({['ps_blob:'+H]:seg(SVG)}),fetched=[];
  const sync={blob:{fetch:async hs=>{fetched.push(hs.slice());return {[G]:seg(SMALL+SVG)};},hash:async()=>'x'}};
  const inst=api.create({storage:st,sync});
  const a={thumb:'',thumbRef:H},b={thumb:'',thumbRef:G},c={thumb:'',thumbRef:H},keep={thumb:'inline',thumbRef:H},none={thumb:'',thumbRef:'bad'};
  const doc={weeks:{0:[{trainings:[a,b],warmsData:[c,keep],meetsData:[none]}]}};
  let done=null;const n=await inst.hydrate([doc],m=>{done=m;});
  assert.equal(n,3);assert.equal(done,3);
  assert.equal(a.thumb,SVG);assert.equal(c.thumb,SVG);assert.equal(b.thumb,SMALL+SVG);assert.equal(keep.thumb,'inline');assert.equal(none.thumb,'');
  assert.deepEqual(st.log.get,['ps_blob:'+H,'ps_blob:'+G]);assert.deepEqual(fetched,[[G]],'캐시에 없는 참조만 서버에');
  assert.equal(a.thumbRef,H,'참조는 남는다 — 다음 저장이 같은 참조로 뗀다');
  const raw=JSON.stringify(doc,inst.replacer);assert.ok(raw.includes('"thumb":"","thumbRef":"'+H+'"'));assert.equal(st.log.set.length,0);
});

test('a legacy inline picture (old mirror) gets the sync SHA-256 reference ahead of its next save and is cached once',async()=>{
  const st=store(),hashed=[];
  const sync={blob:{fetch:async()=>({}),hash:async s=>{hashed.push(s);return H;}}};
  const inst=api.create({storage:st,sync});
  const cell={thumb:SVG,title:'옛 거울'},small={thumb:SMALL};
  await inst.hydrate([{weeks:{0:[{trainings:[cell,small]}]}}]);
  assert.deepEqual(hashed,[seg(SVG)]);assert.equal(cell.thumbRef,H);assert.equal(small.thumbRef,undefined);
  assert.deepEqual(st.log.set,['ps_blob:'+H]);
  assert.ok(JSON.stringify([cell],inst.replacer).includes('"thumb":"","thumbRef":"'+H+'"'),'저장은 그 SHA 참조로 — 해시를 새로 만들지 않는다');
  st.log.set.length=0;await inst.hydrate([{weeks:{0:[{trainings:[cell]}]}}]);assert.equal(st.log.set.length,0,'이미 참조가 있으면 다시 하지 않는다');
});

test('undo round trip: a stripped history snapshot is refilled synchronously from this window memory',async()=>{
  const st=store(),inst=api.create({storage:st});
  const live={weeks:{0:[{trainings:[{thumb:SVG,title:'t'}]}]}};
  const snap=JSON.stringify(live.weeks,inst.replacer);
  const back={weeks:JSON.parse(snap)};
  assert.equal(back.weeks[0][0].trainings[0].thumb,'');
  const n=await inst.hydrate([back.weeks]);
  assert.equal(n,1);assert.equal(back.weeks[0][0].trainings[0].thumb,SVG);assert.equal(st.log.get.length,0,'메모리 조각으로 바로');
});

test('process.html, app.html and sw.js wiring',()=>{
  const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
  assert.ok(P.includes("const __rep=window.__schedRep||((k,v)=> k==='_open'?undefined:v);"),'saveNow 의 replacer 는 모듈 것(없으면 예전 것)');
  assert.equal((P.match(/if\(window\.__schedAfterLoad\)__schedAfterLoad\(\)/g)||[]).length,2,'loadState 와 doUndo 뒤에 채우기');
  assert.ok(P.includes("if(k==='thumb'&&typeof v==='string'&&!x.thumbRef){"),'참조가 있는 그림은 다이어트하지 않는다');
  assert.ok(P.indexOf('<script src="schedule-thumb-ref.js"')>P.indexOf('<script src="schedule-syncline-steady.js"'),'본문 뒤에 읽힌다');
  const A=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
  assert.ok(A.indexOf('<script src="sync-sched-blob.js"')<A.indexOf('<script src="sync.js'),'동기화 모듈은 sync.js 앞');
  const SW=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
  for(const f of ['sync-sched-blob','schedule-thumb-ref'])assert.ok(SW.includes("'/studio/"+f+".js'"),f+' in sw CORE');
});
