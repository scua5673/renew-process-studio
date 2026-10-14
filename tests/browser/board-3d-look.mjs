import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
// 3.029 — 사용자 «3D 연출 — 시간대 · 분석 그래픽»(목업 ①). 11 대 11 을 놓고:
// ① 분석 그래픽 다섯(팀 형태 · 라인 간격 · 오프사이드 · 공간 점유 · 압박 거리)이 두 팀에 그려지고, 보드 스냅에 저장되며, 내보내기 SVG 에도 들어간다
// ② 3D 분위기 — 야간(기본 · 조명탑 네 방향 그림자) · 낮(짧은 그림자 하나 · 밝은 무대) · 해질녘(긴 그림자 하나) — 경기장 그림이 다시 그려지고 기기에 남는다
// ③ 팀 브랜딩 — 광고판 문구가 팀 이름이 되고, 직접 적은 문구가 있으면 그게 우선 ④ 세로 보기에서 분석 글자는 바로 선다
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/board-3d-look');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-3d-look-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
try{
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),errors=[];
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
    const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    return route.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream'});
  });
  await context.addInitScript(({UID,WID})=>{
    localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'fixture',rt:'fixture'}));
    localStorage.setItem('ps_active_ws',WID);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:WID}));
    localStorage.setItem('ps_ws_list',JSON.stringify([{id:WID,kind:'personal',role:'owner',owner_id:UID}]));
    localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[UID]:{role:'executive'}},defaultRole:'player'}));
    localStorage.setItem('cs_squad_v1',JSON.stringify({name:'프로세스 FC',players:[]}));
    window.PSSync={session:()=>({uid:UID}),activeWs:()=>WID,activeWsObj:()=>({id:WID,kind:'personal',role:'owner',owner_id:UID}),dataUnlocked:()=>true,keyReady:()=>true,act(){},ping(){},event(){}};
  },{UID,WID});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/studio/board.html?fixture=3dlook');
  await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);
  await page.evaluate(()=>{
    boardShowDefault();const s=captureSnap();
    const H=[[1,'GK',80,370],[2,'RB',260,160],[4,'RCB',240,300],[5,'LCB',240,440],[3,'LB',260,580],[6,'DM',400,370],[8,'RCM',470,250],[10,'LCM',470,490],[7,'RW',620,140],[9,'ST',650,370],[11,'LW',620,600]];
    const A=[[1,'GK',1030,370],[2,'RB',850,580],[4,'RCB',870,440],[5,'LCB',870,300],[3,'LB',850,160],[6,'DM',720,370],[8,'RCM',640,490],[10,'LCM',640,250],[7,'RW',500,600],[9,'ST',470,370],[11,'LW',500,140]];
    s.players=H.map(p=>({id:'h'+p[0],team:'blue',num:p[0],pos:p[1],name:'',x:p[2],y:p[3]})).concat(A.map(p=>({id:'a'+p[0],team:'red',num:p[0],pos:p[1],name:'',x:p[2],y:p[3]})));
    s.equipment=[];s.drawings=[];s.ball={x:560,y:300};loadSnap(s);
    window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
    window.__stadium=()=>{const img=document.querySelector('#tiltSurface .tilt-stadium');let svg='';try{svg=decodeURIComponent((img&&img.src||'').split(',')[1]||'');}catch(_){}return {sig:(img||{}).__sig||'',svg};};
  });

  // ① 분석 그래픽 — 평면에서: 두 팀에 다섯 가지, 스냅에 저장, 내보내기에 포함, 끄면 사라진다, 선수를 옮기면 다시 계산
  const an=await page.evaluate(()=>{
    const before=document.querySelectorAll('#analysisLayer *').length;
    ['hull','gap','off','vor','press'].forEach(k=>window.__setAnalysis(k,true));
    const L=()=>document.getElementById('analysisLayer'),labels=()=>[...L().querySelectorAll('text')].map(t=>t.textContent);
    const r={before,teams:[...L().querySelectorAll('.an-team')].map(g=>g.getAttribute('data-team')),hulls:L().querySelectorAll('.an-hull').length,off:L().querySelectorAll('.an-off').length,press:L().querySelectorAll('.an-press').length,
      vor:L().querySelectorAll('.an-vor path').length,gapBars:L().querySelectorAll('.an-gapbar').length,labels:labels(),pressed:[...document.querySelectorAll('#analysisSeg button')].map(b=>b.getAttribute('aria-pressed')).join(''),
      snap:captureSnap().analysis,exported:/class="an-hull"/.test(boardImageXML().xml),order:(function(){const w=document.getElementById('world'),a=[...w.children].indexOf(L()),d=[...w.children].indexOf(document.getElementById('drawLayer')),l=[...w.children].indexOf(document.getElementById('lineLayer'));return {a,d,l};})()};
    const l0=labels().find(t=>/오프사이드/.test(t)),x0=+L().querySelector('.an-off').getAttribute('x1');
    state.players.find(p=>p.id==='h4').x=150;renderTokens();r.offMoved=+L().querySelector('.an-off').getAttribute('x1')===150&&x0!==150;   /* 골키퍼 다음으로 깊은 선수가 바뀌면 선도 따라온다 */
    window.__setAnalysis('vor',false);r.vorOff=L().querySelectorAll('.an-vor').length;r.snap2=captureSnap().analysis;
    ['hull','gap','off','press'].forEach(k=>window.__setAnalysis(k,false));r.empty=L().childNodes.length;r.snap3=captureSnap().analysis;
    loadSnap(Object.assign(captureSnap(),{analysis:{hull:true,off:true}}));r.restored=L().querySelectorAll('.an-hull').length+L().querySelectorAll('.an-off').length;r.restoredPressed=[...document.querySelectorAll('#analysisSeg button')].map(b=>b.getAttribute('aria-pressed')).join('');
    return r;
  });
  assert.equal(an.before,0,'off by default');
  assert.deepEqual(an.teams,['blue','red'],'ours first, then the other team');
  assert.equal(an.hulls,2);assert.equal(an.off,2);assert.equal(an.press,2);assert.equal(an.vor,22,'a cell per player');assert.equal(an.gapBars,4,'two gaps per team');
  assert.equal(an.labels.filter(t=>/^폭 \d+(\.\d)?m · 길이 \d+(\.\d)?m$/.test(t)).length,2,'shape labels '+JSON.stringify(an.labels));
  assert.equal(an.labels.filter(t=>t==='오프사이드 라인').length,2);assert.equal(an.labels.filter(t=>/^\d+(\.\d)?m$/.test(t)).length,6,'4 gap + 2 press distances');
  assert.equal(an.pressed,'truetruetruetruetrue','the settings chips show every toggle on');
  assert.deepEqual(an.snap,{hull:true,gap:true,off:true,vor:true,press:true},'saved with the board');
  assert.ok(an.exported,'in the exported picture');assert.ok(an.order.l<an.order.a&&an.order.a<an.order.d,'above the lines, below the drawings '+JSON.stringify(an.order));
  assert.ok(an.offMoved,'moving a defender moves the offside line');
  assert.equal(an.vorOff,0);assert.deepEqual(an.snap2,{hull:true,gap:true,off:true,press:true});
  assert.equal(an.empty,0,'all off → nothing drawn');assert.equal(an.snap3,null,'and nothing saved');
  assert.equal(an.restored,4,'a snapshot restores its toggles');assert.equal(an.restoredPressed,'truefalsetruefalsefalse');

  // ② 3D 분위기 — 야간이 기본(지금 모습), 낮·해질녘으로 바꾸면 경기장 그림 · 무대 · 칩 그림자가 바뀌고 기기에 남는다
  const night=await page.evaluate(async()=>{
    __setTilt(true);__tiltFit();await __sleep(800);const st=__stadium();
    return {mood:document.body.getAttribute('data-tilt-mood'),sig:st.sig,cone:st.svg.includes('psStCone')&&/clip-path="url\(#psStPitchClip\)"/.test(st.svg),shadows:document.querySelectorAll('#tokenLayer .ps-chip-shadow').length,chips:document.querySelectorAll('#tokenLayer .ps-chip').length,
      moodLayer:(function(){const m=document.getElementById('tiltMood');return m?getComputedStyle(m).display:'';})(),stored:JSON.parse(localStorage.getItem('ps_tilt3d_opts_v1')||'{}').mood,pressed:[...document.querySelectorAll('#tiltMoodSeg button')].map(b=>b.getAttribute('aria-pressed')).join('')};
  });
  assert.equal(night.mood,'night','today\'s look is the default');assert.match(night.sig,/\|night\|0\|$/);assert.ok(night.cone,'floodlight cones on the grass');
  assert.equal(night.chips,22);assert.equal(night.shadows,88,'four shadows per chip under the masts');assert.equal(night.moodLayer,'block');assert.equal(night.stored,undefined,'nothing stored until chosen');
  assert.equal(night.pressed,'falsefalsetrue');
  const day=await page.evaluate(async()=>{
    document.querySelector('#tiltMoodSeg [data-mood="day"]').click();await __sleep(800);const st=__stadium();
    return {mood:document.body.getAttribute('data-tilt-mood'),sig:st.sig,cone:st.svg.includes('psStCone')&&/clip-path="url\(#psStPitchClip\)"/.test(st.svg),lampDim:/fill="url\(#psStLamp\)" fill-opacity="0?\.2"/.test(st.svg),shadows:document.querySelectorAll('#tokenLayer .ps-chip-shadow').length,
      bg:getComputedStyle(document.getElementById('boardStage')).backgroundColor,stored:JSON.parse(localStorage.getItem('ps_tilt3d_opts_v1')||'{}').mood,pressed:[...document.querySelectorAll('#tiltMoodSeg button')].map(b=>b.getAttribute('aria-pressed')).join('')};
  });
  assert.equal(day.mood,'day');assert.match(day.sig,/\|day\|0\|$/,'the stadium is redrawn');assert.equal(day.cone,false,'no floodlights by day');assert.ok(day.lampDim,'roof lamps off');
  assert.equal(day.shadows,22,'one short shadow per chip');assert.equal(day.bg,'rgb(60, 71, 83)','a lighter stage');assert.equal(day.stored,'day','remembered on this device');assert.equal(day.pressed,'truefalsefalse');
  const dusk=await page.evaluate(async()=>{
    window.__setTilt3dOpt('mood','dusk');await __sleep(800);const st=__stadium();
    return {sig:st.sig,warm:/fill="#ff9a3c" fill-opacity="0?\.12"/.test(st.svg),shadows:document.querySelectorAll('#tokenLayer .ps-chip-shadow').length,long:!!document.querySelector('#tokenLayer .ps-chip-shadow[transform="rotate(12)"]'),bg:getComputedStyle(document.getElementById('boardStage')).backgroundColor};
  });
  assert.match(dusk.sig,/\|dusk\|0\|$/);assert.ok(dusk.warm,'a sunset wash');assert.equal(dusk.shadows,22);assert.ok(dusk.long,'one long shadow');assert.equal(dusk.bg,'rgb(36, 28, 39)');

  // ③ 팀 브랜딩 — 광고판 = 팀 이름 · 관중은 팀 색 · 직접 적은 문구가 우선 · 끄면 PROCESS STUDIO
  const brand=await page.evaluate(async()=>{
    window.__setTilt3dOpt('mood','night');document.querySelector('#tiltBrandSeg [data-brand="1"]').click();await __sleep(800);let st=__stadium();
    const r={team:window.__tiltTeamName(),sig:st.sig,ads:(st.svg.match(/프로세스 FC/g)||[]).length,noDefault:!/PROCESS STUDIO/.test(st.svg),stored:JSON.parse(localStorage.getItem('ps_tilt3d_opts_v1')||'{}').brand,pressed:[...document.querySelectorAll('#tiltBrandSeg button')].map(b=>b.getAttribute('aria-pressed')).join('')};
    window.__setTilt3dOpt('ad','HELLO FC');await __sleep(800);st=__stadium();r.custom=(st.svg.match(/HELLO FC/g)||[]).length;r.customNoTeam=!/프로세스 FC/.test(st.svg);
    window.__setTilt3dOpt('ad','');window.__setTilt3dOpt('brand','0');await __sleep(800);st=__stadium();r.off=(st.svg.match(/PROCESS STUDIO/g)||[]).length;r.offSig=st.sig;
    return r;
  });
  assert.equal(brand.team,'프로세스 FC');assert.match(brand.sig,/\|프로세스 FC\|night\|1\|#1a2f5c$/,'the picture carries the name and the team colour');
  assert.ok(brand.ads>=20&&brand.noDefault,'every ad panel reads the team name '+brand.ads);assert.equal(brand.stored,true);assert.equal(brand.pressed,'falsetrue');
  assert.ok(brand.custom>=20&&brand.customNoTeam,'a custom ad text wins over the team name');
  assert.ok(brand.off>=20,'off → PROCESS STUDIO again');assert.match(brand.offSig,/\|PROCESS STUDIO\|night\|0\|$/);

  // ④ 세로 보기 — 분석 글자가 바로 선다(세트피스 글자와 같은 회전)
  const vert=await page.evaluate(async()=>{
    __setTilt(false);window.__setAnalysis('off',true);state.orientation='v';applyView();renderTokens();await __sleep(300);
    const t=[...document.querySelectorAll('#analysisLayer text')];const r={n:t.length,rot:t.every(x=>/rotate\((-?90) /.test(x.getAttribute('transform')||''))};
    state.orientation='h';applyView();renderTokens();r.back=[...document.querySelectorAll('#analysisLayer text')].every(x=>!x.getAttribute('transform'));return r;
  });
  assert.ok(vert.n>0&&vert.rot,'labels turn with the board '+JSON.stringify(vert));assert.ok(vert.back);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,test:'board-3d-look',passed:true}));
  await context.close();
}finally{await browser.close();}
