import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.087 — 커뮤니티 글 보기(사용자 «커뮤니티에 있는 것들 볼 때 도크가 필요 없는데 떠 있고 · 원하는 형태로 볼 수 있게 ·
// 3d나 평면이나 사람모향이나 원형이나 이런 것들 선택할수 있게»).
// 데스크톱: 떠 있는 도크 · 칸 · 훈련 탭이 없고 «움직임 재생»이 가려지지 않는다 · «보기»에서 평면/3D · 선수 모양 · 재생해도 그대로 · 다음 글도 그대로 · 보드 설정 값은 그대로.
// 폰: 3D · «사람»이 없다 · 고른 모양이 다음 글에도. 합성 팀 fixture 에서만 돈다(서버 답은 아래 route 가 흉내 낸다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop',phone=size==='phone';
const OTHER='22222222-2222-4222-8222-222222222222';
const snap=s=>({pitchSpec:'fifa',players:[{id:101,team:'blue',num:'6',pos:'',x:400+s*40,y:300},{id:102,team:'red',num:'4',pos:'',x:520,y:330+s*12}],equipment:[],drawings:[],
  ball:{x:410+s*30,y:310,scale:.62},lines:true,gridType:'off',tokenScale:.6,label:'num',tokShape:'circle',orientation:'h',area:'full',pitchView:'full',pitchN:1,tokV:2});
const THUMB='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"><rect width="80" height="60" fill="#15172b"/></svg>';
const POST={id:'Clook1',owner:OTHER,owner_name:'가상코치',title:'가상 보기 글',summary:'',cat:'rondo',age:'U12',players:'8',thumb:THUMB,views:3,copies:0,likes:0,created_at:'2026-10-01T00:00:00Z'};
const ITEM={name:'가상 보기 글',type:'train',focus:'bp',minutes:10,snap:snap(0),frames:[0,1,2].map(s=>({snap:snap(s),hold:.4,dur:.6,cap:''}))};
const fx=await startFixture(),browsers={};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  // 기기 기본 보드 모양을 누가 쓰는지 — 실패하면 어느 화면 · 어느 줄인지 알 수 있게(3.088 WebKit 폰에서만 '{}' 가 적혔다)
  const lkTrap=()=>{try{if(Storage.prototype.__lkTrap)return;const o=Storage.prototype.setItem;Storage.prototype.__lkTrap=1;
    Storage.prototype.setItem=function(k,v){if(k==='cs_board_lookdef_v1'){try{const t=window.top;(t.__lkW=t.__lkW||[]).push(location.pathname+location.search+' '+String(new Error().stack||'').split('\n').slice(0,6).join(' | '));}catch(_){}}return o.apply(this,arguments);};}catch(_){}};
  await context.addInitScript(lkTrap);
  for(const f of page.frames()){try{await f.evaluate(lkTrap);}catch(_){}}
  const lkAt=()=>page.evaluate(()=>localStorage.getItem('cs_board_lookdef_v1')),lk0=await lkAt(),frames0=page.frames().map(f=>f.url().replace(/^https?:\/\/[^/]+/,''));
  const shot=n=>page.screenshot({path:path.join(SHOTS,`community-view-look-${engine}-${size}-${n}.png`)});
  const cors={'access-control-allow-origin':'*'};
  await context.route('**/rest/v1/rpc/ps_comm_**',r=>r.fulfill({status:200,contentType:'application/json',headers:cors,body:'null'}));
  await context.route('**/rest/v1/ps_community**',route=>{const r=route.request(),u=new URL(r.url());
    if(r.method()!=='GET')return route.fallback();
    const body=(u.searchParams.get('select')||'')==='item'?[{item:ITEM}]:[POST];
    return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(body)});});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>window.__psShowApp('community'));
  let c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#prSeg');
  await c.evaluate(()=>{ try{sessionStorage.removeItem('ps_comm_feed_cache_v1');}catch(_){} location.reload(); });   // 셸이 미리 받아 둔 목록 대신 위 흉내로
  await page.waitForTimeout(400);
  c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#prSeg');
  await c.click('#prTabCoach');
  await c.waitForSelector('#grid .card');
  const open=async()=>{
    if(await c.evaluate(()=>getComputedStyle(document.getElementById('commPreview')).display!=='none')){
      await c.click('#grid .card'); await c.waitForTimeout(150); if(await c.$('.tx-sheet'))await c.click('.tx-sheet .tx-btn');
      await c.waitForSelector('#cpOpen'); await c.click('#cpOpen');
    }else{ await c.click('#grid .card'); await c.waitForTimeout(150); if(await c.$('.tx-sheet'))await c.click('.tx-sheet .tx-btn'); }
    await c.waitForSelector('#cvMask.on');
    const v=await (await c.waitForSelector('#cvFrame')).contentFrame();
    await v.waitForFunction(()=>!!document.getElementById('commLookBtn')&&!!document.getElementById('commPlayControls')&&!document.documentElement.classList.contains('comm-boot'));
    await page.waitForTimeout(500);
    return v;
  };
  const close=async()=>{ await c.click('#cvClose'); await c.waitForFunction(()=>!document.getElementById('cvMask').classList.contains('on')); };
  const look=v=>v.evaluate(()=>{
    const vis=id=>{const e=document.getElementById(id);if(!e)return false;const cs=getComputedStyle(e),r=e.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;};
    const pop=document.getElementById('commLookPop'),btn=document.getElementById('commLookBtn'),br=btn.getBoundingClientRect(),pr=pop.getBoundingClientRect();
    const play=document.getElementById('commPlayControls').getBoundingClientRect(),hit=document.elementFromPoint(play.left+play.width/2,play.top+play.height/2);
    return {tilt:document.body.classList.contains('bc-tilt3d'),shape:tokShape,now:btn.querySelector('.cl-now').textContent,open:!pop.hidden,expanded:btn.getAttribute('aria-expanded'),
      tiltOpts:[...pop.querySelectorAll('[data-cl-tilt]')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':'')),
      shapeOpts:[...pop.querySelectorAll('[data-cl-shape]')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':'')),
      hint:pop.querySelector('.cl-hint').textContent,pref:localStorage.getItem('ps_comm_look_v1'),setting:localStorage.getItem('ps_board_tilt3d'),lookdef:localStorage.getItem('cs_board_lookdef_v1'),
      chrome:['ps-command-dock','ps-df-tray','ps-df-opts','trainingStrip','animBar'].filter(vis),playHit:!!(hit&&hit.closest('#commPlayControls')),
      btnH:Math.round(br.height),popIn:pop.hidden||(pr.left>=0&&pr.right<=innerWidth+0.5&&pr.top>=0),vw:innerWidth,docW:document.documentElement.scrollWidth};});
  const pick=async(v,sel)=>{ await v.click(sel); await page.waitForTimeout(phone?250:700); };

  // 1) 처음 — 편집 크롬 없음 · «움직임 재생»이 맨 위 · «보기»는 올린 그대로
  const lkOpen=await lkAt();   // 커뮤니티 글을 열기 전 값 — 보기가 이 값을 바꾸지 않아야 한다
  let v=await open(),L=await look(v);
  assert.deepEqual(L.chrome,[],'커뮤니티 보기에는 도크 · 선수 칸 · 도구 옵션 · 훈련 탭 · 장면 줄이 없다');
  assert.equal(L.playHit,true,'«움직임 재생»을 가리는 것이 없다');
  assert.deepEqual([L.tilt,L.shape,L.open,L.expanded,L.now],[false,'circle',false,'false',phone?'올린 그대로':'평면 · 올린 그대로']);
  assert.ok(L.btnH>=36,'단추 높이 '+L.btnH);
  await shot('1-open');

  await v.click('#commLookBtn'); L=await look(v);
  assert.deepEqual([L.open,L.expanded,L.popIn],[true,'true',true],'고르개가 화면 안에 열린다');
  if(phone){
    assert.deepEqual(L.tiltOpts,[],'폰은 3D 없음(3.069)');
    assert.deepEqual(L.shapeOpts,['올린 그대로 · 원형*','원형','유니폼','쉐이퍼'],'폰은 «사람» 없음');
    await shot('2-pop');
    await pick(v,'[data-cl-shape="shaper"]'); L=await look(v);
    assert.deepEqual([L.shape,L.now,L.pref],['shaper','쉐이퍼',JSON.stringify({shape:'shaper',tilt:''})]);
    await shot('3-shaper');
    await close(); v=await open(); L=await look(v);
    assert.deepEqual([L.shape,L.now,L.tilt],['shaper','쉐이퍼',false],'다음 글도 고른 모양');
  }else{
    assert.deepEqual(L.tiltOpts,['평면*','3D']);
    assert.deepEqual(L.shapeOpts,['올린 그대로 · 원형*','원형','유니폼','사람','쉐이퍼']);
    assert.match(L.hint,/다음 글에도 그대로 열려요\. 글은 바뀌지 않아요\./);
    await shot('2-pop');
    // 2) 3D — 보드 설정 값(ps_board_tilt3d)은 그대로
    const setting0=L.setting;
    await pick(v,'[data-cl-tilt="3d"]'); L=await look(v);
    assert.deepEqual([L.tilt,L.now,L.setting,L.pref],[true,'3D · 올린 그대로',setting0,JSON.stringify({shape:'',tilt:'3d'})]);
    // 3) 모양 — 유니폼 · 사람
    await pick(v,'[data-cl-shape="shirt"]'); L=await look(v);
    assert.deepEqual([L.shape,L.now],['shirt','3D · 유니폼']);
    await pick(v,'[data-cl-shape="person"]'); L=await look(v);
    assert.deepEqual([L.shape,L.tilt,L.now,L.shapeOpts[3]],['person',true,'3D · 사람','사람*']);
    await shot('3-person-3d');
    // 4) 평면으로 — 사람은 유니폼으로 보인다고 알린다 · 사람을 다시 고르면 3D 도 켠다
    await pick(v,'[data-cl-tilt="flat"]'); L=await look(v);
    assert.deepEqual([L.tilt,L.shape,L.now],[false,'person','평면 · 사람']);
    assert.match(L.hint,/^사람은 3D 에서 서 있는 선수로 보여요 — 평면에서는 유니폼이에요/);
    await pick(v,'[data-cl-shape="person"]'); L=await look(v);
    assert.equal(L.tilt,true,'평면에서 사람을 고르면 3D 도');
    await pick(v,'[data-cl-shape="shirt"]'); await pick(v,'[data-cl-tilt="flat"]');
    // 5) 바깥(판)을 누르면 닫힌다 — 보기 전용 막이가 판을 누른 것을 멈춰도
    const box=await v.evaluate(()=>{const r=document.getElementById('boardStage').getBoundingClientRect();return [r.left+r.width*.25,r.top+r.height*.7];});
    const fr=await (await c.$('#cvFrame')).boundingBox(),cf=await (await page.$('#fComm')).boundingBox();
    await page.mouse.click(cf.x+fr.x+box[0],cf.y+fr.y+box[1]); await page.waitForTimeout(200); L=await look(v);
    assert.deepEqual([L.open,L.expanded],[false,'false'],'판을 누르면 닫힘');
    // 6) 재생해도 고른 모양(재생은 장면마다 올린 사람의 모양을 되살린다)
    await v.evaluate(()=>{ const b=[...document.querySelectorAll('#commPlayControls button')].find(x=>/재생/.test(x.textContent)); b.click(); });
    await page.waitForTimeout(900); assert.equal(await v.evaluate(()=>tokShape),'shirt','재생 중');
    await page.waitForTimeout(2600); assert.equal(await v.evaluate(()=>tokShape),'shirt','재생 끝');
    // 7) 다음 글도 고른 대로 · 올린 그대로로 되돌리기
    await close(); v=await open(); L=await look(v);
    assert.deepEqual([L.tilt,L.shape,L.now,L.pref],[false,'shirt','평면 · 유니폼',JSON.stringify({shape:'shirt',tilt:'flat'})]);
    assert.deepEqual(L.chrome,[],'다시 열어도 편집 크롬 없음');
    await v.click('#commLookBtn'); await pick(v,'[data-cl-tilt="3d"]'); await pick(v,'[data-cl-shape=""]'); L=await look(v);
    assert.deepEqual([L.shape,L.tilt,L.now],['circle',true,'3D · 올린 그대로'],'올린 사람의 모양으로');
    await shot('4-reopen');
    await close(); v=await open(); L=await look(v);
    assert.deepEqual([L.tilt,L.shape],[true,'circle'],'3D 도 기기에 남는다(데스크톱)');
    assert.equal(L.setting,setting0,'보드 설정의 3D 값은 끝까지 그대로');
  }
  assert.equal(L.lookdef,lkOpen,'커뮤니티 보기는 기기 기본 보드 모양(cs_board_lookdef_v1)을 쓰지 않는다 — '+JSON.stringify({lk0,lkOpen,frames0,writes:await page.evaluate(()=>window.__lkW||[])}));
  console.log(JSON.stringify({lookdefBeforeViewer:lk0,lookdefAtOpen:lkOpen}));
  assert.equal(L.docW,L.vw,'가로로 넘치지 않는다');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
