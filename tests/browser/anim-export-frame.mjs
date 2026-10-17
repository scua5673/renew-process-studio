import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 오류 제보 8e143f85 «영상 내보내기 시, 운동장의 위치가 조금씩 다름» — «운동장 전체» 영상은 운동장만 보고 화면을 정한다:
//   판 밖 선수·그림, 창 크기, 페이지가 달라도 운동장 자리·크기가 같다(예전엔 판 밖 내용만큼 화면이 넓어져 운동장이 작아졌다).
// 오류 제보 178c465c — 여러 페이지 영상에서 페이지 이름 아래 자막을 «넣지 않기»로 끌 수 있고, 이 기기에 기억한다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&document.getElementById('dfNew'));
  await bf.evaluate(()=>document.getElementById('dfNew').click());
  await bf.waitForSelector('.vcc-item');
  await bf.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/작전판/.test(b.textContent)).click());
  await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultPending,null,{timeout:10000});
  await page.waitForTimeout(600);
  await bf.evaluate(()=>{ try{localStorage.removeItem('ps_anim_export_pgcap_v1');localStorage.removeItem('ps_anim_export_fit_v1');localStorage.removeItem('ps_anim_export_scope_v1');}catch(_){} });

  // 장면 둘(선수가 오른쪽으로) — 페이지 1 은 운동장 안, 페이지 2 는 터치라인 밖 선수 + 판 밖으로 나가는 화살표
  const scenes=async(players,drawings)=>{
    await bf.evaluate(([p,d])=>{ state.players=p; state.drawings=d||[]; renderTokens(); renderDrawings(); },[players,drawings]);
    await bf.evaluate(()=>document.getElementById('animAdd').click()); await page.waitForTimeout(300);
    await bf.evaluate(()=>{ state.players.forEach(p=>{p.x+=80;}); renderTokens(); autoSaveAnimFrame(); document.getElementById('animAdd').click(); }); await page.waitForTimeout(400);
  };
  await scenes([{id:901,team:'blue',num:7,x:300,y:370},{id:902,team:'red',num:4,x:600,y:250}]);
  await bf.evaluate(()=>[...document.querySelectorAll('#boardPageStrip .bp-add')].find(b=>/페이지/.test(b.textContent)).click());
  await page.waitForTimeout(400);
  await scenes([{id:901,team:'blue',num:7,x:300,y:700},{id:903,team:'blue',num:12,x:250,y:790},{id:904,team:'blue',num:14,x:330,y:790}],
    [{id:9901,type:'arrow',color:'#ffffff',lw:2,pts:[{x:500,y:600},{x:520,y:780}]}]);
  const names=await bf.evaluate(()=>window.__psPages.exportList().filter(p=>p.frames.length>1).map(p=>p.name));
  assert.equal(names.length,2,JSON.stringify(names));

  // 저장 창 흉내 · 영상에 들어간 화면(viewBox) · 캔버스에 쓴 글자(자막) 기록
  await bf.evaluate(()=>{
    window.__ev={vbs:[],texts:[],write:0};
    window.showSaveFilePicker=async o=>({name:o.suggestedName,remove:async()=>{},createWritable:async()=>({write:async()=>{window.__ev.write++;},close:async()=>{}})});
    const bix=window.boardImageXML; window.boardImageXML=function(vb){ if(window.__animExport&&Array.isArray(vb))window.__ev.vbs.push(vb.map(v=>Math.round(v*10)/10).join(',')); return bix.apply(this,arguments); };
    const ft=CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText=function(t){ if(window.__animExport)window.__ev.texts.push(String(t)); return ft.apply(this,arguments); };
  });
  const canVideo=await bf.evaluate(()=>typeof MediaRecorder!=='undefined'||(typeof VideoEncoder==='function'&&!(/^Apple/.test(navigator.vendor||'')&&!/Mac|iPhone|iPad|iPod/.test(navigator.platform||''))));
  const pick=t=>bf.evaluate(t=>[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent===t).click(),t);
  const openSheet=async()=>{ await bf.evaluate(()=>{document.getElementById('cmd-export-btn')?.click();document.getElementById('animExport').click();}); await bf.waitForSelector('#evSheet #evGo'); };
  const capRow=()=>bf.evaluate(()=>{ const r=document.getElementById('evCapRow'); return r?{hidden:r.hidden,btn:[...r.querySelectorAll('.ev-b')].map(b=>({t:b.textContent,on:b.classList.contains('on')})),desc:document.getElementById('evDesc').textContent}:null; });
  const make=async(choose)=>{ await openSheet(); for(const t of choose)await pick(t); await pick('720p'); await pick('15fps');
    await bf.evaluate(()=>{window.__ev.vbs=[];window.__ev.texts=[];});
    await bf.locator('#evSheet #evGo').click();
    await bf.waitForFunction(()=>{const o=document.getElementById('psExpProg');return o&&o.className==='done';},null,{timeout:90000});
    const ev=await bf.evaluate(()=>({vbs:window.__ev.vbs.slice(),texts:window.__ev.texts.slice()}));
    await bf.evaluate(()=>{const b=[...document.querySelectorAll('#psExpProg .pep-acts button')].find(x=>x.textContent==='닫기');if(b)b.click();});
    return ev; };
  const pitchOK=(v,msg)=>{ const [x,y,w,h]=v.split(',').map(Number);
    assert.ok(Math.abs(w/h-16/9)<0.01,msg+' 16:9 '+v); assert.ok(Math.abs(x+w/2-555)<0.5&&Math.abs(y+h/2-370)<0.5,msg+' pitch centred '+v);
    assert.ok(Math.abs(h-740)<0.5,msg+' 3m of grass beside the touchlines, not more '+v); };

  // ① 시트: «여러 페이지»에서만 «자막» 줄 — 처음엔 «페이지 이름»(예전 그대로)
  await openSheet();
  let cr=await capRow();
  assert.ok(cr,'caption row exists on a multi-page board');
  assert.equal(cr.hidden,true,'hidden while «이 페이지» is chosen');
  await pick('여러 페이지'); cr=await capRow();
  assert.equal(cr.hidden,false);
  assert.deepEqual(cr.btn,[{t:'페이지 이름',on:true},{t:'넣지 않기',on:false}],'names on by default');
  assert.match(cr.desc,/페이지 이름이 아래 자막으로/);
  await pick('넣지 않기'); cr=await capRow();
  assert.match(cr.desc,/페이지 이름 자막은 넣지 않습니다/,'the description follows the choice');
  await bf.evaluate(()=>document.getElementById('evCancel').click());

  if(canVideo){
    // ② 여러 페이지 · 이름 자막 넣기 — 두 페이지 모두 같은 운동장 화면, 자막에 페이지 이름
    const a=await make(['여러 페이지','페이지 이름']);
    const va=[...new Set(a.vbs)];
    assert.equal(va.length,1,'one pitch view for both pages (the touchline bench and the arrow do not widen page 2): '+JSON.stringify(va));
    pitchOK(va[0],'page view');
    names.forEach(n=>assert.ok(a.texts.includes(n),'page name «'+n+'» captioned: '+JSON.stringify([...new Set(a.texts)])));
    // ③ 창을 키운 뒤(제보한 화면 1928×1377) · 이름 자막 넣지 않기 — 같은 화면, 페이지 이름 없음
    await page.setViewportSize({width:1928,height:1377}); await page.waitForTimeout(900);
    const live1=await bf.evaluate(()=>document.getElementById('board').getAttribute('viewBox'));
    const b=await make(['여러 페이지','넣지 않기']);
    assert.deepEqual([...new Set(b.vbs)],va,'same pitch placement in a bigger window');
    names.forEach(n=>assert.ok(!b.texts.includes(n),'no «'+n+'» caption: '+JSON.stringify([...new Set(b.texts)])));
    assert.ok(!b.texts.some(t=>/^\d+\/\d+$/.test(t)),'no caption bar at all (no badge) when scenes have no caption');
    assert.equal(await bf.evaluate(()=>localStorage.getItem('ps_anim_export_pgcap_v1')),'0','remembered on this device');
    // ④ 작은 창 · 이 페이지만 — 그래도 같은 화면
    await page.setViewportSize({width:900,height:640}); await page.waitForTimeout(900);
    const live2=await bf.evaluate(()=>document.getElementById('board').getAttribute('viewBox'));
    assert.notEqual(live1,live2,'the on-screen board really changed shape');
    const c=await make(['이 페이지']);
    assert.deepEqual([...new Set(c.vbs)],va,'same pitch placement in a small window, single page');
    // ⑤ 다음에 열면 «넣지 않기»가 골라져 있다
    await openSheet(); await pick('여러 페이지'); cr=await capRow();
    assert.deepEqual(cr.btn.map(x=>x.on),[false,true],'remembered «넣지 않기»');
    await bf.evaluate(()=>document.getElementById('evCancel').click());
    console.log(JSON.stringify({view:va[0],texts:[...new Set(a.texts)].slice(0,6)}));
  } else console.log('영상 단계 건너뜀 — 이 브라우저는 영상을 만들 수 없다',engine);
  await bf.evaluate(()=>{ try{localStorage.removeItem('ps_anim_export_pgcap_v1');}catch(_){} });
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('anim-export-frame ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
