const test=require('node:test'),assert=require('node:assert/strict');
const sha='a'.repeat(40),base={id:1,name:'release-gate',head_sha:sha,status:'completed',conclusion:'success',app:{slug:'github-actions'}};
test('production gate requires success on the exact commit from GitHub Actions',async()=>{const {verdict}=await import('../scripts/verify-release.mjs');assert.equal(verdict([base],sha),'pass');for(const patch of [{head_sha:'b'.repeat(40)},{app:{slug:'other'}},{name:'different'},{status:'queued'}])assert.equal(verdict([{...base,...patch}],sha),'wait');for(const conclusion of ['failure','cancelled','skipped','neutral','timed_out',null])assert.equal(verdict([{...base,conclusion}],sha),'fail');assert.equal(verdict([base,{...base,id:2,status:'in_progress'}],sha),'wait');});
test('production gate never deploys on API failure or a missing check',async()=>{const {verify}=await import('../scripts/verify-release.mjs');let clock=0;const opts={env:{CONTEXT:'production',COMMIT_REF:sha},now:()=>clock,sleep:async ms=>{clock+=ms;},log(){}};await assert.rejects(verify({...opts,fetcher:async()=>({ok:false,status:403})}),/stopped/);await assert.rejects(verify({...opts,fetcher:async()=>({ok:true,json:async()=>({check_runs:[]})})}),/20 minutes/);await verify({...opts,fetcher:async()=>({ok:true,json:async()=>({check_runs:[base]})}),now:()=>0});});
// 10/21 — 토큰 없는 GitHub API 한도(IP 하나에 시간당 60번)에 걸린 Netlify 짓기 기계가 3.137 · 3.141 실서버 게시를 멈췄다.
test('production gate retries GitHub rate limits instead of stopping, and uses GITHUB_TOKEN when set',async()=>{
  const {verify,rateLimited}=await import('../scripts/verify-release.mjs');
  const hdr=o=>({get:k=>o[k.toLowerCase()]??null});
  const limited={ok:false,status:403,headers:hdr({'x-ratelimit-remaining':'0'})};
  assert.equal(rateLimited(limited),true);
  assert.equal(rateLimited({ok:false,status:429}),true);
  assert.equal(rateLimited({ok:false,status:403,headers:hdr({'x-ratelimit-remaining':'12'})}),false);
  assert.equal(rateLimited({ok:false,status:403}),false);
  assert.equal(rateLimited({ok:false,status:404,headers:hdr({'x-ratelimit-remaining':'0'})}),false);
  let clock=0;const opts={env:{CONTEXT:'production',COMMIT_REF:sha},now:()=>clock,sleep:async ms=>{clock+=ms;},log(){}};
  // 한도에 두 번 걸린 뒤 풀리면 그대로 통과한다
  let calls=0;await verify({...opts,fetcher:async()=>(++calls<=2?limited:{ok:true,json:async()=>({check_runs:[base]})})});
  assert.equal(calls,3);
  // 20분 내내 한도면 토큰을 넣으라고 말하며 멈춘다
  clock=0;await assert.rejects(verify({...opts,fetcher:async()=>limited}),/GITHUB_TOKEN/);
  // 토큰이 있으면 Authorization 으로 묻는다 — 없으면 보내지 않는다
  let seen=null;await verify({...opts,env:{...opts.env,GITHUB_TOKEN:' ghp_x '},fetcher:async(url,init)=>{seen=init.headers;return {ok:true,json:async()=>({check_runs:[base]})};}});
  assert.equal(seen.Authorization,'Bearer ghp_x');
  await verify({...opts,fetcher:async(url,init)=>{seen=init.headers;return {ok:true,json:async()=>({check_runs:[base]})};}});
  assert.equal('Authorization' in seen,false);
});
