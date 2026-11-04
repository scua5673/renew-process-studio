import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.254 — 작전판 제보 셋(합성 팀 fixture 에서만 · 실계정 · 서버 없음).
//  ① 3d89e952 · eb30babd: 16:9 영상 화면은 운동장 틀 하나 — 놓인 것 · 운동장 사진 비율과 상관없이. 사진이 못 덮는 쪽은 어두운 띠.
//  ② 2456db8e: «선 스타일 › 모양 › 점선»이 연결선 · 다각형 · 원형 구역 · 구역 · 그리드 원 · 점선 도구(실선으로)에 먹는다.
//  ③ 7db68045: 계속 강조는 이 장면부터 뒤로 이어서 켜고 끈다(뒤에서 따로 바꿔 둔 장면 앞까지) · 되돌리기 한 번.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-reports-3254 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  if(size==='desktop')await page.setViewportSize({width:2560,height:1402});   // 제보자 화면(2560×1440 전체 화면) — 판 옆 여백이 넓다
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof anim==='object'&&window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.PSPitchPhoto&&window.PSShapeMenu,null,{timeout:30000});
  await page.waitForTimeout(800);
  const reset=()=>f.evaluate(()=>{try{stopAnim();}catch(_){}state.players=[];state.equipment=[];state.drawings=[];state.pitchImg=null;anim.frames=[];animActive=-1;sel=null;multiSel=[];try{renderPitchImg();}catch(_){}renderTokens();renderDrawings();renderAnimFrames();updateDelUI();});

  // ① 영상 화면
  step('frame-fixed');
  await reset();
  const frames=await f.evaluate(()=>{
    const P=window.PSPitchPhoto,out={};
    const box=setup=>{state.players=[];state.pitchImg=null;setup();renderTokens();return __export169(__exportVB()).map(v=>Math.round(v*100)/100);};
    out.base=box(()=>{state.players=[{id:1,team:'blue',num:'7',x:400,y:300}];});
    out.subLeft=box(()=>{state.players=[{id:1,team:'blue',num:'7',x:400,y:300},{id:2,team:'blue',num:'12',x:-150,y:370}];});
    out.subBelow=box(()=>{state.players=[{id:2,team:'blue',num:'12',x:555,y:800}];});
    out.touchline=box(()=>{state.players=[{id:3,team:'blue',num:'7',name:'김가상',pos:'RW',x:555,y:710}];});
    for(const [w,h] of [[1920,1080],[1600,1200],[1500,1000],[2560,1080]])out['photo'+w+'x'+h]=box(()=>{state.pitchImg=P.refOf('synthetic'+w+h,w,h);});
    state.pitchImg=null;state.players=[];renderTokens();return out;});
  for(const [k,v] of Object.entries(frames))assert.deepEqual(v,frames.base,'영상 화면이 같다: '+k);
  assert.deepEqual(frames.base,[-102.78,0,1315.56,740],'운동장(규격 + 런오프)을 담는 16:9 · 가운데');

  step('photo-bands');
  const bands=await f.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=960;c.height=720;const x=c.getContext('2d');x.fillStyle='#df22ce';x.fillRect(0,0,960,720);
    const url=c.toDataURL('image/png'),ref=PSPitchPhoto.refOf(url,960,720),key=PSPitchPhoto.PREFIX+PSPitchPhoto.idOf(ref);
    await storage.set(key,url);state.pitchImg=ref;await PSPitchPhoto.ready(ref,()=>renderPitchImg());renderPitchImg();
    const out={href:(document.querySelector('#ps-pitchimg')?.getAttribute('href')||'').slice(0,11)};
    const vb=__export169(null);
    window.__animExport=1;window.__psExport169=1;
    try{const xml=boardImageXML(vb).xml;out.on=/class="ps-photo-bars"/.test(xml);out.onBeforePhoto=xml.indexOf('ps-photo-bars')<xml.indexOf('id="ps-pitchimg"');}
    finally{window.__animExport=0;window.__psExport169=0;}
    out.off=/ps-photo-bars/.test(boardImageXML(vb).xml);
    out.live=!!document.querySelector('.ps-photo-bars');
    state.pitchImg=null;renderPitchImg();try{await storage.remove?.(key);}catch(_){}
    return out;});
  assert.equal(bands.href,'data:image/','사진이 깔렸다');
  assert.equal(bands.on,true,'16:9 영상 · GIF 에서 사진이 못 덮는 쪽은 어두운 띠');
  assert.equal(bands.onBeforePhoto,true,'띠는 사진 밑(사진을 가리지 않는다)');
  assert.equal(bands.off,false,'그림(PNG) · 화면에는 띠가 없다');
  assert.equal(bands.live,false,'편집 화면은 그대로');

  // ② 점선 — 실제 «선 스타일» 창의 «모양» 단추로
  step('dash');
  await reset();
  const dash=await f.evaluate(()=>{
    state.players=[{id:11,team:'blue',num:'7',x:300,y:300},{id:12,team:'blue',num:'8',x:450,y:250},{id:13,team:'blue',num:'9',x:420,y:420}];
    state.drawings=[
      {type:'link',ids:[11,12,13],closed:true,color:'#ffffff'},
      {type:'poly',pts:[{x:600,y:200},{x:800,y:220},{x:760,y:400}],closed:true,color:'#ffffff'},
      {type:'ellipse',pts:[{x:150,y:500},{x:350,y:650}],color:'#ffffff'},
      {type:'rect',pts:[{x:850,y:480},{x:1000,y:640}],color:'#ffffff'},
      {type:'rectline',shape:'circle',grid:true,pts:[{x:600,y:480},{x:760,y:640}],color:'#ffffff'},
      {type:'rectdash',pts:[{x:880,y:120},{x:1040,y:260}],color:'#ffffff'},
      {type:'dashline',pts:[{x:100,y:100},{x:300,y:120}],color:'#ffffff'}];
    renderTokens();renderDrawings();
    const L=document.getElementById('drawLayer'),gOf=d=>[...L.children].find(g=>g.__psD===d)||L.children[state.drawings.indexOf(d)];
    const dashed=d=>[...gOf(d).querySelectorAll('[stroke-dasharray]')].filter(n=>!/grid-split/.test(n.getAttribute('class')||'')&&n.getAttribute('stroke')!=='#ffd60a').map(n=>n.tagName.toLowerCase()+':'+n.getAttribute('stroke-dasharray'));
    const pick=(d,v)=>{selectItem('drawing',d);document.getElementById('lineStyleBtn').click();const pop=document.getElementById('lsPop');
      const mark=pop&&pop.querySelector('#lsShape button.on')?.dataset.v;pop.querySelector('#lsShape [data-v="'+v+'"]').click();document.getElementById('lineStyleBtn').click();return mark;};
    const out={};
    for(const d of state.drawings.slice(0,5)){const t=d.type+(d.shape?'-'+d.shape:'');out[t]={before:dashed(d),mark:pick(d,'dash')};out[t].after=dashed(d);}
    const rd=state.drawings[5],dl=state.drawings[6];
    out.rectdash={before:dashed(rd),mark:pick(rd,'solid')};out.rectdash.after=dashed(rd);out.rectdash.solid=!!rd.solid;
    out.dashline={before:dashed(dl),mark:pick(dl,'solid')};out.dashline.after=dashed(dl);
    const el=state.drawings[2];out.ellipseDot={mark:pick(el,'dot')};out.ellipseDot.after=dashed(el);
    undoLast();renderDrawings();out.undo={dot:!!state.drawings[2].dot,dash:!!state.drawings[2].dash};
    sel=null;renderDrawings();updateDelUI();return out;});
  for(const t of ['link','poly'])assert.deepEqual([dash[t].before,dash[t].mark,dash[t].after],[[],'solid',['path:11 8']],t+' 점선(예전부터 되던 길 그대로)');
  assert.deepEqual([dash.ellipse.before,dash.ellipse.after],[[],['ellipse:11 8']],'원형 구역: 점선이면 점선 테두리');
  assert.deepEqual([dash.rect.before,dash.rect.after],[[],['rect:11 8']],'구역: 점선이면 점선 테두리');
  assert.deepEqual([dash['rectline-circle'].before,dash['rectline-circle'].after],[[],['path:11 8']],'그리드 원: 선 스타일의 점선을 따른다');
  assert.deepEqual([dash.rectdash.before,dash.rectdash.mark,dash.rectdash.after,dash.rectdash.solid],[['rect:11 8'],'dash',[],true],'사각형(점선)은 «점선»으로 보이고 «실선»으로 바꿀 수 있다');
  assert.equal(dash.dashline.mark,'dash');assert.deepEqual(dash.dashline.after,[],'점선 도구로 그린 선도 실선으로');
  assert.equal(dash.ellipseDot.after.length,1);assert.match(dash.ellipseDot.after[0],/^ellipse:0\.1 12/,'둥근 점선');
  assert.deepEqual(dash.undo,{dot:false,dash:true},'되돌리기 한 번 = 바로 앞 모양');

  if(size==='desktop'){
    step('shape-menu-more');
    const more=await f.evaluate(()=>{const d=state.drawings[2],g=[...document.getElementById('drawLayer').children].find(x=>x.__psD===d);return g?true:false;});
    assert.ok(more,'그림 표식');
    const box=await (await page.$('#fBoard')).boundingBox();
    const pt=await f.evaluate(()=>{const s=document.getElementById('board'),m=document.getElementById('world').getScreenCTM(),p=s.createSVGPoint();p.x=250;p.y=575;const q=p.matrixTransform(m);return {x:q.x,y:q.y};});
    await page.mouse.click(box.x+pt.x,box.y+pt.y,{button:'right'});
    await f.waitForSelector('#psShapeMenu');
    const label=await f.evaluate(()=>document.querySelector('#psShapeMenu [data-act="more"]')?.textContent||'');
    if(label){assert.equal(label,'점선 · 선 스타일…');
      await f.click('#psShapeMenu [data-act="more"]');await f.waitForSelector('#lsPop #lsShape');
      assert.equal(await f.evaluate(()=>document.querySelector('#lsPop #lsShape button.on')?.dataset.v),'dash','원형 구역의 지금 모양');
      await f.evaluate(()=>document.getElementById('lineStyleBtn').click());}
    else console.log('선 스타일 단추가 이 배치에서 숨어 «더 보기» 없음 — 이름 검사는 단위 시험');
    await page.keyboard.press('Escape');
  }

  // ③ 계속 강조 이어 적용 — 실제 단추(#animHlBtn)
  step('highlight-carry');
  await reset();
  const hl=await f.evaluate(()=>{
    state.players=[{id:21,team:'blue',num:'7',x:300,y:300},{id:22,team:'red',num:'9',x:600,y:300}];renderTokens();
    anim.frames=Array.from({length:9},()=>({snap:captureSnap(),dur:1}));animActive=0;renderAnimFrames();
    const toasts=[],t=window.toast;window.toast=function(m){toasts.push(String(m));return t.apply(this,arguments);};
    const press=(i,id)=>{selectAnimFrame(i);if(id!=null)selectItem('player',state.players.find(p=>p.id===id));else{sel=null;multiSel=[];}document.getElementById('animHlBtn').click();};
    const row=id=>anim.frames.map(f=>f.hl&&f.hl.indexOf(id)>=0?1:0).join('');
    const out={};
    press(4,21);out.on5=row(21);
    press(7,21);out.off8=row(21);
    press(2,21);out.on3=row(21);
    press(4,22);out.other=row(22);out.mine=row(21);
    press(5,null);out.clearAll=[row(21),row(22)];
    undoLast();out.undo=[row(21),row(22)];
    out.btn=document.getElementById('animHlBtn').classList.contains('on');
    window.toast=t;out.toasts=toasts.filter(m=>/강조/.test(m));
    try{stopAnim();}catch(_){}anim.frames=[];animActive=-1;state.players=[];sel=null;renderTokens();renderAnimFrames();
    return out;});
  assert.equal(hl.on5,'000011111','장면 5에서 켜면 5~9');
  assert.equal(hl.off8,'000011100','장면 8에서 끄면 8~9');
  assert.equal(hl.on3,'001111100','장면 3에서 켜면 3~4 — 이미 켜진 5에서 멈추고 8~9(따로 끈 곳)는 그대로');
  assert.equal(hl.other,'000011111','다른 토큰은 제 줄');assert.equal(hl.mine,'001111100','먼저 켠 토큰은 그대로');
  assert.deepEqual(hl.clearAll,['001110000','000010000'],'고른 것 없이 누르면 이 장면부터 모두 끈다(켜져 있던 곳까지)');
  assert.deepEqual(hl.undo,['001111100','000011111'],'되돌리기 한 번에 이어 적용 전체가 돌아온다');
  assert.ok(hl.toasts.includes('계속 강조 · 장면 5~9 — 재생·영상에서 계속 환하게 보여요'),hl.toasts.join(' | '));
  assert.ok(hl.toasts.includes('강조 해제 · 장면 8~9'));
  assert.ok(hl.toasts.includes('강조 해제 모두 · 장면 6~9')||hl.toasts.some(m=>/^강조 해제 모두 · 장면 6/.test(m)),hl.toasts.join(' | '));

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('board-reports-3254 ok',engine,size);
}catch(e){console.error('board-reports-3254 실패 단계:',cur);throw e;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}
