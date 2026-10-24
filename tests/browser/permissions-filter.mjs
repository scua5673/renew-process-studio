import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/permissions-filter'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
fs.mkdirSync(out,{recursive:true});
const sync=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8');
function cut(a,b){const i=sync.indexOf(a),j=sync.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return sync.slice(i,j);}
const actual=cut('function accountActionWatch(','function psModal(')+cut('function memberLabel(','var _dnHydratePromise=')+cut('var permsLinkFilter=','function uiLeave(');
const rows=[['owner','가상 관리자','owner'],['executive','가상 임원','member'],['staff','가상 코치','member'],['player-a','가상 선수 하나','member'],['player-b','가상 선수 둘','member'],['linked','가상 연결된 선수','member']].map(([user_id,name,role])=>({user_id,name,role,email:user_id+'@example.invalid'}));
const initial={v:1,defaultRole:'player',custom:{keep:true},members:{executive:{role:'executive'},staff:{role:'staff',scopes:['team']},'player-a':{role:'player'},'player-b':{role:'player'},linked:{role:'player',playerId:'taken'}}};
const roster={players:[{id:'taken',name:'연결된 선수',num:1},...['free-a','free-b','free-c'].map((id,i)=>({id,name:'가상 명단 '+(i+1),num:i+2}))]};
const setup=`window.fixtureWrites=[];window.fixtureMembersCalls=0;window.fixtureCurrent=true;
localStorage.setItem('ps_sync_session',JSON.stringify({uid:'owner'}));localStorage.setItem('ps_active_ws','fixture-team');localStorage.setItem('ps_ws_list',JSON.stringify([{id:'fixture-team',kind:'team',role:'owner'}]));
localStorage.setItem('cs_perms_v1',${JSON.stringify(JSON.stringify(initial))});localStorage.setItem('scout_tool_v1',${JSON.stringify(JSON.stringify(roster))});localStorage.setItem('cs_idp_v1_private','SYNTHETIC PRIVATE');
function holdConflictContext(){return {wid:'fixture-team',uid:'owner'};}function holdConflictCurrent(){return fixtureCurrent;}function workspaceSwitchGuardRead(){return null;}function activeWsObj(){return {id:'fixture-team',role:'owner'};}
function psModal(){return {close:function(){}};}function membersOf(){fixtureMembersCalls++;return Promise.resolve(${JSON.stringify(rows)});}function setStatus(){}function forceSync(){}
function psSaveShared(k,v){fixtureWrites.push({k:k,v:v});localStorage.setItem(k,v);return true;}function esc(v){return String(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
`;
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#eef0f3;font:14px system-ui}button,input,select{font:inherit}h1{margin:24px;font-size:18px}</style><h1>가상 테스트 팀</h1><script>'+setup.replace(/<\/script/gi,'<\\/script')+'</script><script>'+fs.readFileSync(path.join(root,'studio/perms.js'),'utf8')+'</script><script>'+fs.readFileSync(path.join(root,'studio/permissions-filter.js'),'utf8')+'</script><script>'+actual.replace(/<\/script/gi,'<\\/script')+"\nuiPerms({id:'fixture-team'});</script></html>";
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,results=[];
const options={headless:true};if(engine==='chromium'&&(process.env.PS_CHROME_PATH||process.platform==='darwin'))options.executablePath=process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let browser;
try{
 browser=await pw[engine].launch(options);
 for(const width of [375,393,768,1280]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<768,hasTouch:width<768,serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#psPermsOv').waitFor();
  const member=uid=>page.locator('[data-perms-member="'+uid+'"]'),filter=label=>page.getByRole('button',{name:new RegExp('^'+label+' \\d+$')});
  const visible=async()=>page.locator('[data-perms-member]:visible').evaluateAll(els=>els.map(e=>e.getAttribute('data-perms-member')).sort());
  await filter('연결 안 된 팀원').click();assert.deepEqual(await visible(),['executive','player-a','player-b','staff']);
  await filter('연결 안 된 선수').click();assert.deepEqual(await visible(),['player-a','player-b']);assert.equal(await filter('연결 안 된 선수').getAttribute('aria-pressed'),'true');
  assert.equal(await member('player-a').locator('select').nth(1).locator('option[value="taken"]').isDisabled(),true,'hidden members keep their player reserved');
  assert.equal(await page.evaluate(()=>fixtureWrites.length),0);assert.equal(await page.evaluate(()=>fixtureMembersCalls),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  await page.screenshot({path:path.join(out,width+'-unlinked-players.png')});
  await member('player-a').locator('select').nth(1).selectOption('free-a');assert.deepEqual(await visible(),['player-b']);
  await member('player-b').getByRole('checkbox').first().check();await page.getByRole('button',{name:'켜기',exact:true}).click();
  await filter('전체').click();await member('staff').locator('select').first().selectOption('player');
  await filter('연결 안 된 선수').click();assert.deepEqual(await visible(),['player-b','staff']);assert.equal(await page.locator('[data-perms-role="staff"]').isVisible(),false);
  assert.equal(await page.locator('[data-perms-role="player"] [data-perms-member="staff"]').isVisible(),true);
  await filter('연결 안 된 팀원').click();await filter('전체').click();await filter('연결 안 된 선수').click();
  assert.equal(await page.evaluate(()=>fixtureMembersCalls),1,'filters preserve the same dialog and drafts');
  await page.getByRole('button',{name:'저장',exact:true}).click();
  const expected=structuredClone(initial);expected.staffEdit='edit';expected.members['player-a'].playerId='free-a';expected.members['player-b'].scopes=['board'];expected.members.staff={role:'player',scopes:[]};
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_perms_v1'))),expected);assert.equal(await page.evaluate(()=>fixtureWrites.length),1);assert.equal(await page.evaluate(()=>fixtureWrites[0].k),'cs_perms_v1');assert.equal(await page.evaluate(()=>localStorage.getItem('cs_idp_v1_private')),'SYNTHETIC PRIVATE');
  await page.evaluate(()=>uiPerms({id:'fixture-team'}));await page.locator('#psPermsOv').waitFor();await filter('전체').click();await filter('연결 안 된 선수').click();await page.getByRole('button',{name:'저장',exact:true}).click();assert.equal(await page.evaluate(()=>fixtureWrites.length),1,'filter-only save writes nothing');
  await page.evaluate(()=>uiPerms({id:'fixture-team'}));await page.locator('#psPermsOv').waitFor();await member('player-b').locator('select').nth(1).selectOption('free-b');await member('staff').locator('select').nth(1).selectOption('free-c');assert.deepEqual(await visible(),[]);assert.equal(await page.getByRole('status').innerText(),'연결 안 된 선수가 없습니다.');
  await page.getByRole('button',{name:'취소',exact:true}).click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_perms_v1'))),expected,'cancel preserves stored settings');
  assert.deepEqual(errors,[]);results.push({width,passed:true,filterDraftsAndHiddenLinksPreserved:true,errors});await context.close();
 }
 console.log(JSON.stringify({engine,results},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
