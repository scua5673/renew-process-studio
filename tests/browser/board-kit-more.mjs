import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.127 — 해외 구단 같은 유니폼(사용자 «해외리그 팀 유니폼 더 잘» → 시안 → «브랜드로고는 다 빼주고 미리보기부터» · «팀엠블럼도 빼줘»):
// 유니폼 꾸미기 «상의»에 소매 · 테두리 · 목깃(둥근 목 · V넥 · 카라), 무늬 넷(체크 · 가슴 띠 · 옅어지는 색 · 갈매기), 빠른 조합 20.
// 판의 원형 · 유니폼 토큰에 그대로(board-jersey.js), 가슴의 브랜드 같은 표시 · 팀 엠블럼은 없다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  // 3.101 — 판에 손대는 시험은 내 작업판을 다 불러온 뒤에
  await f.waitForFunction(()=>window.__psKitOpen&&window.__kitMore&&window.PSJersey&&window.kitSVGDef&&window.kitSVGDef.__psMore&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
  await page.waitForTimeout(500);
  await f.evaluate(()=>{
    state.teamColors={blue:'#1e5bc6',red:'#d71920'};state.teamColor2={blue:'#ffffff',red:'#ffffff'};state.teamPattern={blue:'solid',red:'solid'};state.teamKit={};
    state.players=[];const L=[[1,'GK',160,330],[4,'CB',300,250],[5,'CB',300,410],[8,'CM',420,330],[9,'ST',520,330]];
    L.forEach((r,i)=>{state.players.push({id:'b'+i,team:'blue',num:String(r[0]),pos:r[1],x:r[2],y:r[3]});state.players.push({id:'r'+i,team:'red',num:String(r[0]),pos:r[1],x:1110-r[2],y:r[3]});});
    setTokShape('circle');window.__setChip3d(false);renderTokens();});
  const tok=(id)=>f.evaluate(id=>{const g=document.querySelector('#tokenLayer [data-id="'+id+'"]'),j=g&&g.querySelector('.ps-jersey');if(!j)return null;
    const sh=g.querySelector('.tok-c').tagName.toLowerCase()==='path'?'s':'c',G=PSJersey.GEO[sh],C=PSJersey.COLLAR,ds=[...j.querySelectorAll('path')].map(p=>p.getAttribute('d'));
    const fillOf=d=>{const p=[...j.querySelectorAll('path')].find(x=>x.getAttribute('d')===d);return p&&p.getAttribute('fill');};
    return {sleeve:fillOf(G.sleeve),collar:fillOf(G.collar)||fillOf(C.v[sh].collar)||fillOf(C.polo[sh].flaps),v:ds.includes(C.v[sh].collar),polo:ds.includes(C.polo[sh].flaps),stripes:ds.includes(G.stripes),
      brand:ds.includes(G.brand)||ds.includes(G.crest),base:g.querySelector('.tok-c').getAttribute('fill'),rim:(j.lastElementChild||{}).getAttribute&&j.lastElementChild.getAttribute('stroke')};},id);

  // ① 빠른 조합 «빨강 몸통 · 흰 소매» → 팀 1(파랑 팀 칸)에 소매 · 테두리까지 한 번에
  await f.evaluate(()=>window.__psKitOpen({team:'blue',gk:false}));
  await f.waitForFunction(()=>document.getElementById('psKitEd')&&document.getElementById('psKitEd').classList.contains('on'));
  const ui=await f.evaluate(()=>({combos:document.querySelectorAll('#psKitEd [data-combo]').length,pats:[...document.querySelectorAll('#psKitEd [data-pat]')].map(b=>b.getAttribute('data-pat')),
    subs:[...document.querySelectorAll('#psKitEd .ke-sub [data-sub]')].map(b=>b.textContent.replace(/\s+/g,' ').trim()),cols:[...document.querySelectorAll('#psKitEd [data-collar]')].map(b=>b.textContent+(b.classList.contains('on')?'*':''))}));
  assert.equal(ui.combos,20);assert.deepEqual(ui.pats.slice(-4),['check','chest','fade','chev']);
  assert.deepEqual(ui.subs,['주색','보조색 무늬에','소매','테두리']);assert.deepEqual(ui.cols,['둥근 목*','V넥','카라']);
  await f.evaluate(()=>document.querySelector('#psKitEd [data-combo="0"]').click());
  let t=await tok('b3');
  assert.deepEqual(await f.evaluate(()=>state.teamKit.blue),{shorts:'#ffffff',socks:'#d71920',sleeve:'#ffffff',trim:'#ffffff'});
  assert.equal(t.sleeve,'#ffffff','흰 소매');assert.equal(t.stripes,false,'원형은 소매 줄을 뺀다');assert.equal(t.rim,'#2a3140','밝은 소매 · 자동 테두리 → 어두운 테두리');
  assert.equal(t.brand,false,'브랜드 같은 가슴 표시 · 팀 엠블럼 없음');
  await page.screenshot({path:path.join(SHOTS,'board-kit-more-editor-'+size+'.png')});

  // ② 팀 2 — 소매 · 테두리 · 목깃 · 새 무늬를 하나씩
  await f.evaluate(()=>window.__psKitOpen({team:'red',gk:false}));
  const pick=(sel)=>f.evaluate(sel=>document.querySelector(sel).click(),sel);
  await pick('#psKitEd .ke-sub [data-sub="sleeve"]');await pick('#psKitEd .ke-sw [data-c="#1a1a1a"]');
  await pick('#psKitEd .ke-sub [data-sub="trim"]');await pick('#psKitEd .ke-sw [data-c="#c8a24a"]');
  await pick('#psKitEd [data-collar="polo"]');
  await pick('#psKitEd .ke-sub [data-sub="main"]');await pick('#psKitEd [data-pat="check"]');
  assert.deepEqual(await f.evaluate(()=>state.teamKit.red),{sleeve:'#1a1a1a',trim:'#c8a24a',collar:'polo'});
  assert.equal(await f.evaluate(()=>state.teamPattern.red),'check');
  t=await tok('r3');
  assert.deepEqual([t.sleeve,t.collar,t.polo,t.brand],['#1a1a1a','#c8a24a',true,false]);assert.match(t.base,/^url\(#/,'체크 무늬 바탕');
  assert.ok(await f.evaluate(()=>{const id=document.querySelector('#tokenLayer [data-id="r3"] .tok-c').getAttribute('fill').slice(5,-1),d=document.getElementById(id);return !!d&&d.querySelectorAll('rect').length>=13;}),'체크 칸');
  assert.ok(await f.evaluate(()=>+document.querySelector('#tokenLayer [data-id="r3"] > text').getAttribute('stroke-width')>=1.5),'체크 위 번호 테두리를 진하게');
  // «자동»은 그 칸만 비운다 — 소매는 몸통과 같게
  await pick('#psKitEd .ke-sub [data-sub="sleeve"]');await pick('#psKitEd .ke-auto');
  assert.deepEqual(await f.evaluate(()=>state.teamKit.red),{trim:'#c8a24a',collar:'polo'});
  await pick('#psKitEd .ke-sub [data-sub="sleeve"]');await pick('#psKitEd .ke-sw [data-c="#1a1a1a"]');
  await page.screenshot({path:path.join(SHOTS,'board-kit-more-editor2-'+size+'.png')});
  const prev=await f.evaluate(()=>[...document.querySelectorAll('#psKitEd .ke-tok svg')].map(s=>({polo:[...s.querySelectorAll('path')].some(p=>p.getAttribute('d')===PSJersey.COLLAR.polo[s.parentNode.dataset.shape==='shirt'?'s':'c'].flaps),
    brand:[...s.querySelectorAll('path')].some(p=>{const G=PSJersey.GEO[s.parentNode.dataset.shape==='shirt'?'s':'c'];return p.getAttribute('d')===G.brand||p.getAttribute('d')===G.crest;})})));
  assert.deepEqual(prev,[{polo:true,brand:false},{polo:true,brand:false}],'창 안 토큰 미리보기도 같은 그림');
  await f.evaluate(()=>{const e=document.getElementById('psKitEd');e.classList.remove('on');});
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(SHOTS,'board-kit-more-circle-'+size+'.png')});

  // ③ 유니폼 모양 · V넥 · 새 무늬(가슴 띠) · 내보내기 · 저장 칸
  await f.evaluate(()=>{state.teamKit.blue.collar='v';state.teamPattern.blue='chest';state.teamColor2.blue='#ffffff';setTokShape('shirt');renderTokens();});
  t=await tok('b3');assert.equal(t.v,true,'V넥');assert.equal(t.brand,false);
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(SHOTS,'board-kit-more-shirt-'+size+'.png')});
  const xml=await f.evaluate(()=>{const s=boardImageXML().xml;return {brand:s.includes(PSJersey.GEO.s.brand)||s.includes(PSJersey.GEO.c.brand)||s.includes(PSJersey.GEO.s.crest)||s.includes(PSJersey.GEO.c.crest),polo:s.includes(PSJersey.COLLAR.polo.s.flaps),n:(s.match(/class="ps-jersey"/g)||[]).length};});
  assert.deepEqual(xml,{brand:false,polo:true,n:10},'내보내기도 같은 그림');
  const snap=await f.evaluate(()=>{const s=captureSnap();return {kit:s.teamKit,pat:s.teamPattern};});
  assert.deepEqual(snap.kit.red,{trim:'#c8a24a',collar:'polo',sleeve:'#1a1a1a'});assert.equal(snap.pat.red,'check');
  // 3D 칩 윗면에도 같은 유니폼(board-token-depth 가 .ps-jersey 를 복사)
  await f.evaluate(()=>window.__setTilt(true));await f.waitForFunction(()=>document.body.classList.contains('bc-tilt3d'));
  const d3=await f.evaluate(()=>{renderTokens();return document.querySelectorAll('#tokenLayer .ps-chip .ps-jersey').length;});
  assert.equal(d3,10,'칩 윗면');
  await f.evaluate(()=>window.__setTilt(false));

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,test:'board-kit-more',passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
