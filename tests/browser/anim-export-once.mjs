import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.974 — 사용자 «보관함에 작전판 만들고 애니메이션 만들고 MP4 내보내기 했을 때 (맥에서) 저장 창이 두 번»
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
  // 크롬처럼: 저장 창이 떠 있는 동안 또 부르면 «File picker already active» 로 거절. 창은 0.4초 뒤 «저장»
  await bf.evaluate(()=>{
    window.__ev={pick:0,reject:0,write:0,anchor:0,makes:0,mode:'ok'};let open=false;
    window.showSaveFilePicker=async o=>{ if(open){window.__ev.reject++;const e=new Error('File picker already active.');e.name='NotAllowedError';throw e;}
      open=true;window.__ev.pick++;await new Promise(r=>setTimeout(r,400));open=false;
      return {name:o.suggestedName,remove:async()=>{},createWritable:async()=>{ if(window.__ev.mode==='fail'){const e=new Error('denied');e.name='NotAllowedError';throw e;}
        return {write:async()=>{window.__ev.write++;},close:async()=>{}}; }}; };
    HTMLAnchorElement.prototype.click=function(){window.__ev.anchor++;};
    let last='';setInterval(()=>{const o=document.getElementById('psExpProg'),c=o?o.className:'';if(c!==last){if(c==='make')window.__ev.makes++;last=c;}},20);
    state.players=[{id:901,team:'blue',num:7,x:300,y:370}];renderTokens();
  });
  await bf.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(300);
  await bf.evaluate(()=>{state.players[0].x=650;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click();});await page.waitForTimeout(400);
  const card=()=>bf.evaluate(()=>{const o=document.getElementById('psExpProg');return o?{cls:o.className,t:o.querySelector('.pep-t').textContent,btn:[...o.querySelectorAll('.pep-acts button')].map(b=>b.textContent)}:null;});
  const sheet=async()=>{ await bf.evaluate(()=>{document.getElementById('cmd-export-btn')?.click();document.getElementById('animExport').click();});
    await bf.waitForSelector('#evSheet #evGo');
    await bf.evaluate(()=>{const pick=t=>[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent===t).click();pick('720p');pick('15fps');}); };

  // 영상을 만들 수 없는 브라우저(CI 의 리눅스 웹킷 — MediaRecorder 없음, 웹코덱은 앱이 끈다)에선 ①② 를 건너뛰고 GIF ③ 만 본다
  const canVideo=await bf.evaluate(()=>typeof MediaRecorder!=='undefined'||(typeof VideoEncoder==='function'&&!(/^Apple/.test(navigator.vendor||'')&&!/Mac|iPhone|iPad|iPod/.test(navigator.platform||''))));
  let ev;
  if(canVideo){
  // ① «영상 만들기» 더블클릭 — 저장 창 1번 · 만들기 1번 · 내려받기 0번
  await sheet();
  await bf.locator('#evSheet #evGo').dblclick();
  await bf.evaluate(()=>{const g=document.querySelector('#evSheet #evGo');if(g)g.click();});   /* 세 번째도 */
  await bf.waitForFunction(()=>{const o=document.getElementById('psExpProg');return o&&o.className==='done';},null,{timeout:60000});
  await page.waitForTimeout(800);
  ev=await bf.evaluate(()=>({...window.__ev}));
  assert.deepEqual({pick:ev.pick,reject:ev.reject,write:ev.write,anchor:ev.anchor,makes:ev.makes},{pick:1,reject:0,write:1,anchor:0,makes:1},JSON.stringify(ev));
  assert.match((await card()).t,/MP4 저장됨 ✓|WebM 저장됨 ✓/);
  await bf.evaluate(()=>{const b=[...document.querySelectorAll('#psExpProg .pep-acts button')].find(x=>x.textContent==='닫기');if(b)b.click();});

  // ② 고른 파일에 쓰기 실패 — 말없이 내려받지 않고 카드가 «내려받기»를 묻는다
  await bf.evaluate(()=>{Object.assign(window.__ev,{pick:0,write:0,anchor:0,makes:0,mode:'fail'});});
  await sheet();await bf.locator('#evSheet #evGo').click();
  await bf.waitForFunction(()=>{const o=document.getElementById('psExpProg');return o&&o.className==='warn';},null,{timeout:60000});
  const warn=await card();
  assert.equal(warn.t,'고른 폴더에 저장하지 못했어요');assert.deepEqual(warn.btn,['내려받기','닫기']);
  assert.equal(await bf.evaluate(()=>window.__ev.anchor),0,'저장 창이 또 뜨지 않게 — 누를 때만 받는다');
  await page.screenshot({path:path.join(SHOTS,'anim-export-once-warn-'+size+'.png')});
  await bf.evaluate(()=>[...document.querySelectorAll('#psExpProg .pep-acts button')].find(x=>x.textContent==='내려받기').click());
  assert.equal(await bf.evaluate(()=>window.__ev.anchor),1);
  assert.equal((await card()).t,'내려받았어요 ✓');
  await bf.evaluate(()=>{const b=[...document.querySelectorAll('#psExpProg .pep-acts button')].find(x=>x.textContent==='닫기');if(b)b.click();});

  } else console.log('영상 단계 건너뜀 — 이 브라우저는 영상을 만들 수 없다',engine);
  // ③ GIF 를 빠르게 두 번 — 저장 창 1번
  await bf.evaluate(()=>{Object.assign(window.__ev,{pick:0,reject:0,write:0,anchor:0,makes:0,mode:'ok'});});
  await bf.evaluate(()=>{const g=document.getElementById('animGif');g.click();g.click();});
  await bf.waitForFunction(()=>{const o=document.getElementById('psExpProg');return o&&o.className==='done';},null,{timeout:60000});
  ev=await bf.evaluate(()=>({...window.__ev}));
  assert.deepEqual({pick:ev.pick,reject:ev.reject,write:ev.write,anchor:ev.anchor},{pick:1,reject:0,write:1,anchor:0},'GIF '+JSON.stringify(ev));
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('anim-export-once ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
