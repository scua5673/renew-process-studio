import {pathToFileURL} from 'node:url';
const REPOSITORY='scua5673/renew-process-studio';
export function verdict(checks,sha){
 if(!Array.isArray(checks))return 'wait';
 const gate=checks.filter(c=>c.name==='release-gate'&&c.app?.slug==='github-actions'&&c.head_sha===sha).sort((a,b)=>(b.id||0)-(a.id||0))[0];
 if(!gate||gate.status!=='completed')return 'wait';
 return gate.conclusion==='success'?'pass':'fail';
}
/* 10/21(판 그대로 3.141 — 배포 묶음 밖 스크립트) — 토큰 없는 GitHub API 는 IP 하나에 시간당 60번이다. Netlify 짓기 기계는 IP 를 여럿이 같이 써서 한도가 바닥나면
   403 «API rate limit exceeded» 가 났고, 예전엔 그 자리에서 멈춰 3.137 · 3.141 실서버 게시가 실패했다(testprocess 는 다른 기계라 통과).
   Netlify 환경 변수 GITHUB_TOKEN(읽기 전용이면 충분)이 있으면 그것으로 묻고(시간당 5,000번), 한도 403 · 429 는 멈추지 않고 기다리는 동안 다시 묻는다.
   10/28(3.201) — 기다리는 시간 12분 → 20분. CI «Storage safety» 는 실행기가 비어 있을 때 13~14분, PR 둘이 함께 돌면 17~18분이다.
   12분은 그 사이의 운에 걸려 있었다(10/28 staging 3.201 게시가 17분 CI 에 걸려 실패, 3.117 때도 main 이 18분). */
// 11/3 — 운영 CI가 실행기 대기를 포함해 22분 53초 걸렸다. 같은 커밋의 전체 통과 조건을 유지하며 30분까지 기다린다.
export const GATE_WAIT_MS=30*60*1000;
export function rateLimited(response){
 if(!response||response.ok)return false;
 if(response.status===429)return true;
 if(response.status!==403)return false;
 const h=response.headers,get=k=>h&&typeof h.get==='function'?h.get(k):null;
 return get('x-ratelimit-remaining')==='0'||get('retry-after')!=null;
}
/* 11/3(판 번호 없음 — 배포 묶음 밖 스크립트) — Netlify 짓기는 CI 를 끝까지 기다리지 못한다: 3.246 · 3.250 게시가 «Failed during stage 'building site':
   Command did not finish within the time limit»(짓기 시작 뒤 약 18분)로 멈췄고, 그날 CI 는 23분이었다. 그래서 위 30분 대기는 그 전에 잘린다.
   합치는 커밋(가지에 PR 을 합칠 때 · staging → main 승격)의 내용은 대개 이미 CI 를 통과한 부모와 글자 하나 다르지 않다.
   그 부모의 release-gate 를 쓴다 — 조건 둘: ① 트리(파일 전체의 해시)가 같다 ② 다른 부모가 모두 그 부모의 조상이다
   (PR CI 는 «기준 가지 + PR» 을 합친 것을 시험한다 — 기준이 PR 에 이미 들어 있어야 시험한 내용이 그 PR 의 트리와 같다).
   찾지 못하거나 묻다 실패하면 예전처럼 이 커밋의 CI 만 기다린다. 이 커밋의 CI 가 빨강이면 부모가 초록이어도 멈춘다. */
export async function sameTreeParents(sha,ask){
 const commit=async c=>{const r=await ask('git/commits/'+c);return r&&r.tree&&r.tree.sha?r:null;};
 const head=await commit(sha);if(!head||!Array.isArray(head.parents)||head.parents.length<2)return [];
 const parents=head.parents.map(p=>p&&p.sha).filter(c=>/^[a-f0-9]{40}$/i.test(c||''));if(parents.length!==head.parents.length)return [];
 const out=[];
 for(const p of parents){
  const pc=await commit(p);if(!pc||pc.tree.sha!==head.tree.sha)continue;
  let ok=true;
  for(const q of parents){if(q===p)continue;const cmp=await ask(`compare/${q}...${p}?per_page=1`);if(!cmp||!['ahead','identical'].includes(cmp.status)){ok=false;break;}}
  if(ok)out.push(p);
 }
 return out;
}
export async function verify({env=process.env,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,log=console.log}={}){
 if(env.CONTEXT!=='production'){log('Production CI gate applies to production deploys only.');return;}
 const sha=env.COMMIT_REF;if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('A production deploy requires an exact COMMIT_REF.');
 const token=String(env.GITHUB_TOKEN||'').trim();
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 if(token)headers.Authorization='Bearer '+token;
 log('release-gate lookup '+(token?'with GITHUB_TOKEN':'without a token (60 requests/hour per build IP — set GITHUB_TOKEN in Netlify)'));
 const deadline=now()+GATE_WAIT_MS;let limited=false,twins=null,asksLimited=0;
 const api=`https://api.github.com/repos/${REPOSITORY}/`;
 const ask=async path=>{const r=await fetcher(api+path,{headers});if(rateLimited(r)){limited=true;asksLimited++;return null;}return r&&r.ok?r.json():null;};
 while(now()<deadline){
  const response=await fetcher(`${api}commits/${sha}/check-runs?filter=latest&per_page=100`,{headers});
  if(rateLimited(response)){limited=true;log('GitHub API rate limit on this build machine — retrying in 30s');await sleep(30000);continue;}
  if(!response.ok)throw Error(`Cannot verify release-gate (${response.status}); production deploy stopped.`);
  const state=verdict((await response.json()).check_runs,sha);
  if(state==='pass'){log('Exact production commit passed Node, SQL restore and Chromium/WebKit CI.');return;}
  if(state==='fail')throw Error('release-gate failed; production deploy stopped.');
  if(twins===null){
   const before=asksLimited;twins=[];
   try{twins=await sameTreeParents(sha,ask);}catch(e){log('Same-content parent lookup skipped: '+e.message);}
   if(twins.length)log('Same-content parent'+(twins.length>1?'s':'')+': '+twins.map(c=>c.slice(0,12)).join(', '));
   else if(asksLimited>before)twins=null;   // 한도에 걸려 못 찾았으면 다음 회차에 다시 찾는다
  }
  for(const twin of twins||[]){
   const runs=await ask(`commits/${twin}/check-runs?filter=latest&per_page=100`);
   if(runs&&verdict(runs.check_runs,twin)==='pass'){log('Commit '+twin.slice(0,12)+' with the identical tree already passed Node, SQL restore and Chromium/WebKit CI.');return;}
  }
  log('Waiting for release-gate on '+sha.slice(0,12));await sleep(30000);
 }
 if(limited)throw Error('GitHub API rate limit kept the release-gate check from answering for 30 minutes; production deploy stopped. Add GITHUB_TOKEN to the Netlify environment (docs/OPERATIONS.md §2).');
 throw Error('release-gate was not confirmed within 30 minutes; production deploy stopped.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)verify().catch(e=>{console.error(e.message);process.exitCode=1;});
