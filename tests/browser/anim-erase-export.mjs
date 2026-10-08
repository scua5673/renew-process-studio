import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.969 — 오류 제보 bd3caa77 «애니메이션에서 그렸다가 지웠는데 지워지지 않아요» + «애니메이션 내보내기를 원하는 폴더에».
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof state==='object'&&typeof anim==='object'&&document.getElementById('animAdd'));
  const box=await (await page.$('#fBoard')).boundingBox();
  /* 판 좌표 → 화면 좌표(세로 판·확대와 상관없이) */
  const U=async(x,y)=>{const c=await bf.evaluate(([x,y])=>{const s=document.getElementById('board'),m=document.getElementById('world').getScreenCTM(),p=s.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(m);return {x:q.x,y:q.y};},[x,y]);return {x:box.x+c.x,y:box.y+c.y};};
  const tool=t=>bf.evaluate(t=>{document.querySelector('#toolSeg [data-tool="'+t+'"]').click();return state.tool;},t);
  const stroke=async(a,b)=>{const p=await U(...a),q=await U(...b);await page.mouse.move(p.x,p.y);await page.mouse.down();for(let i=1;i<=10;i++)await page.mouse.move(p.x+(q.x-p.x)*i/10,p.y+(q.y-p.y)*i/10);await page.mouse.up();await page.waitForTimeout(250);};
  const reset=()=>bf.evaluate(()=>{state.players=[];state.drawings=[];anim.frames=[];animActive=-1;renderTokens();renderDrawings();renderAnimFrames();});

  // 1) 선수 동선 위에 그린 화살표 — 가운데를 지우개로 누르면 지워진다(곡선 손잡이가 가로채지 않는다)
  await reset();
  await bf.evaluate(()=>{state.players=[{id:901,team:'blue',num:7,x:300,y:370}];renderTokens();});
  await bf.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(400);
  await bf.evaluate(()=>{state.players[0].x=600;renderTokens();autoSaveAnimFrame();updateMotionPaths();});
  await bf.evaluate(()=>document.querySelectorAll('#animFrames .anim-frame')[0].click());await page.waitForTimeout(300);
  assert.ok(await bf.evaluate(()=>!!document.querySelector('#pathLayer .mp-handle')),'선수 동선과 곡선 손잡이가 보인다');
  await tool('run');await stroke([330,370],[570,370]);
  assert.equal(await bf.evaluate(()=>state.drawings.length),1);
  await tool('eraser');
  const mid=await U(450,370);
  assert.equal(await bf.evaluate(([x,y])=>!!document.elementFromPoint(x,y).closest('#drawLayer'),[mid.x-box.x,mid.y-box.y]),true,'지우개 모드에선 손잡이 아래 그림이 잡힌다');
  await page.mouse.click(mid.x,mid.y);await page.waitForTimeout(300);
  assert.equal(await bf.evaluate(()=>state.drawings.length),0,'화살표 가운데를 눌러 지워진다');
  await tool('move');
  assert.equal(await bf.evaluate(([x,y])=>!!document.elementFromPoint(x,y).closest('.mp-handle'),[mid.x-box.x,mid.y-box.y]),true,'이동 도구에선 손잡이를 그대로 끈다');

  // 2) 그리고 바로 «장면 추가» — 그린 것이 지금 장면에 남는다(훈련 편집기: 자동 저장 0.6초보다 빨리 눌러도)
  await reset();
  await bf.evaluate(()=>{try{setView('session');}catch(_){}openEditor(null,'train');});
  await bf.waitForFunction(()=>document.body.classList.contains('editing'));await page.waitForTimeout(500);
  await bf.evaluate(()=>{anim.frames=[];animActive=-1;renderAnimFrames();});
  await bf.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(150);
  await tool('pass');await stroke([250,240],[450,240]);
  await bf.evaluate(()=>document.getElementById('animAdd').click());   /* 그린 직후 바로 */
  await page.waitForTimeout(150);
  assert.deepEqual(await bf.evaluate(()=>anim.frames.map(f=>(f.snap.drawings||[]).length)),[0,1,1],'장면 2 에도 화살표가 남는다');
  await tool('pass');await stroke([250,480],[450,480]);
  await bf.evaluate(()=>document.querySelectorAll('#animFrames .anim-frame')[1].click());   /* 그린 직후 다른 장면으로 */
  await page.waitForTimeout(150);
  assert.deepEqual(await bf.evaluate(()=>anim.frames.map(f=>(f.snap.drawings||[]).length)),[0,1,2],'장면 3 에 방금 그린 화살표가 남는다');
  await bf.evaluate(()=>{try{closeEditor(false);}catch(_){}});await page.waitForTimeout(400);
  await page.evaluate(()=>{const b=document.querySelector('#appSeg button[data-app="board"]');if(b)b.click();});await page.waitForTimeout(600);

  // 3) GIF 내보내기 — 누르는 순간 저장 창(고른 폴더·파일에 쓴다) · 취소하면 만들지 않는다 · 안 되는 브라우저는 내려받기
  await reset();
  const pepLog=()=>bf.evaluate(()=>{window.__pepLog=[];if(window.__pepMo)window.__pepMo.disconnect();window.__pepMo=new MutationObserver(()=>{const o=document.getElementById('psExpProg');if(o)window.__pepLog.push(o.className+':'+o.querySelector('.pep-pct').textContent);});window.__pepMo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});});
  const pepCard=()=>bf.evaluate(()=>{const o=document.getElementById('psExpProg');return o?{cls:o.className,t:o.querySelector('.pep-t').textContent,sub:o.querySelector('.pep-sub').textContent,pct:o.querySelector('.pep-pct').textContent,btn:[...o.querySelectorAll('.pep-acts button')].map(b=>b.textContent)}:null;});
  const pepClose=()=>bf.evaluate(()=>{const b=[...document.querySelectorAll('#psExpProg .pep-acts button')].find(x=>x.textContent==='닫기');if(b)b.click();});
  
  await bf.evaluate(()=>{state.players=[{id:902,team:'blue',num:9,x:300,y:300}];renderTokens();document.getElementById('animAdd').click();state.players[0].x=520;renderTokens();autoSaveAnimFrame();});
  await bf.evaluate(()=>{window.__dl=[];HTMLAnchorElement.prototype.click=function(){window.__dl.push(this.download||'');};
    window.showSaveFilePicker=async o=>{window.__pick=o;return {name:'코너킥 수비.gif',createWritable:async()=>({write:async b=>{window.__wrote=b.size;},close:async()=>{window.__closed=1;}})};};});
  await pepLog();
  await bf.evaluate(()=>document.getElementById('animGif').click());
  await bf.waitForFunction(()=>window.__closed===1,null,{timeout:60000});
  /* 2.972 — 진행 카드: 퍼센트가 차오르고(줄지 않는다) → 저장하는 중 → 저장됨 ✓ 고른 파일 이름 */
  await bf.waitForFunction(()=>/저장됨/.test((document.querySelector('#psExpProg .pep-t')||{}).textContent||''),null,{timeout:15000});
  { const lg=await bf.evaluate(()=>window.__pepLog.slice()),mk=lg.filter(x=>/^make:/.test(x)).map(x=>parseInt(x.split(':')[1],10)),c=await pepCard();
    assert.ok(mk.some(v=>v>0&&v<100),'만드는 동안 퍼센트가 보인다 '+JSON.stringify(lg.slice(0,12)));
    assert.ok(mk.every((v,i)=>i===0||v>=mk[i-1]),'퍼센트는 줄지 않는다 '+JSON.stringify(mk));
    assert.ok(lg.some(x=>/^save:/.test(x)),'저장하는 중 단계가 있다');
    assert.deepEqual([c.cls,c.t,c.pct],['done','GIF 저장됨 ✓','100%']);assert.match(c.sub,/코너킥 수비\.gif/);
    await pepClose(); }
  const pick=await bf.evaluate(()=>({n:window.__pick.suggestedName,id:window.__pick.id,acc:Object.keys(window.__pick.types[0].accept),wrote:window.__wrote,dl:window.__dl.length}));
  assert.deepEqual([pick.n,pick.id,pick.acc[0]],['작전판_애니메이션.gif','ps-anim-export','image/gif']);
  assert.ok(pick.wrote>1000,'GIF 바이트를 고른 파일에 썼다 '+pick.wrote);assert.equal(pick.dl,0,'내려받기는 하지 않는다');
  // 취소
  await bf.evaluate(()=>{window.__closed=0;window.showSaveFilePicker=async()=>{const e=new Error('c');e.name='AbortError';throw e;};});
  await bf.evaluate(()=>document.getElementById('animGif').click());await page.waitForTimeout(800);
  assert.deepEqual(await bf.evaluate(()=>[window.__animExport||0,window.__dl.length,window.__closed]),[0,0,0],'취소하면 아무것도 만들지 않는다');
  // 안 되는 데스크톱 브라우저(맥 사파리·파이어폭스) — 예전처럼 내려받기
  await bf.evaluate(()=>{window.showSaveFilePicker=undefined;Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get:()=>0});});
  await bf.evaluate(()=>document.getElementById('animGif').click());
  await bf.waitForFunction(()=>window.__dl.length>0,null,{timeout:60000});
  assert.deepEqual(await bf.evaluate(()=>window.__dl),['작전판_애니메이션.gif']);
  await bf.waitForFunction(()=>/저장됨/.test((document.querySelector('#psExpProg .pep-t')||{}).textContent||''),null,{timeout:15000});
  assert.match((await pepCard()).sub,/다운로드 폴더/);await pepClose();
  // 2.972 — 아이폰·아이패드(저장 창 없음): 다 만든 뒤 «파일에 저장»(공유 시트 → 폴더 고르기) · «내려받기» · «닫기»
  await bf.evaluate(()=>{window.__dl=[];window.__shared=null;Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get:()=>5});
    Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=>'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
    navigator.canShare=()=>true;navigator.share=async d=>{window.__shared=d.files.map(x=>x.name+':'+x.type);};});
  await bf.evaluate(()=>document.getElementById('animGif').click());
  await bf.waitForFunction(()=>(document.querySelector('#psExpProg .pep-t')||{}).textContent==='다 만들었어요',null,{timeout:60000});
  assert.deepEqual((await pepCard()).btn,['파일에 저장','내려받기','닫기']);assert.equal(await bf.evaluate(()=>window.__dl.length),0,'묻기 전엔 내려받지 않는다');
  await bf.evaluate(()=>[...document.querySelectorAll('#psExpProg .pep-acts button')].find(b=>b.textContent==='파일에 저장').click());
  await bf.waitForFunction(()=>window.__shared,null,{timeout:10000});
  assert.deepEqual(await bf.evaluate(()=>window.__shared),['작전판_애니메이션.gif:image/gif']);
  await bf.waitForFunction(()=>/저장했어요/.test((document.querySelector('#psExpProg .pep-t')||{}).textContent||''),null,{timeout:10000});
  await pepClose();
  await bf.evaluate(()=>{delete navigator.maxTouchPoints;delete navigator.userAgent;delete navigator.canShare;delete navigator.share;});

  // 4) 영상 시트 — «영상 만들기»를 누른 순간 저장 창, 취소하면 시트가 그대로 남는다
  await bf.evaluate(()=>{window.showSaveFilePicker=async()=>{const e=new Error('c');e.name='AbortError';throw e;};});
  await bf.evaluate(()=>document.getElementById('animExport').click());
  await bf.waitForSelector('#evSheet #evGo');
  await bf.evaluate(()=>document.querySelector('#evSheet #evGo').click());await page.waitForTimeout(500);
  assert.equal(await bf.evaluate(()=>!!document.getElementById('evSheet')&&!window.__animExport),true,'취소하면 시트가 남고 영상은 만들지 않는다');
  if(engine==='chromium'){
    await bf.evaluate(()=>{window.__closed=0;window.showSaveFilePicker=async o=>{window.__pick=o;return {name:'빌드업.mp4',createWritable:async()=>({write:async b=>{window.__wrote=b.size;},close:async()=>{window.__closed=1;}})};};
      [...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent==='720p').click();[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent==='15fps').click();
      document.querySelector('#evSheet #evGo').click();});
    await bf.waitForFunction(()=>window.__closed===1,null,{timeout:90000});
    const v=await bf.evaluate(()=>({acc:Object.keys(window.__pick.types[0].accept)[0],n:window.__pick.suggestedName,wrote:window.__wrote,sheet:!!document.getElementById('evSheet')}));
    assert.ok(/^video\//.test(v.acc)&&/^작전판_애니메이션\.(mp4|webm)$/.test(v.n),JSON.stringify(v));
    assert.ok(v.wrote>1000&&!v.sheet,JSON.stringify(v));
    await bf.waitForFunction(()=>/MP4 저장됨|WebM 저장됨/.test((document.querySelector('#psExpProg .pep-t')||{}).textContent||''),null,{timeout:15000});
    assert.match((await pepCard()).sub,/빌드업\.mp4/);await pepClose();
    /* 2.972 — «멈추기»: 녹화를 끊고, 고른 자리에 쓰지 않고 빈 파일을 치우고, 판을 되돌린다 */
    await bf.evaluate(()=>{window.__closed=0;window.__removed=0;window.showSaveFilePicker=async()=>({name:'멈춤.mp4',createWritable:async()=>({write:async()=>{},close:async()=>{window.__closed=1;}}),remove:async()=>{window.__removed=1;}});});
    await bf.evaluate(()=>document.getElementById('animExport').click());
    await bf.waitForSelector('#evSheet #evGo');
    await bf.evaluate(()=>document.querySelector('#evSheet #evGo').click());
    await bf.waitForFunction(()=>{const o=document.getElementById('psExpProg');return o&&o.className==='make'&&parseInt(o.querySelector('.pep-pct').textContent,10)>0&&/초 남음/.test(o.querySelector('.pep-sub').textContent);},null,{timeout:30000});
    await page.screenshot({path:path.join(SHOTS,'anim-export-progress-'+size+'.png')});
    await bf.evaluate(()=>[...document.querySelectorAll('#psExpProg .pep-acts button')].find(b=>b.textContent==='멈추기').click());
    await bf.waitForFunction(()=>!document.getElementById('psExpProg')&&!window.__animExport,null,{timeout:30000});
    assert.deepEqual(await bf.evaluate(()=>[window.__closed,window.__removed]),[0,1],'멈추면 쓰지 않고 고른 자리의 빈 파일을 치운다');
  }
  await page.screenshot({path:path.join(SHOTS,'anim-erase-export-'+size+'.png')});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('anim-erase-export ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
