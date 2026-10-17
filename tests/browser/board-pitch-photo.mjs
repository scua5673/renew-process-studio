import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 제보 553c06ac «운동장 화면을 사진 이미지로 첨부» — 보드 설정 › 운동장 › «사진». 합성 팀 fixture 에서만 돈다(운영 Supabase 에 닿지 않는다).
// 고르기(파일 고르개) → 운동장 자리에 깔리고 선수 · 화살표는 그 위 → PNG 에 사진이 들어간다 → 장면 · 페이지 · 되돌리기에는 참조만(이 기기 사진 한 벌)
// → «사진 빼기»로 운동장 → 저장하고 다시 열면 이 기기에서 사진이 돌아온다 → 사진이 없는 기기(IndexedDB 에서 뺀 것)는 운동장 + «이 기기에는 없어요».
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
const shot=(page,n)=>page.screenshot({path:path.join(SHOTS,'board-pitch-photo-'+n+'-'+engine+'.png')});
try{
  const {page,logs}=await openApp(fx,size,{browsers,tilt3d:false});
  await page.waitForTimeout(2500);
  async function openBoard(){
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
    await f.waitForFunction(()=>typeof state==='object'&&window.__boardReady!==false&&window.__boardRestoreDone&&typeof window.__psToggleBoardSettings==='function'&&!!window.PSPitchPhoto&&!!document.getElementById('cmd-board-settings-pop'),null,{timeout:30000});
    await page.waitForTimeout(900);
    return f;
  }
  let f=await openBoard();
  const box=async()=>(await page.$('#fBoard')).boundingBox();
  /* 판 좌표 → 창 좌표(iframe 안 · 밖) */
  const at=(x,y)=>f.evaluate(([x,y])=>{const s=document.getElementById('board'),m=document.getElementById('world').getScreenCTM(),p=s.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(m);return {x:q.x,y:q.y};},[x,y]);
  const settings=async open=>{await f.evaluate(o=>window.__psToggleBoardSettings(o?'open':'force-close'),open);await page.waitForTimeout(350);if(open){await f.evaluate(()=>document.getElementById('cmd-board-settings-pop').__psSelectTab('pitch'));await page.waitForTimeout(250);}};
  const labels=()=>f.evaluate(()=>[...document.querySelectorAll('#cmd-board-settings-pop .menurow')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).map(e=>{const l=e.querySelector('.menulbl');return l?l.textContent.trim():'';}).filter(Boolean));
  const row=()=>f.evaluate(()=>{const r=document.getElementById('pitchPhotoRow'),h=document.getElementById('pitchPhotoHint');return {pick:r.querySelector('[data-pp="pick"]').textContent,clearOff:r.querySelector('[data-pp="clear"]').disabled,hint:h.textContent,hintShown:h.getBoundingClientRect().height>0,state:r.getAttribute('data-pp-state')};});
  const photo=()=>f.evaluate(()=>{const im=document.querySelector('#ps-pitchimg'),w=document.getElementById('world'),kids=[...w.children];
    return {ref:state.pitchImg,inWorld:!!im&&im.parentNode===w,href:im?(im.getAttribute('href')||'').slice(0,23):'',len:im?(im.getAttribute('href')||'').length:0,
      box:im?['x','y','width','height'].map(k=>+im.getAttribute(k)):null,fit:im?im.getAttribute('preserveAspectRatio'):'',
      order:im?{img:kids.indexOf(im),lines:kids.indexOf(w.querySelector('#lineLayer')),grid:kids.indexOf(w.querySelector('#gridLayer')),draw:kids.indexOf(w.querySelector('#drawLayer')),tok:kids.indexOf(w.querySelector('#tokenLayer'))}:null,
      custom:document.body.classList.contains('ps-custompitch'),orient:state.orientation};});
  const idbKeys=()=>f.evaluate(()=>window.storage.keys('ps_pitch_photo:'));

  // ① 보드 설정 › 운동장 › 바탕: «피치» 바로 아래 «사진» 줄 + 이 기기에만 안내
  await settings(true);
  let lb=await labels();
  assert.equal(lb[lb.indexOf('피치')+1],'사진','«사진» 줄은 «피치» 바로 아래 '+JSON.stringify(lb));
  let r=await row();
  assert.deepEqual([r.pick,r.clearOff,r.state,r.hintShown],['사진 고르기',true,'none',true],JSON.stringify(r));
  assert.match(r.hint,/이 기기에만 저장돼요/);
  await shot(page,'1-settings');

  // ② 사진 고르기 — 1920×1080 PNG(왼쪽 빨강 · 오른쪽 파랑)를 파일 고르개로
  const png=await f.evaluate(()=>{const c=document.createElement('canvas');c.width=1920;c.height=1080;const g=c.getContext('2d');g.fillStyle='#d01818';g.fillRect(0,0,960,1080);g.fillStyle='#1830d0';g.fillRect(960,0,960,1080);g.fillStyle='#fff';g.fillRect(80,80,240,140);return c.toDataURL('image/png').split(',')[1];});
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),f.click('#pitchPhotoRow [data-pp="pick"]')]);
  await chooser.setFiles({name:'경기화면.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await f.waitForFunction(()=>PSPitchPhoto.isRef(state.pitchImg)&&!!document.querySelector('#world > #ps-pitchimg'),null,{timeout:15000});
  let ph=await photo();
  console.log('photo',JSON.stringify(ph));
  assert.match(ph.ref,/^@photo:[0-9a-f]{16}-1600x900$/,'판에는 참조만(긴 변 1600 으로 줄인 크기)');
  assert.equal(ph.inWorld,true,'사진은 판 좌표(#world)에');assert.equal(ph.href,'data:image/jpeg;base64,');
  assert.deepEqual(ph.box,[-102.78,0,1315.56,740],'운동장 틀(11인제 0 0 1110 740)을 덮고 16:9 그대로 가운데');
  assert.ok(ph.order.img>ph.order.lines&&ph.order.img>ph.order.grid&&ph.order.img<ph.order.draw&&ph.order.img<ph.order.tok,'라인 · 구역 위, 그림 · 선수 아래 '+JSON.stringify(ph.order));
  assert.equal(ph.custom,false);assert.equal(ph.orient,'h','가로 사진 → 가로 판');
  const ref=ph.ref,id=ref.slice(7,23),photoChars=ph.len;
  assert.ok(ph.len<500000,'긴 변 1600 JPEG — '+ph.len+'자');
  assert.deepEqual(await idbKeys(),['ps_pitch_photo:'+id],'이 기기 IndexedDB 에 한 벌');
  assert.equal(await f.evaluate(k=>window.storage.get(k).then(v=>v&&v.value.slice(0,23)),'ps_pitch_photo:'+id),'data:image/jpeg;base64,');
  r=await row();assert.deepEqual([r.pick,r.clearOff,r.state],['다른 사진',false,'here']);assert.match(r.hint,/이 기기에만 저장돼요.*운동장으로 보여요/);
  await shot(page,'2-picked');
  /* ⌘Z 한 걸음 — 사진 전으로, ⇧⌘Z 로 다시 */
  await f.evaluate(()=>undoLast());await page.waitForTimeout(300);
  assert.deepEqual(await f.evaluate(()=>[state.pitchImg,!!document.querySelector('#ps-pitchimg')]),[null,false],'되돌리면 운동장');
  await f.evaluate(()=>redoLast());await page.waitForTimeout(300);
  assert.deepEqual(await f.evaluate(()=>[state.pitchImg,!!document.querySelector('#world > #ps-pitchimg')]),[ref,true],'다시 하면 사진');

  // ③ 선수 · 화살표는 사진 위 — 선수를 놓고 «패스» 화살표를 사진 위에 끈다
  await settings(false);
  await f.evaluate(()=>{state.players.push({id:9701,team:'red',num:'9',x:300,y:600});renderTokens();boardSaveLive();});
  const tp=await at(300,600);
  assert.equal(await f.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return !!(e&&e.closest('#tokenLayer'));},[tp.x,tp.y]),true,'선수가 사진 위에서 잡힌다');
  await f.evaluate(()=>document.querySelector('#toolSeg [data-tool="pass"]').click());
  const b0=await box(),a1=await at(700,200),a2=await at(900,250);
  await page.mouse.move(b0.x+a1.x,b0.y+a1.y);await page.mouse.down();for(let i=1;i<=10;i++)await page.mouse.move(b0.x+a1.x+(a2.x-a1.x)*i/10,b0.y+a1.y+(a2.y-a1.y)*i/10);await page.mouse.up();await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>state.drawings.length),1,'사진 위에 화살표를 그렸다');
  assert.equal(await f.evaluate(()=>{const d=document.querySelector('#drawLayer');return !!d&&d.children.length>0&&d.compareDocumentPosition(document.querySelector('#ps-pitchimg'))===Node.DOCUMENT_POSITION_PRECEDING;}),true,'화살표는 사진보다 뒤(위)에 그려진다');
  await f.evaluate(()=>document.querySelector('#toolSeg [data-tool="move"]').click());
  await shot(page,'3-arrow');

  // ④ PNG — 내보내기 그림(boardImageXML · exportPNG 와 같은 길)에 사진이 들어간다: 왼쪽 빨강 · 오른쪽 파랑
  const px=await f.evaluate(()=>new Promise(res=>{const o=boardImageXML(),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=o.w;c.height=o.h;const g=c.getContext('2d');g.drawImage(img,0,0,o.w,o.h);
    const s=(fx,fy)=>Array.from(g.getImageData(Math.round(o.w*fx),Math.round(o.h*fy),1,1).data.slice(0,3));res({vb:o.vb,left:s(.25,.35),right:s(.75,.65),photo:o.xml.indexOf('data:image/jpeg')>=0,n:(o.xml.match(/data:image\/jpeg/g)||[]).length});};img.onerror=()=>res(null);img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(o.xml);}));
  console.log('png',JSON.stringify(px));
  assert.ok(px&&px.photo&&px.n===1,'내보내기 그림에 사진 한 장');
  assert.ok(px.left[0]>150&&px.left[2]<90,'왼쪽은 사진의 빨강 '+px.left);assert.ok(px.right[2]>150&&px.right[0]<90,'오른쪽은 사진의 파랑 '+px.right);
  if(engine==='chromium'){   /* 진짜 «PNG 저장» 단추 길 — 받은 파일도 같은 색 */
    const [dl]=await Promise.all([page.waitForEvent('download',{timeout:15000}),f.evaluate(()=>exportPNG())]);
    const file=await dl.path(),b64=fs.readFileSync(file).toString('base64');
    const got=await f.evaluate(b=>new Promise(res=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);const s=(fx,fy)=>Array.from(g.getImageData(Math.round(c.width*fx),Math.round(c.height*fy),1,1).data.slice(0,3));res({w:c.width,left:s(.25,.35),right:s(.75,.65)});};img.src='data:image/png;base64,'+b;}),b64);
    console.log('download',JSON.stringify(got));
    assert.ok(got.left[0]>150&&got.right[2]>150,'저장한 PNG 에도 사진 '+JSON.stringify(got));
  }

  // ⑤ 장면 3개 · 되돌리기 · 개인 보드 본문 — 사진은 참조로만 실린다(장면마다 한 벌이 되지 않는다)
  for(let i=0;i<3;i++){await f.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(250);}
  const sz=await f.evaluate(r=>{const cap=boardLiveCapture('board'),raw=cap?cap.raw:'';return {frames:anim.frames.length,refs:anim.frames.map(x=>x.snap&&x.snap.pitchImg),rawLen:raw.length,rawPhoto:/data:image\/jpeg/.test(raw),rawRefs:raw.split(r).length-1,undoPhoto:/data:image\/jpeg/.test(JSON.stringify(undoStack)),undoN:undoStack.length};},ref);
  console.log('sizes',JSON.stringify(sz));
  assert.ok(sz.frames>=3);assert.ok(sz.refs.every(x=>x===ref),'모든 장면에 같은 참조');
  assert.equal(sz.rawPhoto,false,'저장 본문에 사진 원본 없음');assert.ok(sz.rawRefs>=sz.frames,'장면마다 23자 참조');
  assert.equal(sz.undoPhoto,false,'되돌리기 기록에도 원본 없음');

  // ⑥ 페이지 — 새 페이지는 지금 운동장(사진)을 이어받고, 페이지를 오가도 이 기기 사진은 한 벌
  await f.evaluate(()=>[...document.querySelectorAll('#boardPageStrip .bp-add')].find(b=>/페이지/.test(b.textContent)).click());await page.waitForTimeout(700);
  ph=await photo();assert.equal(ph.ref,ref,'새 페이지도 같은 사진');assert.equal(ph.inWorld,true);
  await f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[0].click());await page.waitForTimeout(700);
  ph=await photo();assert.equal(ph.ref,ref);assert.equal(ph.inWorld,true,'첫 페이지로 돌아와도 사진');
  assert.equal((await idbKeys()).length,1,'페이지 둘 · 장면 넷이어도 이 기기 사진은 한 벌');
  const pages=await f.evaluate(r=>{const v=window.__psPages.liveVal();const raw=JSON.stringify(v);return {n:v&&v.pages.length,photo:/data:image\/jpeg/.test(raw),refs:raw.split(r).length-1,len:raw.length};},ref);
  console.log('pages',JSON.stringify(pages));
  assert.equal(pages.n,2);assert.equal(pages.photo,false,'페이지 묶음에도 원본 없음');

  // ⑥-2 보관함에 저장 — 이 기기 보관함 항목에도 참조만(썸네일에도 사진 원본 없음)
  await f.click('#boardManualSave');await f.waitForSelector('#psSaveOv');
  await f.evaluate(()=>{document.getElementById('pssName').value='가상 사진 보드';});await f.click('#pssOk');
  await f.waitForFunction(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).some(d=>d.name==='가상 사진 보드'),null,{timeout:15000});
  const vault=await f.evaluate(async r=>{const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x.name==='가상 사진 보드'),raw=JSON.stringify(d);return {len:raw.length,photo:/data:image\/jpeg/.test(raw),refs:raw.split(r).length-1};},ref);
  console.log('vault',JSON.stringify(vault));
  assert.equal(vault.photo,false,'보관함 항목에 사진 원본 없음');assert.ok(vault.refs>=2,'페이지 · 장면마다 참조');
  await page.waitForTimeout(400);

  // ⑦ «사진 빼기» — 운동장으로(이 페이지의 모든 장면)
  await settings(true);
  await f.click('#pitchPhotoRow [data-pp="clear"]');await page.waitForTimeout(400);
  ph=await photo();
  assert.equal(ph.ref,null);assert.equal(ph.inWorld,false,'사진이 걷혔다');
  assert.equal(await f.evaluate(()=>!!document.querySelector('#lineLayer')&&getComputedStyle(document.querySelector('#lineLayer')).display!=='none'),true,'운동장 라인이 보인다');
  assert.ok(await f.evaluate(()=>anim.frames.every(x=>!x.snap||!x.snap.pitchImg)),'모든 장면에서 빠졌다');
  r=await row();assert.deepEqual([r.pick,r.clearOff,r.state],['사진 고르기',true,'none']);
  await shot(page,'4-cleared');

  // ⑧ 같은 사진을 다시 고르면 같은 참조(한 벌) → 저장하고 앱을 다시 열면 이 기기에서 사진이 돌아온다
  const [ch2]=await Promise.all([page.waitForEvent('filechooser'),f.click('#pitchPhotoRow [data-pp="pick"]')]);
  await ch2.setFiles({name:'경기화면.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await f.waitForFunction(r=>state.pitchImg===r&&!!document.querySelector('#world > #ps-pitchimg'),ref,{timeout:15000});
  assert.equal((await idbKeys()).length,1,'같은 사진은 한 벌');
  await settings(false);
  assert.ok(await f.evaluate(()=>Promise.resolve(window.__boardSaveExplicit()).then(v=>v!==false)),'보드 저장');
  await page.waitForTimeout(600);
  await page.reload();await page.waitForTimeout(2500);
  f=await openBoard();
  await f.waitForFunction(r=>state.pitchImg===r&&!!document.querySelector('#world > #ps-pitchimg'),ref,{timeout:15000});
  ph=await photo();assert.equal(ph.href,'data:image/jpeg;base64,','다시 열어도 이 기기에서 사진이 보인다');
  await shot(page,'5-reloaded');

  // ⑧-2 3D 보기 — 사진은 숨고(운동장이 보인다) 켠 순간 알려 준다. 끄면 다시 사진
  await f.evaluate(()=>window.__setTilt(true,{transient:true}));await page.waitForTimeout(700);
  const t3=await f.evaluate(()=>({vis:getComputedStyle(document.querySelector('#ps-pitchimg')).visibility,hint:(document.getElementById('hint')||{}).textContent||''}));
  assert.equal(t3.vis,'hidden','3D 에서는 사진이 숨는다');assert.match(t3.hint,/3D 보기에서는 운동장 사진이 보이지 않아요/);
  await shot(page,'5b-3d');
  await f.evaluate(()=>window.__setTilt(false,{transient:true}));await page.waitForTimeout(500);
  assert.equal(await f.evaluate(()=>getComputedStyle(document.querySelector('#ps-pitchimg')).visibility),'visible');

  // ⑧-3 세로 사진(위 25% 초록 · 아래 빨강) — 판이 세로로 돌고, 사진은 바로 서 있다(위가 초록)
  const tall=await f.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=1600;const g=c.getContext('2d');g.fillStyle='#d01818';g.fillRect(0,0,900,1600);g.fillStyle='#18a030';g.fillRect(0,0,900,400);return c.toDataURL('image/png').split(',')[1];});
  await settings(true);
  const [ch3]=await Promise.all([page.waitForEvent('filechooser'),f.click('#pitchPhotoRow [data-pp="pick"]')]);
  await ch3.setFiles({name:'세로.png',mimeType:'image/png',buffer:Buffer.from(tall,'base64')});
  await f.waitForFunction(r=>PSPitchPhoto.isRef(state.pitchImg)&&state.pitchImg!==r&&!!document.querySelector('#world > #ps-pitchimg'),ref,{timeout:15000});
  await settings(false);
  const up=await f.evaluate(()=>new Promise(res=>{const o=boardImageXML(),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=o.w;c.height=o.h;const g=c.getContext('2d');g.drawImage(img,0,0,o.w,o.h);
    const s=(fx,fy)=>Array.from(g.getImageData(Math.round(o.w*fx),Math.round(o.h*fy),1,1).data.slice(0,3));res({o:state.orientation,flip:!!state.spFlip,ref:state.pitchImg,vb:o.vb,top:s(.5,.06),bottom:s(.5,.9)});};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(o.xml);}));
  console.log('tall',JSON.stringify(up));
  assert.equal(up.o,'v','세로 사진 → 세로 판');assert.match(up.ref,/-1600x900$/,'판 좌표에는 돌려 담는다');
  assert.ok(up.top[1]>120&&up.top[0]<90,'위가 사진의 위(초록) '+up.top);assert.ok(up.bottom[0]>150&&up.bottom[1]<90,'아래는 빨강 '+up.bottom);
  await shot(page,'5c-tall');
  const ref2=up.ref,id2=ref2.slice(7,23);
  assert.equal((await idbKeys()).length,2,'사진 둘 = 이 기기에 두 벌');
  assert.ok(await f.evaluate(()=>Promise.resolve(window.__boardSaveExplicit()).then(v=>v!==false)),'보드 저장');await page.waitForTimeout(600);

  // ⑨ 사진이 없는 기기(= 다른 기기 · 팀원) — 참조는 그대로, 판은 운동장, 설정 줄이 «이 기기에는 없어요»
  await f.evaluate(k=>window.storage.del(k),'ps_pitch_photo:'+id2);
  await page.reload();await page.waitForTimeout(2500);
  f=await openBoard();
  await f.waitForFunction(r=>state.pitchImg===r,ref2,{timeout:15000});await page.waitForTimeout(800);
  ph=await photo();assert.equal(ph.inWorld,false,'사진이 없으면 그리지 않는다');assert.equal(ph.custom,false);
  assert.equal(await f.evaluate(()=>!!document.querySelector('#lineLayer')),true,'운동장으로 보인다');
  await settings(true);
  r=await row();assert.equal(r.state,'missing');assert.match(r.hint,/이 기기에는 없어요/);
  await shot(page,'6-missing');
  await settings(false);

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,passed:true,photoChars,vault,sizes:sz,pages}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
