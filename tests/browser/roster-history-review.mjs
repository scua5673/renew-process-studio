import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Actual history/list/modal functions and storage.js run in a fresh browser.
// Unrelated boot/sync channels are omitted so writes caused by this read-only UI
// can be measured independently. The sole RPC returns synthetic history only.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/roster-history-review',engine);
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8');
function section(a,b){const from=source.indexOf(a),to=source.indexOf(b,from+a.length);assert.ok(from>=0&&to>from,a);return source.slice(from,to);}
const fn=name=>section('function '+name+'(','\nfunction ');
const actual=[section('var KEY_LABEL={','function skippedList('),section('var HIST_KEYS=','function histRestore('),
  ...['dataReviewOpen','dataReviewList','getSess','wsList','activeWs','activeWsObj','cacheOwner','dataUnlocked','isTeamWs','holdList','holdConflictContext','holdConflictCurrent','sessionStorageOwnerChanged','workspaceSwitchGuardRaw','workspaceSwitchEpochRaw','workspaceSwitchGuardRead','esc','psModal'].map(fn)].join('\n');
const base='https://roster-history-fixture.invalid',uid='synthetic-review-coach',wid='synthetic-review-team';
const player=(id,n)=>({id,name:'가상 선수 '+n,grp:n<26?'A':'B',type:'ours',levels:{technique:3},memo:''});
const baseline={attrs:[],positions:[],meta:{evalMode:'fifa'},players:Array.from({length:44},(_,i)=>player('kept-'+i,i))};
const current=structuredClone(baseline);
current.players[0].memo='선택 판본 뒤 현재 기록';
for(let i=0;i<25;i++)current.players.push({...player('extra-'+i,i),grp:'',memo:i===0?'보존할 추가 선수 메모':''});
current.players[45].name='<img src=x onerror="window.fixtureXss=1">';
current.players[45].grp='<svg onload="window.fixtureXss=2">';
current.players[46].name='아주긴합성선수이름'.repeat(30);
const history=[{at:'2026-09-14T02:56:28Z',v:JSON.stringify(baseline)},{at:'2026-09-13T02:00:00Z',v:null}];
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const results=[];
try{
 for(const width of [1280,393]){
  const context=await browser.newContext({viewport:{width,height:852},serviceWorkers:'block',timezoneId:'Asia/Seoul',acceptDownloads:true}),requests=[],blocked=[];
  await context.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());
   if(url.origin!==base){blocked.push(url.origin+url.pathname);return route.abort();}
   if(url.pathname==='/fixture.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif}button{font:inherit}</style></head><body><button id="openReview">자료 확인 열기</button><script src="/storage.js"></script></body></html>'});
   if(url.pathname==='/storage.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'studio/storage.js'))});
   if(url.pathname==='/rest/v1/rpc/ps_admin_kv_history'){
    requests.push({path:url.pathname,method:r.method(),body:r.postDataJSON()});
    return route.fulfill({contentType:'application/json',body:JSON.stringify(history)});
   }
   return route.fulfill({status:404,body:''});
  });
  const page=await context.newPage(),errors=[],dialogs=[];page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
  await page.goto(base+'/fixture.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(async({uid,wid,current})=>{
   await storage.keys();await PSStorage.sharedReady();
   localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'SYNTHETIC_ACCESS_TOKEN_DO_NOT_EXPORT',rt:'SYNTHETIC_REFRESH_TOKEN_DO_NOT_EXPORT'}));
   localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid,nonce:'synthetic'}));
   localStorage.setItem('ps_active_ws',wid);localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner'}]));
   localStorage.setItem('scout_tool_v1',JSON.stringify(current));localStorage.setItem('cs_player_del_v1',JSON.stringify({'extra-3':12345}));
   localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[uid]:{role:'executive'},'PRIVATE_ACCOUNT_IDENTIFIER_ONE':{playerId:'extra-0'},'PRIVATE_ACCOUNT_IDENTIFIER_TWO':{playerId:'extra-0'}}}));
   localStorage.setItem('cs_idp_v1_unrelated','PRIVATE_IDP_BODY_DO_NOT_EXPORT');
   for(const p of current.players)await storage.set('sq:'+p.id,JSON.stringify(p));
   await storage.set('unrelated-private-key','PRIVATE_UNRELATED_BODY_DO_NOT_EXPORT');
   Object.assign(window,{SKEY:'ps_sync_session',WSKEY:'ps_active_ws',WLKEY:'ps_ws_list',OWNERKEY:'ps_cache_owner_v1',HOLD_LIST:'ps_hold_list_v1',HOLD_MAX:12,WS_SWITCH_GUARD:'ps_ws_switch_guard_v1',WS_SWITCH_EPOCH:'ps_ws_switch_epoch_v1',dataReady:true,signOutEpoch:0,externalSwitchFrozen:false,ITEMS_ACTIVE:true,COPIES_OFF:true,
    PSPerms:{role:()=>JSON.parse(localStorage.getItem('cs_perms_v1')||'{}').members?.[uid]?.role||'player'},personalReviewList:()=>[],itemsLostSnapshot:()=>null,itemsHoldList:()=>[],renderDataLock(){},psCount:s=>JSON.parse(s).players.length,
    rpc:async(name,args,guard)=>{if(guard)guard();const r=await fetch('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});if(guard)guard();return r.json();}
   });
  },{uid,wid,current});
  await page.addScriptTag({content:actual});
  await page.evaluate(()=>{
   document.querySelector('#openReview').onclick=()=>dataReviewOpen();
   window.fixtureMutationLog=[];
   for(const name of ['setItem','removeItem','clear']){const original=Storage.prototype[name];Storage.prototype[name]=function(...args){fixtureMutationLog.push({store:'localStorage',name,key:args[0]});return original.apply(this,args);};}
   for(const name of ['put','add','delete','clear']){const original=IDBObjectStore.prototype[name];IDBObjectStore.prototype[name]=function(...args){fixtureMutationLog.push({store:'IndexedDB',name});return original.apply(this,args);};}
   window.fixtureSnapshot=async()=>({local:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),idb:await Promise.all((await storage.keys()).sort().map(async k=>[k,(await storage.get(k))?.value]))});
  });
  const before=await page.evaluate(()=>fixtureSnapshot());
  await page.locator('#openReview').click();await page.locator('#drHistKey').selectOption('scout_tool_v1');await page.locator('#drHistLoad').click();
  await page.locator('[data-hist-compare="0"]').click();
  const area=page.locator('[data-hist-backup]');await area.waitFor({state:'attached'});
  assert.equal(await page.locator('[data-hist-compare]').count(),1,'expired history body has no compare action');
  assert.match(await page.locator('#drHistOut').innerText(),/같은 ID 44명 · 현재에만 25명 · 판본에만 0명/);
  const text=await area.inputValue(),backup=JSON.parse(text),c=backup.comparison;
  assert.equal(c.currentCount,69);assert.equal(c.baselineCount,44);assert.equal(c.commonIds.length,44);assert.equal(c.extraIds.length,25);assert.equal(c.missingIds.length,0);
  assert.deepEqual(c.commonIds,baseline.players.map(p=>p.id));assert.deepEqual(c.extraIds,current.players.slice(44).map(p=>p.id));
  assert.equal(backup.raw.scout_tool_v1,JSON.stringify(current));assert.equal(backup.raw.baseline_scout_tool_v1,JSON.stringify(baseline));assert.equal(backup.items.length,69);
  assert.equal(c.rows.find(r=>r.id==='kept-0').changed,true);assert.equal(c.rows.find(r=>r.id==='extra-0').linkedAccounts,2);assert.equal(c.rows.find(r=>r.id==='extra-3').deleted,true);
  const linked=page.locator('#drHistOut tbody tr').filter({hasText:'extra-0'});assert.match(await linked.innerText(),/현재에만[\s\S]*계정 2개[\s\S]*메모/);
  for(const secret of ['SYNTHETIC_ACCESS_TOKEN_DO_NOT_EXPORT','SYNTHETIC_REFRESH_TOKEN_DO_NOT_EXPORT','PRIVATE_ACCOUNT_IDENTIFIER_ONE','PRIVATE_ACCOUNT_IDENTIFIER_TWO','PRIVATE_IDP_BODY_DO_NOT_EXPORT','PRIVATE_UNRELATED_BODY_DO_NOT_EXPORT'])assert.ok(!text.includes(secret),secret+' excluded from backup');
  assert.equal(await page.locator('#drHistOut tbody img,#drHistOut tbody svg').count(),0);assert.equal(await page.evaluate(()=>window.fixtureXss||0),0);
  assert.ok((await page.locator('#drHistOut tbody').innerText()).includes('<img src=x onerror="window.fixtureXss=1">'));
  const columns=await page.locator('#drHistOut tbody tr').first().locator('td').evaluateAll(cells=>cells.map(c=>c.getBoundingClientRect().width));assert.ok(columns.every(w=>w>=65),'long fields must not squeeze other columns: '+JSON.stringify(columns));
  await page.locator('[data-hist-compare="0"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${width}-comparison-top.png`)});
  await page.locator('#drHistOut details summary').click();assert.equal(await area.evaluate(el=>el.readOnly),true);
  await page.locator('[data-hist-download]').scrollIntoViewIfNeeded();
  const dimensions=await page.evaluate(()=>{const card=document.querySelector('#psWsModal').firstElementChild,b=card.getBoundingClientRect(),body=document.querySelector('#psWsBody'),ok=document.querySelector('#psWsOk').getBoundingClientRect();return {viewport:innerWidth,doc:document.documentElement.scrollWidth,bodyClient:body.clientWidth,bodyScroll:body.scrollWidth,cardLeft:b.left,cardRight:b.right,closeTop:ok.top,closeBottom:ok.bottom,height:innerHeight};});
  assert.ok(dimensions.doc<=width+1&&dimensions.cardLeft>=0&&dimensions.cardRight<=width+1,JSON.stringify(dimensions));
  assert.ok(dimensions.bodyScroll<=dimensions.bodyClient+1,'comparison wrapper contains wide data without overflowing modal body');
  assert.ok(dimensions.closeTop>=0&&dimensions.closeBottom<=dimensions.height,'close button stays visible');
  await page.screenshot({path:path.join(out,`${width}-comparison.png`)});
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-hist-download]').click();const download=await downloadPromise;await download.saveAs(path.join(out,`${width}-synthetic-backup.json`));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,`${width}-synthetic-backup.json`),'utf8')),backup);
  await page.locator('#psWsOk').click();assert.equal(await page.locator('#psWsModal').count(),0);
  assert.deepEqual(await page.evaluate(()=>fixtureSnapshot()),before,'UI comparison/download/close preserve exact local and IDB state');
  assert.deepEqual(await page.evaluate(()=>fixtureMutationLog),[],'read-only UI never calls a storage mutation API');
  // Owner changes must clear the raw backup still visible in an open dialog.
  await page.locator('#openReview').click();await page.locator('#drHistLoad').click();await page.locator('[data-hist-compare="0"]').click();await area.waitFor({state:'attached'});
  await page.evaluate(()=>{const oldValue=localStorage.getItem('ps_cache_owner_v1'),newValue=JSON.stringify({uid:'other-coach',wid:'other-team',nonce:'changed'});localStorage.setItem('ps_cache_owner_v1',newValue);dispatchEvent(new StorageEvent('storage',{key:'ps_cache_owner_v1',oldValue,newValue}));});
  assert.equal(await page.locator('[data-hist-backup]').count(),0);assert.equal(await page.locator('#drHistOut').innerText(),'');await page.locator('#psWsOk').click();
  assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);assert.deepEqual(blocked,[]);
  assert.ok(requests.length===2&&requests.every(r=>r.path==='/rest/v1/rpc/ps_admin_kv_history'&&r.method==='POST'&&r.body.p_wid===wid&&r.body.p_key==='scout_tool_v1'));
  results.push({engine,width,passed:true,current:69,baseline:44,common:44,extra:25,linkedExtra:2,exactIds:true,noTokenOrPrivateIdpExport:true,escaped:true,readOnly:true,downloadMatches:true,closeVisible:true,ownerChangeClears:true,dimensions,historyRequests:requests.length});
  console.log(JSON.stringify(results.at(-1)));await context.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Actual history UI functions and storage.js; all data synthetic; only read-only history RPC mocked; full app bootstrap excluded.',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),results},null,2));
}finally{await browser.close();}
