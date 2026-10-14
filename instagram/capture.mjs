// 인스타 게시물에 넣을 앱 화면을 가상 자료로 찍는다. 실제 팀·선수 자료는 쓰지 않는다(이름은 등번호 · 가상 이름뿐).
// 쓰는 법: node instagram/capture.mjs <장면 이름…> --out <폴더>   (장면 이름을 빼면 전부)
// 보드는 studio/board.html 을 로그인 없는 개인 공간 흉내(PSSync stub)로 연다 — tests/browser/board-depth.mjs 와 같은 방식.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='https://capture.process-studio.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'};

// 장면 = 보드에 올릴 판 + 보기. pitch: ''(네이비) · grass(실사 잔디) · white · train · calm.
const SCENES={
  'board-flat':{title:'작전판 · 평면(잔디)',tilt:false,pitch:'grass'},
  'board-flat-navy':{title:'작전판 · 평면(네이비)',tilt:false,pitch:''},
  'board-flat-white':{title:'작전판 · 평면(화이트)',tilt:false,pitch:'white'},
  'board-3d':{title:'작전판 · 3D 경기장',tilt:true,cam:'mid',ad:''},
  'board-3d-low':{title:'작전판 · 3D 낮은 카메라',tilt:true,cam:'low',ad:''},
  'board-3d-high':{title:'작전판 · 3D 높은 카메라',tilt:true,cam:'high',ad:''},
  'board-3d-team':{title:'작전판 · 3D 광고판에 팀 이름',tilt:true,cam:'mid',ad:'우리 FC'}
};
export const SCENE_NAMES=Object.keys(SCENES);

// 클라우드 세션에는 Playwright 판과 다른 Chromium 이 /opt/pw-browsers/chromium 에 깔려 있다 — 있으면 그것을 쓴다.
export function launchChromium(){
  const pre='/opt/pw-browsers/chromium',exe=process.env.PS_CHROME_PATH||(fs.existsSync(pre)?pre:undefined);
  return pw.chromium.launch({headless:true,...(exe?{executablePath:exe}:{})});
}

export async function openBoard(browser,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:2,serviceWorkers:'block',locale:'ko-KR',timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
    const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});
    return route.fulfill({body:fs.readFileSync(file),contentType:MIME[path.extname(file)]||'application/octet-stream'});
  });
  await context.addInitScript(({UID,WID})=>{
    localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'capture',rt:'capture'}));
    localStorage.setItem('ps_active_ws',WID);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:WID}));
    localStorage.setItem('ps_ws_list',JSON.stringify([{id:WID,kind:'personal',role:'owner',owner_id:UID}]));
    localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[UID]:{role:'executive'}},defaultRole:'player'}));
    window.PSSync={session:()=>({uid:UID}),activeWs:()=>WID,activeWsObj:()=>({id:WID,kind:'personal',role:'owner',owner_id:UID}),dataUnlocked:()=>true,keyReady:()=>true,act(){},ping(){},event(){}};
  },{UID,WID});
  const page=await context.newPage();
  await page.goto(base+'/studio/board.html?capture=instagram');
  await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone,null,{timeout:60000});
  return {context,page};
}

// 화면 위 도구줄·안내·«포메이션으로 시작» 버튼은 게시물에 필요 없다 — 숨기고 판 크기를 다시 맞춘다.
const HIDE_CHROME='#ps-command-dock,#hint,#ehDoor,.eh-door,#libDock{display:none!important}';

async function setScene(page,scene){
  await page.addStyleTag({content:HIDE_CHROME});
  await page.evaluate(sel=>document.querySelectorAll(sel).forEach(el=>el.style.setProperty('display','none','important')),HIDE_CHROME.split('{')[0]);
  await page.evaluate(scene=>{
    try{window.toast=function(){};}catch(_){}   // 3D 켜고 끌 때 뜨는 안내 말풍선이 사진에 남지 않게
    boardShowDefault();
    window.__setTilt(false);
    document.documentElement.dataset.pitch=scene.pitch||'';
    const s=captureSnap();s.drawings=[];s.equipment=[];s.players=[];s.gridType='off';loadSnap(s);
    state.gridType='off';buildPitch();
    applyFormationTo('blue','433');applyFormationTo('red','442');
    // 공을 우리 팀 6번 앞에, 패스·움직임 화살표 셋 — 판이 비어 보이지 않게.
    const by=(team,num)=>state.players.find(p=>p.team===team&&+p.num===num);
    const dm=by('blue',6),lw=by('blue',7),cf=by('blue',9),lb=by('blue',3);
    if(dm){state.ball={x:dm.x+18,y:dm.y};}
    const D=(type,a,b,dx,dy)=>a&&b&&state.drawings.push({type,color:'#ffd24a',pts:[{x:a.x+14,y:a.y},{x:b.x+(dx||0),y:b.y+(dy||0)}]});
    D('pass',dm,lb,6,0);
    if(lb&&lw)state.drawings.push({type:'run',color:'#ffd24a',pts:[{x:lb.x+10,y:lb.y},{x:lw.x+60,y:lb.y-6}]});
    if(cf)state.drawings.push({type:'run',color:'#ffd24a',pts:[{x:cf.x+10,y:cf.y},{x:cf.x+110,y:cf.y-40}]});
    sel=null;multiSel=[];
    resetTokenSize();scaleAll(1.15);scaleAll(1.15);
    window.dispatchEvent(new Event('resize'));
    renderTokens();renderDrawings();
    if(scene.tilt){window.__setTilt(true);window.__setTilt3dOpt('cam',scene.cam||'mid');window.__setTilt3dOpt('deco','full');window.__setTilt3dOpt('ad',scene.ad||'');window.__tiltFit();}
    state.tool='move';
  },scene);
  await page.waitForTimeout(1200);
  await page.evaluate(async()=>{const im=document.querySelector('#tiltSurface img.tilt-stadium');if(im)try{await im.decode();}catch(_){}
    const h=document.getElementById('hint');if(h){h.textContent='';h.style.setProperty('display','none','important');}
    document.querySelectorAll('[class*="toast"],[id*="toast"],[id*="Toast"]').forEach(el=>el.style.setProperty('display','none','important'));});
}

export async function capture(names=SCENE_NAMES,outDir){
  fs.mkdirSync(outDir,{recursive:true});
  const browser=await launchChromium();
  const made=[];
  try{
    const {context,page}=await openBoard(browser,{width:1280,height:860});
    for(const name of names){
      const scene=SCENES[name];if(!scene)throw Error('모르는 장면: '+name+' (가능: '+SCENE_NAMES.join(', ')+')');
      await setScene(page,scene);
      const file=path.join(outDir,name+'.png');
      const stage=await page.$('#boardStage');
      await (stage||page).screenshot({path:file});
      made.push(file);console.log('찍음 '+path.relative(root,file));
    }
    await context.close();
  }finally{await browser.close();}
  return made;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),oi=args.indexOf('--out');
  const out=oi>=0?path.resolve(args[oi+1]):path.join(root,'instagram/out/shots');
  const names=args.filter((a,i)=>a!=='--out'&&i!==oi+1);
  capture(names.length?names:SCENE_NAMES,out).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
}
