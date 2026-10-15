// 3.051 — 배포 파이프라인(피드백 13 · TD-4 · TD-10): 판 목록(sw-manifest.json) · 바뀐 파일만 받는 서비스워커 install ·
// «판 번호를 깜빡한 배포»를 멈추는 release-guard · SQL 시험 전부 · 버전 정본 하나 · README · 배포 열차.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const R=f=>fs.readFileSync(path.join(root,f),'utf8');

test('판 목록 — 배포 파일마다 SHA-256, 판 번호는 sw.js CACHE = process-<PS_BUILD> 일 때만',async()=>{
  const {buildManifest,releaseOf}=await import('../scripts/package-site.mjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ps-man-'));
  fs.mkdirSync(path.join(dir,'studio'));
  fs.writeFileSync(path.join(dir,'sw.js'),"x\nconst CACHE = 'process-3.051';\n");
  fs.writeFileSync(path.join(dir,'studio/app.html'),"<script>window.PS_BUILD='3.051';</script>");
  fs.writeFileSync(path.join(dir,'studio/a.js'),'hello');
  const m=buildManifest(dir,['studio/a.js','sw.js','studio/app.html']);
  assert.equal(m.release,'process-3.051'); assert.equal(m.build,'3.051');
  assert.equal(m.files['/studio/a.js'],crypto.createHash('sha256').update('hello').digest('hex'));
  assert.deepEqual(Object.keys(m.files),['/studio/a.js','/studio/app.html','/sw.js']);
  fs.writeFileSync(path.join(dir,'studio/app.html'),"<script>window.PS_BUILD='3.050';</script>");
  assert.throws(()=>releaseOf(dir),/must equal/);
  assert.match(R('scripts/package-site.mjs'),/fs\.writeFileSync\(path\.join\(out,MANIFEST\),JSON\.stringify\(manifest\)\)/,'dist 에 쓴다');
  assert.match(R('.gitignore'),/^dist\/$/m,'저장소에는 두지 않는다');
});

test('release-guard — 같은 판 · 다른 파일이면 멈춘다, 판을 올리면 지나간다, 낮추면 멈춘다, 목록이 없으면 지나간다',async()=>{
  const {compare,guard}=await import('../scripts/release-guard.mjs');
  const live={release:'process-3.050',files:{'/a.js':'1','/b.js':'2'}};
  assert.equal(compare(live,{release:'process-3.050',files:{'/a.js':'1','/b.js':'2'}}).ok,true);
  const same=compare(live,{release:'process-3.050',files:{'/a.js':'1','/b.js':'3'}});
  assert.equal(same.ok,false); assert.deepEqual(same.changed,['/b.js']); assert.match(same.why,/판 번호는 process-3\.050 그대로/);
  assert.equal(compare(live,{release:'process-3.050',files:{'/a.js':'1'}}).ok,false,'파일이 빠져도 바뀐 것');
  assert.equal(compare(live,{release:'process-3.051',files:{'/a.js':'9'}}).ok,true);
  assert.equal(compare(live,{release:'process-3.039',files:live.files}).ok,false,'판을 낮춘 배포');
  assert.equal(compare(null,{release:'process-3.051',files:{}}).ok,true,'첫 배포');
  const logs=[]; assert.deepEqual(await guard({env:{CONTEXT:'deploy-preview'},log:m=>logs.push(m)}),{ok:true}); assert.match(logs[0],/production deploys only/);
  assert.match(R('netlify.toml'),/node scripts\/package-site\.mjs && node scripts\/release-guard\.mjs"/,'목록을 만든 뒤 견준다');
});

/* sw.js 를 그대로 돌린다 — 가짜 Cache API · fetch 위에서 install 한 번 */
function swHarness({manifest,oldBodies,changed=[]}){
  const store=new Map(), fetched=[];
  const mk=name=>{ if(!store.has(name))store.set(name,new Map()); const m=store.get(name);
    return {match:async p=>{ const r=m.get(typeof p==='string'?p:p.url); return r?r.clone():undefined; },put:async(p,r)=>{ m.set(typeof p==='string'?p:p.url,r); },keys:async()=>[...m.keys()].map(u=>({url:u})),delete:async p=>m.delete(p)}; };
  const caches={open:async n=>mk(n),keys:async()=>[...store.keys()],delete:async n=>store.delete(n)};
  if(oldBodies){ const c=mk('process-3.050'); for(const [p,b] of Object.entries(oldBodies))store.get('process-3.050').set(p,new Response(b)); }
  const body=p=>changed.includes(p)?'new:'+p:'old:'+p;
  const fetchFn=async(p)=>{ fetched.push(p); if(p==='/sw-manifest.json')return manifest?new Response(JSON.stringify(manifest)):new Response('nope',{status:404}); return new Response(body(p)); };
  const listeners={};
  const self={addEventListener:(t,f)=>{listeners[t]=f;},location:{origin:'https://x.test'},skipWaiting:async()=>{},clients:{matchAll:async()=>[],claim:async()=>{}},crypto:globalThis.crypto};
  const ctx={self,caches,fetch:fetchFn,Response,URL,crypto:globalThis.crypto,console,setTimeout,Promise,Uint8Array,Array,JSON,Date,Set,Map,Object,Error};
  vm.createContext(ctx); vm.runInContext(R('sw.js')+'\n;this.__CORE=CORE;this.__OPTIONAL=OPTIONAL;',ctx);
  return {ctx,store,fetched,listeners,body,install:async()=>{ let p; listeners.install({waitUntil:x=>{p=x;}}); await p; }};
}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const LIVE=R('sw.js').match(/const CACHE = '(process-[\d.]+)'/)[1];   /* 판을 올려도 시험은 지금 판으로 */

test('서비스워커 install — 옛 판 캐시의 본문이 목록 해시와 같으면 옮겨 담고, 바뀐 것만 받는다',async()=>{
  const probe=swHarness({}); const all=[...new Set(probe.ctx.__CORE.concat(probe.ctx.__OPTIONAL))];
  const files={}; all.forEach(p=>{ if(!/\/$/.test(p)&&p!=='/admin')files[p]=sha(p==='/studio/app.html'?'new:'+p:'old:'+p); });
  const old={}; all.forEach(p=>{ old[p]='old:'+p; });
  old['/studio/sync.js']='tampered';   /* 옛 캐시가 목록과 어긋나 있으면(옛 install 이 배포와 겹친 경우) 믿지 않고 받는다 */
  const h=swHarness({manifest:{v:1,release:LIVE,files},oldBodies:old,changed:['/studio/app.html']});
  await h.install();
  const got=h.fetched.filter(p=>p!=='/sw-manifest.json').sort();
  const expect=['/studio/app.html','/studio/sync.js'].concat(all.filter(p=>!files[p])).sort();
  assert.deepEqual(got,expect,'받은 것 = 바뀐 것 + 본문이 어긋난 것 + 목록에 없는 경로 이름');
  const nc=h.store.get(LIVE);
  for(const p of all)assert.ok(nc.has(p),'새 캐시에 '+p);
  assert.equal(await nc.get('/studio/app.html').text(),'new:/studio/app.html');
  assert.equal(await nc.get('/studio/board.html').clone().text(),'old:/studio/board.html','옮겨 담은 본문');
  assert.equal(await nc.get('/studio/sync.js').text(),'old:/studio/sync.js','어긋난 것은 새로 받은 본문');
  const st=JSON.parse(await nc.get('/__ps_sw_install__').text());
  assert.equal(st.manifest,true); assert.equal(st.fetched,expect.length); assert.equal(st.reused,all.length-expect.length);
  assert.ok(nc.has('/sw-manifest.json'),'목록도 판 캐시에');
});

test('서비스워커 install — 목록이 없거나 다른 판의 목록이면 예전처럼 전부 받는다',async()=>{
  for(const manifest of [null,{v:1,release:'process-3.050',files:{}}]){
    const h=swHarness({manifest,oldBodies:{'/studio/board.html':'old:/studio/board.html'}});
    await h.install();
    const all=[...new Set(h.ctx.__CORE.concat(h.ctx.__OPTIONAL))];
    assert.deepEqual(h.fetched.filter(p=>p!=='/sw-manifest.json').sort(),all.slice().sort());
  }
  const sw=R('sw.js');
  assert.match(sw,/if \(!j \|\| j\.release !== CACHE \|\| !j\.files \|\| typeof j\.files !== 'object'\) return null;/);
  assert.match(sw,/await eachLimit\(CORE, 6, path => precache\(cache, path, files, olds, stats\)\);/,'필수 파일은 여전히 하나라도 실패하면 install 실패');
});

test('SQL 시험은 migrations/*.local-test.cjs 전부 · 버전 정본은 PS_BUILD 하나 · README 는 시작 안내',()=>{
  const runner=R('scripts/test-sql.cjs');
  assert.match(runner,/fs\.readdirSync\(dir\)\.filter\(f=>f\.endsWith\('\.local-test\.cjs'\)\)/);
  assert.doesNotMatch(runner,/const files=\['00000000_baseline'/,'손으로 적은 목록이 아니다');
  assert.equal(JSON.parse(R('package.json')).version,'0.0.0');
  assert.equal(JSON.parse(R('package-lock.json')).version,'0.0.0');
  const readme=R('README.md');
  assert.ok(readme.split('\n').length<60,'README 는 짧은 시작 안내');
  for(const s of ['npm test','npm run test:sql','docs/OPERATIONS.md','docs/device-checklist.md','PS_BUILD','운영 Supabase'])assert.ok(readme.includes(s),s);
  assert.ok(fs.existsSync(path.join(root,'docs/changelog-until-2.886.md')),'옛 변경 기록은 docs 로');
});

test('배포 열차 · 승격 PR 실기기 점검 칸',()=>{
  const ops=R('docs/OPERATIONS.md'), tpl=R('.github/pull_request_template.md');
  assert.match(ops,/### 배포 열차/); assert.match(ops,/`main` 승격은 주 2회/); assert.match(ops,/보드 표현력 신규 작업은 12\/2 까지 동결/);
  assert.match(ops,/release-guard\.mjs` 가 지금 사이트의 목록과 견준다/);
  assert.match(tpl,/## 승격 PR\(`staging` → `main`\)만 — 실기기 점검 \(필수\)/); assert.match(tpl,/release-guard\.mjs/);
});
