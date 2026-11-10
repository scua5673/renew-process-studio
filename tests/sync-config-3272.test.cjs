'use strict';
/* 3.272 — 서버 주소 · 공개 키는 상수다. 예전엔 localStorage `ps_sync_cfg` 가 있으면 그 값으로 서버를 바꿨다 — XSS 한 번이면
   그 기기의 모든 요청(로그인 토큰 포함)을 남의 서버로 돌릴 수 있었고 새로고침 · 재로그인 뒤에도 남았다.
   storage.js `PSSafe.cfg` 가 유일한 길: 운영 주소는 정해진 호스트만, 시험용 주소(루프백 fixture)는 화면이 루프백에서 열렸을 때만. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const storage=read('studio/storage.js'),sync=read('studio/sync.js'),app=read('studio/app.html'),admin=read('admin.html');
const PROD=JSON.parse(app.match(/window\.PS_SYNC=(\{url:"[^"]+",anonKey:"[^"]+"\});/)[1].replace(/(\w+):/g,(m,k)=>k==='https'?m:'"'+k+'":'));
function block(){const a=storage.indexOf("var SYNC_HOST="),b=storage.indexOf('var SYNC_CFG_READY=1;');assert.ok(a>0&&b>a,'cfg block');return storage.slice(a,b);}
function page(href,{stored,own,parent}={}){
  const m=new Map();if(stored!==undefined)m.set('ps_sync_cfg',typeof stored==='string'?stored:JSON.stringify(stored));
  const location=new URL(href),win={PSSafe:{},location,localStorage:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
  win.parent=parent||win;win.top=parent||win;if(own)win.PS_SYNC=own;
  vm.runInContext(block(),vm.createContext({window:win,location,localStorage:win.localStorage,URL,JSON,String}));
  const cfg=(...a)=>{const r=win.PSSafe.cfg(...a);return r==null?r:JSON.parse(JSON.stringify(r));};   /* vm 문맥의 객체 → 견줄 수 있는 값 */
  return {cfg,store:m,win};
}
const EVIL={url:'https://collector.example',anonKey:'anything'},LOOP={url:'http://127.0.0.1:43210',anonKey:'fixture-key'};

test('production origin: a stored override is ignored and deleted',()=>{
  for(const href of ['https://processstudio.netlify.app/studio/community.html','https://testprocess.netlify.app/studio/process.html','https://localhost.evil.example/studio/app.html','https://127.0.0.1.evil.example/x']){
    for(const stored of [EVIL,LOOP,{url:'http://localhost:1',anonKey:'k'},'not json']){
      const p=page(href,{stored});
      assert.equal(p.store.has('ps_sync_cfg'),false,'stale value removed on load: '+href);
      assert.deepEqual(p.cfg(),PROD,'standalone page falls back to the constant: '+href);
    }
  }
});
test('only the project host passes validation outside loopback',()=>{
  const p=page('https://processstudio.netlify.app/studio/app.html');
  assert.deepEqual(p.cfg(PROD),PROD);
  for(const url of ['https://collector.example','http://jvtajoeptzfsdwizxejg.supabase.co','https://jvtajoeptzfsdwizxejg.supabase.co.evil.example','https://jvtajoeptzfsdwizxejg.supabase.co@evil.example','https://evil.example/#https://jvtajoeptzfsdwizxejg.supabase.co','https://xjvtajoeptzfsdwizxejg.supabase.co','http://127.0.0.1:43210','javascript:alert(1)','',null,42])
    assert.equal(p.cfg({url,anonKey:'k'}),null,String(url));
  assert.equal(p.cfg({url:PROD.url}),null,'a key is required');assert.equal(p.cfg(null),null);
  assert.equal(p.store.has('ps_sync_cfg'),false,'production never writes the override key');
});
test('a page inside the shell uses the shell constant; a hostile window value is not trusted',()=>{
  const shell={PS_SYNC:PROD},inner=page('https://processstudio.netlify.app/studio/process.html',{parent:shell});
  assert.deepEqual(inner.cfg(),PROD);
  const bad=page('https://processstudio.netlify.app/studio/process.html',{own:EVIL,parent:{PS_SYNC:EVIL}});
  assert.deepEqual(bad.cfg(),PROD,'an injected PS_SYNC pointing elsewhere falls back to the constant');
});
test('loopback fixture: the test server address works, and only there',()=>{
  const shell=page('http://127.0.0.1:43210/studio/app.html',{own:LOOP});
  assert.deepEqual(shell.cfg(LOOP),LOOP,'the fixture rewrites PS_SYNC to its own origin');
  assert.deepEqual(JSON.parse(shell.store.get('ps_sync_cfg')),LOOP,'remembered for pages opened directly in the same test browser');
  const alone=page('http://127.0.0.1:43210/studio/community.html',{stored:LOOP});
  assert.deepEqual(alone.cfg(),LOOP);
  const real=page('http://localhost:8888/studio/app.html',{own:PROD});assert.deepEqual(real.cfg(PROD),PROD,'local preview against the real project is still valid');
  const fake={url:'https://synthetic-auth.invalid',anonKey:'k'};
  assert.deepEqual(page('http://127.0.0.1:43210/studio/app.html',{own:fake}).cfg(fake),fake,'browser tests may use an unresolvable .invalid host — on loopback only');
  assert.equal(page('https://processstudio.netlify.app/studio/app.html').cfg(fake),null);
  assert.deepEqual(page('https://account-team-fixture.invalid/studio/app.html',{own:fake}).cfg(fake),fake,'an intercepted .invalid page origin is a test page too');
  for(const href of ['https://processstudio.netlify.app.invalid.example/studio/app.html','https://invalid/studio/app.html','https://xinvalid.example/'])assert.equal(page(href).cfg(fake),null,href);
  const evil=page('http://127.0.0.1:43210/studio/community.html',{stored:EVIL});
  assert.equal(evil.store.has('ps_sync_cfg'),false,'even on loopback an outside host is dropped');
  assert.equal(evil.cfg(),null,'a loopback page with no fixture address never talks to production by itself');
  assert.equal(evil.cfg(EVIL),null);
});
test('no page reads the override key any more',()=>{
  for(const f of ['studio/sync.js','studio/community.html','studio/process.html','studio/board.html','studio/app.html','studio/scout.html','studio/idp.html','admin.html'])
    assert.ok(!read(f).includes("'ps_sync_cfg'")&&!read(f).includes('"ps_sync_cfg"'),f+' still touches ps_sync_cfg');
  const outside=storage.replace(block(),'');
  assert.ok(!outside.includes("'ps_sync_cfg'")&&!outside.includes('SYNC_STORE'),'storage.js reads it only inside the validated block');
  assert.match(sync.slice(0,1400),/CFG=window\.PSSafe\.cfg\(window\.PS_SYNC\)/,'sync.js takes its config through the allow-list');
  assert.ok(!/localStorage\.(?:get|set)Item\('ps_sync_cfg'/.test(sync));
});
test('the constant is the same publishable project everywhere',()=>{
  assert.ok(block().includes(PROD.url.replace('https://',''))&&block().includes(PROD.anonKey),'storage.js constant = app.html PS_SYNC');
  assert.ok(admin.includes('url:"'+PROD.url+'",anonKey:"'+PROD.anonKey+'"'),'admin.html constant');
  assert.match(PROD.anonKey,/^sb_publishable_/,'publishable key only');
});
