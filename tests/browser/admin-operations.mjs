import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/admin-operations',engine);
fs.mkdirSync(out,{recursive:true});
const ADM='99999999-9999-4999-8999-999999999999',U='11111111-1111-4111-8111-111111111111',V='22222222-2222-4222-8222-222222222222',W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',X='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',I='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port;
const apiOrigin=(fs.readFileSync(path.join(root,'admin.html'),'utf8').match(/url:"(https:\/\/[^\"]+)"/)||[])[1];assert.ok(apiOrigin,'configured API origin found for request interception only');
const results=[];let browser;
try{
 browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 for(const width of [390,1024,1440]){
  const now=Date.now(),iso=mins=>new Date(now-mins*60000).toISOString();
  const users=[{user_id:U,name:'가상 코치 A',email:'coach-a@example.test',team_names:'가상 팀 A',workspace_ids:[W,X],created_at:iso(20000),last_sign_in_at:iso(300),made_count:8},{user_id:V,name:'가상 선수 B',email:'player-b@example.test',team_names:'가상 팀 A',workspace_ids:[W],created_at:iso(18000),last_sign_in_at:iso(200),made_count:0}];
  const workspaces=[{id:W,name:'가상 팀 A',kind:'team',member_count:2,lib_count:0,last_activity:iso(2)},{id:X,name:'가상 팀 B',kind:'team',member_count:1,lib_count:0,last_activity:iso(20)}];
  const counters={pending_team:0,pending_personal:0,held:0,skipped:0,deferred:0,conflicts:0};
  const reports=[{user_id:U,workspace_id:W,device_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',report_seq:1,received_at:iso(1),...counters,pending_team:2,last_round_ack_at:iso(2),error_code:'sync_conflict',device_class:'tablet',app_version:'2.792',online:true,busy:false},{user_id:U,workspace_id:X,device_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',report_seq:1,received_at:iso(2),...counters,pending_personal:null,device_class:'desktop',app_version:'2.791',online:null,busy:null},{user_id:V,workspace_id:W,device_id:'12345678-abcd-4123-8123-123456789abc',report_seq:1,received_at:iso(20),...counters,device_class:'mobile',app_version:'2.790',online:false,busy:false}];
  let followups=[{id:I,version:1,subject_user_id:U,workspace_id:W,kind:'support',note:'가상 문의: 저장 흐름 확인',status:'open',assignee_label:'운영 담당',next_check_at:iso(-60),release_version:'',created_at:iso(30),updated_at:iso(10),created_by:ADM,updated_by:ADM}];
  const calls=[],blocked=[];let serial=0,failReports=false,failViews=false,forceConflict=false,saveCalls=0;
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(({ADM})=>{localStorage.setItem('ps_sync_session',JSON.stringify({uid:ADM,at:'fixture-access-token',rt:'fixture-refresh-token',email:'admin@example.test',exp:Date.now()+86400000}));},{ADM});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();if(url.origin!==apiOrigin){blocked.push(url.origin);return route.abort('blockedbyclient');}
   const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   const rpc=url.pathname.startsWith('/rest/v1/rpc/')?url.pathname.split('/').pop():null,args=req.postDataJSON()||{};calls.push({rpc,path:url.pathname,query:url.search,method:req.method(),scope:args.p_user_id||null});
   const send=(data,status=200)=>route.fulfill({status,headers,body:JSON.stringify(data)});
   if(rpc){
    if(rpc==='ps_whoami')return send([{uid:ADM,email:'admin@example.test',is_admin:true}]);
    if(rpc==='ps_admin_users_v2'||rpc==='ps_admin_users')return send(users);
    if(rpc==='ps_admin_workspaces')return send(workspaces);
    if(rpc==='ps_admin_sync_reports_list'){if(failReports)return send({code:'PGRST202',message:'fixture RPC unavailable'},404);return send(reports.filter(r=>(!args.p_user_id||r.user_id===args.p_user_id)&&(!args.p_workspace_id||r.workspace_id===args.p_workspace_id)));}
    if(rpc==='ps_admin_followups_list')return send(followups.filter(r=>(!args.p_user_id||r.subject_user_id===args.p_user_id)&&(!args.p_workspace_id||r.workspace_id===args.p_workspace_id)));
    if(rpc==='ps_admin_shared_views_list'){if(failViews)return send({code:'PGRST202',message:'fixture report unavailable'},404);return send([{user_id:U,subject_user_id:V,workspace_id:W,view_kind:'player_matches',received_at:iso(3)}].filter(r=>(!args.p_user_id||r.user_id===args.p_user_id||r.subject_user_id===args.p_user_id)&&(!args.p_workspace_id||r.workspace_id===args.p_workspace_id)));}
    if(rpc==='ps_admin_followup_save'){
     saveCalls++;const previous=followups.find(r=>r.id===args.p_id);
     if(forceConflict){forceConflict=false;if(previous){previous.version++;previous.note='다른 관리자의 가상 변경';previous.updated_at=iso(0);}return send({code:'P0001',message:'version conflict'},409);}
     if(args.p_id&&(!previous||previous.version!==args.p_expected_version))return send({code:'P0001',message:'version conflict'},409);
     const id=previous?.id||'dddddddd-dddd-4ddd-8ddd-'+String(++serial).padStart(12,'0'),row={...args.p_fields,id,version:previous?previous.version+1:1,created_at:previous?.created_at||iso(0),updated_at:iso(0),created_by:ADM,updated_by:ADM};followups=followups.filter(r=>r.id!==id);followups.push(row);return send(row);
    }
    if(rpc==='ps_admin_idp_get'||rpc==='ps_admin_library_item')return send({message:'fixture forbids document body reads'},403);
    return send([]);
   }
   if(url.pathname==='/rest/v1/ps_events'){
    const requested=url.searchParams.get('user_id');if(requested)return send([{user_id:requested.slice(3),workspace_id:W,event_name:'feature_opened',feature:'idp',device:'ipad',app_version:'2.792',status:'ok',created_at:iso(1)},{user_id:requested.slice(3),workspace_id:W,event_name:'a_diary',feature:'idp',device:'ipad',app_version:'2.792',status:'ok',created_at:iso(2)}]);return send([]);
   }
   return send({message:'unhandled fixture endpoint'},404);
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/admin.html',{waitUntil:'domcontentloaded'});await page.locator('.admin-ops [data-op-user="'+U+'"]').first().waitFor();await page.waitForTimeout(150);
  assert.match(await page.locator('.admin-ops').innerText(),/가상 문의: 저장 흐름 확인/);assert.match(await page.locator('.admin-ops').innerText(),/10분/);assert.match(await page.locator('.admin-ops').innerText(),/현재 상태를 판단하지/);await page.screenshot({path:path.join(out,'home-'+width+'.png')});
  await page.locator('.admin-ops [data-op-user="'+U+'"]').first().click();await page.locator('.aud-followup-card').waitFor();await page.locator('.aud-report').first().waitFor();
  assert.match(await page.locator('.aud-panel').innerText(),/최근 인증 로그인/);assert.match(await page.locator('.aud-panel').innerText(),/최근 수집된 사용 흔적/);assert.match(await page.locator('.aud-panel').innerText(),/일부 항목 미확인/);assert.match(await page.locator('.aud-panel').innerText(),/조회 시 10분 이내 보고/);assert.match(await page.locator('.aud-panel').innerText(),/개별 경기/);assert.equal(await page.locator('.aud-panel img').count(),0);await page.screenshot({path:path.join(out,'detail-initial-'+width+'.png')});
  const memo=page.getByLabel('관리 메모',{exact:true});await memo.fill('가상 새 기록 <script>alert(1)</script>');await page.getByRole('button',{name:'기록 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.aud-save-message')?.textContent.includes('저장했습니다'));assert.equal(saveCalls,1);assert.equal(followups.length,2);assert.equal(await page.locator('.aud-panel script').count(),0);assert.equal(await memo.inputValue(),'가상 새 기록 <script>alert(1)</script>');
  await page.getByRole('button',{name:'사용자 상세 닫기'}).click();await page.locator('[data-admin-tab="users"]').click();await page.locator('#usersTable [data-admin-user="'+U+'"]').click();await page.locator('.aud-followup-card').filter({hasText:'가상 새 기록'}).waitFor();const newCard=page.locator('.aud-followup-card').filter({hasText:'가상 새 기록'});await newCard.getByRole('button',{name:'편집',exact:true}).click();await memo.fill('내 가상 수정은 보존');forceConflict=true;await page.getByRole('button',{name:'기록 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.aud-save-message')?.textContent.includes('다른 관리자'));assert.equal(await memo.inputValue(),'내 가상 수정은 보존');assert.equal(await page.getByRole('button',{name:'기록 저장',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'새로고침',exact:true}).click();await page.locator('.aud-followup-card').filter({hasText:'다른 관리자의 가상 변경'}).getByRole('button',{name:'편집',exact:true}).click();assert.equal(await memo.inputValue(),'내 가상 수정은 보존');await page.getByRole('button',{name:'기록 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.aud-save-message')?.textContent.includes('저장했습니다'));assert.ok(followups.some(r=>r.note==='내 가상 수정은 보존'&&r.version===3));
  failReports=true;failViews=true;await memo.fill('부분 실패 중 입력');await page.getByRole('button',{name:'새로고침',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.aud-section')].filter(e=>/이 정보만 불러오지/.test(e.textContent)).length>=2);assert.equal(await memo.inputValue(),'부분 실패 중 입력');assert.match(await page.locator('.aud-timeline').first().innerText(),/훈련일지/);assert.match(await page.locator('.aud-panel').innerText(),/공유 화면 확인/);
  const geometry=await page.evaluate(()=>{const p=document.querySelector('.aud-panel'),b=p.getBoundingClientRect();return{viewport:innerWidth,panel:{x:b.x,width:b.width,height:b.height},overflow:p.scrollWidth>p.clientWidth,formInputs:[...p.querySelectorAll('input,select,textarea')].map(e=>({name:e.name,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}});assert.equal(geometry.overflow,false);assert.ok(geometry.panel.width<=width);await page.screenshot({path:path.join(out,'detail-'+width+'.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('.aud-overlay').count(),0);
  assert.equal(calls.some(c=>c.rpc==='ps_admin_idp_get'||c.rpc==='ps_admin_library_item'),false,'no automatic body reads');const scopedEventCalls=calls.filter(c=>c.path==='/rest/v1/ps_events'&&c.query.includes('user_id='));assert.ok(scopedEventCalls.length);for(const c of scopedEventCalls){assert.ok(c.query.includes('limit=100'));assert.equal(c.query.includes('meta'),false);}
  assert.deepEqual(errors,[]);results.push({width,saveCalls,noAutomaticBodyRead:true,geometry,errors,network:'All Supabase calls intercepted; every other external origin blocked',blocked});console.log(JSON.stringify({engine,width,saveCalls,passed:true}));await context.close();
 }
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({engine,fixture:'Isolated real admin.html plus in-memory authenticated REST/RPC fixture. No external data or writes.',results},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
