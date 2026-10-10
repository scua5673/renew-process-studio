import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.987 — 세로 폰의 보드 탭 · 폰에서 여는 보관함 작전판: 페이지가 둘 이상이면 페이지 띠가 페이지 고르개가 된다.
// 띠는 원래 그 자리(52px)에 있었지만 번진 운동장 배경에 덮여 다른 페이지로 넘어갈 길이 없었다.
// 웹킷 = 폰(고르개) → 아이패드(그대로), 크롬 = 데스크톱(그대로). PS_SIZE 로 하나만 고를 수 있다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',sizes=process.env.PS_SIZE?[process.env.PS_SIZE]:(engine==='webkit'?['phone','ipad']:['desktop']);
for(const size of sizes)await run(size);
async function run(size){
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&typeof renderTokens==='function');
  await page.evaluate(()=>{ if(document.body.getAttribute('data-ps-app')!=='board'){ const b=document.querySelector('#appSeg button[data-app="board"]'); b&&b.click(); } });
  await bf.waitForFunction(()=>(window.__csView||'board')==='board'&&!!document.querySelector('#boardPageStrip.on .bp-tab'),null,{timeout:12000});
  await page.waitForTimeout(900);
  const shot=n=>page.screenshot({path:path.join(SHOTS,`phone-page-strip-${engine}-${size}-${n}.png`)});
  const noErrors=()=>{ const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(errs,[],JSON.stringify(errs)); };
  const strip=()=>bf.evaluate(()=>{ const ps=document.getElementById('boardPageStrip'),st=document.getElementById('boardStage'),cs=e=>getComputedStyle(e);
    const r=e=>{ const b=e.getBoundingClientRect(); return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)]; };
    const shown=e=>cs(e).display!=='none'&&e.getBoundingClientRect().width>0;
    const at=e=>{ const b=e.getBoundingClientRect(),x=Math.min(Math.max(b.left+b.width/2,2),innerWidth-2),t=document.elementFromPoint(x,b.top+b.height/2); return !!t&&(t===e||e.contains(t)); };
    const kids=[...ps.children],tabs=[...ps.querySelectorAll('.bp-tab')],on=ps.querySelector('.bp-tab.on'),ob=on?on.getBoundingClientRect():null;
    return {multi:ps.classList.contains('bp-multi'),pos:cs(ps).position,z:cs(ps).zIndex,h:Math.round(ps.getBoundingClientRect().height),
      shown:kids.filter(shown).map(c=>c.id||String(c.className).split(' ')[0]),tabH:tabs.filter(shown).map(t=>Math.round(t.getBoundingClientRect().height)),
      bpx:[...ps.querySelectorAll('.bpx')].filter(shown).length,hitTabs:tabs.filter(t=>{ const b=t.getBoundingClientRect(); return b.right>4&&b.left<innerWidth-4; }).map(at),
      onIdx:tabs.indexOf(on),onIn:ob?(ob.left>=-1&&ob.right<=innerWidth+1):null,stage:r(st),docSW:document.documentElement.scrollWidth,vw:innerWidth,
      phoneWork:document.body.classList.contains('ps-phone-work'),has901:state.players.some(p=>p.id===901)}; });
  const addPage=n=>bf.evaluate(k=>{ const a=()=>[...document.querySelectorAll('#boardPageStrip .bp-add')].find(b=>/페이지/.test(b.textContent)); for(let i=0;i<k;i++)a().click(); },n);
  const dbl=()=>bf.evaluate(()=>{ const keep=window.psPrompt; let n=0; window.psPrompt=function(){ n++; };
    document.querySelector('#boardPageStrip .bp-tab.on').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true})); window.psPrompt=keep; return n; });
  const hold=async()=>{ await bf.evaluate(()=>{ const t=document.querySelector('#boardPageStrip .bp-tab.on'),b=t.getBoundingClientRect();
      t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:71,clientX:b.left+b.width/2,clientY:b.top+b.height/2})); });
    await page.waitForTimeout(380);
    return bf.evaluate(()=>{ const d=!!document.querySelector('#boardPageStrip .bp-tab.bp-dragging'),t=document.querySelector('#boardPageStrip .bp-tab.on'),b=t.getBoundingClientRect();
      document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:71,clientX:b.left+b.width/2,clientY:b.top+b.height/2}));
      document.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerType:'touch',pointerId:71})); return d; }); };
  // 1페이지에 표식 선수 하나 — 페이지가 정말 바뀌는지 본다
  await bf.evaluate(()=>{ state.players.push({id:901,team:'blue',num:9,x:300,y:300}); renderTokens(); try{ boardSaveLive(); }catch(_){} });

  if(size==='phone'){
    // ── ① 한 페이지: 지금 모습 그대로 — 고를 것이 없으니 띠를 올리지 않는다 ──
    const one=await strip(); console.log('phone one',JSON.stringify(one));
    assert.equal(one.phoneWork,true,'the shell marks the phone board');
    assert.equal(one.multi,false); assert.notEqual(one.z,'6'); assert.deepEqual(one.hitTabs,[false],'nothing to press with a single page');
    await shot('1-one-page');
    // ── ② 세 페이지: 띠가 올라와 페이지 고르개가 된다. 탭만 · 40px · 운동장은 그대로 ──
    await addPage(2); await page.waitForTimeout(600);
    const three=await strip(); console.log('phone three',JSON.stringify(three));
    assert.equal(three.multi,true); assert.equal(three.pos,'relative'); assert.equal(three.z,'6');
    assert.deepEqual(three.shown,['bp-tab','bp-tab','bp-tab'],'only the page tabs — a phone has no editing tools');
    assert.equal(three.bpx,0,'no rename · duplicate · delete handles');
    assert.ok(three.tabH.every(h=>h>=40),'40px touch targets: '+three.tabH);
    assert.deepEqual(three.hitTabs,[true,true,true],'every tab can be pressed');
    assert.deepEqual(three.stage,one.stage,'the pitch did not move'); assert.equal(three.h,one.h);
    assert.ok(three.docSW<=three.vw,'no sideways overflow'); assert.equal(three.onIdx,2); assert.equal(three.has901,false,'a new page starts empty');
    await shot('2-three-pages');
    // ── ③ 실제 손가락 탭으로 페이지가 바뀐다 ──
    await bf.locator('#boardPageStrip .bp-tab').nth(0).tap(); await page.waitForTimeout(500);
    let s=await strip(); assert.equal(s.onIdx,0); assert.equal(s.has901,true,'page 1 came back with its player');
    await bf.locator('#boardPageStrip .bp-tab').nth(1).tap(); await page.waitForTimeout(500);
    s=await strip(); assert.equal(s.onIdx,1); assert.equal(s.has901,false);
    // ── ④ 고르기만 한다 — 두 번 눌러 이름 바꾸기 · 꾹 눌러 순서 바꾸기는 쉰다 ──
    assert.equal(await dbl(),0,'no rename prompt on the phone');
    assert.equal(await hold(),false,'no reorder drag on the phone');
    // ── ⑤ 페이지가 많아도 지금 페이지가 화면 안에 있다 ──
    await addPage(5); await page.waitForTimeout(600);
    s=await strip(); console.log('phone eight',JSON.stringify(s));
    assert.equal(s.shown.length,8); assert.equal(s.onIdx,6,'a new page goes right after the current one (2 → 7)'); assert.equal(s.onIn,true,'the current tab is scrolled into view'); assert.ok(s.docSW<=s.vw);
    await bf.locator('#boardPageStrip .bp-tab').nth(4).tap(); await page.waitForTimeout(500);
    s=await strip(); assert.equal(s.onIdx,4); assert.equal(s.onIn,true); assert.deepEqual(s.stage,one.stage);
    await shot('3-many-pages');
    // ── ⑥ 보관함의 여러 페이지 작전판을 폰에서 «보기»로 열어도 넘길 수 있다 ──
    await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
    await bf.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:12000});
    await bf.evaluate(async()=>{ const lib=await libGet(),sn=x=>({players:[{id:1,team:'blue',num:8,x:x,y:300}],equipment:[],drawings:[],ball:null,pitchN:1});
      lib.unshift({libId:'VTESTPAGES',type:'board',name:'폰에서 넘겨 보는 작전판',folder:'',thumb:'',tags:[],savedAt:Date.now(),snap:sn(200),
        pages:[{name:'빌드업',snap:sn(200),thumb:''},{name:'전방 압박',snap:sn(600),thumb:''}]});
      await libWrite(lib); try{libTouch();}catch(_){} try{renderDrillFiles();}catch(_){} });
    await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes('폰에서 넘겨 보는 작전판')),null,{timeout:12000});
    await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('폰에서 넘겨 보는 작전판')); (c.querySelector('.vc-act.view')||[...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='보기')).click(); });
    await bf.waitForFunction(()=>window.__csView==='board'&&document.querySelectorAll('#boardPageStrip.on .bp-tab').length===2,null,{timeout:12000});
    await page.waitForTimeout(1200);
    const v=await strip(); console.log('phone vault view',JSON.stringify(v));
    assert.equal(v.multi,true); assert.equal(v.z,'6'); assert.deepEqual(v.shown,['bp-tab','bp-tab']); assert.deepEqual(v.hitTabs,[true,true]); assert.ok(v.docSW<=v.vw);
    assert.deepEqual(await bf.evaluate(()=>[...document.querySelectorAll('#boardPageStrip .bp-tab')].map(t=>t.textContent.replace(/[·\s]+$/,'').trim())),['빌드업','전방 압박']);
    await bf.locator('#boardPageStrip .bp-tab').nth(1).tap(); await page.waitForTimeout(600);
    assert.deepEqual(await bf.evaluate(()=>({on:[...document.querySelectorAll('#boardPageStrip .bp-tab')].findIndex(t=>t.classList.contains('on')),x:state.players[0].x})),{on:1,x:600});
    await shot('4-vault-view');
  }else{
    // ── 아이패드·데스크톱: 띠는 예전 그대로다(머리 · 손잡이 · ＋ 페이지 · 미팅 세트 · 보드 가져오기) ──
    await addPage(2); await page.waitForTimeout(600);
    const s=await strip(); console.log(size,JSON.stringify(s));
    assert.equal(s.phoneWork,false); assert.equal(s.multi,true); assert.notEqual(s.z,'6','the phone rule stays on the phone');
    assert.ok(s.shown.includes('bp-head'),'the head stays'); assert.ok(s.shown.filter(k=>k==='bp-add').length>=2,'＋ 페이지 · 미팅 세트 stay'); assert.ok(s.shown.includes('bpImportBoard'),'보드 가져오기 stays');
    assert.ok(s.bpx>=3,'rename · duplicate · menu handles stay: '+s.bpx); assert.equal(s.onIdx,2);
    assert.ok(s.hitTabs.every(Boolean),'tabs can be pressed');
    assert.equal(await dbl(),1,'double-click still renames');
    if(size==='ipad'){ assert.equal(await hold(),true,'a finger still reorders pages on the tablet'); await page.waitForTimeout(500); }   // 끌기를 놓은 뒤 0.4초는 띠가 클릭을 삼킨다(탭 전환 방지)
    await bf.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[0].click()); await page.waitForTimeout(500);
    const b=await strip(); assert.equal(b.onIdx,0); assert.equal(b.has901,true);
    await shot('1-unchanged');
  }
  noErrors();
}finally{ for(const b of Object.values(browsers))await b.close().catch(()=>{}); await fx.close(); }
}
