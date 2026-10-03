'use strict';
// scripts/schema-baseline.mjs — 운영에 묻는 부분은 가짜 fetch 로만 시험한다(네트워크·토큰 없음).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const load=()=>import('../scripts/schema-baseline.mjs');
const TOKEN='sbp_'+'a'.repeat(40);
function home(content){const d=fs.mkdtempSync(path.join(os.tmpdir(),'psbase-'));if(content!==undefined)fs.writeFileSync(path.join(d,'.supabase-pat'),content);return d;}
function fakeFetch(answers){const calls=[];const f=async(url,opt)=>{calls.push({url,opt,sql:JSON.parse(opt.body).query});const a=answers.shift();
  return {ok:a.status===undefined||a.status<300,status:a.status||200,text:async()=>typeof a.body==='string'?a.body:JSON.stringify(a.body)};};f.calls=calls;return f;}

test('token: missing file, wrong shape and good token',async()=>{
  const m=await load();
  assert.throws(()=>m.readToken(home()),/토큰 파일이 없습니다/);
  assert.throws(()=>m.readToken(home('hello')),/모양이 아닙니다/);
  assert.equal(m.readToken(home(TOKEN+'\n')),TOKEN);
});

test('live body: catalog query goes to the project query endpoint with the token, cron only when present',async()=>{
  const m=await load();
  const f=fakeFetch([{body:[{ddl:'set check_function_bodies = off;\n\n-- 1. 스키마  \n'}]},{body:[{has:false}]}]);
  const body=await m.liveBody({token:TOKEN,fetcher:f,catalog:'select 1 as ddl'});
  assert.equal(body,'set check_function_bodies = off;\n\n-- 1. 스키마\n');
  assert.equal(f.calls[0].url,'https://api.supabase.com/v1/projects/'+m.PROJECT_REF+'/database/query');
  assert.equal(f.calls[0].opt.headers.Authorization,'Bearer '+TOKEN);
  assert.equal(f.calls.length,2,'no cron query when cron.job is missing');
  const g=fakeFetch([{body:[{ddl:'x'}]},{body:[{has:true}]},{body:[{ddl:"select cron.schedule('a', '1 * * * *', 'select 1');"}]}]);
  assert.match(await m.liveBody({token:TOKEN,fetcher:g,catalog:'select 1 as ddl'}),/-- 18\. pg_cron 작업\nselect cron\.schedule\('a'/);
});

test('server errors never echo the token',async()=>{
  const m=await load();
  const f=fakeFetch([{status:401,body:'bad token '+TOKEN}]);
  await assert.rejects(m.runQuery('select 1',{token:TOKEN,fetcher:f}),e=>{assert.match(e.message,/HTTP 401/);assert.ok(!e.message.includes(TOKEN));return true;});
});

test('a catalog answer that is not exactly one DDL cell is refused',async()=>{
  const m=await load();
  for(const rows of [[],[{ddl:''}],[{ddl:'a'},{ddl:'b'}],[{other:'x'}]])
    await assert.rejects(m.liveBody({token:TOKEN,fetcher:fakeFetch([{body:rows}]),catalog:'select 1'}),/DDL 한 칸/);
});

test('file text carries the body unchanged and --check reports the first drift',async()=>{
  const m=await load();
  const body='line1\nline2\n';
  const text=m.fileText(body,{catalog:'q',now:new Date('2026-10-03T00:00:00Z')});
  assert.match(text,/받은 날 2026-10-03/);assert.equal(m.bodyOf(text),body);
  const dir=home(TOKEN),file=path.join(dir,'baseline.sql');fs.writeFileSync(file,text);
  const logs=[];
  const same=await m.main({argv:['--check'],home:dir,baselineFile:file,log:s=>logs.push(s),fetcher:fakeFetch([{body:[{ddl:body}]},{body:[{has:false}]}])});
  assert.equal(same,0);assert.match(logs.pop(),/운영 구조 = 저장된 기준본/);
  const drift=await m.main({argv:['--check'],home:dir,baselineFile:file,log:s=>logs.push(s),fetcher:fakeFetch([{body:[{ddl:'line1\nCHANGED\n'}]},{body:[{has:false}]}])});
  assert.equal(drift,1);assert.match(logs.pop(),/본문 2줄\n  저장: line2\n  운영: CHANGED/);
  let wrote=null;
  assert.equal(await m.main({argv:[],home:dir,baselineFile:file,log:()=>{},write:(f,t)=>{wrote={f,t};},fetcher:fakeFetch([{body:[{ddl:body}]},{body:[{has:false}]}])}),0);
  assert.equal(wrote.f,file);assert.equal(m.bodyOf(wrote.t),body);
});

test('the catalog query file is read-only (no write keyword outside string literals)',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../migrations/00000000_baseline.catalog.sql'),'utf8');
  // 문자열('…', '' 이스케이프)과 줄 주석(--)을 한 글자씩 걸러 코드만 남긴다 — 문자열 안의 -- 나 주석 안의 ' 에 속지 않게
  let code='';for(let i=0;i<raw.length;){
    if(raw[i]==="'"){let j=i+1;for(;j<raw.length;j++){if(raw[j]==="'"){if(raw[j+1]==="'"){j++;continue;}break;}}code+="''";i=j+1;}
    else if(raw[i]==='-'&&raw[i+1]==='-'){while(i<raw.length&&raw[i]!=='\n')i++;}
    else code+=raw[i++];
  }
  assert.doesNotMatch(code,/\b(insert\s+into|update\s+[\w.]+\s+set|delete\s+from|truncate|drop|alter|create|grant|revoke|comment\s+on|set\s+\w+\s*=|do\s+\$)\b/i);
  assert.match(code.trim(),/^with\b/i);
  assert.match(code.trim(),/as ddl from sec;$/);
  const keys=[...raw.matchAll(/union all select (\d+), '-- /g)].map(m=>+m[1]);
  assert.equal(new Set(keys).size,keys.length,'every section has its own order key');
  assert.deepEqual(keys,[...keys].sort((x,y)=>x-y),'order keys follow the file order');
});
