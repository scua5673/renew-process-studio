/* 3.368 — 보관함 › 게임모델 «한 장에서 고르기»(gamemodel-sheet.js). 합성 계정 · 개인 판(?scope=personal).
   고르면 원칙이 원래 자리(moments › phases › principles)에 적히고, 직접 쓴 원칙은 다시 골라도 남고, «자세히»는 예전 화면이며, 팀 판은 그대로다. 세 폭에서 넘침 없음. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://gamemodel-fixture.invalid';
const shots=process.env.PS_SHOT_DIR||'';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
async function open(query,seed,size){
  const context=await browser.newContext({serviceWorkers:'block',viewport:size||{width:1280,height:900}});
  await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.resolve(root,'.'+u.pathname);if(u.origin!==base)return route.abort();if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||fs.statSync(f).isDirectory())return route.fulfill({status:404,body:''});return route.fulfill({contentType:TYPES[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});});
  await context.addInitScript(seed=>{
    const uid='11111111-1111-4111-8111-111111111111',wid='22222222-2222-4222-8222-222222222222';
    localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture'}));localStorage.setItem('ps_active_ws',wid);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid}));localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner'}]));
    if(!localStorage.getItem('gm-fixture-seeded')){
      localStorage.setItem('cs_gamemodel_v1',JSON.stringify({identity:'팀 정체성',moments:[{key:'ao',name:'공격 조직',tag:'',phases:[{id:'t1',name:'빌드업',principles:['팀 원칙']}]}]}));
      if(seed)localStorage.setItem('cs_gamemodel_personal_v1',JSON.stringify(seed));
    }
    localStorage.setItem('gm-fixture-seeded','1');
    window.PSSync={session:()=>({uid}),activeWs:()=>wid,dataUnlocked:()=>true,keyReady:()=>true};
  },seed||null);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/studio/gamemodel.html'+query);
  return {context,page,errors};
}
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_personal_v1')||'null'));
const lines=(page,k)=>page.locator(`#gmSheet [data-gs-cell="${k}"] .gsh-lines input`).evaluateAll(a=>a.map(i=>i.value));
const flat=m=>m.phases.flatMap(ph=>ph.principles.map(p=>typeof p==='string'?p:p.t)).filter(Boolean);
let fail=null;
try{
  { /* 빈 판 → 고르기 */
    const {context,page,errors}=await open('?scope=personal');
    await page.locator('#gmSheet .gsh-cell').first().waitFor();
    assert.equal(await page.locator('#gmSheet .gsh-cell').count(),4,'네 칸');
    assert.equal(await page.locator('#gmSheet .gsh-opt').count(),10,'그림 답 10개');
    assert.equal(await page.evaluate(()=>document.body.classList.contains('gm-sheet-on')&&getComputedStyle(document.querySelector('.gm-two')).display),'none','예전 판은 감춘다');
    assert.equal(await stored(page),null,'여는 것만으로는 쓰지 않는다');

    await page.locator('[data-gs-pick="ao:short"]').click();
    assert.deepEqual(await lines(page,'ao'),['골키퍼부터 짧게 이어 첫 압박을 벗어납니다']);
    let m=await stored(page), ao=m.moments.find(x=>x.key==='ao');
    assert.equal(ao.pick,'short'); assert.equal(ao.phases.length,3,'단계는 원래 목록 그대로'); assert.equal(ao.phases[0].principles[0],'골키퍼부터 짧게 이어 첫 압박을 벗어납니다','빌드업 단계에 적힌다');
    assert.equal(m.identity||'','','한 칸만으론 한 문장을 짓지 않는다');

    await page.locator('[data-gs-pick="dt:drop"]').click();
    m=await stored(page);
    assert.equal(m.identity,'짧게 이어 나가고, 잃으면 빠르게 자리를 잡는 팀');
    assert.equal(await page.locator('#gmSheet .gsh-id').inputValue(),m.identity);
    assert.equal(m.moments.find(x=>x.key==='dt').phases[1].principles[0],'공 뒤로 빠르게 내려와 줄을 맞춥니다','고른 답의 단계(후퇴 · 재정비)에');

    /* 제안 하나 + 직접 쓰기 → 세 개에서 멈춘다 */
    await page.locator('[data-gs-cell="ao"] [data-gs-add]').first().click();
    await page.locator('[data-gs-cell="ao"] [data-gs-own]').click();
    const own=page.locator('[data-gs-cell="ao"] .gsh-lines input').nth(2);
    assert.equal(await own.evaluate(e=>e===document.activeElement),true,'새 줄에 초점');
    await own.fill('풀백은 안으로 들어옵니다');
    assert.equal((await lines(page,'ao')).length,3);
    assert.equal(flat((await stored(page)).moments.find(x=>x.key==='ao')).length,3);
    assert.equal(await page.locator('[data-gs-cell="ao"] [data-gs-own],[data-gs-cell="ao"] [data-gs-add]').count(),0,'칸마다 세 개까지');
    assert.match(await page.locator('#gmSheet .gsh-foot p').innerText(),/^2 \/ 4칸/);

    /* 다시 고르기 — 앞 답이 넣은 문장만 걷고 직접 쓴 원칙은 남는다 */
    await page.locator('[data-gs-cell="ao"] [data-gs-reopen]').click();
    await page.locator('[data-gs-pick="ao:long"]').click();
    assert.deepEqual(await lines(page,'ao'),['앞으로 길게 보내고 떨어지는 공을 따냅니다','풀백은 안으로 들어옵니다']);
    m=await stored(page);
    assert.equal(m.identity,'길게 바로 보내고, 잃으면 빠르게 자리를 잡는 팀','손대지 않은 한 문장은 따라 바뀐다');
    await page.locator('#gmSheet .gsh-id').fill('우리는 끝까지 뛰는 팀');
    await page.locator('[data-gs-pick="do:mid"]').click();
    assert.equal((await stored(page)).identity,'우리는 끝까지 뛰는 팀','직접 쓴 한 문장은 그대로');

    /* 자세히 → 지우기 */
    await page.locator('[data-gs-cell="ao"] [data-gs-deep]').nth(1).click();
    await page.locator('[data-gs-cell="ao"] [data-gs-del]').click();
    assert.deepEqual(await lines(page,'ao'),['앞으로 길게 보내고 떨어지는 공을 따냅니다']);

    /* 자세히 화면 = 예전 판(같은 자료) · 돌아오면 한 장 */
    await page.locator('#gmSheetBar [data-gs-mode="detail"]').click();
    assert.equal(await page.evaluate(()=>!document.body.classList.contains('gm-sheet-on')&&getComputedStyle(document.querySelector('.gm-two')).display!=='none'&&getComputedStyle(document.getElementById('gmSheet')).display),'none');
    assert.equal(await page.locator('#gmIdentLine').inputValue(),'우리는 끝까지 뛰는 팀');
    assert.equal(await page.locator('#gmRail .gm-ri').count(),3,'레일에 국면 셋');
    const ta=page.locator('#moments .moment .prow textarea').first(); await ta.fill('자세히에서 고친 원칙');
    await page.locator('#gmSheetBar [data-gs-mode="sheet"]').click();
    assert.ok((await page.evaluate(()=>[...document.querySelectorAll('#gmSheet .gsh-lines input')].map(i=>i.value))).includes('자세히에서 고친 원칙'),'자세히에서 고친 것이 한 장에');

    /* 새로고침 뒤 그대로 · 팀 판은 손대지 않았다 */
    await page.reload(); await page.locator('#gmSheet .gsh-cell').first().waitFor();
    assert.equal(await page.locator('#gmSheet .gsh-id').inputValue(),'우리는 끝까지 뛰는 팀');
    assert.equal((await lines(page,'do'))[0],'가운데를 좁혀 공을 밖으로 내보냅니다');
    assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('cs_gamemodel_v1'))).moments[0].phases[0].principles[0],'팀 원칙');
    assert.deepEqual(errors,[],'페이지 오류 없음'); await context.close();
  }
  { /* 이미 많이 적은 판 — 앞의 셋 + «자세히 보기», 아무것도 지우지 않는다 · 직접 만든 국면도 칸으로 */
    const seed={identity:'원래 문장',moments:[{key:'ao',cat:'ao',name:'공격 조직',tag:'',phases:[{id:'a',name:'빌드업',principles:['하나','둘',{t:'셋',why:'까닭'}]},{id:'b',name:'전진 · 전개',principles:['넷','다섯']}]},{key:'mx1',cat:'ao',name:'우리 진영 빌드업',tag:'',phases:[{id:'c',name:'새 단계',principles:['']}]}]};
    for(const [name,size] of [['desktop',{width:1280,height:900}],['ipad',{width:768,height:1024}],['phone',{width:375,height:812}]]){
      const {context,page,errors}=await open('?scope=personal',seed,size);
      await page.locator('#gmSheet .gsh-cell').first().waitFor();
      assert.deepEqual(await lines(page,'ao'),['하나','둘','셋'],name);
      assert.match(await page.locator('[data-gs-cell="ao"] [data-gs-detail]').last().innerText(),/원칙 2개 더/);
      assert.equal(await page.locator('#gmSheet .gsh-cell').count(),5,'직접 만든 국면 칸');
      assert.equal(await page.locator('[data-gs-cell="mx1"] .gsh-opt').count(),0);
      const before=JSON.stringify((await stored(page)).moments);
      await page.locator('[data-gs-cell="ao"] .gsh-lines input').nth(2).fill('셋 고침');
      const ao=(await stored(page)).moments[0];
      assert.deepEqual(ao.phases[0].principles[2],{t:'셋 고침',why:'까닭'},'상세가 붙은 원칙은 글만 바뀐다');
      assert.deepEqual(ao.phases[1].principles,['넷','다섯']); assert.notEqual(JSON.stringify((await stored(page)).moments),before);
      const box=await page.evaluate(()=>{const de=document.documentElement,s=document.getElementById('gmSheet').getBoundingClientRect();const small=[...document.querySelectorAll('#gmSheet button,#gmSheet input,#gmSheetBar button')].filter(e=>e.getBoundingClientRect().height<39.5).map(e=>e.className+':'+Math.round(e.getBoundingClientRect().height));const cut=[...document.querySelectorAll('#gmSheet .gsh-cell,#gmSheet .gsh-opt,#gmSheet .gsh-lines input')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+0.5||r.left<-0.5;}).length;return {over:de.scrollWidth-de.clientWidth,w:Math.round(s.width),cols:getComputedStyle(document.querySelector('#gmSheet .gsh-grid')).gridTemplateColumns.split(' ').length,small,cut};});
      assert.ok(box.over<=0,name+' 가로 넘침 '+box.over); assert.equal(box.cut,0,name+' 잘린 칸'); assert.deepEqual(box.small,[],name+' 누르는 자리 40px+');
      assert.equal(box.cols,name==='phone'?1:2,name+' 칸 수');
      if(shots){ fs.mkdirSync(shots,{recursive:true}); await page.screenshot({path:path.join(shots,'sheet-'+name+'.png'),fullPage:true}); }
      assert.deepEqual(errors,[],name+' 페이지 오류 없음'); await context.close();
    }
  }
  { /* 팀 운영 › 게임모델에는 한 장이 없다 */
    const {context,page,errors}=await open('');
    await page.locator('#moments').waitFor({state:'attached'}); await page.waitForTimeout(300);
    assert.equal(await page.locator('#gmSheet,#gmSheetBar').count(),0);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('gm-sheet-on')),false);
    assert.deepEqual(errors,[]); await context.close();
  }
  console.log(JSON.stringify({engine,passed:true}));
}catch(e){ fail=e; console.error(e); process.exitCode=1; }
finally{ await browser.close(); }
if(fail)throw fail;
