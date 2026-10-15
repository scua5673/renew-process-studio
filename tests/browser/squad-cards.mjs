/* 3.038 — 오류 제보 «선수단 표시 오류»: 선수단 작전판에서 포메이션을 바꾸면 카드가 왼쪽 아래 한 줄로 몰리고 선수가 «운동장 밖»으로 빠지던 것.
   ① 선수단 포메이션 고르기(4-3-3 → 4-4-2) ② 예전 판에서 이미 어긋난 팀(카드는 4-3-3 · 선수는 LM · RM) — 둘 다 11명이 운동장 카드 위에, 왼쪽 아래 줄은 없다. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/squad-cards');
const base='https://squad-cards-fixture.invalid',mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'};
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const results=[];
try{
  for(const scenario of ['pick-formation','already-broken']){
    const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block',timezoneId:'Asia/Seoul'}),page=await context.newPage(),errors=[],blocked=[];
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.origin!==base){blocked.push(url.origin);return route.abort();}
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
    });
    await context.addInitScript(()=>{
      const uid='synthetic-squad-cards-coach',wid='synthetic-squad-cards-team';
      localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'synthetic-at',rt:'synthetic-rt'}));localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid,nonce:'synthetic-squad-cards'}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,name:'가상 검증팀',kind:'team',role:'owner'}]));
      localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[uid]:{role:'executive'}}}));
      localStorage.setItem('cs_scout_targets_v1','{"v":1,"players":[]}');localStorage.setItem('cs_lang','ko');localStorage.setItem('ps_tm_view','pitch');
      window.PSSync={dataUnlocked:()=>true,keyReady:()=>true,rosterReady:()=>true,syncNow:async()=>({pushed:0,applied:0})};
      window.PSItems={active:()=>false,write(){},flush:async()=>true};
    });
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
    try{
      await page.goto(base+'/studio/scout.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.PSStorage&&typeof tbRender==='function');
      const state=await page.evaluate(async scenario=>{
        await PSStorage.sharedReady();await store.ready(true);
        const AB=['GK','LB','LCB','RCB','RB','DM','CM','AM','LW','RW','CF'],pos={};
        data.positions.forEach(p=>{const ab=posAbbr(p.name);if(!pos[ab])pos[ab]=p.id;});
        data.players=AB.map((ab,i)=>({id:'pl'+i,name:'가상 '+ab,num:String(i+1),type:'ours',posId:pos[ab],status:'ok',levels:{},profile:{},memo:''}));
        data.meta.form='433';delete data.meta.tbCards;delete data.meta.tbXY;scMainMigrationPending=false;
        document.querySelectorAll('.view.on').forEach(e=>e.classList.remove('on'));document.getElementById('teamView').classList.add('on');renderTeam();
        if(scenario==='pick-formation'){const f=document.getElementById('tmForm');f.value='442';f.onchange();}
        else{data.meta.form='442';data.meta.tbCards=AB.map(ab=>pos[ab]);
          data.players[7].posId=pos.LM;data.players[8].posId=pos.RM;data.players[9].posId=pos.CF;renderTeam();}
        const slots=[...document.querySelectorAll('#tbPitch .tb-slot')];
        return {cards:slots.length,pills:document.querySelectorAll('#tbPitch .tb-pill').length,
          bottomLeft:slots.filter(s=>parseFloat(s.style.top)>=88&&parseFloat(s.style.left)<50).length,
          offHidden:document.getElementById('tbOff').hidden,tray:document.getElementById('tbTrayN').textContent,
          lm:(slots.find(s=>s.dataset.posid===pos.LM)||{}).style?.cssText||''};
      },scenario);
      await page.locator('#tbPitch').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,`${engine}-${scenario}.png`),animations:'disabled'});
      assert.equal(state.cards,11,'eleven position cards');
      assert.equal(state.pills,11,'all eleven players stand on the pitch cards');
      assert.equal(state.bottomLeft,0,'no card falls into the old bottom-left row');
      assert.equal(state.offHidden,true,'nobody is pushed to «운동장 밖»');
      assert.equal(state.tray,'0명');
      assert.match(state.lm,/left: 5\d(\.\d+)?%; top: 1\d(\.\d+)?%/,'LM stands on the left midfield line');
      assert.deepEqual(errors,[]);
      results.push({engine,scenario,...state,externalOriginsBlocked:[...new Set(blocked)]});
    }catch(error){await page.screenshot({path:path.join(out,`${engine}-${scenario}-failure.png`)}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
