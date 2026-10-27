#!/usr/bin/env node
/* One editorial publication, two sites. No new credentials: use the user's existing gh/Netlify login. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {importLetters} from './import-community-letters.mjs';
const REPO='scua5673/renew-process-studio',STUDIO='51517b22-e1df-493a-ad81-5204303ded1b',TEST='52c8c8c7-f3ae-41e0-95ae-19233921a900',LETTER='ec0233f6-920d-4665-9ff7-61f15dd269a1';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>crypto.createHash('sha1').update(b).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function run(bin,args,cwd=ROOT){return execFileSync(bin,args,{cwd,encoding:'utf8',env:{...process.env,DEVELOPER_DIR:process.env.DEVELOPER_DIR||'/Library/Developer/CommandLineTools'},maxBuffer:32*1024*1024}).trim();}
const git=(args,cwd)=>run('git',args,cwd);
function files(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(root,x.name)).map(y=>x.name+'/'+y):[x.name]);}
export function sourceFingerprint(source){const names=['build.py',...files(path.join(source,'src')).map(x=>'src/'+x)].sort();return crypto.createHash('sha256').update(names.map(n=>n+':'+crypto.createHash('sha256').update(fs.readFileSync(path.join(source,n))).digest('hex')+'\n').join('')).digest('hex');}
export function nextBuild(value){const m=/^(\d+)\.(\d+)$/.exec(value);if(!m)throw Error('Invalid build '+value);return m[1]+'.'+(+m[2]+1);}
export function bumpBuild(root){const appFile=path.join(root,'studio/app.html'),swFile=path.join(root,'sw.js'),app=fs.readFileSync(appFile,'utf8'),old=app.match(/window\.PS_BUILD='([^']+)'/)[1],next=nextBuild(old),sw=fs.readFileSync(swFile,'utf8');if(!sw.includes("const CACHE = 'process-"+old+"';"))throw Error('Build mismatch');fs.writeFileSync(appFile,app.replaceAll('?v='+old,'?v='+next).replace("window.PS_BUILD='"+old+"'","window.PS_BUILD='"+next+"'"));fs.writeFileSync(swFile,sw.replace("const CACHE = 'process-"+old+"';","const CACHE = 'process-"+next+"';"));return next;}
export async function verifyPublishedLetters({revision,feed,fetcher=fetch}){
 const index=JSON.parse(fs.readFileSync(path.join(feed,'index.json')));
 const bases=[['https://processstudio.netlify.app','/studio/letters'],['https://process-letter.netlify.app','/letters']];
 for(const [base,prefix] of bases){
  const r=await fetcher(base+prefix+'/revision.json',{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!r.ok||(await r.json()).revision!==revision)throw Error('Live revision mismatch: '+base);
  const entries=['index',...index.issues.map(x=>String(x.number).padStart(2,'0'))];
  for(let n=0;n<entries.length;n+=6)await Promise.all(entries.slice(n,n+6).map(async name=>{
   const response=await fetcher(base+prefix+'/'+name+'.json',{cache:'no-store',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Cannot read published letter '+base+'/'+name);
   const expected=JSON.parse(fs.readFileSync(path.join(feed,name+'.json'))),actual=await response.json();
   if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Published manuscript differs: '+base+'/'+name);
  }));
 }
 return {letters:index.issues.length,revision};
}
export async function publish({source,workspace,prepareOnly=false}={}){
 if(!source||!path.isAbsolute(source))throw Error('Use --source /absolute/path/to/letter/site');
 workspace=path.resolve(workspace||path.join(os.tmpdir(),'process-letter-publish'));
 fs.mkdirSync(workspace,{recursive:true});
 const lock=path.join(workspace,'running.lock');let lockFd;try{lockFd=fs.openSync(lock,'wx');}catch{throw Error('A publication is running, or an interrupted run left '+lock+'. Confirm no publisher is running before removing the lock.');}
 fs.writeFileSync(lockFd,String(process.pid));
 try{
  const fingerprint=sourceFingerprint(source),snapshot=path.join(workspace,'source-'+fingerprint.slice(0,16));
  if(!fs.existsSync(snapshot)){fs.mkdirSync(snapshot);fs.copyFileSync(path.join(source,'build.py'),path.join(snapshot,'build.py'));fs.cpSync(path.join(source,'src'),path.join(snapshot,'src'),{recursive:true});}
  if(sourceFingerprint(snapshot)!==fingerprint||sourceFingerprint(source)!==fingerprint)throw Error('Source changed during snapshot; retry after saving.');
  console.log('원고 스냅샷 확인: '+fingerprint.slice(0,12));
  const checkout=path.join(workspace,'studio-'+Date.now());
  if(!fs.existsSync(path.join(checkout,'.git')))run('git',['clone','--depth','1','--branch','main','https://github.com/'+REPO+'.git',checkout],workspace);
  if(git(['status','--porcelain'],checkout))throw Error('Publisher checkout has pending changes: '+checkout+'; preserve/review them before retry.');
  git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main','+refs/heads/staging:refs/remotes/origin/staging'],checkout);
  const main=git(['rev-parse','origin/main'],checkout),staging=git(['rev-parse','origin/staging'],checkout);
  git(['switch','--detach',main],checkout);
  const result=importLetters(path.join(snapshot,'src/issues'),{root:checkout,check:prepareOnly});
  const revision=result.revision;
  const recordFile=path.join(workspace,'publication-'+revision+'.json');
  const state=fs.existsSync(recordFile)?JSON.parse(fs.readFileSync(recordFile)):{};
  const record=patch=>{Object.assign(state,{revision,source,fingerprint,snapshot},patch);fs.writeFileSync(recordFile,JSON.stringify(state,null,2)+'\n');};
  record({});
  // Build every public page before creating any remote change. Existing media stay in their original paths.
  run('python3',['build.py'],snapshot);
  const publicDir=path.join(snapshot,'dist'),feed=path.join(publicDir,'letters');fs.mkdirSync(feed,{recursive:true});
  if(prepareOnly){console.log(JSON.stringify({revision,changed:result.changed,publicDir,prepareOnly:true}));return;}
  for(const name of fs.readdirSync(path.join(checkout,'studio/letters')))if(name.endsWith('.json'))fs.copyFileSync(path.join(checkout,'studio/letters',name),path.join(feed,name));
  for(const entry of JSON.parse(fs.readFileSync(path.join(feed,'index.json'))).issues){const html=fs.readFileSync(path.join(publicDir,String(entry.number).padStart(2,'0'),'index.html'),'utf8');if(/data-release=|data-soon=|공개 예정/.test(html))throw Error('A letter is still scheduled: '+entry.number);}
  const configPath=process.platform==='darwin'?path.join(os.homedir(),'Library/Preferences/netlify/config.json'):path.join(os.homedir(),'.config/netlify/config.json');
  const config=JSON.parse(fs.readFileSync(configPath)),token=process.env.NETLIFY_AUTH_TOKEN||config.users[config.userId].auth.token;
  const api=async(method,p,body,raw=false)=>{const r=await fetch('https://api.netlify.com/api/v1'+p,{method,headers:{Authorization:'Bearer '+token,...body?{'Content-Type':raw?'application/octet-stream':'application/json'}:{}},body:body?(raw?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Netlify '+method+' '+p+' '+r.status);return r.status===204?null:r.json();};
  const gh=(p)=>JSON.parse(run('gh',['api','repos/'+REPO+'/'+p],checkout));
  const waitGate=async commit=>{console.log('필수 CI 확인: '+commit.slice(0,12));const deadline=Date.now()+40*60000;while(Date.now()<deadline){const checks=gh('commits/'+commit+'/check-runs?filter=latest&per_page=100').check_runs;const gate=checks.filter(c=>c.name==='release-gate'&&c.app?.slug==='github-actions'&&c.head_sha===commit).sort((a,b)=>b.id-a.id)[0];if(gate?.status==='completed'){if(gate.conclusion!=='success')throw Error('Required CI failed for '+commit);return;}if(!gate){const runs=gh('actions/runs?head_sha='+commit+'&per_page=20').workflow_runs.filter(r=>r.name==='Storage safety'&&r.head_sha===commit).sort((a,b)=>b.id-a.id);const r=runs[0];if(r?.status==='completed'){const jobs=gh('actions/runs/'+r.id+'/jobs?per_page=100').jobs;if(r.conclusion!=='success'||!jobs.some(j=>j.name==='release-gate'&&j.conclusion==='success'))throw Error('Required CI failed for '+commit);return;}}await sleep(15000);}throw Error('CI wait timed out; rerun after checking GitHub.');};
  const waitDeploy=async(site,commit)=>{console.log('사이트 배포 확인: '+site+' '+commit.slice(0,12));const deadline=Date.now()+25*60000;let retriggered=false;while(Date.now()<deadline){const s=await api('GET','/sites/'+site);if(s.published_deploy?.commit_ref===commit&&s.published_deploy.state==='ready')return s.published_deploy;const rows=await api('GET','/sites/'+site+'/deploys?per_page=10'),d=rows.find(x=>x.context==='production'&&x.commit_ref===commit);if(d?.state==='error'){if(retriggered)throw Error('Deployment failed: '+d.id);await api('POST','/sites/'+site+'/builds',{});retriggered=true;}await sleep(15000);}throw Error('Deploy wait timed out; rerun to resume.');};
  const readRevision=async(base,prefix)=>{const r=await fetch(base+prefix+'/revision.json',{cache:'no-store',signal:AbortSignal.timeout(30000)});return r.ok?(await r.json()).revision:null;};
  const studioLive=await readRevision('https://processstudio.netlify.app','/studio/letters');
  // Prepare and verify a public draft first, retaining all unrelated deployed files.
  const site=await api('GET','/sites/'+LETTER);if(site.published_deploy.available_functions?.length)throw Error('Unexpected server functions; refuse a static-only deployment.');
  const currentFiles=await api('GET','/sites/'+LETTER+'/files'),body={draft:true,files:Object.fromEntries(currentFiles.map(f=>[f.path.replace(/^\//,''),f.sha]))},uploads={};
  for(const name of files(publicDir)){const file=path.join(publicDir,name),hash=sha(fs.readFileSync(file));body.files[name]=hash;uploads[hash]={file,name};}
  const samePublic=Object.keys(body.files).length===currentFiles.length&&currentFiles.every(f=>body.files[f.path.replace(/^\//,'')]===f.sha);
  let draft=null;
  const deploy=async draftFlag=>{let d=await api('POST','/sites/'+LETTER+'/deploys?title='+encodeURIComponent('원고 동기화 '+revision.slice(0,12)),{...body,draft:draftFlag});record(draftFlag?{publicDraftId:d.id}:{publicDeployId:d.id});if(d.required_functions?.length)throw Error('Unexpected function upload');for(let i=0;i<(d.required||[]).length;i+=6)await Promise.all(d.required.slice(i,i+6).map(async h=>{const u=uploads[h];if(!u)throw Error('Unknown missing asset '+h);const b=fs.readFileSync(u.file);await api('PUT','/deploys/'+d.id+'/files/'+u.name.split('/').map(encodeURIComponent).join('/')+'?size='+b.length,b,true);}));const deadline=Date.now()+5*60000;while(Date.now()<deadline){d=await api('GET','/deploys/'+d.id);if(d.state==='ready')return d;if(d.state==='error')throw Error('Public deployment failed: '+d.id);await sleep(2000);}throw Error('Public deployment still pending; retry to resume.');};
  if(!samePublic){draft=await deploy(true);if(await readRevision(draft.deploy_ssl_url,'/letters')!==revision)throw Error('Public draft revision mismatch');console.log('공개 레터 미리보기 검증: '+draft.deploy_ssl_url);}
  if(studioLive!==revision){
   const refRevision=ref=>{try{return JSON.parse(Buffer.from(gh('contents/studio/letters/revision.json?ref='+ref).content,'base64').toString()).revision;}catch{return null;}};
   const mainRevision=refRevision('main'),stagingRevision=refRevision('staging');
   if(mainRevision!==revision&&stagingRevision!==revision){
    if(main!==staging)throw Error('main/staging differ; reconcile separately before publishing letters. Prepared changes remain in '+checkout);
    const branch='codex/letter-publish-'+revision.slice(0,12);
    let prs=JSON.parse(run('gh',['pr','list','--repo',REPO,'--head',branch,'--base','staging','--state','open','--json','number,url'],checkout));
    let build;
    if(!prs.length){git(['switch','-C',branch],checkout);build=bumpBuild(checkout);
    console.log('스튜디오 원고 검증: '+build);run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],checkout);run('npm',['test'],checkout);run('npm',['run','test:sql'],checkout);
    git(['add','studio/letters','studio/app.html','sw.js'],checkout);git(['commit','-m','Sync letter manuscripts '+revision.slice(0,12)],checkout);git(['push','-u','origin',branch],checkout);
    }else{git(['restore','studio/letters'],checkout);git(['clean','-f','--','studio/letters/revision.json'],checkout);git(['fetch','origin',branch],checkout);git(['switch','--detach','FETCH_HEAD'],checkout);if(importLetters(path.join(snapshot,'src/issues'),{root:checkout,check:true}).changed.length)throw Error('Existing publication branch does not match source');}
    if(!prs.length){const bodyFile=path.join(workspace,'pr-body.txt');fs.writeFileSync(bodyFile,'레터 원본의 수정 내용을 스튜디오 원고와 공개 페이지에 반영합니다. 원고 리비전: '+revision+'\n\n검증: 원고 전체 검증, Node·SQL 시험 통과. 공개 레터 사이트도 같은 원고 스냅샷으로 빌드했습니다.');run('gh',['pr','create','--repo',REPO,'--base','staging','--head',branch,'--title','레터 원고 동기화 '+build,'--body-file',bodyFile],checkout);prs=JSON.parse(run('gh',['pr','list','--repo',REPO,'--head',branch,'--base','staging','--state','open','--json','number,url'],checkout));}
    record({stagingPR:prs[0].url,branch});console.log('PR '+prs[0].url);const head=git(['rev-parse','HEAD'],checkout);await waitGate(head);
    if(gh('git/ref/heads/staging').object.sha!==staging)throw Error('Staging changed; rebase and review before merging.');
    run('gh',['pr','merge',String(prs[0].number),'--repo',REPO,'--merge','--match-head-commit',head],checkout);
   }
   if(mainRevision!==revision){
   git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main','+refs/heads/staging:refs/remotes/origin/staging'],checkout);
   const paths=git(['diff','--name-only','origin/main','origin/staging'],checkout).split('\n').filter(Boolean);
   if(paths.some(p=>!p.startsWith('studio/letters/')&&!['studio/app.html','sw.js'].includes(p)))throw Error('Staging includes unrelated changes; do not promote automatically.');
   for(const file of ['studio/app.html','sw.js']){const before=git(['show','origin/main:'+file],checkout),after=git(['show','origin/staging:'+file],checkout);const normalize=x=>x.replace(/window\.PS_BUILD='[0-9.]+'/g,"window.PS_BUILD='VERSION'").replace(/\?v=[0-9.]+/g,'?v=VERSION').replace(/const CACHE = 'process-[0-9.]+';/g,"const CACHE = 'process-VERSION';");if(normalize(before)!==normalize(after))throw Error('Unrelated shell changes; do not promote automatically.');}
   const stageCommit=gh('git/ref/heads/staging').object.sha;record({stagingCommit:stageCommit});await waitGate(stageCommit);await waitDeploy(TEST,stageCommit);
   if(await readRevision('https://testprocess.netlify.app','/studio/letters')!==revision)throw Error('Staging manuscript mismatch');
   if(gh('git/ref/heads/main').object.sha!==main)throw Error('Main changed; review before promotion.');
   let promotion=JSON.parse(run('gh',['pr','list','--repo',REPO,'--head','staging','--base','main','--state','open','--json','number,url'],checkout));
   if(promotion.length&&state.promotionPR!==promotion[0].url)throw Error('An existing promotion needs review: '+promotion[0].url);
   if(!promotion.length){
   const promotionBody=path.join(workspace,'promotion-body.txt');fs.writeFileSync(promotionBody,'레터 원고를 같은 정본으로 동기화합니다. staging CI와 testprocess 배포에서 리비전 '+revision+'를 확인했습니다. 변경은 레터 JSON·색인·리비전 및 캐시 갱신 판 번호입니다. 로그인·저장·기기 데이터 동작 변경 없음.\n\n공개 레터 미리보기: '+(draft?.deploy_ssl_url||site.ssl_url));
   run('gh',['pr','create','--repo',REPO,'--base','main','--head','staging','--title','배포: 레터 원고 동기화','--body-file',promotionBody],checkout);promotion=JSON.parse(run('gh',['pr','list','--repo',REPO,'--head','staging','--base','main','--state','open','--json','number,url'],checkout));record({promotionPR:promotion[0].url});console.log('PR '+promotion[0].url);
   }
   if(gh('git/ref/heads/staging').object.sha!==stageCommit)throw Error('Staging changed during promotion');run('gh',['pr','merge',String(promotion[0].number),'--repo',REPO,'--merge','--match-head-commit',stageCommit],checkout);
   const commit=gh('git/ref/heads/main').object.sha;record({studioCommit:commit});await waitGate(commit);await waitDeploy(STUDIO,commit);
   if(await readRevision('https://processstudio.netlify.app','/studio/letters')!==revision)throw Error('Studio production revision mismatch');
   git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main','+refs/heads/staging:refs/remotes/origin/staging'],checkout);if(gh('git/ref/heads/staging').object.sha===stageCommit)git(['push','origin','origin/main:staging'],checkout);
   }else{await waitGate(main);await waitDeploy(STUDIO,main);if(state.stagingCommit&&gh('git/ref/heads/staging').object.sha===state.stagingCommit){git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main'],checkout);git(['push','origin','origin/main:staging'],checkout);}}
  }
  if(!samePublic){const fresh=await api('GET','/sites/'+LETTER);if(fresh.published_deploy.id!==site.published_deploy.id)throw Error('Public site changed; rerun to preserve its updates.');const d=await deploy(false);const published=await api('GET','/sites/'+LETTER);if(published.published_deploy.id!==d.id)throw Error('Public publication not confirmed');}
  if(await readRevision('https://process-letter.netlify.app','/letters')!==revision||await readRevision('https://processstudio.netlify.app','/studio/letters')!==revision)throw Error('The two live revisions do not match');
  const verified=await verifyPublishedLetters({revision,feed});
  record({verified,complete:true,completedAt:new Date().toISOString(),newerEditsPending:sourceFingerprint(source)!==fingerprint});console.log('두 사이트 반영 완료: '+revision+'\n기록: '+recordFile);
 }finally{fs.closeSync(lockFd);fs.unlinkSync(lock);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const arg=n=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1];};publish({source:arg('--source'),workspace:arg('--workspace'),prepareOnly:process.argv.includes('--prepare')}).catch(e=>{console.error(e.message);process.exitCode=1;});}
