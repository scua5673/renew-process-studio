const test=require('node:test');
const assert=require('node:assert/strict');
const mod=require('../studio/board-pdf-save.js');

function win(o){return Object.assign({navigator:{},toast(){},PSSync:{event(name,p){(this.log=this.log||[]).push([name,p]);}},document:{createElement(){return {click(){},remove(){}};},body:{appendChild(){}}},URL:{createObjectURL(){return 'blob:';}}},o);}

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
