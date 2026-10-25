const test=require('node:test'),assert=require('node:assert/strict');
test('deploy artifact permits runtime files and excludes development or local reports',async()=>{const {isRuntimeFile}=await import('../scripts/package-site.mjs');for(const f of ['studio/board.html','studio/board-token-depth.js','vendor/font.woff2','guide/quick.html','sw.js','manifest.json','_headers','_redirects'])assert.equal(isRuntimeFile(f),true,f);for(const f of ['outputs/private.md','test-results/report.json','node_modules/library.js','docs/operations.md','migrations/fixture.sql','tests/browser/board.mjs','scripts/package-site.mjs','package.json','package-lock.json','.env','studio/../private.html','studio/.secret'])assert.equal(isRuntimeFile(f),false,f);});
test('packaging seals all frame APIs, CSP and hashes to the same explicit backend',async()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
 const {packageSite}=await import('../scripts/package-site.mjs'),{TEST_SITE,PRODUCTION_SITE}=await import('../scripts/backend-config.mjs'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ps-backend-package-'));
 const source=path.resolve(__dirname,'..'),git=process.env.PS_GIT_BIN||'git',project='abcdefghijklmnopqrst';
 try{
  const files={'studio/app.html':"<script>window.PS_BUILD='9.999'</script>",'studio/board.html':'<script src="storage.js"></script>','studio/board-token-depth.js':'/* fixture */','studio/backend-config.js':fs.readFileSync(path.join(source,'studio/backend-config.js'),'utf8'),'studio/storage.js':'window.fixtureStorageLoaded=true;','sw.js':"const CACHE = 'process-9.999';\n",'_headers':fs.readFileSync(path.join(source,'_headers'),'utf8'),'_redirects':'/ /studio/app.html 200\n'};
  for(const [file,body] of Object.entries(files)){const target=path.join(tmp,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);}
  execFileSync(git,['init','--quiet'],{cwd:tmp});execFileSync(git,['add','--',...Object.keys(files)],{cwd:tmp});
  const testEnv={NETLIFY:'true',SITE_ID:TEST_SITE,CONTEXT:'production',BRANCH:'staging',PS_BACKEND_ROLE:'test',PS_TEST_SUPABASE_URL:'https://'+project+'.supabase.co',PS_TEST_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_test_public_key'};
  packageSite(tmp,testEnv);
  const out=path.join(tmp,'dist'),read=f=>fs.readFileSync(path.join(out,f),'utf8'),manifest=JSON.parse(read('sw-manifest.json'));
  assert.deepEqual(manifest.backend,{environment:'test',project});assert.equal(manifest.build,'9.999');
  assert.ok(read('studio/storage.js').startsWith(read('studio/backend-config.js')+'\n'));
  for(const file of ['studio/backend-config.js','studio/storage.js','_headers']){assert.ok(!read(file).includes('jvtajoeptzfsdwizxejg'),file);assert.ok(read(file).includes(project),file);}
  for(const [file,hash] of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(read(file.slice(1))).digest('hex'),hash,file);
  fs.writeFileSync(path.join(out,'keep-on-failure'),'prior valid artifact');assert.throws(()=>packageSite(tmp,{...testEnv,PS_TEST_SUPABASE_URL:''}),/no production fallback/);assert.equal(read('keep-on-failure'),'prior valid artifact');
  packageSite(tmp,{NETLIFY:'true',SITE_ID:PRODUCTION_SITE,CONTEXT:'production',BRANCH:'main',PS_BACKEND_ROLE:'production'});
  const live=JSON.parse(read('sw-manifest.json'));assert.equal(live.backend.environment,'production');assert.equal(live.release,manifest.release);
  for(const file of ['/studio/backend-config.js','/studio/storage.js','/_headers'])assert.notEqual(live.files[file],manifest.files[file],file+' differs per environment even at the same source version');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
