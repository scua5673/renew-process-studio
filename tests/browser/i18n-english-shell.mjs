import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES,OUT,SHOTS} from '../fixtures/team-app.mjs';

// 영어 모드의 셸(app.html 문서)에 한글이 남지 않는다 · 한국어로 돌리면 원문 그대로 · 한국어 사용자는 영어 사전을 받지 않는다.
// 합성 팀(가상 테스트 FC · 가상 선수 N · A팀/B팀)의 이름은 사용자 자료라 그대로 둔다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
SIZES.phone.engine=engine;SIZES.desktop.engine=engine;
SIZES.phone.ctx={...SIZES.phone.ctx,viewport:{width:390,height:844},deviceScaleFactor:1};
SIZES.desktop.ctx={viewport:{width:1440,height:900},deviceScaleFactor:1};
const fx=await startFixture(),browsers={},results=[];
const seedLang=lang=>({fn:l=>{if(window.top!==window||localStorage.getItem('i18n_test_seed'))return;localStorage.setItem('i18n_test_seed','1');localStorage.setItem('cs_lang',l);},arg:lang});
/* 판 소개 글(release-notes.js — 판마다 바뀌는 내용, 영역 content)은 아직 한국어다 */
const USER_DATA=/가상|[AB]팀|v\d\.\d{3} ·/;

/* 셸 문서에서 보이는 글 노드 · 번역 대상 속성에 남은 한글 */
function leftovers(page,{all=false}={}){
  return page.evaluate(({attrs,all})=>{
    const H=/[ㄱ-ㆎ가-힣]/,out=[];
    const shown=el=>{
      if(!el||!el.getClientRects().length)return false;
      if(el.checkVisibility&&!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;
      const r=el.getBoundingClientRect();
      return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;
    };
    const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let n;
    while((n=w.nextNode())){
      const t=n.nodeValue.replace(/\s+/g,' ').trim(),p=n.parentElement;
      if(!t||!H.test(t)||!p||p.closest('script,style,noscript,template'))continue;
      if(all||shown(p))out.push({kind:'text',text:t,where:(p.id?'#'+p.id:p.tagName.toLowerCase()+(p.className&&typeof p.className==='string'?'.'+p.className.split(' ')[0]:''))});
    }
    for(const el of document.body.querySelectorAll('*')){
      if(!all&&!shown(el))continue;
      for(const a of attrs){const v=el.getAttribute(a);if(v&&H.test(v))out.push({kind:a,text:v.replace(/\s+/g,' ').trim(),where:el.id?'#'+el.id:el.tagName.toLowerCase()});}
    }
    return out;
  },{attrs:['placeholder','title','aria-label','aria-description','aria-placeholder','aria-valuetext','aria-roledescription','alt','data-tip','data-ph','data-title','data-short','data-df-label','data-sel-note'],all});
}
async function expectEnglish(page,label){
  await page.waitForTimeout(350);
  const left=(await leftovers(page)).filter(x=>!USER_DATA.test(x.text)&&!/\.ava$/.test(x.where));
  const uniq=[...new Map(left.map(x=>[x.kind+'|'+x.text,x])).values()];
  results.push({label,left:uniq.length});
  assert.deepEqual(uniq,[],label+' — Korean left in the English shell');
}
async function noOverflow(page,label){
  const bad=await page.evaluate(()=>{
    const out=[];
    for(const sel of ['#appSeg button','#teamBottom>button','#teamNav button','.appbar button','#gearPop .gp-tab,#gearPop [data-gp-go]']){
      for(const el of document.querySelectorAll(sel)){
        if(!el.getClientRects().length)continue;
        const s=el.querySelector('span')||el,r=el.getBoundingClientRect();
        if(s.scrollWidth>s.clientWidth+1&&getComputedStyle(s).overflow!=='visible')out.push({sel,text:el.textContent.trim().slice(0,40),sw:s.scrollWidth,cw:s.clientWidth});
        if(r.right>innerWidth+1||r.left<-1)out.push({sel,text:el.textContent.trim().slice(0,40),left:r.left,right:r.right});
      }
    }
    /* 말줄임(…)으로 잘린 메뉴 글 — 왼쪽 메뉴 · 하단 메뉴 · 팀 메뉴 */
    for(const el of document.querySelectorAll('.appbar *,#appSeg *,#teamBottom *,#teamNav *')){
      if(el.children.length||!el.getClientRects().length||!el.textContent.trim())continue;
      if(el.scrollWidth>el.clientWidth+1&&getComputedStyle(el).overflow!=='visible')out.push({clipped:el.id||el.className||el.tagName,text:el.textContent.trim().slice(0,40),sw:el.scrollWidth,cw:el.clientWidth});
    }
    if(document.documentElement.scrollWidth>innerWidth+1)out.push({page:'horizontal overflow',sw:document.documentElement.scrollWidth});
    return out;
  });
  assert.deepEqual(bad,[],label+' — English labels fit');
}
async function settingsTabs(page,label){
  const tabs=await page.evaluate(()=>[...document.querySelectorAll('#gearPop [data-gp-go]')].filter(b=>b.getClientRects().length).map(b=>b.getAttribute('data-gp-go')));
  assert.ok(tabs.length>=3,label+' settings tabs '+JSON.stringify(tabs));
  for(const t of tabs){
    await page.locator('#gearPop [data-gp-go="'+t+'"]').click();
    await expectEnglish(page,label+' settings › '+t);
  }
}
try{
  /* 1) 데스크톱 1440×900 — 영어로 부팅 */
  const reqEn=[];
  const desk=await openApp(fx,'desktop',{browsers,init:seedLang('en')});
  desk.page.on('request',r=>reqEn.push(r.url()));
  {
    const {page,logs}=desk;
    await page.evaluate(()=>PSI18n.ready);
    assert.equal(await page.evaluate(()=>PSI18n.lang()),'en');
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en','shell <html lang>');
    assert.deepEqual(await page.evaluate(()=>PSI18n.packs().slice(0,2)),['en-common','en-shell'],'shell dictionaries are requested first');
    /* 틀은 문서가 실린 뒤(load) 걷기가 lang 을 찍는다 — 막 실린 틀을 한 번만 보면 빈 값이 잡힌다(PR #804 웹킷 entry). 5초까지 기다렸다 본다 */
    const frameLangsOf=()=>[...document.querySelectorAll('iframe')].map(f=>{try{const d=f.contentDocument;return d&&d.body&&d.body.childNodes.length&&d.location.href!=='about:blank'?d.documentElement.lang:'en';}catch(_){return 'en';}});
    let frameLangs=await page.evaluate(frameLangsOf);
    for(let i=0;i<20&&!frameLangs.every(l=>l==='en');i++){await page.waitForTimeout(250);frameLangs=await page.evaluate(frameLangsOf);}
    assert.ok(frameLangs.every(l=>l==='en'),'iframe <html lang> follows the shell '+JSON.stringify(frameLangs));
    assert.deepEqual(await page.locator('#appSeg button').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>e.textContent.trim())),['Board','Library','Team','IDP','Community','Profile'],'desktop rail in English, Learning removed');
    await expectEnglish(page,'desktop board');
    await noOverflow(page,'desktop board');
    await page.screenshot({path:path.join(SHOTS,'i18n-desktop-board.png')});
    await page.setViewportSize({width:1180,height:820});   /* 아이패드 가로 폭 */
    await page.waitForFunction(()=>innerWidth===1180);
    await noOverflow(page,'1180×820 board');
    await page.screenshot({path:path.join(SHOTS,'i18n-1180-board.png')});
    await page.setViewportSize({width:1440,height:900});
    await page.waitForFunction(()=>innerWidth===1440);
    await page.locator('#psTrainBtn').click();
    await page.waitForFunction(()=>document.body.dataset.psApp==='design');
    await expectEnglish(page,'desktop vault');
    await page.screenshot({path:path.join(SHOTS,'i18n-desktop-vault.png')});
    await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
    await page.waitForFunction(()=>document.body.dataset.psApp==='board');
    await expectEnglish(page,'desktop board after vault');
    await page.locator('#appSeg [data-team-hub]').click();
    await page.waitForFunction(()=>document.body.classList.contains('ps-team-open'));
    await page.waitForTimeout(800);
    await expectEnglish(page,'desktop team today');
    await noOverflow(page,'desktop team today');
    await page.screenshot({path:path.join(SHOTS,'i18n-desktop-team.png')});
    await page.evaluate(()=>document.getElementById('gearBtn').click());
    await page.locator('#gearPop').waitFor({state:'visible'});
    await expectEnglish(page,'desktop settings');
    await page.screenshot({path:path.join(SHOTS,'i18n-desktop-settings.png')});
    await settingsTabs(page,'desktop');
    await noOverflow(page,'desktop settings');

    /* 실행 중 한국어로 — 원문 그대로 */
    const koNow=async()=>(await leftovers(page,{all:true})).map(x=>x.kind+'|'+x.where+'|'+x.text).sort();
    await page.locator('#gearPop [data-gp-go="general"]').click();
    await page.locator('#langSw [data-lang="ko"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'ko');
    const afterSwitch=await koNow();
    assert.ok(afterSwitch.length>200,'Korean is back '+afterSwitch.length);
    /* 나중에 그려진 글 · 속성 · 알림 · 창도 번역된다 */
    await page.locator('#langSw [data-lang="en"]').click();
    await page.evaluate(()=>{
      const d=document.createElement('div');d.id='i18nProbe';d.style.cssText='position:fixed;left:0;top:0;z-index:2147483647';
      d.innerHTML='<button id="i18nProbeB" title="새로고침">다시 시도</button><svg width="40" height="20"><text id="i18nProbeS" y="12">저장됨</text></svg><select><option id="i18nProbeO">오프라인</option></select><textarea id="i18nProbeT">보관함</textarea><div id="i18nProbeC" contenteditable="true">보관함</div><span id="i18nProbeU">가상 선수 1</span>';
      document.body.appendChild(d);
    });
    await page.waitForFunction(()=>document.getElementById('i18nProbeB').textContent==='Try again');
    assert.deepEqual(await page.evaluate(()=>({title:i18nProbeB.title,svg:i18nProbeS.textContent,option:i18nProbeO.textContent,textarea:i18nProbeT.value,editable:i18nProbeC.textContent,user:i18nProbeU.textContent})),
      {title:'Refresh',svg:'Saved',option:'Offline',textarea:'보관함',editable:'보관함',user:'가상 선수 1'},'innerHTML · title · SVG text · option are translated, typed content and names are not');
    await page.evaluate(()=>{i18nProbeB.textContent='저장 확인';i18nProbeB.setAttribute('title','닫기');i18nProbeB.setAttribute('aria-label','오류 제보');});
    await page.waitForFunction(()=>i18nProbeB.textContent==='Check save'&&i18nProbeB.title==='Close'&&i18nProbeB.getAttribute('aria-label')==='Report a problem');
    await page.evaluate(()=>{i18nProbeB.setAttribute('title','3 / 7');});
    await page.locator('#langSw [data-lang="ko"]').click();
    assert.deepEqual(await page.evaluate(()=>({text:i18nProbeB.textContent,title:i18nProbeB.title,aria:i18nProbeB.getAttribute('aria-label'),svg:i18nProbeS.textContent})),{text:'저장 확인',title:'3 / 7',aria:'오류 제보',svg:'저장됨'},'switching back restores the latest Korean, not a stale one');
    await page.evaluate(()=>document.getElementById('i18nProbe').remove());
    await page.locator('#langSw [data-lang="en"]').click();
    const dialogs=[];page.on('dialog',d=>dialogs.push(d.message()));
    await page.evaluate(()=>{try{alert('취소했어요');}catch(_){}});
    await page.waitForFunction(()=>true);
    assert.ok(desk.logs.some(l=>l.type==='dialog'&&/Cancelled/.test(l.text))||dialogs.some(m=>/Cancelled/.test(m)),'alert text is translated '+JSON.stringify(dialogs));
    await page.locator('#langSw [data-lang="ko"]').click();
    assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'no runtime errors (desktop en)');
  }
  /* learn-model.js 는 학습 앱이 아니라 IDP · 플레이북이 함께 읽는 사전(idp.html · gamemodel.html) — 그 화면이 미리 데워지면 요청된다(PR #800 크로미움 entry) */
  const learnReq=reqEn.filter(u=>/learning\.html|learn-(?!model\.js)/.test(u));
  assert.deepEqual(learnReq,[],'Learning files are not requested');

  /* 2) 한국어로 부팅한 기기와 한 글자도 다르지 않다 · 영어 사전을 받지 않는다 */
  {
    const reqKo=[];
    const ko=await openApp(fx,'desktop',{browsers,init:seedLang('ko')});
    ko.context.on('request',r=>reqKo.push(r.url()));
    const {page}=ko;
    await page.evaluate(()=>PSI18n.ready);
    const seen=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));
    assert.deepEqual(seen.concat(reqKo).filter(u=>/\/i18n\/en-/.test(u)),[],'Korean boot requests no English dictionary');
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'ko');
    assert.deepEqual(await page.locator('#appSeg button').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>e.textContent.trim())),['보드','보관함','팀 운영','IDP','커뮤니티','프로필'],'Korean rail, Learning removed');
    /* 영어 → 한국어로 돌린 화면과 처음부터 한국어인 화면의 고정 문구가 같다 */
    const staticKo=()=>page.evaluate(()=>[...document.querySelectorAll('#appSeg button span,#gearPop .gp-section-title,#gearPop .gp-lb,#teamBottom button span,#appMoreSheet button,#teamMoreSheet button')].map(e=>e.textContent.trim()));
    const before=await staticKo();
    await page.evaluate(()=>PSI18n.set('en'));
    await page.waitForFunction(()=>document.querySelector('#appSeg button span').textContent==='Board');
    await page.evaluate(()=>PSI18n.set('ko'));
    assert.deepEqual(await staticKo(),before,'en → ko restores the original Korean exactly');
    assert.equal(await page.evaluate(()=>localStorage.getItem('cs_lang')),'ko');
    await ko.context.close();
  }
  await desk.context.close();

  /* 3) 폰 390×844 — 영어로 부팅 */
  {
    const phone=await openApp(fx,'phone',{browsers,phoneStart:true,init:seedLang('en')});
    const {page,logs}=phone;
    await page.evaluate(()=>PSI18n.ready);
    await page.waitForFunction(()=>document.body.classList.contains('ps-mobile-six'));
    await page.locator('#appSeg [data-team-hub]').click();
    await page.waitForFunction(()=>document.body.classList.contains('ps-team-open'));
    await page.waitForTimeout(800);
    assert.deepEqual(await page.locator('#appSeg button').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>e.textContent.trim())),['Board','Library','Community','Team','More'],'phone bottom bar: five English destinations');
    await expectEnglish(page,'phone team today');
    await noOverflow(page,'phone team today');
    await page.screenshot({path:path.join(SHOTS,'i18n-phone-team.png')});
    await page.locator('#teamBottom [data-tb="more"]').click();
    await page.locator('#teamMoreSheet').waitFor({state:'visible'});
    await expectEnglish(page,'phone team more sheet');
    await page.screenshot({path:path.join(SHOTS,'i18n-phone-team-more.png')});
    await page.locator('#teamMoreSheet [data-tb-app="board"]').click();
    await page.waitForFunction(()=>document.body.dataset.psApp==='board'&&!document.body.classList.contains('ps-team-open'));
    await expectEnglish(page,'phone board');
    await noOverflow(page,'phone board');
    await page.screenshot({path:path.join(SHOTS,'i18n-phone-board.png')});
    await page.locator('#appSeg #psTrainBtn').click();
    await page.waitForFunction(()=>document.body.dataset.psApp==='design');
    await expectEnglish(page,'phone vault');
    await page.screenshot({path:path.join(SHOTS,'i18n-phone-vault.png')});
    await page.locator('#appSeg #psMoreBtn').click();
    await page.locator('#appMoreSheet').waitFor({state:'visible'});
    await expectEnglish(page,'phone more sheet');
    await page.screenshot({path:path.join(SHOTS,'i18n-phone-more.png')});
    await page.locator('#appMoreSheet [data-am="settings"]').click();
    await page.locator('#gearPop').waitFor({state:'visible'});
    await expectEnglish(page,'phone settings');
    await page.screenshot({path:path.join(SHOTS,'i18n-phone-settings.png')});
    await settingsTabs(page,'phone');
    assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'no runtime errors (phone en)');
    await phone.context.close();
  }

  /* 4) 로그인 전 첫 화면(자료 잠금 · 로그인 창)도 영어 */
  {
    const guest=await openApp(fx,'desktop',{browsers,guest:true,init:seedLang('en')});
    const {page}=guest;
    await page.evaluate(()=>PSI18n.ready);
    await expectEnglish(page,'guest board');
    await page.locator('#appSeg [data-team-hub]').click();
    await page.waitForTimeout(900);
    await expectEnglish(page,'guest team (login required)');
    await page.screenshot({path:path.join(SHOTS,'i18n-guest-team.png')});
    await page.evaluate(()=>{const b=document.querySelector('#psAcctWrap .acct-btn,#psAcctBtn');if(b)b.click();});
    await page.waitForTimeout(500);
    await expectEnglish(page,'guest account pop-up');
    await page.screenshot({path:path.join(SHOTS,'i18n-guest-login.png')});
    await guest.context.close();
  }
  fs.writeFileSync(path.join(OUT,'i18n-english-shell.json'),JSON.stringify({engine,passed:true,results},null,2));
  console.log(JSON.stringify({engine,passed:true,checks:results.length}));
}catch(error){
  fs.writeFileSync(path.join(OUT,'i18n-english-shell.json'),JSON.stringify({engine,passed:false,results,error:String(error&&error.message||error).slice(0,4000)},null,2));
  throw error;
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
