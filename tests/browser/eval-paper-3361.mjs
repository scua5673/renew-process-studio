import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/* 3.361 — 선수 평가서(스태프용) · 선수 추천서(진학 · 외부 제출) A4 한 장씩.
   IDP › 선수 › «리포트»에서 만들고, 사본은 팀 문서의 선수 밑(papers)에 남는다. 합성 팀 fixture 에서만 돈다.
   팀 쪽 응답(teamEvalStats · teamEvalPaper)은 fixture 페이지가 흉내 낸다 — 진짜 셈은 tests/eval-paper-3361.test.cjs 가 본다. */
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'supported browser engine');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/eval-paper-3361');
fs.mkdirSync(out,{recursive:true});
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'studio/eval-standard.js'),'utf8'),sandbox);
const STD=sandbox.window.PS_EVAL_STD;
const cats=STD.cats.map(c=>({id:c.id,name:c.name}));
const attrs=STD.items.map(i=>({id:i.id,cat:i.cat,name:i.name}));
const fb=STD.posItems('FB').map(i=>i.id);
const lvA={};attrs.forEach((a,i)=>{lvA[a.id]=[3,4,2,3,3][i%5];});fb.forEach((id,i)=>{lvA[id]=[4,3,2,2,3,3,3,3][i];});
const old={};Object.keys(lvA).forEach(k=>{old[k]=Math.max(1,lvA[k]-(k===fb[1]?2:k===attrs[1].id?1:0));});
const lvB={};attrs.forEach(a=>{lvB[a.id]=1;});
const COACH='fixture-evp-coach',WID='fixture-evp-team',A='fixture-evp-a';
const players=[
  {id:'p-a',name:'가상 선수 7',num:'7',posId:'rb',levels:lvA,evalAt:Date.parse('2026-11-18T10:00:00+09:00'),grade:'2',foot:'R',
    profile:{dob:'2010. 3. 14.',height:'176',weight:'66',subs:['rwb','cb']},meetings:[],
    papers:[{id:'ep-old',kind:'eval',at:Date.parse('2026-09-28T10:00:00+09:00'),date:'2026-09-28',label:'2026 3분기',by:'가상 코치',opinion:'가상 지난 의견',levels:old}]},
  {id:'p-b',name:'가상 선수 11',num:'11',posId:'cb',levels:lvB,evalAt:0,profile:{},meetings:[],papers:[]}];
const positions=[{id:'rb',name:'RB',req:{},role:{}},{id:'rwb',name:'RWB',req:{},role:{}},{id:'cb',name:'CB',req:{},role:{}}];
const documents={
  ['cs_idp_v1_'+A]:{v:1,profile:{name:'가상 선수 7',elem:'가상초등학교',mid:'가상중학교'},selfEval:{levels:{}},trainings:[{id:'t1',title:'가상 개인 슈팅',days:['수'],items:[{name:'슛',min:'30'}]}],
    done:{'2026-10-07':['t1'],'2026-10-14':['t1']},log:{},matchSelf:{m1:{apps:'start',mins:'80',at:1},m2:{apps:'sub',mins:'25',at:2}}},
  cs_team_matches_v1:{version:1,matches:[{id:'m1',date:'2026-10-03',opponent:'가상 상대 A'},{id:'m2',date:'2026-10-17',opponent:'가상 상대 B'}]},
  scout_tool_v1:{players,positions,cats,attrs},
  cs_perms_v1:{v:1,defaultRole:'player',members:{[COACH]:{role:'executive'},[A]:{role:'player',playerId:'p-a'}}}
};
const HOST=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}iframe{display:block}</style><script>
window.fixtureAsked=[];
window.addEventListener("message",function(e){var f=document.getElementById("fixtureIDP"),d=e.data||{};if(!f||e.source!==f.contentWindow||e.origin!==location.origin||d.source!=="idp")return;
  function back(o){f.contentWindow.postMessage(Object.assign({source:"app",type:d.type+"Ack",requestId:d.requestId},o),location.origin);}
  var doc=JSON.parse(localStorage.getItem("scout_tool_v1"));
  if(d.type==="teamEvalList")back(Object.assign({ok:true,editable:true,groups:[],ex:{}},doc));
  if(d.type==="teamEvalStats"){window.fixtureAsked.push({from:d.from,to:d.to});back({ok:true,playerId:d.playerId,stats:{match:{total:22,start:13,res:5,goals:1},train:{done:96,scheduled:112,minutes:8640}}});}
  if(d.type==="teamEvalPaper"){var p=doc.players.filter(function(x){return x.id===d.playerId;})[0];p.papers=p.papers||[];
    if(d.delId)p.papers=p.papers.filter(function(x){return x.id!==d.delId;});else{p.papers=p.papers.filter(function(x){return x.id!==d.paper.id;});p.papers.unshift(d.paper);}
    localStorage.setItem("scout_tool_v1",JSON.stringify(doc));back({ok:true,playerId:p.id,papers:p.papers});}
});</script><iframe id="fixtureIDP" src="/studio/idp.html?fixture=eval-paper"></iframe>`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{
  let file;
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    if(pathname==='/fixture-idp-team.html'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(HOST);return;}
    file=path.resolve(root,'.'+pathname);
  }catch{response.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  try{response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(fs.readFileSync(file));}
  catch{response.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`;
const SIZES={desktop:{width:1280,height:1000},tablet:{width:768,height:1024},phone:{width:390,height:844}};
const result={engine,cases:[],errors:[],measure:{}};let browser;
/* 종이 한 장이 A4 안쪽(186 × 271mm)에 들어가는지 — 넘치는 덩이 · 잘리는 항목 이름이 없어야 한다 */
/* #report 는 인쇄 매체에서만 보인다 — 인쇄 모드로 바꿔 잰다(인쇄 뒤 body.rep 가 걷히므로 다시 건다) */
const fit=async(page,frame,shot)=>{await page.emulateMedia({media:'print'});try{const r=await fit0(frame);if(shot)await frame.locator('#report .evp').screenshot({path:path.join(out,engine+'-'+shot+'.png')});return r;}finally{await page.emulateMedia({media:'screen'});}};
const fit0=frame=>frame.evaluate(()=>{document.body.classList.add('rep');const a=document.querySelector('#report .evp');if(!a)return null;const r=a.getBoundingClientRect();
  return {w:Math.round(r.width),h:Math.round(r.height),over:a.scrollHeight-a.clientHeight,
    kids:[...a.children].map(c=>Math.round(c.getBoundingClientRect().bottom-r.top)),
    clip:[...a.querySelectorAll('.evp-dr>span:first-child')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),
    wide:[...a.querySelectorAll('.evp-tb')].filter(t=>t.scrollWidth>t.parentElement.clientWidth+1).length,
    op:Math.round(a.querySelector('.evp-txt').getBoundingClientRect().height),text:a.innerText,
    marks:{rows:a.querySelectorAll('.evp-dr').length,hi:a.querySelectorAll('.evp-dr.hi').length,on:a.querySelectorAll('.evp-seg i.on').length,
      up:[...a.querySelectorAll('.evp-dr em')].map(e=>e.textContent).filter(Boolean),dash:[...a.querySelectorAll('.evp-dr>b')].every(b=>b.textContent==='–'),
      pos:a.querySelector('.evp-pitch').getAttribute('aria-label'),s3:a.querySelectorAll('.evp-s3>div').length,
      h4:[...a.querySelectorAll('h4')].map(h=>{const c=getComputedStyle(h);return parseFloat(c.borderLeftWidth)+parseFloat(c.paddingLeft)+(parseFloat(c.fontSize)>11.5?100:0);}).reduce((x,y)=>x+y,0),
      foot:(()=>{const f=a.querySelector('.evp-ft').getBoundingClientRect();return Math.round(r.bottom-f.bottom);})()}};});
try{
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const size of (process.env.PS_TEST_SIZES||'desktop,tablet,phone').split(',')){
    const context=await browser.newContext({viewport:SIZES[size],serviceWorkers:'block',timezoneId:'Asia/Seoul'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
    await context.addInitScript(({uid,wid,documents})=>{
      if(!localStorage.getItem('fixture-evp-seeded')){
        localStorage.setItem('fixture-evp-seeded','1');
        localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-not-a-real-token'}));
        localStorage.setItem('ps_active_ws',wid);
        localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid,wid,nonce:'fixture'}));
        localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner',name:'프로세스FC'}]));
        localStorage.setItem('cs_lang','ko');
        localStorage.setItem('cs_idp_v1_'+uid,JSON.stringify({v:1,profile:{name:'가상 코치'},selfEval:{levels:{}},trainings:[],log:{}}));
        for(const [key,doc] of Object.entries(documents))localStorage.setItem(key,JSON.stringify(doc));
      }
      window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')||'null'),dataUnlocked:()=>true,keyReady:()=>true,syncNow:()=>Promise.resolve({fixture:true}),act(){},ping(){},displayName:()=>'가상 코치'};
      window.print=()=>{window.fixturePrinted=(window.fixturePrinted||0)+1;};
    },{uid:COACH,wid:WID,documents});
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>result.errors.push(size+': '+e.message));
    await page.clock.setFixedTime(new Date('2026-11-22T14:00:00+09:00'));
    await page.goto(base+'/fixture-idp-team.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('fixtureIDP')?.contentWindow.document.getElementById('wrap')?.children.length>0);
    const frame=page.frame({url:/\/studio\/idp\.html\?fixture=eval-paper$/});assert.ok(frame,'IDP iframe mounted');
    const open=async pid=>{
      await page.evaluate(()=>document.getElementById('fixtureIDP').contentWindow.postMessage({type:'openSquad'},location.origin));
      await frame.locator('.sq-scope').waitFor({state:'visible'});
      await frame.locator('.sq-scope button').filter({hasText:/^선수$/}).click();
      /* 폰은 첫 선수가 이미 열려 있다(목록은 «‹ 선수 목록» 뒤에) */
      const back=frame.locator('[data-sqe-back]');if(await back.count())await back.click();
      await frame.locator('[data-sqe-p="'+pid+'"]').first().click();
      if(size==='phone')return;
      await frame.locator('.sqe-modes [data-sqe-mode="report"]').click();
      await frame.locator('[data-evp-open="eval"]').waitFor({state:'visible'});
    };
    await open('p-a');
    if(size==='phone'){
      /* 폰은 «리포트» 칸이 없다(2.121 정책 그대로) — 종이는 아이패드 · 데스크톱에서 만든다 */
      await frame.locator('.sqe-modes').waitFor({state:'visible'});
      assert.equal(await frame.locator('.sqe-modes [data-sqe-mode="report"]').count(),0);assert.equal(await frame.locator('[data-evp-open]').count(),0);
      result.cases.push('phone:no-report-tab-kept');await context.close();continue;
    }
    /* 화면 칸: 옆으로 넘치지 않고, 누르는 것은 44px */
    const panel=await frame.evaluate(()=>({doc:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      btn:[...document.querySelectorAll('[data-evp-open]')].map(b=>Math.round(b.getBoundingClientRect().height)),old:document.querySelectorAll('.evp-li').length}));
    assert.ok(panel.doc<=1,size+': report tab has no horizontal overflow ('+panel.doc+')');assert.equal(panel.old,1,'the earlier paper is listed');
    /* ── 평가서 ── */
    await frame.locator('[data-evp-open="eval"]').click();
    await frame.locator('[data-evp="label"]').fill('2026 시즌 끝');
    await frame.locator('[data-evp="opinion"]').fill('가상 의견 — 시즌 후반에 공격 가담이 늘었다. 다음 시즌은 크로스와 말하기를 함께 본다.');
    const form=await frame.evaluate(()=>({doc:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      h:[...document.querySelectorAll('.evp-form input,.evp-form textarea,.evp-go .btn')].map(e=>Math.round(e.getBoundingClientRect().height))}));
    assert.ok(form.doc<=1,size+': form has no horizontal overflow');assert.ok(form.h.every(h=>h>=44),size+': form targets are 44px ('+form.h+')');
    await frame.locator('[data-evp-make="eval"]').click();
    await frame.locator('#report .evp').waitFor({state:'attached'});
    const ev=await fit(page,frame,size==='desktop'?'eval':'');result.measure[size+'-eval']={...ev,text:undefined,marks:undefined};
    assert.ok(ev.over<=1,size+': evaluation sheet fits one page (over '+ev.over+')');assert.deepEqual(ev.clip,[],size+': no clipped item names');assert.equal(ev.wide,0);
    assert.ok(ev.op>=40,size+': opinion box keeps room ('+ev.op+')');
    for(const x of ['선수 평가서','스태프 전용','가상 선수 7','2026 시즌 끝','강점 3','키울 것 3','항목 전체','가상 의견','가상 코치','13 / 22경기','96 / 112회','8,640분','출전 · 선수 기록','105분','개인 훈련','60분','2026 3분기'])
      assert.ok(ev.text.includes(x),size+': evaluation sheet has «'+x+'»');
    const marks=ev.marks;
    assert.equal(marks.rows,32,'24 standard + 8 position items');
    assert.equal(marks.h4,0,'paper headings are free of the global #report h4 bar and size');assert.ok(marks.foot>=0&&marks.foot<=2,'footer sits on the page bottom ('+marks.foot+')');
    assert.equal(marks.hi,Object.values(lvA).filter(v=>v>=3).length,'purple = items at 3 or above');
    assert.deepEqual(marks.up.sort(),['↑1','↑2'],'changes against the earlier paper');
    assert.equal(marks.pos,'포지션 — 주 RB · 보조 RWB CB');
    await page.waitForFunction(()=>document.getElementById('fixtureIDP').contentWindow.fixturePrinted>=1);
    const saved=(await page.evaluate(()=>JSON.parse(localStorage.getItem('scout_tool_v1')).players[0].papers));
    assert.equal(saved.length,2);assert.equal(saved[0].kind,'eval');assert.equal(saved[0].date,'2026-11-22');assert.equal(saved[0].label,'2026 시즌 끝');
    assert.deepEqual(saved[0].levels,lvA,'the copy keeps that day\'s levels');assert.ok(!('html' in saved[0]));
    assert.deepEqual((await page.evaluate(()=>window.fixtureAsked)).at(-1),{from:'2026-01-01',to:'2026-11-22'});
    await frame.locator('.evp-li').nth(1).waitFor({state:'visible'});
    result.cases.push(size+':evaluation-sheet-one-page-and-copy');
    /* ── 추천서 ── */
    await frame.locator('[data-evp-open="reco"]').click();
    const chips=await frame.locator('.evp-chip.on').count();assert.equal(chips,3,'three strengths preselected');
    await frame.locator('.evp-chip:not(.on)').first().click();
    assert.equal(await frame.locator('.evp-chip.on').count(),3,'a fourth strength is refused');
    await frame.locator('[data-evp="to"]').fill('프로세스고등학교');
    await frame.locator('[data-evp="contact"]').fill('010-0000-0000');
    await frame.locator('[data-evp="opinion"]').fill('가상 추천 — 공격 가담과 1대1 수비를 함께 갖춘 선수입니다.');
    await frame.evaluate(()=>{document.getElementById('report').innerHTML='';});
    await frame.locator('[data-evp-make="reco"]').click();
    await frame.locator('#report .evp.ext').waitFor({state:'attached'});
    const rc=await fit(page,frame,size==='desktop'?'reco':'');result.measure[size+'-reco']={...rc,text:undefined,marks:undefined};
    assert.ok(rc.over<=1,size+': recommendation fits one page (over '+rc.over+')');assert.equal(rc.wide,0);
    for(const x of ['선수 추천서','PLAYER RECOMMENDATION','프로세스고등학교 귀중','Tactical','Technical','Physical','Psychological','Social','Strengths','가상 추천','프로세스FC 가상 코치','010-0000-0000','2010. 3. 14.','가상중학교','Signature'])
      assert.ok(rc.text.toUpperCase().includes(x.toUpperCase()),size+': recommendation has «'+x+'»');
    for(const x of ['키울 것','스태프 전용','항목 전체'])assert.ok(!rc.text.includes(x),size+': recommendation leaves out «'+x+'»');
    assert.equal(rc.marks.rows,0,'no item-by-item levels on the recommendation');assert.equal(rc.marks.s3,3);
    result.cases.push(size+':recommendation-one-page');
    if(size==='desktop'){
      /* 지우기 → 되돌리기 */
      await frame.locator('.evp-li').nth(2).waitFor({state:'visible'});
      await frame.locator('[data-evp-del="ep-old"]').click();
      await frame.locator('[data-evp-undo]').waitFor({state:'visible'});
      assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('scout_tool_v1')).players[0].papers)).length,2);
      await frame.locator('[data-evp-undo]').click();
      await frame.locator('[data-evp-del="ep-old"]').waitFor({state:'visible'});
      assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('scout_tool_v1')).players[0].papers)).length,3);
      result.cases.push('delete-then-undo');
      /* 한 번도 평가하지 않은 선수 — 채워 둔 1 을 평가로 읽지 않는다 */
      await open('p-b');
      await frame.locator('[data-evp-open="eval"]').click();
      assert.ok((await frame.locator('.evp-fact').innerText()).includes('평가 전'));
      await frame.evaluate(()=>{document.getElementById('report').innerHTML='';});
      await frame.locator('[data-evp-make="eval"]').click();
      await frame.locator('#report .evp').waitFor({state:'attached'});
      const u0=await fit(page,frame),un={...u0.marks,text:u0.text};
      assert.equal(un.hi,0);assert.equal(un.on,0);assert.ok(un.dash,'every item reads «–»');assert.ok(un.text.includes('평가 전'));
      result.cases.push('never-evaluated-player-reads-unrated');
    }
    await context.close();
  }
  assert.deepEqual(result.errors.filter(e=>!/ResizeObserver loop/.test(e)),[],'no page errors');
  result.ok=true;
}catch(e){result.ok=false;result.error=e.stack;try{for(const c of browser.contexts())for(const pg of c.pages())await pg.screenshot({path:path.join(out,engine+'-fail.png')});}catch(err){result.shot=String(err);}}
finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,engine+'-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;}
