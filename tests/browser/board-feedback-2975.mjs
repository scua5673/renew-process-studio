import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.975 — 작전판 피드백 20건. 합성 팀 fixture 에서만 돈다(실계정·서버 없음).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof anim==='object'&&window.__psShortcutFor&&document.getElementById('animAdd'));
  await page.waitForTimeout(1200);
  const box=await (await page.$('#fBoard')).boundingBox();
  const U=async(x,y)=>{const c=await f.evaluate(([x,y])=>{const s=document.getElementById('board'),m=document.getElementById('world').getScreenCTM(),p=s.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(m);return {x:q.x,y:q.y};},[x,y]);return {x:box.x+c.x,y:box.y+c.y};};
  const reset=()=>f.evaluate(()=>{try{stopAnim();}catch(_){}state.players=[];state.equipment=[];state.drawings=[];anim.frames=[];animActive=-1;sel=null;multiSel=[];renderTokens();renderDrawings();renderAnimFrames();updateDelUI();});
  const panelShown=()=>f.evaluate(()=>{const p=document.querySelector('.sel-ctl');return !!p&&getComputedStyle(p).display!=='none';});
  const isTouch=size!=='desktop';

  // 1) 왼쪽 클릭 = 고르기만, 오른쪽 클릭 = 정보 창 (마우스 기기)
  step('right-click');
  await reset();
  await f.evaluate(()=>{state.players=[{id:801,team:'blue',num:'7',pos:'RW',x:400,y:300},{id:802,team:'blue',num:'9',pos:'ST',x:250,y:620}];renderTokens();});
  if(!isTouch){
    let p=await U(400,300);
    await page.mouse.click(p.x,p.y);await page.waitForTimeout(250);
    assert.equal(await f.evaluate(()=>sel&&sel.ref&&sel.ref.id),801,'왼쪽 클릭으로 고른다');
    assert.equal(await panelShown(),false,'왼쪽 클릭만으로는 정보 창이 안 뜬다');
    await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(250);
    assert.equal(await panelShown(),true,'오른쪽 클릭이면 정보 창');
    assert.deepEqual(await f.evaluate(()=>({x:state.players[0].x,y:state.players[0].y})),{x:400,y:300},'오른쪽 클릭은 토큰을 끌지 않는다');
    const q=await U(250,620);
    await page.mouse.click(q.x,q.y);await page.waitForTimeout(250);
    assert.equal(await f.evaluate(()=>sel&&sel.ref&&sel.ref.id),802);
    assert.equal(await panelShown(),false,'다른 토큰을 왼쪽 클릭하면 창은 닫힌다');
    // 14) 이름은 치는 대로 판에
    step('name-live');
    await page.mouse.click(q.x,q.y,{button:'right'});await page.waitForTimeout(200);
    await f.click('#nameInput');await f.fill('#nameInput','');
    await page.keyboard.type('김민준',{delay:30});await page.waitForTimeout(160);
    assert.equal(await f.evaluate(()=>document.activeElement&&document.activeElement.id),'nameInput','아직 입력 중');
    const shown=await f.evaluate(()=>Array.from(document.querySelectorAll('#tokenLayer [data-id="802"] text')).map(t=>t.textContent).join('|'));
    assert.match(shown,/김민준/,'칸을 벗어나기 전에 판에 이름이 보인다 '+shown);
    await page.keyboard.press('Escape');
  } else {
    // 손가락(아이패드)은 오른쪽 클릭이 없으니 탭으로 연다
    const p=await U(400,300);
    await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(300);
    assert.equal(await f.evaluate(()=>sel&&sel.ref&&sel.ref.id),801,'탭으로 고른다');
    assert.equal(await panelShown(),true,'손가락 탭이면 정보 창이 열린다');
  }

  // 10) 이 토큰만 «이후 장면 리셋»
  step('token-reset');
  await reset();
  await f.evaluate(()=>{
    const P=(a,b)=>[{id:811,team:'blue',num:'7',x:a,y:300},{id:812,team:'blue',num:'9',x:b,y:450}];
    anim.frames=[{snap:Object.assign(captureSnap(),{players:P(200,200)}),dur:1},{snap:Object.assign(captureSnap(),{players:P(500,500)}),dur:1,curves:{811:{mx:9,my:9}}},{snap:Object.assign(captureSnap(),{players:P(800,800)}),dur:1}];
    animActive=0;loadSnap(anim.frames[0].snap);ensureAnimMode(false);renderAnimFrames();
    sel={type:'player',ref:state.players.find(p=>p.id===811)};window.__selPanelOpen(true);
  });
  await page.waitForTimeout(300);
  assert.notEqual(await f.evaluate(()=>{sel={type:'player',ref:state.players.find(p=>p.id===811)};window.__selPanelOpen(true);return getComputedStyle(document.getElementById('tokAnimResetBtn')).display;}),'none','정보 창에 «이후 장면 리셋»');
  await page.waitForTimeout(300);
  await f.evaluate(()=>{sel={type:'player',ref:state.players.find(p=>p.id===811)};window.__selPanelOpen(true);document.getElementById('tokAnimResetBtn').click();});
  const rs=await f.evaluate(()=>anim.frames.map(fr=>fr.snap.players.map(p=>p.id+':'+p.x).join(',')));
  assert.deepEqual(rs,['811:200,812:200','811:200,812:500','811:200,812:800'],'고른 토큰만 뒤 장면에 지금 자리로');
  assert.equal(await f.evaluate(()=>!!(anim.frames[1].curves&&anim.frames[1].curves[811])),false,'그 토큰 곡선만 지운다');
  await f.evaluate(()=>undoLast());
  assert.equal(await f.evaluate(()=>anim.frames[2].snap.players.find(p=>p.id===811).x),800,'⌘Z 로 되돌린다');

  // 11) 장면 줄 «열림» 표시가 없어도 장면 단축키가 막히지 않는다
  step('anim-bar-toast');
  await f.evaluate(()=>{document.getElementById('animBar').classList.remove('on');window.__toastLog=[];const t=window.toast;window.toast=function(m){window.__toastLog.push(m);return t.apply(this,arguments);};});
  await f.evaluate(()=>document.body.focus());
  const n0=await f.evaluate(()=>anim.frames.length);
  await f.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',bubbles:true})));
  await page.waitForTimeout(200);
  assert.equal(await f.evaluate(()=>anim.frames.length),n0+1,'N 이 장면을 더한다');
  assert.equal(await f.evaluate(()=>window.__toastLog.some(m=>/먼저 여세요/.test(m))),false,'«애니메이션 바를 먼저 여세요»가 뜨지 않는다');

  // 12·13) 장면 줄 «열림»이 꺼져도(부팅 상태) 그린 원은 그 장면에, 지운 선은 다시 안 나온다
  step('scene-commit');
  await reset();
  await f.evaluate(()=>{const b=captureSnap();anim.frames=[{snap:b,dur:1},{snap:JSON.parse(JSON.stringify(b)),dur:1},{snap:JSON.parse(JSON.stringify(b)),dur:1}];animActive=2;loadSnap(anim.frames[2].snap);renderAnimFrames();document.getElementById('animBar').classList.remove('on');});
  const live=await f.evaluate(()=>window.__animLive());
  await f.evaluate(()=>{state.drawings.push({id:9901,type:'ellipse',pts:[{x:300,y:300},{x:420,y:380}],color:'#ffd60a',lw:2});renderDrawings();boardSaveLive();});
  await page.waitForTimeout(500);
  await f.evaluate(()=>selectAnimFrame(0));
  const where=await f.evaluate(()=>anim.frames.map(fr=>(fr.snap.drawings||[]).length));
  if(live)assert.deepEqual(where,[0,0,1],'원은 그린 장면(3)에만 '+JSON.stringify(where));
  await f.evaluate(()=>selectAnimFrame(2));
  await f.evaluate(()=>{const d=state.drawings[0];removeDrawing(d);});
  await f.evaluate(()=>selectAnimFrame(0));await f.evaluate(()=>selectAnimFrame(2));
  assert.equal(await f.evaluate(()=>state.drawings.length),0,'지운 원이 장면을 옮겨도 되살아나지 않는다');
  // 방금 그린 선은 선택 없이 Delete
  await f.evaluate(()=>{const mb=document.querySelector('#toolSeg [data-tool="line"]');if(mb)mb.click();});
  const a=await U(300,500),b2=await U(600,500);
  await page.mouse.move(a.x,a.y);await page.mouse.down();for(let i=1;i<=8;i++)await page.mouse.move(a.x+(b2.x-a.x)*i/8,a.y);await page.mouse.up();await page.waitForTimeout(250);
  assert.equal(await f.evaluate(()=>state.drawings.length),1,'선을 그렸다');
  await f.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true})));
  await page.waitForTimeout(150);
  assert.equal(await f.evaluate(()=>state.drawings.length),0,'방금 그린 선은 Delete 로 지워진다');
  await f.evaluate(()=>{const mb=document.querySelector('#toolSeg [data-tool="move"]');if(mb)mb.click();});

  // 9) 장면 줄에서 Delete 로 지운 장면도 ⌘Z
  step('scene-undo');
  const before=await f.evaluate(()=>anim.frames.length);
  await f.evaluate(()=>{const fr=document.querySelectorAll('#animFrames .anim-frame')[1];fr.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));fr.click();});
  await f.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true})));
  await page.waitForTimeout(150);
  assert.equal(await f.evaluate(()=>anim.frames.length),before-1,'장면이 지워졌다');
  await f.evaluate(()=>undoLast());
  assert.equal(await f.evaluate(()=>anim.frames.length),before,'⌘Z 로 장면이 돌아온다');

  // 6·7·8) 단축키 조합: 편집기가 ⌘+문자·Shift 톡·방향키를 받고, 실행도 된다
  step('shortcuts');
  await f.evaluate(()=>{localStorage.removeItem('cs_tool_shortcuts_v1');const h=document.createElement('div');h.id='kTest';h.style.cssText='position:fixed;left:0;top:0;width:600px;z-index:99999;background:#fff';document.body.appendChild(h);localStorage.setItem('cs_tool_shortcuts_tab_v1','board');window.__mountToolKeyEditor(h);});
  assert.equal(await f.evaluate(()=>window.__psShortcutFor(window.__psComboOf({metaKey:/Mac/.test(navigator.platform),ctrlKey:!/Mac/.test(navigator.platform),key:'s',code:'KeyS'}))),'save','저장 기본 단축키 ⌘S');
  const cap=async(tool,down,up)=>{await f.evaluate(t=>document.querySelector('#kTest button[data-tool="'+t+'"]').click(),tool);await f.focus('#kTest button[data-tool="'+tool+'"]');for(const k of down)await page.keyboard.down(k);for(const k of (up||down).slice().reverse())await page.keyboard.up(k);await page.waitForTimeout(80);return f.evaluate(t=>document.querySelector('#kTest button[data-tool="'+t+'"]').dataset.key,tool);};
  const MOD=process.platform==='darwin'?'Meta':'Control';
  assert.equal(await cap('pen1',[MOD,'KeyK']),(MOD==='Meta'?'cmd':'ctrl')+'+k','⌘+문자를 받는다');
  assert.equal(await cap('penNext',['Shift']),'shift','Shift 만 «톡»');
  assert.equal(await cap('boardSettings',['ArrowRight']),'right','방향키');
  assert.equal(await cap('lineToggle',['Space']),'space','스페이스');
  await f.evaluate(()=>{document.getElementById('kTest').remove();document.body.focus();});
  await f.evaluate(()=>{state.color='#1c1c1e';});
  await page.keyboard.press(MOD+'+KeyK');await page.waitForTimeout(120);
  assert.equal(await f.evaluate(()=>state.color),'#ff453a','⌘K → 펜 색 빨강');
  await page.keyboard.down('Shift');await page.keyboard.up('Shift');await page.waitForTimeout(120);
  assert.equal(await f.evaluate(()=>state.color),'#ff9f0a','Shift 톡 → 펜 색 다음');
  const ln0=await f.evaluate(()=>state.lines);
  await page.keyboard.press('Space');await page.waitForTimeout(150);
  assert.notEqual(await f.evaluate(()=>state.lines),ln0,'스페이스 → 라인 바꾸기');
  // 셸(보드 밖)에 초점이 있어도 보드 단축키가 닿는다
  await f.evaluate(()=>{state.color='#1c1c1e';});
  await page.evaluate(()=>{try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();}catch(_){}window.focus();document.body.focus();});
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.tagName),'BODY','초점이 셸에 있다');
  await page.keyboard.press(MOD+'+KeyK');await page.waitForTimeout(150);
  assert.equal(await f.evaluate(()=>state.color),'#ff453a','셸에서 누른 ⌘K 도 보드 펜 색을 바꾼다');
  await page.keyboard.press('Space');await page.waitForTimeout(150);
  assert.equal(await f.evaluate(()=>state.lines),ln0,'셸에서 누른 스페이스도 보드로(라인 한 번 더 바꿈 = 원래대로)');
  await f.evaluate(()=>localStorage.removeItem('cs_tool_shortcuts_v1'));

  // 2·3) 선수단 불러오기 = 지금 판의 선수 자리 + 다른 페이지
  step('squad');
  await reset();
  await f.evaluate(()=>{
    squad={players:[{id:'q1',name:'골키퍼 하나',num:'21',pos:'GK'},{id:'q2',name:'센터백 하나',num:'4',pos:'CB'},{id:'q3',name:'센터백 둘',num:'5',pos:'CB'},{id:'q4',name:'스트라이커',num:'10',pos:'ST'},{id:'q5',name:'윙어',num:'11',pos:'LW'},{id:'q6',name:'미드 하나',num:'8',pos:'CM'}]};
    /* 3-5-2 풍 판(4-3-3 아님) — 자리 이름이 있는 토큰 5개 */
    state.players=[{id:901,team:'blue',num:'1',pos:'GK',x:80,y:370},{id:902,team:'blue',num:'3',pos:'LCB',x:220,y:250},{id:903,team:'blue',num:'5',pos:'RCB',x:220,y:490},{id:904,team:'blue',num:'9',pos:'ST',x:700,y:370},{id:905,team:'blue',num:'7',pos:'LW',x:640,y:150}];
    renderTokens();
    try{window.__psPages.refresh();}catch(_){} const dp=document.querySelector('.bpx[title="이 페이지 복제"]'); if(dp)dp.click();
  });
  await page.waitForTimeout(300);
  const pagesN=await f.evaluate(()=>window.__psPages&&window.__psPages.pageInfo&&window.__psPages.pageInfo()?window.__psPages.pageInfo().count:1);
  await f.evaluate(()=>applySquadToBoard({includeUnavailable:true}));
  await page.waitForTimeout(400);
  const sq=await f.evaluate(()=>state.players.filter(p=>p.team==='blue').map(p=>({id:p.id,name:p.name,x:Math.round(p.x),y:Math.round(p.y),pos:p.pos})));
  const byId=Object.fromEntries(sq.map(p=>[p.id,p]));
  assert.equal(byId[901].name,'골키퍼 하나');assert.equal(byId[901].x,80,'자리 그대로');
  assert.match(byId[902].name+byId[903].name,/센터백 하나.*센터백 둘|센터백 둘.*센터백 하나/,'CB 둘이 LCB·RCB 자리에');
  assert.equal(byId[904].name,'스트라이커');assert.equal(byId[905].name,'윙어');
  assert.equal(sq.filter(p=>p.id<900||p.id>905).length,1,'자리 없는 미드는 새로 하나(같은 포지션 뒤 또는 대기줄)');
  if(pagesN>1){
    const other=await f.evaluate(()=>{const lv=window.__psPages.liveVal&&window.__psPages.liveVal();return lv?lv.pages.map(p=>(p.snap.players||[]).filter(q=>q.team==='blue').map(q=>q.id+':'+(q.name||'')).join(',')):null;});
    assert.ok(other&&other.every(s=>/901:골키퍼 하나/.test(s)),'다른 페이지에도 '+JSON.stringify(other));
  }

  // 4) 유니폼 색은 모든 장면·모든 페이지에
  step('kit');
  await f.evaluate(()=>{const b=captureSnap();anim.frames=[{snap:b,dur:1},{snap:JSON.parse(JSON.stringify(b)),dur:1}];animActive=0;ensureAnimMode(false);renderAnimFrames();});
  await f.evaluate(()=>{window.__setTeamMain?window.__setTeamMain('blue','#00aa55'):(state.teamColors.blue='#00aa55');boardSaveLive();});
  await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>anim.frames[1].snap.teamColors&&anim.frames[1].snap.teamColors.blue),'#00aa55','다른 장면에도');
  if(pagesN>1){ await page.waitForTimeout(200); assert.ok(await f.evaluate(()=>{const lv=window.__psPages.liveVal();return lv.pages.every(p=>p.snap.teamColors&&p.snap.teamColors.blue==='#00aa55');}),'다른 페이지에도'); }

  // 19) 사진 배경색 + 원보다 작게
  step('photo');
  await f.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=200;const x=c.getContext('2d');x.fillStyle='#e0b090';x.beginPath();x.arc(100,100,90,0,7);x.fill();const im=new Image();im.onload=()=>{window.__cropOpen=1;openTokenPhotoCrop(im,[state.players[0]]);};im.src=c.toDataURL();});
  await f.waitForSelector('#tokenPhotoCrop');
  await f.evaluate(()=>{const r=document.querySelector('#tokenPhotoCrop input[aria-label="사진 확대"]');r.value='0.6';r.dispatchEvent(new Event('input'));document.querySelector('#tokenPhotoCrop [data-bgs] button[title="하늘"]').click();document.querySelector('#tokenPhotoCrop [data-save]').click();});
  await page.waitForTimeout(200);
  const ph=await f.evaluate(()=>{const p=state.players[0];const c=document.querySelector('#tokenLayer [data-id="'+p.id+'"] circle.tok-c');return {bg:p.imgBg,img:!!p.img,fill:c&&c.getAttribute('fill')};});
  assert.deepEqual(ph,{bg:'#5ac8fa',img:true,fill:'#5ac8fa'},'사진 배경색이 토큰에');

  // 20) 운동장 범위 — 상대 쪽 확대
  step('pitch-side');
  await f.evaluate(()=>{window.__setPitchView('q1');});await page.waitForTimeout(150);
  const vbOwn=await f.evaluate(()=>document.getElementById('board').getAttribute('viewBox'));
  await f.evaluate(()=>window.__setPitchSide('opp'));await page.waitForTimeout(150);
  const vbOpp=await f.evaluate(()=>document.getElementById('board').getAttribute('viewBox'));
  assert.notEqual(vbOpp,vbOwn,'상대 쪽으로 옮겨 자른다');
  assert.ok(await f.evaluate(()=>{const v=document.getElementById('board').getAttribute('viewBox').split(/[ ,]+/).map(Number);return state.orientation!=='h'||v[0]+v[2]>=W-60;}),'가로 판이면 오른쪽 끝(상대 골대)까지 보인다 '+vbOpp);
  assert.equal(await f.evaluate(()=>captureSnap().pvSide),'opp','저장된다');
  await f.evaluate(()=>{window.__setPitchSide('own');window.__setPitchView('full');});

  // 15·16·17·18) 영상 — 16:9, 운동장 가운데, 이름 = 작전판 + 페이지
  step('video');
  await reset();
  const vid=await f.evaluate(async()=>{
    state.players=[{id:851,team:'blue',num:'7',x:300,y:370}];renderTokens();
    const a=captureSnap(),b=JSON.parse(JSON.stringify(a));b.players[0].x=800;
    anim.frames=[{snap:a,dur:.4,hold:.2},{snap:b,dur:.4,hold:.2}];animActive=0;renderAnimFrames();
    let got=null;window._animSaveBlob=async function(blob,name){got={size:blob.size,type:blob.type,name,blob};return null;};
    await exportVideo({height:720,fps:15});
    if(!got)return null;
    const url=URL.createObjectURL(got.blob),v=document.createElement('video');v.muted=true;v.src=url;
    const meta=await new Promise(r=>{v.onloadedmetadata=()=>r({w:v.videoWidth,h:v.videoHeight,d:v.duration});v.onerror=()=>r({err:String(v.error&&v.error.code)});setTimeout(()=>r({timeout:1}),8000);});
    return {name:got.name,type:got.type,size:got.size,meta,box:window.__export169&&window.__export169(null)};
  });
  assert.ok(vid&&vid.size>1000,'영상이 만들어졌다 '+JSON.stringify(vid&&{n:vid.name,t:vid.type,s:vid.size}));
  assert.match(vid.name,/^작전판.*\.(mp4|webm)$/,'파일 이름 '+vid.name);
  if(vid.meta&&vid.meta.w){ assert.equal(vid.meta.w,1280);assert.equal(vid.meta.h,720,'16:9'); }
  const bx=vid.box; assert.ok(Math.abs(bx[2]/bx[3]-16/9)<0.01,'16:9 상자');
  const cx=bx[0]+bx[2]/2; assert.ok(Math.abs(cx-555)<1,'운동장 가운데 '+cx);
  console.log(JSON.stringify({vid:{name:vid.name,type:vid.type,size:vid.size,meta:vid.meta}}));

  const errs=logs.filter(l=>l.type==='pageerror');
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('board-feedback-2975 ok',engine,size);
}catch(e){console.error('실패 단계:',cur);throw e;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
