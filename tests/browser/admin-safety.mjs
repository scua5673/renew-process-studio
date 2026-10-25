/* 관리자 화면 보안 — 사용자가 정한 값(팀 이름·사람 이름·IDP 문서·자료 ID·이메일)이 실제 admin.html 에서 HTML·JS 로 실행되지 않고,
   onclick 문자열 대신 data-* 로 바꾼 줄 버튼(미리보기·삭제·복구·내보내기·팀 삭제·IDP 행·홈 팀 행)이 같은 값으로 그대로 동작하는지.
   모든 Supabase 요청은 메모리 안 가상 응답이고, 다른 외부 주소는 막는다. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {fixtureBackend} from '../fixtures/backend-config.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results',engine,'admin-safety');fs.mkdirSync(out,{recursive:true});
const apiOrigin='https://synthetic-admin-api.invalid';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}let body;try{body=fs.readFileSync(f);}catch{res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(f.endsWith('.js')?fixtureBackend(body,apiOrigin):body);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;

const ADM='99999999-9999-4999-8999-999999999999',U='11111111-1111-4111-8111-111111111111',W1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',W2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const XSS='<img src=x onerror="window.pwned=(window.pwned||0)+1">';
const LIB="x');window.pwned=1;('",MAIL="p'+(window.pwned=1)+'@example.test";
const iso=m=>new Date(Date.now()-m*60000).toISOString();
const doc={profile:{name:XSS,pos:XSS},selfEval:{levels:{d_pos:XSS,d_scan:4,d_dec:3,d_run:2}},goal:{cur:{start:'2026-10-01',weeks:XSS,per:XSS}},
  trainings:[{name:'가상 훈련',days:[XSS]}],log:{'2026-10-13':{t:XSS,rpe:XSS,wt:XSS,memo:'가상'}},imgNotes:[]};
const workspaces=[{id:W1,name:XSS,kind:'team',member_count:2,lib_count:1,created_at:iso(9000),last_activity:iso(5),last_kv:iso(5),keys_7d:3},
  {id:W2,name:'',kind:'team',member_count:2,lib_count:0,created_at:iso(9000),last_activity:iso(9),last_kv:iso(9),keys_7d:1}];

let browser;const results=[];
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),calls=[],blocked=[],errors=[];
 await context.addInitScript(({ADM})=>localStorage.setItem('ps_sync_session',JSON.stringify({uid:ADM,at:'synthetic-at',rt:'synthetic-rt',email:'admin@example.test',exp:Date.now()+86400000})),{ADM});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();
  if(url.origin!==apiOrigin){blocked.push(url.origin);return route.abort('blockedbyclient');}
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,prefer','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
  const name=url.pathname.startsWith('/rest/v1/rpc/')?url.pathname.split('/').pop():null,args=req.postDataJSON()||{};
  if(name)calls.push({name,args});
  const send=(v,status=200)=>route.fulfill({status,headers,body:JSON.stringify(v)});
  switch(name){
   case 'ps_whoami':return send([{uid:ADM,email:'admin@example.test',is_admin:true}]);
   case 'ps_admin_users':return send([{user_id:U,email:MAIL,created_at:iso(9000),last_sign_in_at:iso(60)}]);
   case 'ps_admin_workspaces':case 'ps_admin_activity_ws':return send(workspaces);
   case 'ps_admin_library':return send(args.p_wid&&args.p_wid!==W1?[]:[{workspace_id:W1,lib_id:LIB,name:'가상 훈련',type:'train',saved_at:Date.now()-3600000,updated_at:iso(60)}]);
   case 'ps_admin_library_item':return send({workspace_id:args.p_wid,lib_id:args.p_lib_id,item:{name:'가상 훈련',trainings:[]}});
   case 'ps_admin_members':return send([{user_id:U,email:MAIL,role:'player',joined_at:iso(9000),last_sign_in_at:iso(60)}]);
   case 'ps_admin_idp_users':return send([{user_id:U,email:MAIL,idp_last:iso(60),teams:'가상 팀'}]);
   case 'ps_admin_idp_get':return send([{v:JSON.stringify(doc),updated_at:iso(60)}]);
   case 'ps_admin_incidents':return send({since_days:null,goal_days:56,days:56,scan_days:14,log:[],drops:[],guards:{},denied:[]});
   case 'ps_admin_health':return send({db_bytes:1e6,tables:{},blob:{},at:iso(1),policy:{min_build:XSS},
     fails24:[{code:XSS,n:2,users:1}],stuck:[{name:XSS,fails:3,last_code:XSS,app_version:XSS,last_fail:iso(30)}],versions:[{ver:XSS,users:1,events:2,last_at:iso(1)}],
     bigdocs:[{ws:XSS,k:XSS,len:2048,upd:iso(5)}],denied7:[{reason:XSS,k:XSS,n:1}],cron:[{job:XSS,schedule:XSS,active:true}]});
   case 'ps_admin_soft_delete_lib':case 'ps_admin_remove_member':case 'ps_admin_delete_workspace':return send(null);
   case null:return send([]);
   default:return send([]);
  }
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const dialogs=[],answers=[];page.on('dialog',async d=>{dialogs.push({type:d.type(),message:d.message()});const a=answers.shift();if(a===undefined||a===false)await d.dismiss();else await d.accept(a===true?undefined:a);});
 const rpcCalls=n=>calls.filter(c=>c.name===n).map(c=>c.args);
 const pwned=()=>page.evaluate(()=>window.pwned||0);
 await page.goto(base+'/admin.html',{waitUntil:'domcontentloaded'});
 assert.deepEqual(await page.evaluate(()=>({environment:PSBackendConfig.environment,url:PS_SYNC.url})),{environment:'synthetic',url:apiOrigin},'actual admin backend is the intercepted synthetic fixture');

 /* 홈 «가장 활발한 팀» 행 — 이름은 글자로, 누르면 그 팀 상세 */
 const teamRow=page.locator('#hmTeams [data-admin-act="team"]').first();await teamRow.waitFor();
 assert.equal(await page.locator('#hmTeams [onclick]').count(),0);
 assert.ok((await teamRow.innerText()).includes(XSS),'team name is shown as written');
 await teamRow.click();
 await page.locator('#wsDetail .ws-hero h2').waitFor();
 assert.equal(await page.evaluate(()=>curTab),'ws');assert.equal(await page.evaluate(()=>curWid),W1);
 assert.ok((await page.locator('#wsDetail .ws-hero h2').innerText()).includes(XSS));

 /* 멤버 «내보내기» — 취소하면 아무것도 안 하고, 확인하면 정확한 팀·사람으로 */
 answers.push(false);await page.locator('#wsDetail [data-admin-act="remove-member"]').click();
 assert.equal(rpcCalls('ps_admin_remove_member').length,0);
 answers.push(true);await page.locator('#wsDetail [data-admin-act="remove-member"]').click();
 await page.waitForFunction(()=>document.querySelector('#wsDetail .ws-hero h2'));
 assert.deepEqual(rpcCalls('ps_admin_remove_member'),[{p_wid:W1,p_uid:U}]);

 /* 팀 상세 › 콘텐츠 «삭제»·«미리보기» — 따옴표가 든 자료 ID 가 그대로 서버로 */
 await page.locator('#wsDetail [data-wstab="content"]').click();
 assert.equal(await page.locator('#libBody [onclick]').count(),0);
 answers.push(true);await page.locator('#libBody [data-admin-act="soft-del"]').click();
 await page.waitForFunction(()=>true);await page.waitForTimeout(200);
 assert.deepEqual(rpcCalls('ps_admin_soft_delete_lib'),[{p_wid:W1,p_lib_id:LIB}]);
 await page.locator('#wsDetail [data-wstab="content"]').click();
 await page.locator('#libBody [data-admin-act="preview"]').click();
 await page.waitForFunction(()=>curTab==='all');await page.waitForTimeout(300);
 assert.ok(rpcCalls('ps_admin_library_item').some(a=>a.p_wid===W1&&a.p_lib_id===LIB),'preview reads the exact item');

 /* 이름 없는 팀 삭제 — 확인창은 줄이 나뉘고, 빈 답으로는 지우지 않으며 ID 를 쳐야 지운다 */
 await page.evaluate(W2=>{setTab('ws');selectWs(W2);},W2);
 await page.locator('#wsDetail [data-wstab="settings"]').click();
 answers.push('');await page.locator('#wsDetail [data-admin-act="del-ws"]').click();
 const ask=dialogs.filter(d=>d.type==='prompt').pop();
 assert.ok(ask,'delete asks first');assert.match(ask.message,/줍니다\.\n계속하려면 워크스페이스 ID/);assert.doesNotMatch(ask.message,/\\n/);assert.ok(ask.message.endsWith('\n\n'+W2));
 assert.equal(rpcCalls('ps_admin_delete_workspace').length,0,'an empty answer deletes nothing');
 answers.push(W2);await page.locator('#wsDetail [data-admin-act="del-ws"]').click();
 await page.waitForTimeout(200);
 assert.deepEqual(rpcCalls('ps_admin_delete_workspace'),[{p_wid:W2}]);

 /* IDP — 목록 행은 data-* 로 열고, 선수가 쓴 값은 글자로 */
 await page.evaluate(()=>setTab('idp'));
 const idpRow=page.locator('#idpList [data-admin-act="idp"]').first();await idpRow.waitFor();
 assert.equal(await page.locator('#idpList [onclick]').count(),0);
 await idpRow.click();await page.locator('#idpBody .ws-alert').waitFor();
 assert.deepEqual(rpcCalls('ps_admin_idp_get'),[{p_uid:U}]);
 assert.equal(await page.locator('#idpWho').textContent(),'· '+MAIL);
 assert.ok((await page.locator('#idpBody').innerText()).includes(XSS));
 await page.screenshot({path:path.join(out,'idp.png')});

 /* 백엔드 건강 — 팀 이름·사람·오류 코드·버전·키·사유·작업 이름 */
 await page.evaluate(()=>setTab('back'));await page.locator('#backBody table').first().waitFor();
 const back=await page.locator('#backBody').innerText();
 assert.equal(back.split(XSS).length-1,12,'every injected value (12 in this fixture) is visible as text');
 await page.screenshot({path:path.join(out,'back.png')});

 assert.equal(await page.locator('img[src="x"]').count(),0,'no injected image element exists');
 assert.equal(await pwned(),0,'no injected handler ran');
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 results.push({engine,passed:true,dialogs:dialogs.length});console.log(JSON.stringify({engine,passed:true}));
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({engine,fixture:'Real admin.html with in-memory Supabase responses carrying markup and quote payloads. No external data or writes.',results},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
