const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('../studio/letter-social.js'),L=require('../studio/community-letters.js');
test('public share addresses select a letter and contain no account information',()=>{
  assert.equal(S.url(3,'https://processstudio.netlify.app'),'https://processstudio.netlify.app/studio/letter/03/?share=letter-v1');
  for(const n of [0,-1,'3',1.5,1000])assert.throws(()=>S.url(n,'https://example.invalid'));
});
test('counts reject absent and malformed data rather than claiming zero',()=>{
  assert.deepEqual(S.parse([{issue:3,readers:4,likes:2,liked:true}]),{3:{readers:4,likes:2,liked:true}});
  for(const rows of [null,{},[{issue:3,readers:-1,likes:0,liked:false}],[{issue:3,readers:1,likes:'1',liked:false}]])assert.throws(()=>S.parse(rows));
});
test('anonymous identity survives visits and fails closed when browser storage is blocked',()=>{
  const map=new Map(),id='11111111-1111-4111-8111-111111111111';let minted=0;
  const w={crypto:{randomUUID:()=>{minted++;return id;}},localStorage:{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}};
  assert.equal(S.visitor(w),id);assert.equal(S.visitor(w),id);assert.equal(minted,1);
  assert.equal(S.visitor({get localStorage(){throw Error('blocked');}}),null);
});
test('an expired app login reads public counts as a guest without sending the stale token',async()=>{
  let time=1000;const requests=[],map=new Map(),id='11111111-1111-4111-8111-111111111111';
  const w={document:{},crypto:{randomUUID:()=>id},localStorage:{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},AbortController,setTimeout,clearTimeout,addEventListener(){}};
  const social=S.create({window:w,now:()=>time,session:()=>({uid:'account',at:'access-token',exp:2000}),fetch:async(url,init)=>{requests.push(init);return {ok:true,json:async()=>[]};}});
  await social.refresh();assert.equal(requests[0].headers.Authorization,'Bearer access-token');
  time=2001;await social.refresh();assert.equal(requests[1].headers.Authorization,undefined);
  assert.equal(JSON.parse(requests[1].body).p_visitor,id,'same browser identity can merge on the next valid login');
});
test('popular sorting uses reader and reaction counts and remains deterministic on ties',()=>{
  const rows=[{number:1,title:'one'},{number:2,title:'two'},{number:3,title:'three'}],stats={1:{readers:1,likes:5},2:{readers:4,likes:0},3:{readers:4,likes:2}};
  assert.deepEqual(L.select(rows,'','readers',stats).map(r=>r.number),[2,3,1]);
  assert.deepEqual(L.select(rows,'','likes',stats).map(r=>r.number),[1,3,2]);
});
test('every public letter has its full body and unique share metadata before any JavaScript runs',async()=>{
  const {buildPublicLetters}=await import('../scripts/build-public-letters.mjs'),out=fs.mkdtempSync(path.join(os.tmpdir(),'ps-letters-'));
  try{
    const files=buildPublicLetters(out);assert.equal(files.length,47);
    for(let n=1;n<=46;n++){
      const id=String(n).padStart(2,'0'),d=JSON.parse(fs.readFileSync(path.join(__dirname,'../studio/letters',id+'.json'),'utf8'));
      const html=fs.readFileSync(path.join(out,'studio/letter',id,'index.html'),'utf8');
      assert.ok(html.includes(L.rich(d.title)));assert.match(html,new RegExp('og:url" content="https://processstudio.netlify.app/studio/letter/'+id+'/'));
      for(const piece of d.pieces)for(const p of piece.points)assert.ok(html.includes(L.rich(p)),`letter ${id} retains full article`);
      assert.equal((html.match(/data-letter-share=/g)||[]).length,2);
      assert.doesNotMatch(html,/src="[^\"]*(?:sync\.js|app\.html)/);
      assert.match(html,/href="\/studio\/letter\/"/);
    }
  }finally{fs.rmSync(out,{recursive:true,force:true});}
});
