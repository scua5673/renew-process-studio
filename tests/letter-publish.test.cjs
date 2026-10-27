const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('publication fingerprint changes for manuscripts, builder and media; ignores generated dist',async t=>{const {sourceFingerprint}=await import('../scripts/publish-letters.mjs');const root=fs.mkdtempSync(path.join(os.tmpdir(),'letter-source-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'src/issues'),{recursive:true});fs.writeFileSync(path.join(root,'build.py'),'builder');fs.writeFileSync(path.join(root,'src/issues/01.json'),'original');const a=sourceFingerprint(root);fs.mkdirSync(path.join(root,'dist'));fs.writeFileSync(path.join(root,'dist/index.html'),'generated');assert.equal(sourceFingerprint(root),a);fs.writeFileSync(path.join(root,'src/issues/01.json'),'corrected');const b=sourceFingerprint(root);assert.notEqual(a,b);fs.writeFileSync(path.join(root,'src/video.mp4'),'media');assert.notEqual(sourceFingerprint(root),b);});
test('content releases advance both shell and service worker without changing other asset versions',async t=>{
 const {bumpBuild,nextBuild}=await import('../scripts/publish-letters.mjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'letter-version-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const current=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').match(/process-([0-9.]+)/)[1],next=nextBuild(current),unrelated='1.'+(Number(current.split('.')[1])+10);
 fs.mkdirSync(path.join(root,'studio'));
 fs.writeFileSync(path.join(root,'sw.js'),"const CACHE = 'process-"+current+"';");
 fs.writeFileSync(path.join(root,'studio/app.html'),"window.PS_BUILD='"+current+"'; <script src='a.js?v="+current+"'></script><link href='a.css?v="+unrelated+"'>");
 assert.equal(bumpBuild(root),next);assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes('process-'+next));
 assert.ok(fs.readFileSync(path.join(root,'studio/app.html'),'utf8').includes('a.js?v='+next));
 assert.ok(fs.readFileSync(path.join(root,'studio/app.html'),'utf8').includes('a.css?v='+unrelated));
});
test('matching revision metadata cannot hide a stale manuscript on either site',async t=>{
 const {verifyPublishedLetters}=await import('../scripts/publish-letters.mjs');const feed=fs.mkdtempSync(path.join(os.tmpdir(),'letter-feed-'));t.after(()=>fs.rmSync(feed,{recursive:true,force:true}));
 const index={version:1,issues:[{number:1,title:'Correct'}]},doc={number:1,title:'Correct',pieces:[{points:['corrected paragraph']}]};fs.writeFileSync(path.join(feed,'index.json'),JSON.stringify(index));fs.writeFileSync(path.join(feed,'01.json'),JSON.stringify(doc));
 const fetcher=async url=>({ok:true,json:async()=>url.endsWith('revision.json')?{revision:'same'}:url.endsWith('index.json')?index:doc});
 assert.equal((await verifyPublishedLetters({revision:'same',feed,fetcher})).letters,1);
 const stale=async url=>url.includes('processstudio')&&url.endsWith('01.json')?{ok:true,json:async()=>({...doc,title:'Old'})}:fetcher(url);
 await assert.rejects(verifyPublishedLetters({revision:'same',feed,fetcher:stale}),/Published manuscript differs/);
});
