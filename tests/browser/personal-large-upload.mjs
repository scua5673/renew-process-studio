import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'webkit';
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/personal-large-upload',engine);
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
function fn(name){return section(`function ${name}(`,'\nfunction ');}
// The business rules below are extracted from the shipped file, as in the Node
// personal-sync suite. Auth is synthetic; storage uses the actual browser APIs.
const shipped=[fn('hash'),section('function meta()','function keyReady('),fn('syncIssue'),fn('syncHttpError'),
 fn('currentValueForKey'),fn('outboxMarkForOwner'),section('function outboxAckPersonal(','/* 워크스페이스를 바꿀 때'),
 section('function kvPushRows(','/* ── 1.568 안전장치'),section('function kvWrite(','function libLoad('),
 section('function personalWid()','/* 1.504 — 충돌 사본 청소')].join('\n');
const UID='11111111-1111-4111-8111-111111111111',PWID='22222222-2222-4222-8222-222222222222',TWID='33333333-3333-4333-8333-333333333333';
const NOTE='cs_notes_v1',ROLE='cs_analysis_role_v1';
const baseline='{"notes":{},"cur":null}';
const serverRows=new Map(),requests=[],serverErrors=[];
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const rowId=(wid,k)=>wid+'|'+k;
function fixtureScript(){return `(${browserFixture.toString()})(${JSON.stringify({UID,PWID,TWID,NOTE,ROLE})},${JSON.stringify(shipped)});`;}
async function browserFixture(ids,code){
 const {UID,PWID,TWID,NOTE,ROLE}=ids;
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('synthetic-personal-large',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 function read(key){return new Promise((resolve,reject)=>{const t=db.transaction('kv','readonly'),r=t.objectStore('kv').get(key);t.oncomplete=()=>resolve(r.result||null);t.onabort=()=>reject(t.error);});}
 function set(key,value){return new Promise((resolve,reject)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put({key,value});t.oncomplete=()=>resolve(true);t.onabort=()=>reject(t.error);});}
 function replace(key,expected,value){return new Promise((resolve,reject)=>{const t=db.transaction('kv','readwrite'),s=t.objectStore('kv'),r=s.get(key);let changed=false;r.onsuccess=()=>{if((r.result?.value??null)!==expected)return;changed=true;if(value==null)s.delete(key);else s.put({key,value});};t.oncomplete=()=>resolve(changed);t.onabort=()=>reject(t.error);});}
 window.storage={get:read,set,replaceIfValue:replace,delIfValue:(k,v)=>replace(k,v,null)};
 if(!localStorage.getItem('ps_sync_session')){
  localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'synthetic-only',rt:'synthetic-only'}));
  localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:TWID,nonce:'synthetic-generation'}));
  localStorage.setItem('ps_active_ws',TWID);localStorage.setItem('ps_ws_list',JSON.stringify([{id:PWID,kind:'personal',owner_id:UID},{id:TWID,kind:'team'}]));
  localStorage.setItem('ps_sync_meta',JSON.stringify({h:{team_sentinel:'unchanged'},c:{team_sentinel:7},p:{h:{},c:{}},n:{},r:{}}));
 }
 let queueTail=Promise.resolve();const failures=[];
 Object.assign(window,{
  getSess:()=>JSON.parse(localStorage.getItem('ps_sync_session')),activeWs:()=>localStorage.getItem('ps_active_ws'),dataUnlocked:()=>true,
  isTeamWs:()=>true,wsList:()=>JSON.parse(localStorage.getItem('ps_ws_list')),workspaceSwitchGuardRaw:()=>'',workspaceSwitchEpochRaw:()=>'',
  signOutEpoch:0,OWNERKEY:'ps_cache_owner_v1',MKEY:'ps_sync_meta',matchReadyPending:false,MATCH_KEY:'cs_team_matches_v1',SCHEDULE_KEY:'process_coach_v1',
  KEYS:[NOTE,ROLE],PERSONAL:{[NOTE]:1,[ROLE]:1},MAXLEN:1500000,idbBacked:k=>k===NOTE,isIdpPrivateKey:()=>false,isIdpPubKey:()=>false,
  outboxOwner:()=>UID,outboxScope:(u,w)=>u+'|'+w,
  outboxTxn(change){queueTail=queueTail.catch(()=>{}).then(async()=>{const next=await change((await read('@fixture-outbox'))?.value||[]);await set('@fixture-outbox',next);return next;});return queueTail;},
  outboxFail:async(wid,info)=>{failures.push({wid,...info});},syncDiagnostic(){},classifySyncError:e=>({code:e.psCode||'sync_network',stage:e.psStage||'fixture'}),
  importApproved:()=>false,importApprovalClear(){},holdClear(){},rescueStash(){},BASE:location.origin,
  hj:()=>({'Content-Type':'application/json','Authorization':'Bearer synthetic-only'}),prefBuild:p=>p,
  KV_PUSH_BYTES:1000000,KV_PUSH_ROWS:15,blobPrepRows:async()=>{},kvInFilter:keys=>'k=in.('+keys.join(',')+')',
  syncFetch:(stage,url,opts)=>fetch(url,{...opts,headers:{...opts.headers,'X-Fixture-Stage':stage}})
 });
 (0,eval)(code);
 const configuredLimit=PERSONAL_MAXLEN;
 const cap=new URLSearchParams(location.search).get('cap');if(cap)PERSONAL_MAXLEN=Number(cap);
 window.fixture={
  configuredLimit,
  async raw(k){return currentValueForKey(k);},
  async seed(values,bases={}){
   const m=meta();for(const [k,value] of Object.entries(values)){
    if(k===NOTE)await set(k,value);else localStorage.setItem(k,value);
    if(bases[k]){m.p.h[k]=hash(bases[k].v);m.p.c[k]=bases[k].cupd;}
    await outboxMarkForOwner(UID,PWID,k,hash(value),'synthetic-edit');
   }setMetaExact(m);
  },
  async run(){try{await syncPersonal('synthetic-only',()=>true);return {ok:true};}catch(e){return {ok:false,code:e.psCode,keys:e.psPersonalKeys||[]};}},
  async state(){return{meta:meta(),queue:(await read('@fixture-outbox'))?.value||[],issue:personalIssue,failures};},
  makeNote(){
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,512);let seed=42;
   for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255;}
   ctx.putImageData(pixels,0,0);const image=canvas.toDataURL('image/png');
   return JSON.stringify({notes:{'synthetic-note':{id:'synthetic-note',title:'가상 전술 노트 · 선수 🟦',tpl:'blank',orient:'p',pages:[0,1].map(i=>({bg:image,strokes:[{tool:'text',text:('가상 경기 기록과 다음 훈련 한글 검증 🟦 '+i+'\n').repeat(1000),x:20,y:30,size:18,color:'#14161A'}]})),created:1,updated:2}},cur:'synthetic-note'});
  }
 };
 document.getElementById('status').textContent='가상 개인 동기화 검사 준비됨';window.fixtureReady=true;
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 const send=(body,status=200,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(typeof body==='string'?body:JSON.stringify(body));};
 if(u.pathname==='/fixture.html'){send('<!doctype html><meta charset="utf-8"><title>가상 개인 자료 전송 검사</title><p id="status">준비 중</p><script src="/fixture.js"></script>',200,'text/html; charset=utf-8');return;}
 if(u.pathname==='/fixture.js'){send(fixtureScript(),200,'text/javascript; charset=utf-8');return;}
 if(u.pathname!=='/rest/v1/ps_kv'){send({error:'unexpected route'},404);return;}
 try{
  const method=req.method,stage=req.headers['x-fixture-stage'];let body=null;
  if(method!=='GET'){const parts=[];for await(const part of req)parts.push(part);body=JSON.parse(Buffer.concat(parts).toString('utf8'));}
  const wid=u.searchParams.get('workspace_id')?.replace(/^eq\./,'')||body?.workspace_id;
  assert.equal(wid,PWID,'personal rows must never use the active team workspace');
  assert.equal(req.headers.authorization,'Bearer synthetic-only');
  const kfilter=u.searchParams.get('k'),selected=kfilter?.startsWith('in.(')?kfilter.slice(4,-1).split(',').map(x=>x.replace(/^"|"$/g,'')):kfilter?.startsWith('eq.')?[kfilter.slice(3)]:[NOTE,ROLE];
  const entry={method,stage,wid,keys:method==='GET'?selected:[body.k||selected[0]],chars:body?.v?.length||0};requests.push(entry);
  if(method==='GET'){
   const full=u.searchParams.get('select')?.split(',').includes('v');
   send(selected.flatMap(k=>{const row=serverRows.get(rowId(wid,k));return row?[full?row:{k:row.k,cupd:row.cupd}]:[];}));return;
  }
  let saved=null;
  if(method==='POST'){
   assert.equal(Array.isArray(body),false,'missing row CAS must not become a bulk upsert');
   assert.match(req.headers.prefer,/resolution=ignore-duplicates/);
   if(!serverRows.has(rowId(wid,body.k))){saved=body;serverRows.set(rowId(wid,body.k),saved);}
  }else{
   assert.equal(method,'PATCH');const old=serverRows.get(rowId(wid,selected[0])),expected=u.searchParams.get('cupd')?.replace(/^eq\./,'');assert.ok(expected,'version constraint required');
   if(old&&String(old.cupd)===expected){saved={...old,...body};serverRows.set(rowId(wid,saved.k),saved);}
  }
  send(saved?[{workspace_id:wid,k:saved.k,cupd:saved.cupd}]:[]);
 }catch(e){serverErrors.push(e.stack);send({error:'synthetic server assertion'},500);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;const contexts=[],errors=[],results=[];
async function client(cap){
 const context=await browser.newContext({serviceWorkers:'block'});contexts.push(context);
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'/fixture.html'+(cap?'?cap='+cap:''));await page.waitForFunction(()=>window.fixtureReady);return page;
}
const writes=()=>requests.filter(r=>r.method!=='GET');
try{
 browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 serverRows.set(rowId(PWID,NOTE),{workspace_id:PWID,k:NOTE,v:baseline,cupd:1});
 const first=await client();assert.equal(await first.evaluate(()=>fixture.configuredLimit),12000000);
 const raw=await first.evaluate(()=>fixture.makeNote());assert.ok(raw.length>1500000&&raw.length<12000000);
 const role='"coach"';await first.evaluate(({note,role,key,rkey,base})=>fixture.seed({[key]:note,[rkey]:role},{[key]:{v:base,cupd:1}}),{note:raw,role,key:NOTE,rkey:ROLE,base:baseline});
 assert.deepEqual(await first.evaluate(()=>fixture.run()),{ok:true});
  assert.ok(serverRows.get(rowId(PWID,NOTE)).v===raw,'server stores the exact large original');assert.equal(serverRows.get(rowId(PWID,ROLE)).v,role);
 let state=await first.evaluate(()=>fixture.state());assert.equal(state.queue.length,0);assert.equal(state.meta.h.team_sentinel,'unchanged');assert.equal(state.issue,null);
 const count=writes().length;assert.equal(count,2);assert.ok(writes().some(r=>r.method==='PATCH'&&r.keys.includes(NOTE)));
 assert.deepEqual(await first.evaluate(()=>fixture.run()),{ok:true});assert.equal(writes().length,count);
 await first.reload();await first.waitForFunction(()=>window.fixtureReady);assert.deepEqual(await first.evaluate(()=>fixture.run()),{ok:true});assert.equal(writes().length,count);
 assert.ok(await first.evaluate(key=>fixture.raw(key),NOTE)===raw,'reloaded local IndexedDB retains the exact original');
 results.push({case:'large-note-CAS-upload-and-reload-no-duplicate',ok:true,chars:raw.length,utf8Bytes:Buffer.byteLength(raw),sha256:digest(raw),writes:count,realIndexedDB:true,realLocalStorage:true});
 const second=await client();assert.deepEqual(await second.evaluate(()=>fixture.run()),{ok:true});
 assert.ok(await second.evaluate(key=>fixture.raw(key),NOTE)===raw,'fresh device IndexedDB receives the exact original');assert.equal(await second.evaluate(key=>fixture.raw(key),ROLE),role);assert.equal(writes().length,count);
 await second.reload();await second.waitForFunction(()=>window.fixtureReady);assert.deepEqual(await second.evaluate(()=>fixture.run()),{ok:true});assert.equal(writes().length,count);
 results.push({case:'fresh-device-pull-exact-Korean-image-original',ok:true,sha256:digest(await second.evaluate(key=>fixture.raw(key),NOTE)),noUpload:true});

 // Use a smaller fixture cap for the same shipped overflow branch. The previous
 // case asserts the actual 12M production value; no product source is changed.
 serverRows.clear();requests.length=0;
 const smallCap=65536,oversize=JSON.stringify({notes:{fixture:{pages:[{strokes:[{tool:'text',text:'가상'.repeat(50000)}]}]}},cur:'fixture'}),normal='"analyst"';
 const third=await client(smallCap);await third.evaluate(({note,normal,key,rkey})=>fixture.seed({[key]:note,[rkey]:normal}),{note:oversize,normal,key:NOTE,rkey:ROLE});
 const rejected=await third.evaluate(()=>fixture.run());assert.equal(rejected.ok,false);assert.equal(rejected.code,'sync_personal_size');assert.deepEqual(rejected.keys,[NOTE]);
 assert.equal(serverRows.has(rowId(PWID,NOTE)),false);assert.equal(serverRows.get(rowId(PWID,ROLE)).v,normal);assert.equal(await third.evaluate(key=>fixture.raw(key),NOTE),oversize);
 state=await third.evaluate(()=>fixture.state());assert.deepEqual(state.queue.map(x=>x.key),[NOTE]);assert.equal(state.meta.p.h[NOTE],undefined);assert.ok(state.meta.p.h[ROLE]);
 const validCount=writes().length;await third.evaluate(()=>fixture.run());assert.equal(writes().length,validCount);
 results.push({case:'over-limit-only-key-remains-pending-other-key-ACKed',ok:true,fixtureCap:smallCap,oversizeChars:oversize.length,onlyPendingKey:NOTE});
 serverRows.set(rowId(PWID,NOTE),{workspace_id:PWID,k:NOTE,v:oversize,cupd:Date.now()+1000});
 assert.deepEqual(await third.evaluate(()=>fixture.run()),{ok:true});assert.equal((await third.evaluate(()=>fixture.state())).queue.length,0);assert.equal(writes().length,validCount);
 const fourth=await client(smallCap);assert.deepEqual(await fourth.evaluate(()=>fixture.run()),{ok:true});assert.equal(await fourth.evaluate(key=>fixture.raw(key),NOTE),oversize);assert.equal(writes().length,validCount);
 results.push({case:'equal-large-server-and-fresh-pull-bypass-upload-cap',ok:true,fixtureCap:smallCap,noUpload:true});
 assert.deepEqual(errors,[]);assert.deepEqual(serverErrors,[]);
}catch(e){errors.push(e.stack);process.exitCode=1;}
finally{
 for(const context of contexts)await context.close();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
 const report={ok:results.length===4&&!errors.length&&!serverErrors.length,engine,method:'Shipped personal sync/planner/local CAS/HTTP CAS/meta/outbox ACK; synthetic local HTTP server; real isolated browser IndexedDB and localStorage; all external requests blocked.',results,errors,serverErrors};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
}
