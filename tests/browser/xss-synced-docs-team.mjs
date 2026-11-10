import assert from 'node:assert/strict';
import {startFixture,openApp,WT,A} from '../fixtures/team-app.mjs';
import {collector,POLY,NICE} from '../fixtures/xss-probe.mjs';
import * as S from '../fixtures/xss-seeds.mjs';
/* 3.272 — 3.271 탐침(xss-synced-docs)이 남긴 자리: 명단(scout_tool_v1 · sq:*) · 경기(cs_team_matches_v1) · 게임모델 · 용어 · 공지 · 팀원 이름 ·
   코치 → 선수(cs_idp_pub_v1_<uid> · cs_team_attrs_v1) 문서의 모든 글 칸에 나쁜 값을 넣고(tests/fixtures/xss-seeds.mjs),
   코치로 한 번 · 선수로 한 번 그 문서를 그리는 화면을 연다. 어떤 창에서도 스크립트가 돌지 않고, 끼어든 요소 · 처리기가 없어야 한다.
   PS_XSS_ROLE=coach|player 로 한쪽만, PS_XSS_CRAWL=1 이면 화면마다 보이는 단추를 하나씩 눌러 본다(새 구멍 찾기 — CI 는 정해진 길만).
   합성 팀 · 합성 계정 · 루프백 서버만 쓴다. */
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const ROLE=process.env.PS_XSS_ROLE||'both',CRAWL=!!process.env.PS_XSS_CRAWL,STRICT=!process.env.PS_XSS_COLLECT;
const D=S.dates();
const put=(fx,k,v,by=S.B)=>fx.db.set(WT+'|'+k,{workspace_id:WT,k,v:JSON.stringify(v),cupd:2000,updated_by:by});
const get=(fx,k)=>JSON.parse(fx.db.get(WT+'|'+k).v);

function seed(fx,role){
  const base=get(fx,'scout_tool_v1'),roster=S.roster(base),ids=base.players.map(p=>p.id);
  put(fx,'scout_tool_v1',roster);
  for(const p of roster.players)put(fx,'sq:'+p.id,p);
  put(fx,'cs_team_matches_v1',S.matches(D,ids));
  put(fx,'cs_gamemodel_v1',S.gamemodel());put(fx,'cs_terms_v1',S.terms());
  put(fx,'cs_team_notice_v1',S.notice());put(fx,'cs_team_attrs_v1',S.teamAttrs(roster));
  for(const [k,v] of Object.entries(S.teamBits()))put(fx,k,v);
  put(fx,'process_coach_v1',S.scheduleDay(get(fx,'process_coach_v1'),D.dayIndex));
  const perms={members:{[A]:role==='player'?{role:'player',playerId:'vp01'}:{role:'executive'},[S.B]:{role:'player',playerId:'vp02',name:POLY},[S.C]:{role:'staff',playerId:POLY,name:POLY,scopes:[POLY]},[POLY]:{role:POLY,playerId:POLY}},defaultRole:'player',staffEdit:POLY};
  put(fx,'cs_perms_v1',perms);
  /* 코치 → 선수: A 가 선수일 때 A 의 공개 문서 · 코치일 때는 선수 B 의 것(코치 화면도 같은 문서를 그린다) */
  put(fx,'cs_idp_pub_v1_'+A,S.idpPub(D));put(fx,'cs_idp_pub_v1_'+S.B,S.idpPub(D));
  const mine={v:1,profile:{name:'가상 선수 A',pos:'CM'},selfEval:{levels:{}},trainings:[],done:{},log:{[D.today]:{t:'team',w:60,rpe:5,try:1,memo:'가상 기록',next:'가상 다음'},[D.monday]:{t:'match',w:61,rpe:6,memo:'가상 기록'}},growth:{},matchSelf:{xm1:{good:'가상',better:'가상',score:3,at:1}}};
  put(fx,'cs_idp_v1_'+A,mine,A);put(fx,'cs_idp_v1_'+S.B,{...mine,profile:{name:'가상 선수 B',pos:'CM'}});
}

const SKIP=/로그아웃|log ?out|삭제|지우|탈퇴|팀 나가기|초기화|비우기|reset|delete|remove|내보내기|내려받기|다운로드|인쇄|print|공유|업데이트|새로고침/i;
async function frameOf(page,id){const h=await page.$('#'+id);return h?h.contentFrame():null;}
async function settle(page,ms=450){await page.waitForTimeout(ms);}
async function closeAll(page){
  await page.keyboard.press('Escape').catch(()=>{});
  for(const f of page.frames())await f.evaluate(()=>{
    for(const fn of ['closeSheet','closeModal','psFormClose','closeDialog'])try{if(typeof window[fn]==='function')window[fn]();}catch(_){}
    for(const b of document.querySelectorAll('[data-close],.sheet-x,.modal-x,.pw-close,[aria-label="닫기"],.dlg-x,.psf-x,.sheet-close'))try{if(b.offsetParent)b.click();}catch(_){}
  }).catch(()=>{});
}
/* 보이는 틀 하나에서 누를 수 있는 것을 하나씩 눌러 본다(깊이 2). 찾기용 — 차례 · 개수는 화면에 따라 달라진다 */
async function crawl(page,frame,label,C,{max=140,depth=2,reopen=null}={}){
  const list=f=>f.evaluate(skip=>{
    const re=new RegExp(skip,'i'),seen=new Set(),out=[];
    for(const e of document.querySelectorAll('button,[onclick],[role="button"],[role="tab"],summary,[data-pid],[data-id],select,a:not([href]),label[for],.chip,.card,[tabindex="0"]')){
      if(!e.offsetParent||e.disabled)continue;const t=(e.innerText||e.value||e.getAttribute('aria-label')||e.title||'').replace(/\s+/g,' ').trim().slice(0,24);
      if(re.test(t)||re.test(e.id||'')||re.test(e.getAttribute('onclick')||''))continue;
      const sig=e.tagName+'|'+(e.id||'')+'|'+(typeof e.className==='string'?e.className:'')+'|'+t+'|'+[...e.attributes].filter(a=>/^data-/.test(a.name)).map(a=>a.name+'='+a.value.slice(0,20)).join(',');
      if(seen.has(sig))continue;seen.add(sig);out.push(sig);
    }
    return out;},SKIP.source).catch(()=>[]);
  const press=(f,sig)=>f.evaluate(({sig,skip})=>{
    for(const e of document.querySelectorAll('button,[onclick],[role="button"],[role="tab"],summary,[data-pid],[data-id],select,a:not([href]),label[for],.chip,.card,[tabindex="0"]')){
      if(!e.offsetParent||e.disabled)continue;const t=(e.innerText||e.value||e.getAttribute('aria-label')||e.title||'').replace(/\s+/g,' ').trim().slice(0,24);
      const s=e.tagName+'|'+(e.id||'')+'|'+(typeof e.className==='string'?e.className:'')+'|'+t+'|'+[...e.attributes].filter(a=>/^data-/.test(a.name)).map(a=>a.name+'='+a.value.slice(0,20)).join(',');
      if(s!==sig)continue;
      if(e.tagName==='SELECT'){if(e.options.length>1){e.selectedIndex=(e.selectedIndex+1)%e.options.length;e.dispatchEvent(new Event('change',{bubbles:true}));}return true;}
      e.click();return true;
    }return false;},{sig}).catch(()=>false);
  const done=new Set();let n=0;
  const walk=async(level,baseSet)=>{
    const now=await list(frame);
    for(const sig of now){
      if(n>=max)return;if(done.has(sig)||(baseSet&&baseSet.has(sig)))continue;done.add(sig);n++;
      if(!await press(frame,sig))continue;
      await settle(page,380);await C.check(label+' › '+sig.split('|').slice(0,4).join('|').slice(0,90));
      if(level<depth)await walk(level+1,new Set(now));
      await closeAll(page);await settle(page,120);
      if(reopen&&!(await list(frame)).length){await reopen();await settle(page,900);}
    }
  };
  await walk(1,null);
  return n;
}

async function openTeam(page,key){
  const sel='#teamNav [data-team-key="'+key+'"]';
  if(!await page.locator(sel+':visible').first().isVisible().catch(()=>false))await page.locator('#appSeg [data-team-hub]:visible').first().click().catch(()=>{});
  const ok=await page.evaluate(sel=>{const b=[...document.querySelectorAll(sel)].find(b=>b.offsetParent);if(!b)return false;b.click();return true;},sel);
  await settle(page,1600);return ok;
}
const visibleFrame=async page=>{const id=await page.evaluate(()=>{const f=[...document.querySelectorAll('iframe')].find(f=>{const r=f.getBoundingClientRect();return r.width>50&&r.height>50&&getComputedStyle(f).display!=='none'&&getComputedStyle(f).visibility!=='hidden';});return f?f.id:null;});return id?{id,frame:await frameOf(page,id)}:null;};

async function run(role){
  const fx=await startFixture(role==='player'?{teamRole:'member',members:S.members(A),teamName:POLY}:{members:S.members(A),teamName:POLY}),browsers={};
  seed(fx,role);
  let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
  const visited=[],shown={},calls=[];let crawled=0;
  try{
    const {page,logs}=await openApp(fx,'desktop',{browsers});
    const C=collector(page,{strict:STRICT,log:r=>console.error('[hole]['+role+'] '+r)});
    await settle(page,1500);await C.check(role+' shell');
    const screen=async(label,reopen)=>{
      visited.push(label);await C.check(role+' '+label);
      /* 나쁜 값이 글자로 보인 횟수 — 0 이면 그 화면이 씨앗을 그리지 않은 것이다(탐침이 헛돌지 않게 끝에서 센다) */
      let n=0;for(const f of page.frames())n+=await f.evaluate(()=>((document.body&&document.body.innerText||'').match(/xss-probe/g)||[]).length+document.querySelectorAll('input,textarea').length*0+[...document.querySelectorAll('input,textarea')].filter(e=>/xss-probe/.test(e.value||'')).length).catch(()=>0);
      shown[label]=n;
      if(CRAWL){const v=await visibleFrame(page);if(v&&v.frame)crawled+=await crawl(page,v.frame,role+' '+label,C,{reopen});}
    };

    step(role+'-idp');
    await page.evaluate(()=>{const b=document.querySelector('#appSeg button[data-scope="global"][data-app="idp"]');if(b)b.click();});
    const idpH=await page.waitForSelector('#fIdp',{timeout:30000}).catch(()=>null);
    if(idpH){
      const idp=await idpH.contentFrame();
      await idp.waitForFunction(()=>document.body&&document.body.innerText.length>40,null,{timeout:30000}).catch(()=>{});
      await settle(page,2500);await C.check(role+' idp');visited.push('idp');
      const click=async(sel,wait=600)=>{const hit=await idp.evaluate(sel=>{const b=[...document.querySelectorAll(sel)].find(b=>b.offsetParent);if(!b)return false;b.click();return true;},sel).catch(()=>false);if(hit)await settle(page,wait);return hit;};
      if(role==='player'){
        /* 선수의 제 화면 — 층마다(홈 · 프로필 · 경기 · 대화 · 목표 · 루틴 · 리포트 · 달력) 코치가 보낸 글을 그린다 */
        await idp.waitForFunction(()=>[...document.querySelectorAll('#layers [data-l]')].filter(b=>b.offsetParent).length>=4,null,{timeout:30000});
        const layers=await idp.evaluate(()=>[...document.querySelectorAll('#layers [data-l]')].filter(b=>b.offsetParent).map(b=>b.dataset.l));
        for(const l of layers){
          await click('#layers [data-l="'+l+'"]',700);await screen('idp layer '+l,()=>click('#layers [data-l="'+l+'"]',700));
          if(l==='cal')for(const v of ['year','month','week','day','qa']){await click('button[data-v="'+v+'"]',500);await C.check('player calendar '+v);}
        }
      }else{
        await click('[data-sqw="1"]');await C.check('coach this week');
        for(const pid of ['vp01','vp02']){await click('[data-wg-player="'+pid+'"]');await C.check('coach weekly growth '+pid);}
        await click('.sq-scope [data-sqe-mode="story"]',900);
        for(const pid of ['vp01','vp02']){
          if(!await click('[data-sqe-p="'+pid+'"]',900))continue;
          const modes=await idp.evaluate(()=>[...document.querySelectorAll('.sqe-modes [data-sqe-mode]')].map(b=>b.dataset.sqeMode));
          for(const m of modes){await click('.sqe-modes [data-sqe-mode="'+m+'"]',600);await screen('coach idp player '+pid+' · '+m);}
        }
        await click('.sq-scope [data-sqe-mode="today"]',900);
        if(await click('[data-sqd-doc="cs_idp_v1_'+S.B+'"]',1200)){
          const layers=await idp.evaluate(()=>[...document.querySelectorAll('#layers [data-l]')].filter(b=>b.offsetParent).map(b=>b.dataset.l));
          for(const l of layers){await click('#layers [data-l="'+l+'"]',600);await screen('coach in player B · layer '+l);}
        }
      }
    }

    step(role+'-team');
    const keys=await page.evaluate(()=>[...document.querySelectorAll('#teamNav [data-team-key]')].map(b=>b.dataset.teamKey));
    for(const k of [...new Set(keys)]){
      step(role+'-team-'+k);
      if(!await openTeam(page,k))continue;
      await screen('team '+k,()=>openTeam(page,k));
      const v=await visibleFrame(page),f=v&&v.frame;if(!f)continue;
      const call=async(code,wait=450)=>{const r=await f.evaluate(c=>{try{(0,eval)(c);return 'ok';}catch(e){return String(e&&e.message||e).slice(0,90);}},code).catch(e=>String(e).slice(0,60));calls.push(k+': '+code.slice(0,40)+' → '+r);await settle(page,wait);await C.check(role+' team '+k+' › '+code.slice(0,60));};
      if(k==='training'&&role==='coach'){
        /* 일정의 시트들 — 게임모델 국면 · 일정 사전 · 조 이름 · 틀을 다시 그린다(값은 고치지 않는다) */
        const DI=String(D.dayIndex);
        for(const c of ['openDayHub(wk,DI)','openMatch(DI)','openSession(DI,0)',"wksFill(DI,'S-xss')","wksPickSes(DI,'S-xss','topic')","wksTopicSheet(DI,'S-xss')","wkbdPick(DI,'sched')","wkbdPick(DI,'theme')","wkbdPick(DI,'meet',0)","wkbdPick(DI,'warm',0)","wkbdPick(DI,'train',0)","sesGrp(DI,'S-xss')",'boardTeamSetup()','renderTemplateSheet()','openMonthPop(wk,DI,document.body)']){
          await call(c.replace(/DI/g,DI));await f.evaluate(()=>{try{closeSheet();}catch(_){}}).catch(()=>{});
        }
        for(const v of ['year','month','day','week']){await f.evaluate(v=>{const b=document.querySelector('#vtoggle [data-v="'+v+'"]');if(b)b.click();},v).catch(()=>{});await settle(page,600);await C.check('coach schedule view '+v);}
        for(const kind of ['week','day','month'])await f.evaluate(kind=>{try{const out=__buildPrintDoc(kind);if(typeof out==='string'){const fr=document.createElement('iframe');fr.className='xss-print-frame';fr.srcdoc=out;document.body.appendChild(fr);}}catch(_){}},kind).catch(()=>{});
        await settle(page,900);await C.check('coach schedule print documents');
        await f.evaluate(()=>document.querySelectorAll('.xss-print-frame').forEach(x=>x.remove())).catch(()=>{});
      }
      if(k==='players'&&role==='coach'){
        /* 선수단 — 명단 표 · 선수 상세 · 선수 추가 창 · 여러 명 추가 · 팀 기준(포지션 목표 표) */
        for(const sel of ['#tmAdd']){await f.evaluate(sel=>{const b=document.querySelector(sel);if(b)b.click();},sel).catch(()=>{});await settle(page,500);await C.check('coach players '+sel);await closeAll(page);}
        for(const c of ["renderCriteria&&renderCriteria()","window.PSPlayerBulk&&PSPlayerBulk.open&&PSPlayerBulk.open('team')","typeof openProfile==='function'&&openProfile('vp01')","typeof openProfile==='function'&&openProfile('vp02')","typeof printStandalone==='function'&&0"]){await call(c);await closeAll(page);}
      }
    }

    step(role+'-apps');
    /* 셸의 다른 앱(보관함 · 커뮤니티 · 노트 · 학습 …)과 계정 · 팀 창 */
    const apps=await page.evaluate(()=>[...document.querySelectorAll('#appSeg button[data-app]')].filter(b=>b.offsetParent).map(b=>b.dataset.app));
    for(const a of [...new Set(apps)]){
      if(a==='idp')continue;
      await page.evaluate(a=>{const b=[...document.querySelectorAll('#appSeg button[data-app="'+a+'"]')].find(b=>b.offsetParent);if(b)b.click();},a);
      await settle(page,1500);await screen('app '+a);
    }
    step(role+'-board-import');
    /* 작전판 «저장 팀 불러오기» · 선수단/스카우팅 불러오기 — 명단의 이름 · 번호 · 포지션 · 조 이름을 고르개로 그린다 */
    await page.evaluate(()=>{const b=[...document.querySelectorAll('#appSeg button[data-app="board"]')].find(b=>b.offsetParent);if(b)b.click();});await settle(page,1200);
    const board=await frameOf(page,'fBoard')||(await visibleFrame(page)||{}).frame;
    if(board)for(const code of ["openAnalysisTeamLibrary()","document.getElementById('loadSquadBtn')&&document.getElementById('loadSquadBtn').click()","window.PSBoardScoutImport&&PSBoardScoutImport.open&&PSBoardScoutImport.open('team')","window.PSBoardScoutImport&&PSBoardScoutImport.open&&PSBoardScoutImport.open('scout')"]){
      const r=await board.evaluate(async c=>{try{await (0,eval)(c);return 'ok';}catch(e){return String(e&&e.message||e).slice(0,80);}},code).catch(e=>String(e).slice(0,60));
      calls.push('board: '+code.slice(0,44)+' → '+r);await settle(page,900);await C.check(role+' board › '+code.slice(0,50));await closeAll(page);
    }

    step(role+'-account');
    /* 계정 메뉴의 팀 창들 — 팀원 이름 · 이메일(저마다 제 것을 적는다)과 팀 이름을 그린다 */
    for(const name of role==='coach'?['팀원 보기','권한 관리','변경 기록']:['팀원 보기']){
      await page.locator('#psAcctWrap .acct-btn').click().catch(()=>{});await settle(page,500);await C.check(role+' account menu');
      const b=page.locator('#psAcctWrap .acct-pop.on').getByRole('button',{name,exact:true});
      if(await b.isVisible().catch(()=>false)){await b.click();await settle(page,1500);visited.push('account '+name);await C.check(role+' account › '+name);
        if(CRAWL)crawled+=await crawl(page,page.mainFrame(),role+' account '+name,C,{max:30,depth:1});}
      await closeAll(page);await page.evaluate(()=>{document.querySelectorAll('.ps-modal,.psm-back,[data-psm]').forEach(n=>{const x=n.querySelector&&n.querySelector('button');});}).catch(()=>{});
      await page.keyboard.press('Escape').catch(()=>{});await page.mouse.click(5,400).catch(()=>{});await settle(page,300);
    }

    step(role+'-direct-pages');
    /* 셸 없이 바로 연 화면 — 같은 기기 사본을 저마다 다시 읽어 그린다 */
    for(const file of ['scout.html','scouting.html','idp.html','process.html','gamemodel.html','playbook.html','terms.html','note.html']){
      const tab=await page.context().newPage();
      await tab.goto(fx.base+'/studio/'+file,{waitUntil:'domcontentloaded'}).catch(()=>{});await tab.waitForTimeout(2500);
      visited.push('direct '+file);await C.check(role+' direct '+file);
      await tab.close().catch(()=>{});
    }

    const dialogs=logs.filter(l=>l.type==='dialog'&&/xss|__xss/.test(l.text));assert.deepEqual(dialogs,[],'no dialog');
    const pe=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
    if(process.env.PS_XSS_COLLECT)for(const e of pe.slice(0,40))console.error('[pageerror]['+role+'] '+e.step+' '+e.text.slice(0,200)+' '+String(e.stack||'').split('\n').slice(1,3).join(' | ').slice(0,200));
    if(process.env.PS_XSS_COLLECT)console.error('[stats]['+role+'] '+JSON.stringify({shown,crawled,calls}));
    return {role,visited,shown,crawled,holes:C.all,pageErrors:pe.length};
  }catch(e){console.error('[xss-synced-docs-team] role='+role+' step='+cur);throw e;}
  finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
}

const out=[];
for(const role of ['coach','player'])if(ROLE==='both'||ROLE===role)out.push(await run(role));
const holes=out.flatMap(r=>r.holes);
assert.deepEqual(holes,[],'injected element or handler:\n'+holes.join('\n'));
for(const r of out)assert.ok(r.visited.length>=6,r.role+' screens: '+r.visited);
console.log(JSON.stringify({engine,test:'xss-synced-docs-team',ok:true,runs:out.map(r=>({role:r.role,shown:r.shown,crawled:r.crawled}))}));
