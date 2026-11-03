const test=require('node:test'),assert=require('node:assert/strict');
const sha='a'.repeat(40),base={id:1,name:'release-gate',head_sha:sha,status:'completed',conclusion:'success',app:{slug:'github-actions'}};
test('production gate requires success on the exact commit from GitHub Actions',async()=>{const {verdict}=await import('../scripts/verify-release.mjs');assert.equal(verdict([base],sha),'pass');for(const patch of [{head_sha:'b'.repeat(40)},{app:{slug:'other'}},{name:'different'},{status:'queued'}])assert.equal(verdict([{...base,...patch}],sha),'wait');for(const conclusion of ['failure','cancelled','skipped','neutral','timed_out',null])assert.equal(verdict([{...base,conclusion}],sha),'fail');assert.equal(verdict([base,{...base,id:2,status:'in_progress'}],sha),'wait');});
test('production gate never deploys on API failure or a missing check',async()=>{const {verify}=await import('../scripts/verify-release.mjs');let clock=0;const opts={env:{CONTEXT:'production',COMMIT_REF:sha},now:()=>clock,sleep:async ms=>{clock+=ms;},log(){}};await assert.rejects(verify({...opts,fetcher:async()=>({ok:false,status:403})}),/stopped/);await assert.rejects(verify({...opts,fetcher:async()=>({ok:true,json:async()=>({check_runs:[]})})}),/30 minutes/);await verify({...opts,fetcher:async()=>({ok:true,json:async()=>({check_runs:[base]})}),now:()=>0});});
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
  // 30분 내내 한도면 토큰을 넣으라고 말하며 멈춘다
  clock=0;await assert.rejects(verify({...opts,fetcher:async()=>limited}),/GITHUB_TOKEN/);
  // 토큰이 있으면 Authorization 으로 묻는다 — 없으면 보내지 않는다
  let seen=null;await verify({...opts,env:{...opts.env,GITHUB_TOKEN:' ghp_x '},fetcher:async(url,init)=>{seen=init.headers;return {ok:true,json:async()=>({check_runs:[base]})};}});
  assert.equal(seen.Authorization,'Bearer ghp_x');
  await verify({...opts,fetcher:async(url,init)=>{seen=init.headers;return {ok:true,json:async()=>({check_runs:[base]})};}});
  assert.equal('Authorization' in seen,false);
});

test('production gate accepts exact-commit success after a 23-minute runner delay',async()=>{
  const {verify}=await import('../scripts/verify-release.mjs');
  let clock=0,calls=0;
  await verify({env:{CONTEXT:'production',COMMIT_REF:sha},now:()=>clock,sleep:async ms=>{clock+=ms;},log(){},fetcher:async()=>{calls++;return {ok:true,json:async()=>({check_runs:clock>=23*60*1000?[base]:[]})};}});
  assert.equal(clock,23*60*1000);
  assert.ok(calls>1);
});

// 11/3(판 번호 없음) — Netlify 짓기는 약 18분에 끊긴다(3.246 · 3.250 «Command did not finish within the time limit»). 23분 CI 를 기다리지 못하므로,
// 합친 커밋의 트리가 이미 CI 를 통과한 부모와 같고 다른 부모가 그 부모의 조상이면 그 결과를 쓴다.
test('production gate reuses the release-gate of a parent with the identical tree',async()=>{
  const {verify}=await import('../scripts/verify-release.mjs');
  const M='c'.repeat(40),P='d'.repeat(40),B='e'.repeat(40),T='f'.repeat(40);
  const gate=c=>({...base,head_sha:c});
  const world=({tree=T,status='ahead',runs={[P]:[gate(P)]},parents=[B,P]}={})=>{
    const seen=[];
    const fetcher=async url=>{
      const path=url.replace('https://api.github.com/repos/scua5673/renew-process-studio/','');seen.push(path);
      const ok=body=>({ok:true,json:async()=>body});
      let m;
      if((m=/^commits\/([a-f0-9]{40})\/check-runs/.exec(path)))return ok({check_runs:runs[m[1]]||[]});
      if((m=/^git\/commits\/([a-f0-9]{40})$/.exec(path))){const c=m[1];return ok(c===M?{tree:{sha:T},parents:parents.map(sha=>({sha}))}:{tree:{sha:c===P?tree:B}});}
      if((m=/^compare\/([a-f0-9]{40})\.\.\.([a-f0-9]{40})/.exec(path)))return ok({status:m[1]===B&&m[2]===P?status:'diverged'});
      return {ok:false,status:404};
    };
    return {fetcher,seen};
  };
  let clock=0;const opts={env:{CONTEXT:'production',COMMIT_REF:M},now:()=>clock,sleep:async ms=>{clock+=ms;},log(){}};
  // 같은 트리 · 기준이 PR 에 들어 있음 · 그 PR 이 초록 → 기다리지 않고 통과
  let w=world();await verify({...opts,fetcher:w.fetcher});
  assert.equal(clock,0);assert.ok(w.seen.includes(`compare/${B}...${P}?per_page=1`));
  // 트리가 다르면(합치며 내용이 바뀜) 쓰지 않는다 — 이 커밋의 CI 를 기다리다 멈춘다
  clock=0;await assert.rejects(verify({...opts,fetcher:world({tree:'9'.repeat(40)}).fetcher}),/30 minutes/);
  // 기준이 PR 의 조상이 아니면(PR CI 가 시험한 것과 다를 수 있음) 쓰지 않는다
  clock=0;await assert.rejects(verify({...opts,fetcher:world({status:'diverged'}).fetcher}),/30 minutes/);
  // 부모의 CI 가 아직이거나 빨강이면 쓰지 않는다
  clock=0;await assert.rejects(verify({...opts,fetcher:world({runs:{[P]:[{...gate(P),status:'in_progress'}]}}).fetcher}),/30 minutes/);
  clock=0;await assert.rejects(verify({...opts,fetcher:world({runs:{[P]:[{...gate(P),conclusion:'failure'}]}}).fetcher}),/30 minutes/);
  // 합친 커밋이 아니면(부모 하나) 찾지 않는다
  clock=0;w=world({parents:[P]});await assert.rejects(verify({...opts,fetcher:w.fetcher}),/30 minutes/);
  assert.equal(w.seen.some(p=>p.startsWith('compare/')),false);
  // 이 커밋의 CI 가 빨강이면 같은 트리의 부모가 초록이어도 멈춘다
  clock=0;await assert.rejects(verify({...opts,fetcher:world({runs:{[P]:[gate(P)],[M]:[{...gate(M),conclusion:'failure'}]}}).fetcher}),/release-gate failed/);
  // 부모의 CI 가 기다리는 동안 끝나면 그때 통과한다
  clock=0;w=world({runs:{}});const late=w.fetcher;
  await verify({...opts,fetcher:async url=>{if(clock>=5*60*1000&&url.includes(`commits/${P}/check-runs`))return {ok:true,json:async()=>({check_runs:[gate(P)]})};return late(url);}});
  assert.equal(clock,5*60*1000);
});
