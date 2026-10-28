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
