import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/roster-projection');
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{});
const base='https://roster-projection-fixture.invalid';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
try{
  for(const width of [1280,393]){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',timezoneId:'Asia/Seoul'});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({status:200,body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
    });
    await context.addInitScript(()=>{
      const uid='projection-fixture-coach',wid='projection-fixture-team';
      localStorage.setItem('ps_sync_session',JSON.stringify({uid}));localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid,nonce:'fixture'}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,name:'가상 검증팀',kind:'team',role:'owner'}]));
      localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[uid]:{role:'executive'}}}));
      localStorage.setItem('cs_scout_targets_v1','{"v":1,"players":[]}');localStorage.setItem('cs_lang','ko');
      window.PSSync={dataUnlocked:()=>true,keyReady:()=>true,rosterReady:()=>true,syncNow:async()=>({pushed:0,applied:0})};
    });
    const page=await context.newPage(),dialogs=[],errors=[];
    page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/studio/scout.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.PSStorage&&typeof itemsApply==='function');
    await page.evaluate(async()=>{
      await PSStorage.sharedReady();await psSaveSharedAsync(TKEY,localStorage.getItem(TKEY));await scPrepare();await store.ready(true);
      const p=(id,name,grp)=>({id,name,grp,posId:'pos_CB',levels:{},num:'',profile:{},type:'ours'});
      data.players=Array.from({length:44},(_,i)=>p('current-'+i,'가상 선수 '+i,i<26?'A':'B'));
      data.meta.evalMode='fifa';data._items={build:'2.809'};scMainMigrationPending=false;
      await psSaveSharedAsync(KEY,JSON.stringify(data));await psSaveSharedAsync(PDKEY,'{}');await store.ready(true);
      window.fixtureRows=data.players.concat(Array.from({length:25},(_,i)=>p('old-'+i,'가상 선수 '+i,'')));
      window.fixtureWrites=[];window.fixtureConfirmed={};window.fixtureHeld={};
      window.PSItems={active:()=>true,readAll:async()=>({players:fixtureRows,tombs:{},rows:fixtureRows.length,n:fixtureRows.length,confirmed:fixtureConfirmed,held:fixtureHeld}),write:players=>fixtureWrites.push(JSON.stringify(players))};
      document.querySelectorAll('.view.on').forEach(e=>e.classList.remove('on'));document.getElementById('teamView').classList.add('on');renderTeam();
    });
    const inspect=()=>page.evaluate(()=>({ids:data.players.map(p=>p.id),groups:data.players.reduce((r,p)=>(r[p.grp||'none']=(r[p.grp||'none']||0)+1,r),{}),writes:fixtureWrites.length,text:document.querySelector('#teamList').innerText}));
    await page.evaluate(async()=>{await itemsApply('boot');renderTeam();});
    let state=await inspect();assert.equal(state.ids.length,44);assert.deepEqual(state.groups,{A:26,B:18});assert.equal(state.writes,0);assert.ok(!state.text.includes('조 없음 25'));
    await page.evaluate(async()=>{data.players.forEach(p=>fixtureConfirmed['sq:'+p.id]=1);await itemsApply('sync');renderTeam();});
    state=await inspect();assert.equal(state.ids.length,44);assert.equal(state.writes,0);
    await page.screenshot({path:path.join(out,`${engine}-${width}-44.png`)});
    await page.evaluate(async()=>{
      fixtureRows.push({id:'remote-new',name:'가상 선수 0',grp:'B',type:'ours',posId:'pos_CB',levels:{},profile:{}});fixtureConfirmed['sq:remote-new']=1;
      await itemsApply('sync');renderTeam();
    });
    state=await inspect();assert.equal(state.ids.length,45);assert.ok(state.ids.includes('remote-new'));assert.deepEqual(state.groups,{A:26,B:19});assert.equal(state.writes,0);
    await page.evaluate(async()=>{fixtureRows=fixtureRows.map(p=>p.id==='current-0'?{...p,grp:''}:p);fixtureHeld['sq:current-0']=1;await itemsApply('sync');renderTeam();});
    state=await inspect();assert.equal(state.ids.length,45);assert.deepEqual(state.groups,{A:26,B:19});assert.equal(state.writes,0);
    assert.equal(dialogs.length,0);assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log(JSON.stringify({engine,widths:[1280,393],staleRows:25,rosterPreserved:44,remoteAddition:45,sameNamesRemainDistinct:true,groupPreservedDuringConflict:true,projectionDoesNotWriteRows:true,automaticDialogs:0,output:out}));
}finally{await browser.close();}
