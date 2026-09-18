import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const suites={
  board:['gamemodel-sync','board-depth','board-color-palette','vault-board-isolation'],
  identity:['cache-wait','admin-errors','service-worker-update','account-team-switch','mobile-oauth-recovery'],
  storage:['storage-safety','private-board-isolation','roster-main-save','autosave-journal-recovery'],
  idp:['idp-recovery','idp-story-dedup','support']
};
const group=process.env.PS_TEST_GROUP||'all',engines=(process.env.PS_BROWSER_ENGINE||'chromium,webkit').split(',');
if(group!=='all'&&!suites[group])throw Error('Unknown browser test group: '+group);
const tests=group==='all'?Object.values(suites).flat():suites[group],results=[];
for(const engine of engines){
  if(!['chromium','webkit'].includes(engine))throw Error('Unknown browser engine: '+engine);
  for(const test of tests){
    const output=path.join(root,'test-results',engine,test);fs.mkdirSync(output,{recursive:true});
    const env={...process.env,PS_BROWSER_ENGINE:engine,PS_TEST_OUTPUT:output};
    if(engine==='chromium'&&!env.PS_CHROME_PATH)env.PS_CHROME_PATH=pw.chromium.executablePath();
    const started=Date.now();
    const run=spawnSync(process.execPath,[path.join(root,'tests/browser',test+'.mjs')],{cwd:root,env,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
    fs.writeFileSync(path.join(output,'runner.log'),(run.stdout||'')+(run.stderr||'')+(run.error?'\n'+run.error.stack:''));
    const result={engine,test,passed:run.status===0&&!run.error,durationMs:Date.now()-started};results.push(result);
    console.log(JSON.stringify(result));if(!result.passed)console.error((run.stderr||run.stdout||String(run.error)).slice(-3500));
  }
}
fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
fs.writeFileSync(path.join(root,'test-results',`critical-${group}-${engines.join('-')}.json`),JSON.stringify(results,null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
