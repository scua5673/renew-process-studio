import {pathToFileURL} from 'node:url';
const REPOSITORY='scua5673/renew-process-studio';
export function verdict(checks,sha){
 if(!Array.isArray(checks))return 'wait';
 const gate=checks.filter(c=>c.name==='release-gate'&&c.app?.slug==='github-actions'&&c.head_sha===sha).sort((a,b)=>(b.id||0)-(a.id||0))[0];
 if(!gate||gate.status!=='completed')return 'wait';
 return gate.conclusion==='success'?'pass':'fail';
}
export async function verify({env=process.env,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,log=console.log}={}){
 if(env.CONTEXT!=='production'){log('Production CI gate applies to production deploys only.');return;}
 const sha=env.COMMIT_REF;if(!/^[a-f0-9]{40}$/i.test(sha||''))throw Error('A production deploy requires an exact COMMIT_REF.');
 const deadline=now()+12*60*1000;
 while(now()<deadline){
  const response=await fetcher(`https://api.github.com/repos/${REPOSITORY}/commits/${sha}/check-runs?filter=latest&per_page=100`,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!response.ok)throw Error(`Cannot verify release-gate (${response.status}); production deploy stopped.`);
  const state=verdict((await response.json()).check_runs,sha);
  if(state==='pass'){log('Exact production commit passed Node, SQL restore and Chromium/WebKit CI.');return;}
  if(state==='fail')throw Error('release-gate failed; production deploy stopped.');
  log('Waiting for release-gate on '+sha.slice(0,12));await sleep(30000);
 }
 throw Error('release-gate was not confirmed within 12 minutes; production deploy stopped.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)verify().catch(e=>{console.error(e.message);process.exitCode=1;});
