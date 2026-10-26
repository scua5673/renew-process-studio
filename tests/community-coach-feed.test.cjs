const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const src=fs.readFileSync(path.join(__dirname,'../studio/community.html'),'utf8');
const feed=src.slice(src.indexOf('function fetchPosts('),src.indexOf('function paintLike('));
const readers=src.slice(src.indexOf('var ELM_UID='),src.indexOf('function elmPath('));
const training=require('../studio/community-training.js');
const plain=x=>JSON.parse(JSON.stringify(x));

async function load({sort='new',cache=false,fallback=false}={}){
  const stored=new Map(),requests=[];
  let painted;
  const rendered=new Promise(resolve=>{painted=resolve;});
  const ctx=vm.createContext({
    PSCommunityTraining:training,sort,posts:[],ready:false,tabF:'coach',FEED_CK:'feed',FEED_TTL:60000,
    COMM_FULL:'id,owner,likes',COMM_LEAN:'id,owner',
    cmStage(){},base:()=> 'https://fixture.invalid',hd:()=>({}),$:()=>({}),
    fetchMyLikes:()=>Promise.resolve(),render:()=>painted(),elmStale(){},
    sessionStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
    fetch:async url=>{
      requests.push(new URL(url));
      if(fallback&&requests.length===1)return {status:400};
      return {ok:true,status:200,json:async()=>ctx.rows};
    }
  });
  vm.runInContext(readers+feed,ctx);
  ctx.rows=[{id:'elm',owner:ctx.ELM_UID,owner_name:'바뀐 이름'},
    {id:'coach',owner:'another-account',owner_name:'엘미하'},
    {id:training.catalog.posts[0].id,owner:training.catalog.owner,owner_name:'프로세스'}];
  if(cache)stored.set('feed',JSON.stringify({sort,at:Date.now(),posts:ctx.rows}));
  ctx.fetchPosts();
  await rendered;
  return {ctx,requests,stored};
}

for(const sort of ['new','views','likes','copies'])test(`coach feed excludes the account before the 100-row limit: ${sort}`,async()=>{
  const {ctx,requests,stored}=await load({sort});
  assert.equal(requests.length,1);
  assert.equal(requests[0].searchParams.get('owner'),'neq.'+ctx.ELM_UID);
  assert.equal(requests[0].searchParams.get('limit'),'100');
  assert.equal(requests[0].searchParams.get('id'),new URL('https://fixture.invalid/?'+training.exclude().slice(1)).searchParams.get('id'));
  assert.equal(requests[0].searchParams.get('order'),sort==='new'?'created_at.desc':sort+'.desc,created_at.desc');
  assert.deepEqual(plain(ctx.posts),[ctx.rows[1]],'account identity controls the split, regardless of display names');
  assert.deepEqual(JSON.parse(stored.get('feed')).posts,[ctx.rows[1]],'only coach rows enter the new cache');
});

test('a mixed cache from an earlier release cannot put tactical notes back in the coach feed',async()=>{
  const {ctx,requests}=await load({cache:true});
  assert.equal(requests.length,0);
  assert.deepEqual(plain(ctx.posts),[ctx.rows[1]]);
});

test('the compatibility retry keeps the same account exclusion',async()=>{
  const {ctx,requests}=await load({sort:'likes',fallback:true});
  assert.equal(requests.length,2);
  for(const req of requests)assert.equal(req.searchParams.get('owner'),'neq.'+ctx.ELM_UID);
  assert.equal(requests[1].searchParams.get('select'),'id,owner');
  assert.deepEqual(plain(ctx.posts),[ctx.rows[1]]);
});
