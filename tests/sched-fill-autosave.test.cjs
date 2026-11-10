'use strict';
// 세션 채우기 «메모» · «장소» 자동 저장(studio/schedule-fill-autosave.js) — 미룬 저장의 세 길(psFlushPending · pagehide · visibilitychange)과 «칸을 다시 그리지 않는다».
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../studio/schedule-fill-autosave.js');
const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
function win(){
  const L={},timers=new Map();let id=0;
  const doc={visibilityState:'visible',addEventListener(t,f){(L['d:'+t]=L['d:'+t]||[]).push(f);}};
  const W={document:doc,flushes:0,saves:0,ready:0,order:[],addEventListener(t,f){(L['w:'+t]=L['w:'+t]||[]).push(f);},
    setTimeout(f,ms){timers.set(++id,{f,ms});return id;},clearTimeout(i){timers.delete(i);},
    wksFillFlushText(){W.flushes++;W.order.push('text');},saveFlush(){W.saves++;W.order.push('save');return true;},
    psFlushPending(){W.order.push('flush');return 'F';},psFlushPendingReady(){W.ready++;W.order.push('ready');return Promise.resolve(true);},psHasPending(){return false;}};
  return {W,doc,fire:(k,e)=>(L[k]||[]).forEach(f=>f(e||{})),run(){const all=[...timers.values()];timers.clear();all.forEach(t=>t.f());},timers};
}
test('메모 · 장소 칸만 본다',()=>{
  assert.equal(api.watched({id:'wfNote'}),true);assert.equal(api.watched({id:'wfPlace'}),true);
  assert.equal(api.watched({id:'wfOpp'}),false);assert.equal(api.watched({id:'constructor'}),false);assert.equal(api.watched(null),false);
});
test('치는 동안: 마지막 입력에서 0.6초 뒤 원래 저장 길(wksFillFlushText)로 한 번 — 조합 중(isComposing)에도 건다',()=>{
  const h=win(),a=api.mount(h.W);assert.equal(a.delay,600);
  h.fire('d:input',{target:{id:'wfNote'},isComposing:true});h.fire('d:input',{target:{id:'wfNote'},isComposing:true});h.fire('d:compositionend',{target:{id:'wfNote'}});
  assert.equal(h.timers.size,1,'타이머는 하나(뒤 입력이 앞 것을 민다)');assert.equal([...h.timers.values()][0].ms,600);assert.equal(h.W.flushes,0);assert.equal(a.pending(),true);
  assert.equal(h.W.psHasPending(),true,'셸이 «저장할 것 있음»을 안다');
  h.run();assert.equal(h.W.flushes,1);assert.equal(a.pending(),false);assert.equal(h.W.psHasPending(),false);
  h.fire('d:input',{target:{id:'wfOpp'}});assert.equal(h.timers.size,0,'다른 칸은 그 칸의 저장 길 그대로');
});
test('세 길: psFlushPending · psFlushPendingReady 는 칸의 글을 먼저 · pagehide · 숨을 때는 글을 담고 바로 쓴다',()=>{
  const h=win();api.mount(h.W);
  h.fire('d:input',{target:{id:'wfPlace'}});
  assert.equal(h.W.psFlushPending(),'F');assert.deepEqual(h.W.order,['text','flush']);assert.equal(h.timers.size,0,'미룬 타이머는 걷는다');
  h.W.order.length=0;h.W.psFlushPendingReady();assert.deepEqual(h.W.order,['text','ready']);
  h.W.order.length=0;h.fire('d:input',{target:{id:'wfNote'}});h.fire('w:pagehide');assert.deepEqual(h.W.order,['text','save']);assert.equal(h.timers.size,0);
  h.W.order.length=0;h.fire('d:visibilitychange');assert.deepEqual(h.W.order,[],'보이는 쪽으로 바뀔 때는 아무것도');
  h.doc.visibilityState='hidden';h.fire('d:visibilitychange');assert.deepEqual(h.W.order,['text','save']);
});
test('두 번 달지 않는다 · 본문 함수가 없어도 죽지 않는다',()=>{
  const h=win();assert.ok(api.mount(h.W));assert.equal(api.mount(h.W),null);
  const bare={document:{addEventListener(){} },addEventListener(){},setTimeout(){return 1;},clearTimeout(){}};const a=api.mount(bare);a.commit();assert.equal(a.commits(),0);
});
test('모듈은 칸의 DOM 을 쓰지 않는다(값 읽기는 본문 wksFillFlushText 가) · 본문 저장 길은 다시 그리지 않는다',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../studio/schedule-fill-autosave.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(src,/innerHTML|\.value\s*=|wksFillRender|\.focus\(|\.blur\(/);
  const cut=(a,b)=>P.slice(P.indexOf(a),P.indexOf(b,P.indexOf(a)));
  for(const body of [cut('window.wksFillNote=function(v){','/* 닫기 전에'),cut('window.wksFillPlace=function(v){','window.wksFillPlacePick=')]){assert.match(body,/save\(\)/);assert.doesNotMatch(body,/wksFillRender|innerHTML|\.value\s*=/);}
  assert.match(cut('function syncViews(shouldSave){','function updateTopMini'),/if\(__imeOn\)\{[^}]*return; \}[\s\S]*__sheetCovering\(\)\)\{ __viewsStale=true; return; \}/,'조합 중 · 시트가 덮은 동안 뒤 화면을 그리지 않는다');
});
test('process.html 본문 뒤에 싣고(psFlushPending 이 먼저 있어야 감싼다) sw.js CORE 에 있다',()=>{
  const i=P.indexOf('<script src="schedule-fill-autosave.js"');assert.ok(i>P.indexOf('window.psFlushPending=function(){')&&i>P.indexOf('function wksFillFlushText(){'));
  assert.ok(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').includes("'/studio/schedule-fill-autosave.js'"));
});
