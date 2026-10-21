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
   Netlify 환경 변수 GITHUB_TOKEN(읽기 전용이면 충분)이 있으면 그것으로 묻고(시간당 5,000번), 한도 403 · 429 는 멈추지 않고 12분 안에서 다시 묻는다. */
export function rateLimited(response){
 if(!response||response.ok)return false;
 if(response.status===429)return true;
 if(response.status!==403)return false;
 const h=response.headers,get=k=>h&&typeof h.get==='function'?h.get(k):null;
 return get('x-ratelimit-remaining')==='0'||get('retry-after')!=null;
}
export async function verify({env=process.env,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,log=console.log}={}){
 if(env.CONTEXT!=='production'){log('Production CI gate applies to production deploys only.');return;}
 const sha=env.COMMIT_REF;if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('A production deploy requires an exact COMMIT_REF.');
 const token=String(env.GITHUB_TOKEN||'').trim();
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 if(token)headers.Authorization='Bearer '+token;
 log('release-gate lookup '+(token?'with GITHUB_TOKEN':'without a token (60 requests/hour per build IP — set GITHUB_TOKEN in Netlify)'));
 const deadline=now()+12*60*1000;let limited=false;
 while(now()<deadline){
  const response=await fetcher(`https://api.github.com/repos/${REPOSITORY}/commits/${sha}/check-runs?filter=latest&per_page=100`,{headers});
  if(rateLimited(response)){limited=true;log('GitHub API rate limit on this build machine — retrying in 30s');await sleep(30000);continue;}
  if(!response.ok)throw Error(`Cannot verify release-gate (${response.status}); production deploy stopped.`);
  const state=verdict((await response.json()).check_runs,sha);
  if(state==='pass'){log('Exact production commit passed Node, SQL restore and Chromium/WebKit CI.');return;}
  if(state==='fail')throw Error('release-gate failed; production deploy stopped.');
  log('Waiting for release-gate on '+sha.slice(0,12));await sleep(30000);
 }
 if(limited)throw Error('GitHub API rate limit kept the release-gate check from answering for 12 minutes; production deploy stopped. Add GITHUB_TOKEN to the Netlify environment (docs/OPERATIONS.md §2).');
 throw Error('release-gate was not confirmed within 12 minutes; production deploy stopped.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)verify().catch(e=>{console.error(e.message);process.exitCode=1;});
