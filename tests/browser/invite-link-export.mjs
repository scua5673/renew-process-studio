import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startFixture,openApp,WT} from '../fixtures/team-app.mjs';
// 3.052 — 피드백 15: 선수별 초대 링크(만들기 · 링크로 들어오기 · 토큰으로 바로 잇기) · 팀 전체 내보내기(JSON + 명단 · 평가 CSV).
// 픽스처 계정은 팀 소유자라 «선수 쪽 claim 남기기»는 tests/invite-link-3042(단위)이 맡는다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);

  step('issue');
  await page.evaluate(()=>PSSync.idpLink.inviteFor('vp07','#7 가상 선수 7'));
  await page.waitForFunction(()=>[...document.querySelectorAll('div')].some(d=>/#7 가상 선수 7 초대 링크/.test(d.textContent||'')&&d.offsetParent));
  const issued=await page.evaluate(()=>{ const t=JSON.parse(localStorage.getItem('ps_idp_invite_tokens_v1')||'{}'); const body=[...document.querySelectorAll('div')].map(d=>d.textContent||'').find(x=>/studio\/app\.html\?join=/.test(x))||''; return {t,url:(body.match(/https?:\/\/\S+?tk=[0-9a-f]{24}/)||[''])[0]}; });
  const tok=issued.t[WT]&&issued.t[WT].vp07&&issued.t[WT].vp07.tk;
  assert.match(tok||'',/^[0-9a-f]{24}$/,'토큰은 이 기기에만');
  assert.ok(issued.url.includes('join=FIXJOIN1')&&issued.url.includes('pid=vp07')&&issued.url.includes('tk='+tok),issued.url);
  await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='닫기'&&x.offsetParent); if(b)b.click(); });

  step('auto-link');
  // 링크로 합류한 선수(uid C)의 IDP 문서가 이 기기에 들어왔다 — 토큰이 같으면 확인 없이 잇는다
  const C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await page.evaluate(()=>document.querySelector('#appSeg [data-team-hub]').click());
  const sf=await (await page.waitForSelector('#fScout')).contentFrame();
  await sf.waitForFunction(()=>typeof window.__ilAutoLinkByToken==='function');
  const linked=await sf.evaluate(([C,tok])=>{ localStorage.setItem('cs_idp_v1_'+C,JSON.stringify({v:1,claim:{pid:'vp07',num:'7',name:'가상 선수 7',at:Date.now(),tk:tok,via:'link'}}));
    const wrong=localStorage.getItem('cs_idp_v1_'+C); void wrong;
    const n=window.__ilAutoLinkByToken(); const pm=JSON.parse(localStorage.getItem('cs_perms_v1')||'{}');
    return {n,pid:((pm.members||{})[C]||{}).playerId||'',left:JSON.parse(localStorage.getItem('ps_idp_invite_tokens_v1')||'{}')}; },[C,tok]);
  assert.equal(linked.n,1,'토큰이 같은 claim 하나를 이었다');
  assert.equal(linked.pid,'vp07','권한표(cs_perms_v1)의 같은 칸 — 권한 관리 · 명단 칩과 같다');
  assert.deepEqual(linked.left,{},'쓴 토큰은 지운다');
  // 토큰이 다르면 잇지 않는다(평소 확인 카드로)
  const D='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const other=await sf.evaluate(([D])=>{ localStorage.setItem('ps_idp_invite_tokens_v1',JSON.stringify({[localStorage.getItem('ps_active_ws')]:{vp08:{tk:'a'.repeat(24),at:Date.now()}}}));
    localStorage.setItem('cs_idp_v1_'+D,JSON.stringify({v:1,claim:{pid:'vp08',at:Date.now(),tk:'b'.repeat(24),via:'link'}}));
    return window.__ilAutoLinkByToken(); },[D]);
  assert.equal(other,0,'토큰이 다르면 확인 카드로 남는다');

  step('join-link');
  await page.goto(fx.base+'/studio/app.html?join=FIXJOIN1&pid=vp07&tk='+'c'.repeat(24),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!/join=/.test(location.search),null,{timeout:15000});
  const pend=await page.evaluate(()=>JSON.parse(localStorage.getItem('ps_invite_pending_v1')||'null'));
  assert.equal(pend&&pend.code,'FIXJOIN1'); assert.equal(pend.pid,'vp07'); assert.equal(pend.tk,'c'.repeat(24));
  // 로그인된 기기 — 이름을 묻고(다음) «초대 링크로 합류»
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='다음'&&b.offsetParent),null,{timeout:15000});
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='다음'&&b.offsetParent).click());
  await page.waitForFunction(()=>[...document.querySelectorAll('div')].some(d=>/코치가 보낸 초대 링크예요/.test(d.textContent||'')&&d.offsetParent));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='합류'&&b.offsetParent).click());
  await page.waitForFunction(w=>{ const p=JSON.parse(localStorage.getItem('ps_invite_pending_v1')||'null'); return p&&p.wid===w; },WT,{timeout:15000});

  step('export');
  await page.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500);
  const got=[]; page.on('download',d=>got.push(d));
  await page.evaluate(()=>{ document.getElementById('gearBtn').click(); });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ const t=document.querySelector('[data-gp-go="data"]'); if(t)t.click(); });
  await page.waitForFunction(()=>{ const b=document.getElementById('bkAll'); return b&&b.style.display!=='none'; },null,{timeout:8000});
  await page.evaluate(()=>document.getElementById('bkAll').click());
  await page.waitForFunction(()=>/내려받았어요/.test(document.getElementById('bkAll').textContent),null,{timeout:15000});
  await page.waitForTimeout(1200);
  /* 파일 이름은 보지 않는다 — 헤드리스 Chromium 은 한글 download 이름을 «download» 로 바꾼다(데스크톱 크롬은 그대로). 내용으로 가른다 */
  assert.equal(got.length,3,'JSON 하나 + CSV 둘');
  const texts=await Promise.all(got.map(async d=>fs.readFileSync(await d.path(),'utf8')));
  const jsonText=texts.find(t=>t.startsWith('{')),roster=texts.find(t=>t.startsWith('\ufeff번호,이름,조')),evals=texts.find(t=>t.startsWith('\ufeff번호,이름,항목'));
  assert.ok(jsonText&&roster&&evals,texts.map(t=>t.slice(0,30)).join(' | '));
  const json=JSON.parse(jsonText);
  assert.equal(json.type,'process-studio-team-export'); assert.ok(json.keys.scout_tool_v1,'명단 원문'); assert.equal(json.workspace.id,WT);
  assert.ok(roster.startsWith('\ufeff번호,이름,조,포지션,상태,상태 끝나는 날'),roster.slice(0,60));
  assert.match(roster,/\r\n7,가상 선수 7,A팀,/);
  const pe=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(pe,[],JSON.stringify(pe.slice(0,3)));
  void context;
  console.log(JSON.stringify({engine,test:'invite-link-export',ok:true}));
}catch(e){ console.error('[invite-link-export] step='+cur); throw e; }
finally{ for(const b of Object.values(browsers))await b.close().catch(()=>{}); await fx.close?.(); }
