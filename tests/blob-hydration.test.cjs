'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const H='0123456789abcdef01234567',G='fedcba9876543210fedcba98',segment=s=>JSON.stringify(s).slice(1,-1);
function harness(cacheEntries=[],serverEntries=[]){
  const cache=new Map(cacheEntries.map(([h,v])=>['ps_blob:'+h,v])),server=new Map(serverEntries),calls=[],reads=[],writes=[],rows=[];
  const c={console,Promise,JSON,Uint8Array,TextEncoder,crypto:crypto.webcrypto,BASE:'https://synthetic.invalid',KV_PULL_CHUNK:40,
    storage:{async get(k){reads.push(k);return cache.has(k)?{value:cache.get(k)}:null;},async set(k,v){writes.push(k);cache.set(k,v);return {value:v};}},
    hj:()=>({}),kvInFilter:keys=>'k=in.('+keys.join(',')+')',syncDiagnostic(){},syncHttpError:(stage,status)=>Error(stage+' '+status),
    async syncFetch(stage,url){calls.push({stage,url});if(stage==='kv_pull')return {ok:true,json:async()=>rows.map(x=>({...x}))};
      assert.equal(stage,'blob_pull');const filter=decodeURIComponent(url);return {ok:true,json:async()=>[...server].filter(([h])=>filter.includes(h)).map(([h,v])=>({h,v}))};}
  };c.window=c;vm.createContext(c);vm.runInContext(section('var BLOB_MIN=','/* ══ 2.727')+'\n'+section('function kvPullValues(','/* 청크 하나가'),c);
  return {c,cache,calls,reads,writes,rows};
}
test('SQL-reordered nonadjacent emblem reference restores the original cached image without changing other bytes',async()=>{
  const picture='data:image/png;base64,'+'a'.repeat(7802),h=harness([[H,segment(picture)]]);
  const raw='{ "meta" : { "emblemRef" : "'+H+'", "teamName":"Synthetic", "emblem" : "", "count":1.00 }, "players":[] }';
  assert.deepEqual(Array.from(h.c.schedRefs(raw)),[H]);const got=await h.c.schedHydrate('token','team-a',raw);
  assert.equal(got,raw.replace('"emblemRef" : "'+H+'",','').replace('"emblem" : ""','"emblem" : '+JSON.stringify(picture)));
  assert.equal(JSON.parse(got).meta.emblem,picture);assert.deepEqual(h.reads,['ps_blob:'+H]);assert.equal(h.calls.length,0);
});
test('kvPullValues hydrates spaced SQL JSON from the workspace-scoped blob endpoint',async()=>{
  const picture='data:image/png;base64,synthetic',h=harness([],[[H,segment(picture)]]);
  h.rows.push({k:'scout_tool_v1',v:JSON.stringify({meta:{emblem:'',teamName:'Synthetic',emblemRef:H},players:[]},null,2),cupd:7});
  const result=await h.c.kvPullValues('token','team-a',['scout_tool_v1']);assert.equal(JSON.parse(result[0].v).meta.emblem,picture);assert.equal(result[0].cupd,7);
  assert.equal(h.calls.filter(x=>x.stage==='blob_pull').length,1);assert.match(h.calls.find(x=>x.stage==='blob_pull').url,/workspace_id=eq.team-a/);assert.equal(h.cache.get('ps_blob:'+H),segment(picture));
});
for(const key of ['thumb','emblem'])test(key+' strip/hydrate retains exact original bytes, escaping and whitespace',async()=>{
  const h=harness(),picture='<svg title="quoted">\\path\n'+('한글 '.repeat(200))+'</svg>';
  const raw='{ "before": 1.00, "nested": [ { "'+key+'":  '+JSON.stringify(picture)+', "after" : true } ] }';
  const stripped=await h.c.schedStrip(raw);assert.equal(stripped.blobs.length,1);assert.notEqual(stripped.v,raw);assert.deepEqual(Array.from(h.c.schedRefs(stripped.v)),[stripped.blobs[0].h]);
  assert.equal(stripped.blobs[0].h,crypto.createHash('sha256').update(segment(picture)).digest('hex').slice(0,24));
  for(const b of stripped.blobs)h.cache.set('ps_blob:'+b.h,b.v);assert.equal(await h.c.schedHydrate('token','team-a',stripped.v),raw);
  const twice=await h.c.schedStrip(stripped.v);assert.equal(twice.v,stripped.v);assert.equal(twice.blobs.length,0);
});
test('mixed nested schedule and emblem refs match only their own object and field name',async()=>{
  const h=harness([[H,segment('thumbnail')],[G,segment('emblem')]]);
  const doc={meta:{emblemRef:G,other:[{thumbRef:H,rank:0,thumb:''}],emblem:''},wrong:{thumb:'',emblemRef:G},outside:{thumb:''},refOnly:{thumbRef:H},inline:{emblem:'current inline',emblemRef:G}};
  const got=JSON.parse(await h.c.schedHydrate('token','team-a',JSON.stringify(doc)));assert.equal(got.meta.emblem,'emblem');assert.equal(got.meta.other[0].thumb,'thumbnail');
  assert.deepEqual(got.wrong,doc.wrong);assert.deepEqual(got.outside,doc.outside);assert.deepEqual(got.refOnly,doc.refOnly);assert.deepEqual(got.inline,doc.inline);assert.equal(h.reads.length,2);
});
test('multiple leading, adjacent and trailing references are removed without invalidating their object',async()=>{
  const h=harness([[H,segment('thumb')],[G,segment('emblem')]]);
  const fields=['"thumbRef":"'+H+'"','"emblemRef":"'+G+'"','"thumb":""','"emblem":""','"other":1.00'];
  function permutations(a){return a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(rest=>[x,...rest])):[[]];}
  for(const order of permutations(fields)){const raw='{ '+order.join(' , ' )+' }',got=await h.c.schedHydrate('token','team-a',raw);assert.deepEqual(JSON.parse(got),{thumb:'thumb',emblem:'emblem',other:1});assert.match(got,/"other":1\.00/);}
});
test('unavailable or invalid blob data preserves its exact reference while independently available images hydrate',async()=>{
  const raw='{"thumbRef":"'+H+'", "emblemRef":"'+G+'", "thumb":"", "emblem":""}';
  for(const corrupt of [undefined,'bad"quote','\\qad']){const h=harness(corrupt===undefined?[]:[[H,corrupt]]);assert.equal(await h.c.schedHydrate(null,'team-a',raw),raw);assert.equal(h.calls.length,0);}
  const h=harness([[H,segment('ready')]]),out=JSON.parse(await h.c.schedHydrate(null,'team-a',raw));assert.equal(out.thumb,'ready');assert.equal(out.emblem,'');assert.equal(out.emblemRef,G);assert.equal(out.thumbRef,undefined);
});
test('malformed documents, ambiguous duplicate fields and apparent refs inside text remain untouched',async()=>{
  const h=harness([[H,segment('image')]]),raws=['{"thumb":"","thumbRef":"'+H+'",}',
    '{"thumb":"","thumb":"","thumbRef":"'+H+'"}',
    '{"emblem":"","emblemRef":"'+H+'","emblemRef":"'+G+'"}',
    JSON.stringify({memo:'{"thumb":"","thumbRef":"'+H+'"}'}),'{"thumb":"","thumbRef":"not-a-hash"}'];
  for(const raw of raws){assert.deepEqual(Array.from(h.c.schedRefs(raw)),[]);assert.equal(await h.c.schedHydrate('token','team-a',raw),raw);}assert.equal(h.reads.length,0);assert.equal(h.calls.length,0);
});
test('repeated references fetch once, missing server rows stay intact, and unrelated KV keys are untouched',async()=>{
  const h=harness([],[[H,segment('image')]]),raw=JSON.stringify([{thumb:'',thumbRef:H},{thumbRef:H,thumb:''},{emblem:'',emblemRef:G}]);
  const got=JSON.parse(await h.c.schedHydrate('token','team-a',raw));assert.equal(got[0].thumb,'image');assert.equal(got[1].thumb,'image');assert.equal(got[2].emblemRef,G);assert.equal(h.calls.length,1);assert.equal(h.reads.length,2);
  h.rows.push({k:'unrelated',v:raw,cupd:1});const rows=await h.c.kvPullValues('token','team-a',['unrelated']);assert.equal(rows[0].v,raw);
});
