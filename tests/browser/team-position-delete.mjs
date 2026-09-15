import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/team-position-delete');
const base='https://team-position-delete-fixture.invalid',mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const results=[];
try{
  for(const width of [1280,393]){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',timezoneId:'Asia/Seoul'}),page=await context.newPage(),errors=[],nativeDialogs=[],blocked=[];
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.origin!==base){blocked.push(url.origin);return route.abort();}
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
    });
    await context.addInitScript(()=>{
      const uid='synthetic-position-delete-coach',wid='synthetic-position-delete-team';
      localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'synthetic-at',rt:'synthetic-rt'}));localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid,nonce:'synthetic-position-delete'}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,name:'가상 검증팀',kind:'team',role:'owner'}]));
      localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[uid]:{role:'executive'}}}));
      localStorage.setItem('cs_scout_targets_v1','{"v":1,"players":[]}');localStorage.setItem('cs_lang','ko');localStorage.setItem('ps_tm_view','table');
      window.PSSync={dataUnlocked:()=>true,keyReady:()=>true,rosterReady:()=>true,syncNow:async()=>({pushed:0,applied:0})};
      window.PSItems={active:()=>false,write(){},flush:async()=>true};
    });
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{nativeDialogs.push(d.message());d.dismiss();});
    try{
      await page.goto(base+'/studio/scout.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.PSStorage&&typeof tmPosPopup==='function');
      await page.evaluate(async()=>{
        await PSStorage.sharedReady();await psSaveSharedAsync(TKEY,localStorage.getItem(TKEY));await scPrepare();await store.ready(true);
        const pl=(id,num)=>({id,name:'가상 동명이인',num,grp:'A팀',type:'ours',posId:'pos_CB',foot:'R',status:'ok',levels:{},profile:{},memo:'원문 '+id});
        data.positions=[{id:'pos_CB',name:'CB',targets:{},req:{}}];data.players=[pl('keep','1'),pl('remove','2')];
        data.meta.evalMode='fifa';data.meta.teamName='가상 검증팀';data._items={build:'synthetic'};scMainMigrationPending=false;
        await psSaveSharedAsync(KEY,JSON.stringify(data));await psSaveSharedAsync(PDKEY,'{}');await store.ready(true);rosterRemember(data.players);
        window.fixtureOriginal=JSON.parse(JSON.stringify(data.players));window.fixtureTargetRaw=localStorage.getItem(TKEY);
        data.players.push({...pl('private','3'),type:'target',name:'비공개 후보'});
        window.fixtureCalls=[];window.fixtureGate=new Promise(resolve=>window.fixtureRelease=resolve);
        function immutable(v){if(v&&typeof v==='object'){Object.values(v).forEach(immutable);Object.freeze(v);}return v;}
        window.PSItems={patchVersion:1,active:()=>true,readAll:async()=>null,
          writeReady(players,options){fixtureCalls.push(immutable(JSON.parse(JSON.stringify({players,options}))));return fixtureGate.then(()=>({n:players.length,wrote:(options.deletedIds||[]).length}));},
          flush:async()=>{if(fixtureCalls.length)await fixtureGate;return true;}};
        document.querySelectorAll('.view.on').forEach(e=>e.classList.remove('on'));document.getElementById('teamView').classList.add('on');renderTeam();
      });
      const inspect=()=>page.evaluate(async()=>({
        ids:data.players.map(p=>p.id),main:JSON.parse(localStorage.getItem(KEY)),idb:JSON.parse((await storage.get(KEY)).value),
        tombs:JSON.parse(localStorage.getItem(PDKEY)),calls:fixtureCalls,targetUnchanged:localStorage.getItem(TKEY)===fixtureTargetRaw,
        pending:rosterPendingRows(),state:PSSaveState.get('team'),original:fixtureOriginal,
      }));
      const open=async()=>{
        await page.locator('#teamCount').scrollIntoViewIfNeeded();
        await page.evaluate(()=>tmPosPopup('CB',document.getElementById('teamCount')));
        await page.locator('.tmpop [data-del="remove"]').click();
        await page.getByText('가상 동명이인 삭제? 평가 기록도 함께 삭제됩니다.',{exact:true}).waitFor({state:'visible'});
        assert.equal(await page.locator('.tmpop').count(),0,'the underlying popup is closed before the real PWA confirmation');
        for(const label of ['취소','확인']){
          const box=await page.locator(`button:text-is("${label}"):visible`).boundingBox();
          assert.ok(box&&box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=900,'confirmation actions fit the viewport');
        }
      };
      const initial=await inspect();await open();
      await page.screenshot({path:path.join(out,`${engine}-${width}-confirmation.png`),animations:'disabled'});
      await page.locator('button:text-is("취소"):visible').click();
      let state=await inspect();assert.deepEqual(state.ids,initial.ids);assert.deepEqual(state.main,initial.main);assert.deepEqual(state.idb,initial.idb);assert.deepEqual(state.tombs,{});assert.deepEqual(state.calls,[]);
      await open();await page.locator('button:text-is("확인"):visible').click();
      await page.waitForFunction(()=>fixtureCalls.length===1);await page.evaluate(()=>PSStorage.sharedReady());state=await inspect();
      assert.deepEqual(state.ids,['keep','private']);assert.deepEqual(state.main.players.map(p=>p.id),['keep']);assert.deepEqual(state.main,state.idb);
      assert.ok(state.tombs.remove>0);assert.equal(state.tombs.keep,undefined);assert.deepEqual(state.calls[0].options.deletedIds,['remove']);
      assert.deepEqual(state.calls[0].options.changedIds,[]);assert.deepEqual(state.calls[0].players,[]);
      assert.deepEqual(state.calls[0].options.basePlayers,[state.original.find(p=>p.id==='remove')]);
      assert.equal(state.targetUnchanged,true);assert.equal(state.pending,true);assert.equal(state.state,'saving');
      await page.evaluate(async()=>{fixtureRelease();await store.ready();});
      state=await inspect();assert.equal(state.pending,false);assert.equal(state.targetUnchanged,true);assert.deepEqual(state.main,state.idb);
      await page.screenshot({path:path.join(out,`${engine}-${width}-deleted.png`),animations:'disabled'});
      assert.deepEqual(errors,[]);assert.deepEqual(nativeDialogs,[]);
      results.push({engine,width,cancelPreservesRoster:true,realConfirmationWorks:true,exactDeletedId:'remove',sameNamePlayerPreserved:true,candidateUnchanged:true,mainAndIndexedDbExact:true,pendingUntilMockRowReceipt:true,rowTransport:'immutable captured mock',externalRequestsAllowed:0,externalOriginsBlocked:[...new Set(blocked)]});
    }catch(error){await page.screenshot({path:path.join(out,`${engine}-${width}-failure.png`)}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
