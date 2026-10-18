import assert from 'node:assert/strict';
import {startFixture,openApp,A,WT,SIZES} from '../fixtures/team-app.mjs';
// 오류 제보 8d8daa7e «IDP» — 앱이 새 판으로 바뀐 직후 팀 운영 › IDP 의 선수 피드백이 «전부 없어졌다»가 몇 분 뒤 돌아왔다.
// ① 새 판으로 여는 새로고침은 팀 자료 사본을 지우지 않는다(닫을 때만 지운다).
// ② 지운 사본을 다시 받는 동안 IDP 선수단은 «명단이 비어 있어요» 대신 «받는 중»을 말하고, 자료가 오면 프레임을 다시 열지 않아도 명단이 나타난다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
SIZES.desktop.engine=engine;   /* 제보는 데스크톱 — 두 엔진 모두 같은 화면으로 */
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
const P=[1,2,3].map(i=>'22222222-2222-4222-8222-00000000000'+i);
const perms={members:{[A]:{role:'executive'}},defaultRole:'player'};
P.forEach((u,i)=>{perms.members[u]={role:'player',playerId:'vp0'+(i+1)};});
const put=(k,v)=>fx.db.set(WT+'|'+k,{workspace_id:WT,k,v:JSON.stringify(v),cupd:1000,updated_by:A});
put('cs_perms_v1',perms);
P.forEach((u,i)=>{put('cs_idp_v1_'+u,{v:1,profile:{name:'가상 선수 '+(i+1)},log:{},imgNotes:[]});put('cs_idp_pub_v1_'+u,{talk:[{id:'tk'+i,text:'가상 피드백 '+i,at:1000,by:'가상 코치'}]});});
const cache=page=>page.evaluate(()=>{let pub=0;for(let i=0;i<localStorage.length;i++)if(localStorage.key(i).startsWith('cs_idp_pub_v1_'))pub++;
  return {pub,roster:!!localStorage.getItem('scout_tool_v1'),wiped:!!localStorage.getItem('ps_cache_wiped_v1')};});
const idpText=page=>page.evaluate(()=>{try{return document.getElementById('fIdp').contentDocument.body.innerText.replace(/\s+/g,' ');}catch(_){return '';}});
async function idpShows(page,re,ms){const end=Date.now()+ms;while(Date.now()<end){if(re.test(await idpText(page)))return true;await page.waitForTimeout(250);}return false;}
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  step('open-squad');
  await page.evaluate(()=>document.querySelector('#appSeg button[data-scope="global"][data-app="idp"]').click());
  assert.ok(await idpShows(page,/가상 선수 1/,20000),'선수단에 연결된 선수가 보인다');
  assert.deepEqual(await cache(page),{pub:3,roster:true,wiped:false});
  await page.waitForTimeout(16000);   /* 연 지 15초 안의 새로고침은 원래 지우지 않는다 — 그 뒤라야 의미가 있다 */

  step('update-reload');
  let nav=page.waitForNavigation({waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{psAutoReloadWhenSafe(true);window.__psForceReload(true);});
  await nav;
  assert.deepEqual(await cache(page),{pub:3,roster:true,wiped:false},'새 판으로 여는 새로고침은 팀 자료 사본을 지우지 않는다');
  assert.ok(await idpShows(page,/가상 선수 1/,20000),'다시 열린 IDP 선수단에 선수가 그대로 보인다');
  assert.equal(/명단이 비어 있어요/.test(await idpText(page)),false);
  await page.waitForTimeout(16000);

  step('close-like-reload-slow-pull');
  /* 닫았다 여는 것과 같은 새로고침(표시 없음) + 느린 팀 자료 수신 — 실제 팀은 받는 데 수 초가 걸린다 */
  const slow=u=>u.pathname==='/rest/v1/ps_kv'&&/k=in\./.test(decodeURIComponent(u.search));
  await page.context().route(slow,async r=>{await new Promise(x=>setTimeout(x,6000));r.continue().catch(()=>{});});
  nav=page.waitForNavigation({waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{sessionStorage.setItem('ps_resume_screen',JSON.stringify({app:document.body.getAttribute('data-ps-app')||'',team:window.__psTeamSection?String(window.__psTeamSection()||''):'',at:Date.now()}));location.reload();});
  await nav;
  const w=await cache(page);assert.equal(w.wiped,true,'닫힘 정리는 그대로 동작한다');assert.equal(w.pub,0);
  assert.ok(await idpShows(page,/팀 자료를 받는 중이에요/,15000),'받는 동안은 «받는 중»');
  assert.equal(/명단이 비어 있어요/.test(await idpText(page)),false,'받는 동안 «명단이 비어 있어요»라고 하지 않는다');
  await page.evaluate(()=>{document.getElementById('fIdp').contentWindow.__sameDoc=1;});
  assert.ok(await idpShows(page,/가상 선수 1/,40000),'자료가 오면 다시 열지 않아도 명단이 나타난다');
  assert.equal(await page.evaluate(()=>document.getElementById('fIdp').contentWindow.__sameDoc),1,'프레임을 다시 연 것이 아니다');
  assert.equal((await cache(page)).pub,3);
  await page.context().unroute(slow);
  const pe=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(pe,[],JSON.stringify(pe.slice(0,3)));
  const kvWrites=fx.writes.filter(x=>P.some(u=>String(x.k||'').endsWith(u)));assert.deepEqual(kvWrites,[],'선수 IDP · 코치 피드백 문서를 서버에 다시 올리지 않는다(읽기만)');
  console.log(JSON.stringify({engine,test:'idp-update-reload',ok:true}));
}catch(e){console.error('[idp-update-reload] step='+cur);throw e;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
