import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// 2.964 — 관리자 › 사용자 상세 «만든 것» · «요즘 하는 일».
// 실제 admin.html 을 합성 RPC 로 연다. 바깥 요청은 전부 가로챈다 — 운영 자료를 읽지 않는다.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/admin-user-made');fs.mkdirSync(out,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const ADM='99999999-9999-4999-8999-999999999999',USER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const WS='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',WS2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const adminSource=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const apiOrigin=(adminSource.match(/url:"(https:\/\/[^\"]+)"/)||[])[1];assert.ok(apiOrigin,'Configured origin is used for interception only');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local');const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch(_){res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port;
const now=Date.now(),iso=d=>new Date(now-d*864e5).toISOString();
// 이 사람이 만든 것 14개(지운 것 1) + 남이 만든 것 2
const lib=[],owners=[];
const add=(id,owner,name,type,days,ws=WS,del=false)=>{lib.push({workspace_id:ws,workspace_name:ws===WS?'프로세스FC':'프로세스FC U15',lib_id:id,name,type,folder:'',saved_at:now-days*864e5,updated_at:iso(days),deleted_at:del?iso(1):null,shared:true});owners.push({workspace_id:ws,lib_id:id,owner_id:owner,owner_name:owner===USER?'합성 코치':'다른 코치',owner_email:''});};
for(let i=1;i<=12;i++)add('m'+i,USER,'가상 훈련 '+i,'train',i);
add('mt',USER,'가상 경기 미팅','meeting',0.5,WS2);add('del',USER,'지운 작전판','board',3,WS,true);
add('o1',OTHER,'남의 훈련','train',1);add('o2',OTHER,'남의 미팅','meeting',2);
const events=[['a_week','schedule',0.2],['a_week','schedule',1],['a_week','schedule',2],['a_review','scout',1.5],['a_train','board',3],['a_week','schedule',12],
  ['feature_opened','board',0.1],['feature_opened','board',0.3],['feature_opened','idp',0.4],['sync_failed','sync',0.5]]
  .map(([n,f,d])=>({user_id:USER,workspace_id:WS,event_name:n,feature:f,status:'ok',device:'desktop',app_version:'2.964',error_code:'',created_at:iso(d)}));
let browser;const results=[];
try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  for(const width of [1280,393]){
    const calls=[],blocked=[],errors=[];
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());if(url.origin===base)return route.continue();
      if(url.origin!==apiOrigin){blocked.push(url.origin+url.pathname);return route.abort('blockedbyclient');}
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,prefer','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'};
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
      const name=url.pathname.startsWith('/rest/v1/rpc/')?url.pathname.split('/').at(-1):null,args=request.postDataJSON()||{};calls.push({name,path:url.pathname,args});
      const send=(v,status=200)=>route.fulfill({status,headers,body:JSON.stringify(v)});
      if(name==='ps_whoami')return send([{uid:ADM,email:'admin@example.test',is_admin:true}]);
      if(name==='ps_admin_workspaces')return send([{id:WS,name:'프로세스FC',kind:'team',members:3},{id:WS2,name:'프로세스FC U15',kind:'team',members:2}]);
      if(name==='ps_admin_users')return send([{user_id:USER,name:'합성 코치',email:'coach@example.test',workspace_ids:[WS,WS2],team_names:'프로세스FC, 프로세스FC U15'},{user_id:OTHER,name:'다른 코치',email:'other@example.test',workspace_ids:[WS]}]);
      if(name==='ps_admin_library')return send(lib);
      if(name==='ps_admin_content_owners')return send(owners);
      if(name==='ps_admin_library_item')return send({workspace_id:args.p_wid,lib_id:args.p_lib_id,item:{name:(lib.find(r=>r.lib_id===args.p_lib_id)||{}).name,trainings:[]}});
      if(url.pathname==='/rest/v1/ps_events')return send(url.searchParams.get('user_id')==='eq.'+USER?events:[]);
      if(name)return send([]);
      return send([]);
    });
    await context.routeWebSocket('**/*',socket=>{blocked.push(socket.url());socket.close();});
    await context.addInitScript(({ADM})=>{localStorage.setItem('ps_sync_session',JSON.stringify({uid:ADM,at:'fixture-admin-access',rt:'PRIVATE_ADMIN_REFRESH',email:'admin@example.test',exp:Date.now()+86400000}));},{ADM});
    const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/admin.html',{waitUntil:'domcontentloaded'});await page.locator('#app').waitFor({state:'visible'});
    await page.waitForFunction(()=>typeof ALL_LIB!=='undefined'&&ALL_LIB.length===16&&adminOwnersReady===true);
    await page.evaluate(uid=>openAdminUser(uid),USER);
    const panel=page.locator('.aud-panel');await panel.waitFor();
    await page.waitForFunction(()=>/주간 일정 편집/.test((document.querySelector('.aud-panel')||{}).innerText||''));
    const sections=await panel.locator('.aud-section h3').allInnerTexts();
    assert.deepEqual(sections.slice(0,4),['계정','팀','만든 것','요즘 하는 일']);
    const made=panel.locator('.aud-section').nth(2);
    const madeText=await made.innerText();
    assert.match(madeText,/모두 13개 · 지운 것 1/,'이 사람 것만 · 지운 것은 따로');
    assert.ok(!madeText.includes('남의 훈련')&&!madeText.includes('지운 작전판'));
    assert.equal(await made.locator('.aud-made-row').count(),6,'최근 6개까지 — 나머지는 콘텐츠 탭');
    assert.match(await made.locator('.aud-made-row').first().innerText(),/미팅[\s\S]*가상 경기 미팅[\s\S]*프로세스FC U15/,'가장 최근 것이 맨 위 · 팀 이름');
    assert.match(madeText,/콘텐츠 탭에서 13개 모두 보기/);
    const ev=panel.locator('.aud-section').nth(3),evText=await ev.innerText();
    assert.match(evText,/최근 7일 한 일[\s\S]*주간 일정 편집\s*3[\s\S]*경기 리뷰 저장\s*1/,'7일 지난 편집은 빠진다');
    assert.match(evText,/자주 연 화면[\s\S]*보드\s*2/);
    assert.ok(!/자주 연 화면[\s\S]*동기화/.test(evText),'동기화 실패는 «한 일»이 아니다');
    assert.equal(calls.filter(c=>c.name==='ps_admin_library_item').length,0,'상세를 여는 것만으로 본문을 읽지 않는다');
    // 가로 넘침 · 잘림
    const geo=await page.evaluate(()=>{const p=document.querySelector('.aud-panel'),r=p.getBoundingClientRect();
      const over=[...p.querySelectorAll('.aud-made-row,.aud-chip,.aud-chiprow')].filter(e=>{const b=e.getBoundingClientRect();return b.right>r.right+0.5||b.left<r.left-0.5;}).length;
      const rows=[...p.querySelectorAll('.aud-made-row')].map(e=>Math.round(e.getBoundingClientRect().height));
      return {panelW:Math.round(r.width),over,minRow:Math.min(...rows),maxRow:Math.max(...rows),docW:document.documentElement.scrollWidth,vw:innerWidth};});
    assert.equal(geo.over,0);assert.ok(geo.minRow>=44,'누르는 줄은 44px 이상');assert.ok(geo.docW<=geo.vw);
    await made.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,width+'-admin-user-made.png')});await ev.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,width+'-admin-user-doing.png')});
    // 팀 고르기 → 그 팀 것만
    await panel.locator('.aud-filter select').selectOption(WS2);
    await page.waitForFunction(()=>/모두 1개/.test(document.querySelectorAll('.aud-section')[2].innerText));
    await panel.locator('.aud-filter select').selectOption('');
    await page.waitForFunction(()=>/모두 13개/.test(document.querySelectorAll('.aud-section')[2].innerText));
    // 하나 누르면 콘텐츠 탭에서 그 자료 — 그때 처음 본문을 읽는다
    await made.locator('.aud-made-row').first().click();
    await page.waitForFunction(()=>!document.querySelector('.aud-panel'));
    await page.waitForFunction(()=>curTab==='all');
    await page.waitForFunction(()=>true);await page.waitForTimeout(400);
    assert.equal(calls.filter(c=>c.name==='ps_admin_library_item'&&c.args.p_lib_id==='mt').length,1,'고른 그 자료만 읽는다');
    // «모두 보기» → 작성자 필터
    await page.keyboard.press('Escape').catch(()=>{});
    await page.evaluate(uid=>{try{document.querySelectorAll('.ac-modal .ac-close,[data-ac-action="close"]').forEach(b=>b.click());}catch(_){} openAdminUser(uid);},USER);
    await page.locator('.aud-panel').waitFor();
    await page.locator('.aud-panel .aud-section').nth(2).getByRole('button',{name:/콘텐츠 탭에서 13개 모두 보기/}).click();
    await page.waitForFunction(uid=>!document.querySelector('.aud-panel')&&curTab==='all'&&document.getElementById('alAuthor').value==='id:'+uid,USER);
    const count=(await page.locator('#alCount').innerText().catch(()=>'')).trim();
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
    results.push({width,geo,count});
    await context.close();
  }
  console.log(JSON.stringify({engine,passed:true,test:'admin-user-made',results}));
}finally{if(browser)await browser.close();server.close();}
