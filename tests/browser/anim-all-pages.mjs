import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.976 — 사용자 «페이지에 있는 애니메이션 내보내기 했을 때 한 파일로 전부 내보내기 · 페이지에 있는 애니메이션 한 파일로도 전부 내보내기»
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

  // 페이지 1 — 전체 운동장, 장면 둘(선수 하나가 움직인다)
  await bf.evaluate(()=>{ state.players=[{id:901,team:'blue',num:7,x:300,y:370}];renderTokens(); });
  await bf.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(300);
  await bf.evaluate(()=>{state.players[0].x=650;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click();});await page.waitForTimeout(400);
  // 페이지 2 — 장면 없는 판(움직일 것이 없어 고를 수 없다)
  await bf.evaluate(()=>[...document.querySelectorAll("#boardPageStrip .bp-add")].find(b=>/페이지/.test(b.textContent)).click());
  await page.waitForTimeout(400);
  await bf.evaluate(()=>{ state.players=[{id:905,team:"blue",num:9,x:500,y:300}];renderTokens(); });
  // 페이지 3 — 절반 운동장(화면이 달라야 한다), 같은 번호 선수가 다른 자리에서 장면 둘
  await bf.evaluate(()=>[...document.querySelectorAll("#boardPageStrip .bp-add")].find(b=>/페이지/.test(b.textContent)).click());
  await page.waitForTimeout(400);
  await bf.evaluate(()=>{ window.__setPitchView("half"); state.players=[{id:901,team:"blue",num:7,x:900,y:200},{id:902,team:"red",num:4,x:800,y:500}];renderTokens(); });
  await bf.evaluate(()=>document.getElementById("animAdd").click());await page.waitForTimeout(300);
  await bf.evaluate(()=>{state.players[0].x=1000;state.players[1].y=300;renderTokens();autoSaveAnimFrame();document.getElementById("animAdd").click();});await page.waitForTimeout(400);
  const before=await bf.evaluate(()=>({list:JSON.stringify(window.__psPages.exportList()),cur:JSON.stringify(anim.frames.map(f=>f.snap)),board:JSON.stringify(captureSnap().players)}));
  const pagesInfo=JSON.parse(before.list);
  const nF=pagesInfo.map(p=>p.frames.length); assert.ok(nF[0]>1&&nF[1]===0&&nF[2]>1,JSON.stringify(nF));

  // 저장 창 흉내 · 영상에 들어간 화면(viewBox) 기록
  await bf.evaluate(()=>{
    window.__ev={pick:0,write:0,anchor:0,name:"",size:0,type:"",vbs:[]};
    window.showSaveFilePicker=async o=>{ window.__ev.pick++; window.__ev.name=o.suggestedName;
      return {name:o.suggestedName,remove:async()=>{},createWritable:async()=>({write:async b=>{window.__ev.write++;window.__ev.size=b.size;window.__ev.type=b.type;},close:async()=>{}})}; };
    HTMLAnchorElement.prototype.click=function(){window.__ev.anchor++;};
    const bix=window.boardImageXML; window.boardImageXML=function(vb){ if(window.__animExport&&Array.isArray(vb))window.__ev.vbs.push(vb.map(v=>Math.round(v)).join(",")); return bix.apply(this,arguments); };
  });
  const openSheet=async()=>{ await bf.evaluate(()=>{document.getElementById("cmd-export-btn")?.click();document.getElementById("animExport").click();}); await bf.waitForSelector("#evSheet #evGo"); };
  const sheetInfo=()=>bf.evaluate(()=>{ const pl=document.getElementById("evPages");
    return {scope:[...document.querySelectorAll("#evSheet .ev-seg[data-key=\"scope\"] .ev-b")].map(b=>({t:b.textContent,on:b.classList.contains("on")})),
      desc:(document.getElementById("evDesc")||{}).textContent||"",listHidden:!pl||pl.hidden,head:(document.getElementById("evPickN")||{}).textContent||"",
      rows:pl?[...pl.querySelectorAll("label")].map(l=>({t:l.textContent,on:l.querySelector("input").checked,dis:l.querySelector("input").disabled})):[],
      go:document.getElementById("evGo").textContent,goDis:document.getElementById("evGo").disabled}; });
  const fps=15,perOf=p=>{ const h=p.hold>0?p.hold:.6, n=p.frames.length; let t=0;   /* 엔진과 같은 셈: 장면마다 머묾 + 장면 사이 이동, 마지막 장면은 1초 이상 */
    p.frames.forEach((f,k)=>{ const own=f.hold>0?f.hold:h; t+=Math.max(1,Math.round((k===n-1?Math.max(1,own):own)*fps));
      if(k<n-1)t+=Math.max(2,Math.round((Math.max(.3,f.dur||1)/((+f.moveSpeed>0)?+f.moveSpeed:1))*fps))+1; }); return t; };
  const perA=perOf(pagesInfo[0]),perC=perOf(pagesInfo[2]);
  const canVideo=await bf.evaluate(()=>typeof MediaRecorder!=="undefined"||(typeof VideoEncoder==="function"&&!(/^Apple/.test(navigator.vendor||"")&&!/Mac|iPhone|iPad|iPod/.test(navigator.platform||""))));
  const make=async()=>{ await bf.evaluate(()=>{const pick=t=>[...document.querySelectorAll("#evSheet .ev-b")].find(b=>b.textContent===t).click();pick("720p");pick("15fps");});
    await bf.evaluate(()=>{window.__ev.vbs=[];});
    await bf.locator("#evSheet #evGo").click();
    await bf.waitForFunction(()=>{const o=document.getElementById("psExpProg");return o&&o.className==="done";},null,{timeout:90000});
    const ev=await bf.evaluate(()=>({...window.__ev,vbs:window.__ev.vbs.slice()}));
    await bf.evaluate(()=>{const b=[...document.querySelectorAll("#psExpProg .pep-acts button")].find(x=>x.textContent==="닫기");if(b)b.click();});
    return ev; };

  // ① 시트: 범위 줄이 있고, 처음엔 «이 페이지»(예전 그대로) — 목록은 «여러 페이지»에서만
  await openSheet();
  let si=await sheetInfo();
  assert.deepEqual(si.scope.map(b=>b.t),["이 페이지","여러 페이지"]);
  assert.deepEqual(si.scope.map(b=>b.on),[true,false],"no remembered choice → this page");
  assert.ok(si.listHidden);assert.equal(si.go,"영상 만들기");
  await bf.evaluate(()=>[...document.querySelectorAll("#evSheet .ev-b")].find(b=>b.textContent==="여러 페이지").click());
  si=await sheetInfo();
  assert.deepEqual(si.scope.map(b=>b.on),[false,true]);assert.ok(!si.listHidden);
  assert.match(si.desc,/고른 페이지를 페이지 순서대로 한 파일에/);
  assert.equal(si.head,"내보낼 페이지 2 / 2","every animated page starts picked");
  assert.deepEqual(si.rows.map(r=>[r.on,r.dis]),[[true,false],[false,true],[true,false]],"a page with one scene cannot be picked");
  assert.match(si.rows[0].t,new RegExp("페이지 1.*장면 "+nF[0]));assert.match(si.rows[1].t,/장면 1개/);
  assert.equal(si.go,"영상 만들기 · 페이지 2개");
  // 다 빼면 만들 수 없다 → 다시 모두
  await bf.evaluate(()=>document.getElementById("evPickAll").click());
  si=await sheetInfo(); assert.equal(si.head,"내보낼 페이지 0 / 2");assert.ok(si.goDis);assert.equal(si.go,"페이지를 골라 주세요");
  await bf.evaluate(()=>document.getElementById("evPickAll").click());
  si=await sheetInfo(); assert.equal(si.head,"내보낼 페이지 2 / 2");assert.ok(!si.goDis);
  await page.waitForTimeout(300);   /* 단추 색 전환(.12s)이 끝난 뒤 */
  await page.screenshot({path:path.join(SHOTS,"anim-all-pages-sheet-"+size+".png")});

  if(canVideo){
    // ② 두 페이지 한 파일
    let ev=await make();
    assert.equal(ev.pick,1);assert.equal(ev.write,1);assert.equal(ev.anchor,0);
    assert.match(ev.name,/ - 모든 페이지\.(mp4|webm)$/,ev.name);
    assert.ok(ev.size>2000,"a real file "+ev.size);
    // 프레임 수 = 페이지마다 «처음 머묾 + 이동 + 마지막 머묾(1초 이상)» 의 합 — 페이지 사이 이동 장면은 없다
    const st0=Math.max(2,Math.round(Math.max(.3,pagesInfo[0].frames[1].dur||1)*fps));
    assert.equal(ev.vbs.length,perA+perC,"frames "+ev.vbs.length+" expected "+(perA+perC)+" (a moving page join would add "+(st0+1)+")");
    const vA=ev.vbs[0], vC=ev.vbs[ev.vbs.length-1];
    assert.notEqual(vA,vC,"each page is framed on its own (full vs half pitch)");
    assert.ok(ev.vbs.slice(0,perA).every(v=>v===vA)&&ev.vbs.slice(perA).every(v=>v===vC),"page 1 frames use page 1 view, page 3 frames page 3 view");
    const [,,wA,hA]=vA.split(",").map(Number),[,,wC,hC]=vC.split(",").map(Number);
    assert.ok(Math.abs(wA/hA-16/9)<0.02&&Math.abs(wC/hC-16/9)<0.02,"both 16:9");
    // 원본은 그대로 — 지금 페이지의 장면·판·모든 페이지 목록
    const after=await bf.evaluate(()=>({list:JSON.stringify(window.__psPages.exportList()),cur:JSON.stringify(anim.frames.map(f=>f.snap)),board:JSON.stringify(captureSnap().players),pv:state.pitchView}));
    assert.equal(after.cur,before.cur,"current page scenes untouched");
    assert.equal(after.board,before.board,"board back where it was");
    assert.equal(after.list,before.list,"every page untouched");
    assert.equal(after.pv,"half","this page board settings restored");
    // ③ 고른 범위를 기억한다 · 페이지 1 을 빼고 만들면 페이지 3 만
    await openSheet();
    si=await sheetInfo();
    assert.deepEqual(si.scope.map(b=>b.on),[false,true],"remembered «여러 페이지»");
    await bf.evaluate(()=>document.querySelector("#evPages input[data-pi=\"0\"]").click());
    si=await sheetInfo(); assert.equal(si.head,"내보낼 페이지 1 / 2");assert.equal(si.go,"영상 만들기 · 페이지 1개");
    ev=await make();
    assert.match(ev.name,/ - 페이지 3\.(mp4|webm)$/,ev.name);
    assert.equal(ev.vbs.length,perC,"only page 3");assert.ok(ev.vbs.every(v=>v===vC));
  } else console.log("영상 단계 건너뜀 — 이 브라우저는 영상을 만들 수 없다",engine);
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('anim-all-pages ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
