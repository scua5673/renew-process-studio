import assert from 'node:assert/strict';
import {startFixture,openApp,ready,guestReady,WT,A} from '../fixtures/team-app.mjs';
/* 3.272 — login CSRF: 남이 만든 `…/studio/app.html#access_token=…&refresh_token=…` 링크로는 로그인되지 않는다(studio/oauth-gate.js).
   실제 app.html · sync.js · admin.html, 합성 팀 · 루프백 서버. 인증 서버(/auth/v1/authorize)는 시험이 대신 답한다(바깥으로 나가지 않는다).
     ① 로그인한 코치가 그 링크를 연다(같은 문서 · 새 탭)  → 코치 계정 그대로, 주소의 토큰은 지워지고, 알림이 뜬다. 남의 토큰은 서버로 한 번도 안 나간다
     ② 로그아웃한 기기에서 그 링크                          → 로그인되지 않는다
     ③ 로그인 단추를 눌러 시작한 로그인(카카오 · Google)      → 예전처럼 로그인된다. 표식은 한 번 쓰고 사라진다
     ④ 초대 링크(?join=)로 와서 로그인                       → 로그인되고 초대도 남아 있다
     ⑤ 설치 앱처럼 돌아온 창이 다를 때(sessionStorage 없음)   → 10분 안이면 받는다 · 10분이 지났으면 받지 않는다
     ⑥ 관리자 화면(admin.html)도 같은 문 */
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const EVIL='#access_token=evil-access&refresh_token=evil-refresh&expires_in=3600&token_type=bearer';
const GOOD='#access_token=fixture-access-A&refresh_token=fixture-refresh-A&expires_in=3600&token_type=bearer';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
const sess=p=>p.evaluate(()=>{const s=window.PSSync&&PSSync.session();return s?{uid:s.uid,at:s.at}:null;});
const stored=p=>p.evaluate(()=>{try{const s=JSON.parse(localStorage.getItem('ps_sync_session')||'null');return s?{uid:s.uid||'',at:s.at}:null;}catch(_){return 'broken';}});
const marks=p=>p.evaluate(()=>[sessionStorage.getItem('ps_oauth_pending_v1'),localStorage.getItem('ps_oauth_pending_v1')]);
const refused=async(p,why)=>{await p.locator('#psOAuthRefused').waitFor({state:'visible',timeout:15000});assert.equal(await p.locator('#psOAuthRefused').getAttribute('data-why'),why);
  assert.equal(await p.evaluate(()=>/access_token|refresh_token/.test(location.href)),false,'the tokens are gone from the address');};
/* 콜백이 저장되고 그 토큰으로 계정 확인(/auth/v1/user)까지 끝났다. 처음 로그인한 계정의 공간 고르기는 이 시험의 일이 아니다(account-team-switch 가 본다) */
const signedIn=p=>p.waitForFunction(a=>window.PSSync&&PSSync.session()&&PSSync.session().uid===a&&!/access_token/.test(location.href),A,{timeout:45000});
const evilCalls=()=>fx.calls.filter(c=>c.unauth&&/^\/(auth|rest)\/v1\//.test(c.p)&&c.step===cur);
/* 인증 서버 흉내: authorize 로 가면 redirect_to 로 토큰을 붙여 돌려보낸다 */
async function fakeProvider(context,seen){
  await context.route(u=>u.pathname==='/auth/v1/authorize',async route=>{
    const url=new URL(route.request().url());seen.push({provider:url.searchParams.get('provider'),back:url.searchParams.get('redirect_to')});
    await route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><title>fixture provider</title><script>location.replace('+JSON.stringify(url.searchParams.get('redirect_to')+GOOD)+');</script>'});
  });
}
try{
  step('coach-crafted-link');
  const coach=await openApp(fx,'desktop',{browsers}),page=coach.page;
  const before=await sess(page);assert.deepEqual(before,{uid:A,at:'fixture-access-A'});
  await page.evaluate(()=>{window.__sameDocument='yes';});
  await page.goto(fx.base+'/studio/app.html'+EVIL);                      /* 같은 문서 — 주소의 # 만 바뀐다(hashchange) */
  await refused(page,'none');
  assert.deepEqual(await sess(page),before,'the coach is still the coach');assert.deepEqual(await stored(page),before);
  assert.equal(await page.evaluate(()=>window.__sameDocument),'yes','no reload, nothing was thrown away');
  assert.equal(await page.evaluate(()=>PSSync.dataUnlocked()),true,'the team stays open');
  const tab=await coach.context.newPage();                                 /* 새 탭 — 처음부터 그 주소로 열린다 */
  await tab.goto(fx.base+'/studio/app.html'+EVIL,{waitUntil:'domcontentloaded'});
  await refused(tab,'none');await ready(tab);
  assert.deepEqual(await sess(tab),before);assert.equal(await tab.evaluate(w=>PSSync.activeWs()===w,WT),true);
  await tab.waitForTimeout(1500);
  assert.deepEqual(evilCalls(),[],'the foreign token never reaches the server');
  await tab.close();await coach.context.close();

  step('guest-crafted-link');
  const g1=await openApp(fx,'desktop',{browsers,guest:true});
  await g1.page.goto(fx.base+'/studio/app.html'+EVIL);
  await refused(g1.page,'none');
  assert.equal(await stored(g1.page),null,'a logged-out device is not signed in by a link');
  await g1.page.reload({waitUntil:'domcontentloaded'});await guestReady(g1.page);
  assert.equal(await sess(g1.page),null);assert.equal(await g1.page.locator('#psOAuthRefused').count(),0,'nothing lingers after the refused link');

  step('real-sign-in');
  const seen=[];await fakeProvider(g1.context,seen);
  await g1.page.locator('#psAcctWrap .acct-btn').click();
  const google=g1.page.locator('#psAcctWrap .acct-pop.on').getByRole('button',{name:'Google로 계속',exact:true});await google.waitFor({state:'visible'});
  const [m0]=await Promise.all([g1.page.evaluate(()=>new Promise(r=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='ps_oauth_pending_v1'&&!window.__seenMark){window.__seenMark=1;r(v);}return set.apply(this,arguments);};})),google.click()]);
  assert.ok(JSON.parse(m0).t>Date.now()-60000,'the start is recorded before leaving for the provider');
  await signedIn(g1.page);
  assert.deepEqual(await sess(g1.page),{uid:A,at:'fixture-access-A'},'a sign-in started here works as before');
  assert.deepEqual(seen.map(s=>s.provider),['google']);assert.equal(seen[0].back,fx.base+'/studio/app.html');
  assert.deepEqual(await marks(g1.page),[null,null],'the marker is used once');
  assert.equal(await g1.page.locator('#psOAuthRefused').count(),0);
  await g1.page.goto(fx.base+'/studio/app.html'+EVIL);await refused(g1.page,'none');
  assert.deepEqual(await sess(g1.page),{uid:A,at:'fixture-access-A'},'a later crafted link cannot reuse the spent marker');
  await g1.context.close();

  step('invite-link-sign-in');
  const g2=await openApp(fx,'desktop',{browsers,guest:true});const seen2=[];await fakeProvider(g2.context,seen2);
  await g2.page.goto(fx.base+'/studio/app.html?join=FIXJOIN1&pid=vp07&tk='+'c'.repeat(24),{waitUntil:'domcontentloaded'});
  await g2.page.waitForFunction(()=>!/join=/.test(location.search),null,{timeout:15000});
  const invite=await g2.page.evaluate(()=>localStorage.getItem('ps_invite_pending_v1'));assert.ok(invite&&/FIXJOIN1/.test(invite),'the invite waits on this device: '+invite);
  await guestReady(g2.page);
  const kakao=g2.page.locator('#psDataLock [data-ps-login="kakao"], #psAcctWrap .acct-pop.on button').filter({hasText:'카카오'}).first();
  if(!await kakao.isVisible().catch(()=>false))await g2.page.locator('#psAcctWrap .acct-btn').click();
  await kakao.waitFor({state:'visible'});await kakao.click();
  await signedIn(g2.page);
  assert.deepEqual(seen2.map(s=>s.provider),['kakao']);
  const after=await g2.page.evaluate(()=>({pending:localStorage.getItem('ps_invite_pending_v1'),text:document.body.innerText}));
  assert.ok((after.pending&&/FIXJOIN1/.test(after.pending))||/초대|합류/.test(after.text),'the invite survived the sign-in: '+String(after.pending).slice(0,80));
  await g2.context.close();

  step('other-window-callback');
  const g3=await openApp(fx,'desktop',{browsers,guest:true});
  await g3.page.evaluate(()=>{PSOAuthGate.begin('google');});                    /* 로그인을 시작한 창 */
  const other=await g3.context.newPage();                                        /* 돌아온 창은 다르다 — sessionStorage 가 비어 있다 */
  await other.goto(fx.base+'/studio/app.html'+GOOD,{waitUntil:'domcontentloaded'});await signedIn(other);
  assert.deepEqual(await sess(other),{uid:A,at:'fixture-access-A'},'installed-app style return in another window is accepted within ten minutes');
  assert.equal(await other.locator('#psOAuthRefused').count(),0);
  await g3.context.close();
  const g4=await openApp(fx,'desktop',{browsers,guest:true});
  await g4.page.evaluate(()=>{localStorage.setItem('ps_oauth_pending_v1',JSON.stringify({t:Date.now()-11*60*1000,from:''}));});
  await g4.page.goto(fx.base+'/studio/app.html'+GOOD);await refused(g4.page,'stale');
  assert.equal(await stored(g4.page),null,'an old start does not open the door');

  step('admin');
  await g4.page.goto(fx.base+'/admin.html'+EVIL,{waitUntil:'domcontentloaded'});
  await refused(g4.page,'none');assert.equal(await stored(g4.page),null,'admin.html does not store a foreign token either');
  await g4.page.evaluate(()=>{PSOAuthGate.begin('google');});
  await g4.page.goto(fx.base+'/admin.html'+GOOD,{waitUntil:'domcontentloaded'});await g4.page.reload({waitUntil:'domcontentloaded'});
  await g4.page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('ps_sync_session')||'null').at==='fixture-access-A';}catch(_){return false;}},null,{timeout:15000});
  assert.equal(await g4.page.locator('#psOAuthRefused').count(),0,'admin sign-in started here is stored');
  await g4.context.close();
  console.log(JSON.stringify({engine,test:'oauth-callback-gate',ok:true,providers:[...seen,...seen2].map(s=>s.provider)}));
}catch(e){
  console.error('[oauth-callback-gate] step='+cur);
  for(const b of Object.values(browsers))for(const c of b.contexts())for(const p of c.pages())console.error(' page '+p.url().slice(0,90)+' '+JSON.stringify(await p.evaluate(()=>({session:(()=>{try{const s=JSON.parse(localStorage.getItem('ps_sync_session')||'null');return s&&{uid:s.uid,at:s.at};}catch(_){return 'x';}})(),marks:[sessionStorage.getItem('ps_oauth_pending_v1'),localStorage.getItem('ps_oauth_pending_v1')],last:window.PSOAuthGate&&PSOAuthGate.last(),refused:!!document.getElementById('psOAuthRefused'),unlocked:window.PSSync&&PSSync.dataUnlocked(),ws:window.PSSync&&PSSync.activeWs(),state:window.PSSync&&PSSync.state(),lock:(document.getElementById('psDataLock')||{}).innerText})).catch(e=>String(e).slice(0,80))).slice(0,700));
  throw e;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
