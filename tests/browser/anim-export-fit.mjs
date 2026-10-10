import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.988 — 영상 내보내기 «화면: 운동장 전체 | 훈련 구역». 구석의 작은 훈련을 화면 가득 담는다(운동장 전체 16:9 에서는 토큰이 점이었다).
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

  // 왼쪽 위 구석의 12m 론도 — 장면 둘. 공은 새 판의 기본 자리(한가운데)에서 안 움직인다.
  await bf.evaluate(()=>{ try{localStorage.removeItem('ps_anim_export_fit_v1');}catch(_){}
    state.players=[{id:901,team:'blue',num:7,x:200,y:160},{id:902,team:'blue',num:8,x:320,y:160},{id:903,team:'blue',num:6,x:320,y:280},{id:904,team:'red',num:'',x:260,y:220}];
    state.drawings=[{type:'rectline',color:'#ffffff',lw:1,op:1,pts:[{x:200,y:160},{x:320,y:280}]}];renderTokens();renderDrawings(); });
  await bf.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(300);
  await bf.evaluate(()=>{state.players[3].x=290;state.players[3].y=190;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click();});await page.waitForTimeout(400);
  const before=await bf.evaluate(()=>({n:anim.frames.length,cur:JSON.stringify(anim.frames.map(f=>f.snap.players)),ball:JSON.stringify(state.ball&&{x:state.ball.x,y:state.ball.y})}));
  assert.ok(before.n>=2,'scenes '+before.n);

  // 저장 창 흉내 · 영상에 들어간 화면(viewBox)·워터마크 글자 크기 기록
  await bf.evaluate(()=>{
    window.__ev={pick:0,write:0,blob:null,vbs:[],wm:[]};
    window.showSaveFilePicker=async o=>{ window.__ev.pick++;
      return {name:o.suggestedName,remove:async()=>{},createWritable:async()=>({write:async b=>{window.__ev.write++;window.__ev.blob=b;},close:async()=>{}})}; };
    const bix=window.boardImageXML; window.boardImageXML=function(vb){ const o=bix.apply(this,arguments);
      if(window.__animExport&&Array.isArray(vb)){ window.__ev.vbs.push(vb.map(v=>Math.round(v*10)/10).join(','));
        const m=/id="boardWatermarks"[\s\S]*?font-size="([\d.]+)"/.exec(o.xml); window.__ev.wm.push(m?+m[1]:null); }
      return o; };
  });
  const openSheet=async()=>{ await bf.evaluate(()=>{document.getElementById('cmd-export-btn')?.click();document.getElementById('animExport').click();}); await bf.waitForSelector('#evSheet #evGo'); };
  const sheetInfo=()=>bf.evaluate(()=>({fit:[...document.querySelectorAll('#evSheet .ev-seg[data-key="fit"] .ev-b')].map(b=>({t:b.textContent,on:b.classList.contains('on')})),desc:(document.getElementById('evDesc')||{}).textContent||''}));
  const canVideo=await bf.evaluate(()=>typeof MediaRecorder!=='undefined'||(typeof VideoEncoder==='function'&&!(/^Apple/.test(navigator.vendor||'')&&!/Mac|iPhone|iPad|iPod/.test(navigator.platform||''))));
  const make=async()=>{ await bf.evaluate(()=>{const pick=t=>[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent===t).click();pick('720p');pick('15fps');});
    await bf.evaluate(()=>{window.__ev.vbs=[];window.__ev.wm=[];window.__ev.blob=null;});
    await bf.locator('#evSheet #evGo').click();
    await bf.waitForFunction(()=>{const o=document.getElementById('psExpProg');return o&&o.className==='done';},null,{timeout:90000});
    const ev=await bf.evaluate(async()=>{ const e=window.__ev,out={pick:e.pick,write:e.write,vbs:e.vbs.slice(),wm:e.wm.slice(),size:e.blob?e.blob.size:0,type:e.blob?e.blob.type:'',vw:0,vh:0,flag:window.__psExportFit||0};
      if(e.blob&&/mp4|webm/.test(e.blob.type)){ try{ const v=document.createElement('video');v.muted=true;v.src=URL.createObjectURL(e.blob);
        await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(new Error('decode'));setTimeout(()=>rej(new Error('timeout')),6000);}); out.vw=v.videoWidth;out.vh=v.videoHeight; }catch(_){} }
      return out; });
    await bf.evaluate(()=>{const b=[...document.querySelectorAll('#psExpProg .pep-acts button')].find(x=>x.textContent==='닫기');if(b)b.click();});
    return ev; };

  // ① 시트: «화면» 줄이 있고 처음엔 «운동장 전체»(예전 그대로)
  await openSheet();
  let si=await sheetInfo();
  assert.deepEqual(si.fit.map(b=>b.t),['운동장 전체','훈련 구역']);
  assert.deepEqual(si.fit.map(b=>b.on),[true,false],'no remembered choice → the whole pitch');
  assert.match(si.desc,/16:9 · 운동장 가운데/);
  await bf.evaluate(()=>[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent==='훈련 구역').click());
  si=await sheetInfo();
  assert.deepEqual(si.fit.map(b=>b.on),[false,true]);
  assert.match(si.desc,/훈련 구역에 맞춘 화면/);
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(SHOTS,'anim-export-fit-sheet-'+size+'.png')});
  await bf.evaluate(()=>[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent==='운동장 전체').click());

  if(canVideo){
    // ② 운동장 전체 — 16:9, 화면 폭은 운동장 길이보다 넓다
    let ev=await make();
    assert.equal(ev.write,1);assert.ok(ev.size>2000,'a real file '+ev.size);
    const full=ev.vbs[0].split(',').map(Number);
    assert.ok(ev.vbs.every(v=>v===ev.vbs[0]),'one view for the whole video');
    assert.ok(full[2]>1100&&Math.abs(full[2]/full[3]-16/9)<0.02,'whole pitch 16:9: '+ev.vbs[0]);
    assert.ok(ev.wm.every(f=>f===9),'watermark at its usual size: '+ev.wm[0]);
    // ③ 훈련 구역 — 론도만 크게. 한가운데의 기본 공은 세지 않는다
    await openSheet();
    await bf.evaluate(()=>[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent==='훈련 구역').click());
    ev=await make();
    const fit=ev.vbs[0].split(',').map(Number);
    assert.ok(ev.vbs.every(v=>v===ev.vbs[0]),'one view for the whole video');
    assert.ok(fit[2]<420&&fit[3]<420,'the view is a fraction of the pitch: '+ev.vbs[0]);
    assert.ok(fit[0]<=180&&fit[0]+fit[2]>=340&&fit[1]<=140&&fit[1]+fit[3]>=300,'every token and the square are inside: '+ev.vbs[0]);
    assert.ok(fit[0]+fit[2]<555,'the untouched centre ball is left out: '+ev.vbs[0]);
    assert.ok([16/9,4/3,1,3/4].some(a=>Math.abs(fit[2]/fit[3]-a)<0.01),'a standard ratio: '+(fit[2]/fit[3]));
    assert.ok(Math.abs(fit[2]/fit[3]-1)<0.01,'a square area gets a square picture');
    assert.ok(ev.wm.every(f=>f>0&&f<4),'watermark scaled with the picture: '+ev.wm[0]);
    assert.equal(ev.flag,0,'the flag is cleared after the export');
    if(ev.vw)assert.deepEqual([ev.vw,ev.vh],[720,720],'720p square video');
    // 원본은 그대로
    const after=await bf.evaluate(()=>({cur:JSON.stringify(anim.frames.map(f=>f.snap.players)),ball:JSON.stringify(state.ball&&{x:state.ball.x,y:state.ball.y}),pref:localStorage.getItem('ps_anim_export_fit_v1')}));
    assert.equal(after.cur,before.cur,'scenes untouched');assert.equal(after.ball,before.ball,'board back where it was');
    assert.equal(after.pref,'1','remembered on this device');
    // ④ 다음에 열면 «훈련 구역»이 골라져 있다
    await openSheet();
    si=await sheetInfo();
    assert.deepEqual(si.fit.map(b=>b.on),[false,true],'remembered «훈련 구역»');
    await bf.evaluate(()=>document.getElementById('evCancel').click());
  } else console.log('영상 단계 건너뜀 — 이 브라우저는 영상을 만들 수 없다',engine);
  await bf.evaluate(()=>{ try{localStorage.removeItem('ps_anim_export_fit_v1');}catch(_){} });
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('anim-export-fit ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
