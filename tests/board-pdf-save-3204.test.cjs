const test=require('node:test');
const assert=require('node:assert/strict');
const mod=require('../studio/board-pdf-save.js');

function win(o){return Object.assign({navigator:{},toast(){},PSSync:{event(name,p){(this.log=this.log||[]).push([name,p]);}},document:{createElement(){return {click(){},remove(){}};},body:{appendChild(){}},hasFocus(){return false;}},URL:{createObjectURL(){return 'blob:';}},addEventListener(){},removeEventListener(){},setTimeout:(f,ms)=>setTimeout(f,ms),clearTimeout:(t)=>clearTimeout(t),__psPdfSilentMs:40},o);}

test('저장 창이 있으면 그 손잡이를 돌려주고, 취소(AbortError)는 false',async()=>{
  const handle={name:'훈련.pdf'};
  assert.equal(await mod.pick(win({showSaveFilePicker:async()=>handle}),'훈련.pdf'),handle);
  assert.equal(await mod.pick(win({showSaveFilePicker:async()=>{const e=new Error('x');e.name='AbortError';throw e;}}),'훈련.pdf'),false);
});
test('저장 창이 열리지 않으면 null(내려받기) + 알림 + ps_events 오류 이름만',async()=>{
  const toasts=[];const w=win({showSaveFilePicker:async()=>{const e=new Error('Cross origin sub frames');e.name='SecurityError';throw e;},toast(m){toasts.push(m);}});
  assert.equal(await mod.pick(w,'훈련.pdf'),null);
  assert.match(toasts[0],/다운로드 폴더.*SecurityError/);
  assert.equal(w.PSSync.log[0][0],'pdf_picker_failed');assert.equal(w.PSSync.log[0][1].error_code,'SecurityError');
  assert.equal(JSON.stringify(w.PSSync.log[0][1]).includes('훈련'),false,'파일 이름 · 내용은 남기지 않는다');
});
test('아이패드 사파리(저장 창 없음 · 공유 가능)는 공유 시트용 손잡이 — 닫을 때 진행 카드 «파일에 저장»',async()=>{
  const offered=[];const w=win({navigator:{maxTouchPoints:5,userAgent:'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit Safari',share(){}},__psExpProg:{offer(b,n,t){offered.push([b,n,t]);}}});
  const t=await mod.pick(w,'훈련.pdf');assert.equal(t&&t.psShare,true);
  const wr=await t.createWritable();await wr.write('BLOB');await wr.close();
  assert.deepEqual(offered,[['BLOB','훈련.pdf','application/pdf']]);
});
test('저장 창도 공유도 없는 브라우저는 예전처럼 null',async()=>{
  assert.equal(await mod.pick(win({navigator:{userAgent:'Firefox'}}),'a.pdf'),null);
  assert.equal(mod.iosShare(win({navigator:{maxTouchPoints:0,userAgent:'iPad',share(){}}})),false,'터치 없는 맥 사파리는 공유 시트를 쓰지 않는다');
});
test('mount 는 본문의 _ppbPickSaveTarget 을 바꾸고 두 번 붙지 않는다',async()=>{
  const w=win({_ppbPickSaveTarget(){return 'orig';}});mod.mount(w);const f=w._ppbPickSaveTarget;mod.mount(w);
  assert.equal(w._ppbPickSaveTarget,f);assert.equal(await w._ppbPickSaveTarget('x.pdf'),null);
});

/* 3.205 — 저장 창은 한 번에 하나(맥 크롬 «File picker already active» — 2.974 영상과 같은 구멍) */
test('저장 창이 떠 있는 동안의 두 번째 호출은 취소(false) — 창은 한 번만 열고 알림만',async()=>{
  const toasts=[];let calls=0,resolve1;const handle={name:'훈련.pdf'};
  const w=win({showSaveFilePicker(){calls++;return calls===1?new Promise(r=>{resolve1=r;}):Promise.resolve(handle);},toast(m){toasts.push(m);}});
  const p1=mod.pick(w,'훈련.pdf');
  assert.equal(await mod.pick(w,'훈련.pdf'),false,'두 번째는 아무것도 받지 않는다');
  assert.equal(calls,1);assert.match(toasts[0],/이미 열려/);assert.equal(w.PSSync.log,undefined,'서버에 남기지 않는다');
  resolve1(handle);assert.equal(await p1,handle);
  assert.equal(await mod.pick(w,'훈련.pdf'),handle,'창이 닫힌 뒤엔 다시 연다');assert.equal(calls,2);
});
test('크롬의 «이미 열림» 거절(NotAllowedError … active)도 취소로 — 내려받지 않고 기록하지 않는다',async()=>{
  const toasts=[];const w=win({showSaveFilePicker:async()=>{const e=new Error("Failed to execute 'showSaveFilePicker' on 'Window': File picker already active.");e.name='NotAllowedError';throw e;},toast(m){toasts.push(m);}});
  assert.equal(await mod.pick(w,'훈련.pdf'),false);
  assert.match(toasts[0],/이미 열려/);assert.equal(w.PSSync.log,undefined);
  assert.equal(w.__psPdfPicking,false,'거절 뒤 다음 호출은 막히지 않는다');
  const e2=new Error('x');e2.name='NotAllowedError';
  assert.equal(mod.alreadyOpen(e2),false,'다른 NotAllowedError 는 예전처럼(기록 + 내려받기)');
});
test('mount 는 _ppbSavePdf 를 감싸 저장 창이 떠 있는 동안 «PDF 내려받기»를 잠그고, 끝나면(취소 포함) 되돌린다',async()=>{
  const btn={disabled:false,textContent:'PDF 내려받기'};let release;const seen=[];
  const w=win({document:{getElementById(id){return id==='ppbSave'?btn:null;},createElement(){return {click(){},remove(){}};},body:{appendChild(){}}},
    async _ppbSavePdf(){seen.push(btn.disabled+'|'+btn.textContent);await new Promise(r=>{release=r;});}});
  mod.mount(w);
  const p=w._ppbSavePdf();
  assert.deepEqual(seen,['true|저장 위치 고르는 중…']);
  assert.equal(await w._ppbSavePdf(),undefined,'잠긴 동안의 두 번째 누름은 아무 일도 안 한다');assert.equal(seen.length,1);
  release();await p;
  assert.equal(btn.disabled,false);assert.equal(btn.textContent,'PDF 내려받기');
  const f=w._ppbSavePdf;mod.mount(w);assert.equal(w._ppbSavePdf,f,'두 번 감싸지 않는다');
});

/* 3.206 — 창이 안 뜨는 맥 크롬: 맨 위 창에서 열고, 초점을 잃지 않으면 «창이 안 뜸»으로 보고 받는다 */
test('같은 출처의 맨 위 창이 저장 창을 열 수 있으면 거기서 연다(iframe 안 작전판)',async()=>{
  const handle={name:'top.pdf'};let frameCalls=0,topCalls=0;
  const top={showSaveFilePicker:async()=>{topCalls++;return handle;},document:{hasFocus(){return false;}},addEventListener(){},removeEventListener(){}};
  const w=win({showSaveFilePicker:async()=>{frameCalls++;return {name:'frame.pdf'};}});w.top=top;
  assert.equal(await mod.pick(w,'훈련.pdf'),handle);assert.equal(topCalls,1);assert.equal(frameCalls,0);
  assert.equal(mod.hostOf(win({})).top,undefined,'맨 위 창이 없으면 제 창');
  const cross=win({showSaveFilePicker:async()=>handle});Object.defineProperty(cross,'top',{get(){throw new Error('cross');}});
  assert.equal(await mod.pick(cross,'훈련.pdf'),handle,'다른 출처의 맨 위 창이면 제 창에서 연다');
});
test('창이 떠서 초점을 잃었으면(blur · hasFocus 거짓) 사용자가 고를 때까지 기다린다',async()=>{
  const handle={name:'훈련.pdf'};const w=win({showSaveFilePicker:()=>new Promise(r=>setTimeout(()=>r(handle),120))});
  assert.equal(await mod.pick(w,'훈련.pdf'),handle,'hasFocus 거짓(창이 떠 있음) — 40ms 감시가 지나도 기다린다');
  assert.equal(w.__psPdfPickerSilent,undefined);assert.equal(w.PSSync.log,undefined);
  let onBlur=null;const w2=win({document:{hasFocus(){return true;},createElement(){return {click(){},remove(){}};},body:{appendChild(){}}},addEventListener(t,f){if(t==='blur')onBlur=f;},showSaveFilePicker:()=>new Promise(r=>setTimeout(()=>r(handle),120))});
  const p=mod.pick(w2,'훈련.pdf');onBlur();
  assert.equal(await p,handle,'blur 가 왔으면 초점이 참이어도 기다린다');
});
test('3.208 — 초점을 잃지 않은 채 감시 시간이 지나면 저절로 받지 않는다: 카드 손잡이(__psPdfFallback)를 띄운 채 기다리고, 늦게 답한 창은 그대로 쓰며 late 를 ok 로 기록',async()=>{
  const handle={name:'훈련.pdf'};let calls=0;const toasts=[];
  const w=win({document:{hasFocus(){return true;},createElement(){return {click(){},remove(){}};},body:{appendChild(){}}},showSaveFilePicker:()=>{calls++;return new Promise(r=>setTimeout(()=>r(handle),140));},toast(m){toasts.push(m);}});
  const p=mod.pick(w,'훈련.pdf');
  await new Promise(r=>setTimeout(r,80));
  assert.equal(typeof w.__psPdfFallback,'function','감시 시간 뒤 카드 손잡이가 선다');assert.equal(w.__psPdfPicking,true,'창은 계속 기다린다');assert.equal(w.PSSync.log,undefined,'기다리는 동안은 기록하지 않는다');
  assert.equal(await p,handle,'늦게 답한 창의 손잡이를 그대로 쓴다');
  assert.equal(w.__psPdfFallback,null);assert.equal(w.__psPdfPickerSilent,undefined,'다음에도 창을 연다');
  assert.deepEqual(w.PSSync.log.map(x=>[x[0],x[1].status,x[1].error_code,x[1].meta.top]),[['pdf_picker_failed','ok','late',false]]);
  assert.equal(await mod.pick(w,'훈련.pdf'),handle);assert.equal(calls,2);
});
test('3.208 — 카드의 «다운로드 폴더로 받기»를 누르면 그때 내려받기(null) · 알림 · silent 기록 · 다음부터는 묻지 않는다',async()=>{
  const toasts=[];let calls=0;
  const w=win({document:{hasFocus(){return true;},createElement(){return {click(){},remove(){}};},body:{appendChild(){}}},showSaveFilePicker:()=>{calls++;return new Promise(()=>{});},toast(m){toasts.push(m);},matchMedia(){return {matches:true};}});
  const p=mod.pick(w,'훈련.pdf');
  await new Promise(r=>setTimeout(r,80));
  assert.equal(toasts.length,0,'기다리는 동안 다운로드 알림은 없다');w.__psPdfFallback();
  assert.equal(await p,null);
  assert.equal(w.__psPdfPicking,false,'단추 잠금은 풀린다');assert.equal(w.__psPdfPickerSilent,true);assert.equal(w.__psPdfPickerWaited,true);
  assert.match(toasts[0],/다운로드 폴더에 받았어요.*저장 위치 확인/);
  assert.deepEqual(w.PSSync.log.map(x=>[x[0],x[1].status,x[1].error_code,x[1].meta.top,x[1].meta.standalone,x[1].meta.focus]),[['pdf_picker_failed','error','silent',false,true,true]]);
  assert.equal(await mod.pick(w,'훈련.pdf'),null,'다음 호출은 창을 다시 부르지 않고 바로 받는다');assert.equal(calls,1);assert.equal(toasts.length,2);
});
test('3.208 — 카드의 «취소»는 아무것도 받지 않고(false) 다음엔 다시 창을 연다; 카드가 떴던 창에서 크롬이 «이미 열림»으로 거절하면 다운로드로',async()=>{
  let calls=0;const toasts=[];
  const w=win({document:{hasFocus(){return true;},createElement(){return {click(){},remove(){}};},body:{appendChild(){}}},showSaveFilePicker:()=>{calls++;if(calls===1)return new Promise(()=>{});const e=new Error("Failed to execute 'showSaveFilePicker' on 'Window': File picker already active.");e.name='NotAllowedError';return Promise.reject(e);},toast(m){toasts.push(m);}});
  const p=mod.pick(w,'훈련.pdf');
  await new Promise(r=>setTimeout(r,80));
  // 카드가 떠 있을 때 «취소»는 prompt 의 두 번째 인자 — DOM 이 없는 단위 시험에서는 손잡이로 흉내 내지 못하므로 창이 걸린 뒤의 «이미 열림»만 본다
  assert.equal(typeof w.__psPdfFallback,'function');w.__psPdfFallback();assert.equal(await p,null);
  w.__psPdfPickerSilent=undefined;   // 같은 창에서 다시 묻게 해 본다(3.205 의 «이미 열림» 거절이 걸린 창 때문이면)
  assert.equal(await mod.pick(w,'훈련.pdf'),null,'카드가 떴던 창의 «이미 열림» 거절은 내려받기');assert.equal(w.__psPdfPickerSilent,true);
  assert.deepEqual(w.PSSync.log.map(x=>x[1].error_code),['silent','silent']);
});
