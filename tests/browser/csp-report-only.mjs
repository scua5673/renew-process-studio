import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.039 — CSP 보고 모드(피드백 SEC-2). _headers 의 Content-Security-Policy-Report-Only 를 그대로 붙여 앱을 열고 탭을 차례로 돌며
// ① 이 정책이면 막혔을 것이 하나도 없는지(앱 · 모든 프레임) ② 위반이 나면 app.html 의 수집기가 «지시어 + 출처(호스트까지)»로 한 번만 app_error(csp_report)를 올리는지 본다.
// 정책을 막는 쪽으로 옮기기 전에 이 시험이 먼저 지켜야 하는 약속이다 — 새 바깥 주소를 쓰려면 _headers 에 먼저 더한다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers,csp:true});
  // 모든 프레임에서 처음부터 듣는다(앱의 수집기와 별개로 — 수집기가 놓쳐도 시험은 본다)
  await context.addInitScript(()=>{ document.addEventListener('securitypolicyviolation',e=>{ try{ (window.top.__cspSeen=window.top.__cspSeen||[]).push({d:e.effectiveDirective||e.violatedDirective,b:e.blockedURI,f:String(e.sourceFile||'').split('/').pop(),l:e.lineNumber,s:String(e.sample||'').slice(0,80),at:location.pathname}); }catch(_){} },true); });
  step('boot');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!document.querySelector('#appSeg'),null,{timeout:45000});
  await page.waitForTimeout(2500);
  for(const app of ['board','design','idp','scout','community','gamemodel','process','playbook','learning','terms']){
    step('tab:'+app);
    const ok=await page.evaluate(a=>{ const b=[...document.querySelectorAll('#appSeg [data-app="'+a+'"]:not([data-train]),[data-app="'+a+'"]:not([data-train])')].find(x=>x.offsetParent); if(!b)return false; b.click(); return true; },app);
    if(ok)await page.waitForTimeout(2200);
  }
  step('seen');
  const seen=await page.evaluate(()=>window.__cspSeen||[]);
  assert.deepEqual(seen,[],'이 정책이면 막혔을 것 '+JSON.stringify(seen.slice(0,8)));

  // ③ 커뮤니티 재생 썸네일(피드백 SEC-1) — 허용목록이 작전판의 진짜 썸네일은 하나도 버리지 않고, 해로운 것은 다 버린다
  step('community-svg');
  const thumb=await (await (await page.$('#fBoard')).contentFrame()).evaluate(()=>{ state.players=[{id:1,team:'blue',num:'7',name:'Son',x:300,y:300},{id:2,team:'red',num:'9',x:600,y:500}]; renderTokens(); return boardThumbSVG(); });
  const cf=await (await page.$('#fComm')).contentFrame();
  await cf.waitForFunction(()=>typeof window.__psSafeSvgNode==='function');
  const sv=await cf.evaluate(t=>{ const raw=new DOMParser().parseFromString(t,'image/svg+xml').documentElement, safe=window.__psSafeSvgNode(t);
    const count=n=>[...n.querySelectorAll('*')].reduce((a,e)=>a+1+e.attributes.length,0);
    const evil='<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><rect width="9" height="9"/></a><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject><image href="https://evil.example/x.png"/><rect style="fill:url(https://e.x/a)" onclick="x()"/><use href="#ok"/><circle r="3"/></svg>';
    const e=window.__psSafeSvgNode(evil); return {raw:count(raw),safe:safe?count(safe):-1,evil:e?new XMLSerializer().serializeToString(e):''}; },thumb);
  assert.ok(sv.raw>40&&sv.safe===sv.raw,'작전판 썸네일은 그대로 '+JSON.stringify(sv));
  assert.doesNotMatch(sv.evil,/script|onload|onclick|javascript|foreignObject|evil\.example|url\(/i,sv.evil);
  assert.match(sv.evil,/<use href="#ok"\/><circle r="3"\/>/,'안의 참조 · 도형은 남는다');

  // ② 수집기 — 작전판 프레임에서 난 위반 한 건을 지시어 + 호스트로, 같은 것은 한 번만
  step('collector');
  const sent=await page.evaluate(async()=>{
    const got=[]; const real=window.PSSync&&PSSync.event; PSSync.event=function(name,o){ got.push({name,o}); };
    const fr=document.getElementById('fBoard'), doc=fr&&fr.contentDocument; if(!doc)return {err:'no board frame'};
    if(!fr.contentWindow.__psCsp)window.__psCspHook(fr.contentWindow);
    const ev=()=>new (fr.contentWindow.SecurityPolicyViolationEvent)('securitypolicyviolation',{effectiveDirective:'connect-src',violatedDirective:'connect-src',blockedURI:'https://evil.example/path/secret?token=1',
      documentURI:location.href,originalPolicy:'x',disposition:'report',statusCode:200,sourceFile:location.origin+'/studio/board.html',lineNumber:12,columnNumber:3});
    doc.dispatchEvent(ev()); doc.dispatchEvent(ev());
    await new Promise(r=>setTimeout(r,50)); PSSync.event=real; return got; });
  assert.ok(Array.isArray(sent),JSON.stringify(sent));
  assert.equal(sent.length,1,'같은 위반은 한 번만 '+JSON.stringify(sent));
  assert.equal(sent[0].name,'app_error');
  assert.equal(sent[0].o.error_code,'csp_report');
  assert.equal(sent[0].o.meta.source,'connect-src https://evil.example','호스트까지만');
  assert.doesNotMatch(JSON.stringify(sent[0]),/secret|token/,'경로 · 질의는 올리지 않는다');
  assert.equal(await page.evaluate(()=>{ const b=document.getElementById('ps-errbar'); return !!b&&b.style.display==='block'&&/csp/i.test(b.textContent); }),false,'화면 오류 띠는 없다');
  const pe=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(pe,[],'페이지 오류 없음 '+JSON.stringify(pe.slice(0,3)));
  console.log(JSON.stringify({engine,test:'csp-report-only',ok:true}));
}catch(e){ console.error('[csp-report-only] step='+cur); throw e; }
finally{ for(const b of Object.values(browsers))try{await b.close();}catch(_){} try{await fx.close();}catch(_){} }
