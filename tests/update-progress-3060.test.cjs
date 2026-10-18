'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
/* 3.060 — 업데이트 진행 카드: 받는 중(0~70%) · 저장 확인(70~95%) · 다시 여는 중(100%). MP4 내보내기 카드와 같은 모양. */
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const P=require('../studio/update-progress.js'),M=P._math;
const app=R('studio/app.html'),sw=R('sw.js');

test('progress math: download fills 0-60%, saving 60-80%, the new release opens 80-100%', ()=>{
  assert.equal(M.downloadFraction(0,40),0);assert.equal(M.downloadFraction(20,40),0.30);assert.equal(M.downloadFraction(40,40),0.60);
  assert.equal(M.downloadFraction(99,40),0.60,'clamped');assert.equal(M.downloadFraction(3,0),0,'no total yet');
  assert.equal(M.saveFraction(5,5),0.60);assert.equal(M.saveFraction(0,5),0.80);assert.equal(M.saveFraction(0,0),0.80);assert.equal(M.OPEN_AT,0.80);
  assert.equal(M.pctText(0.355),'35%');assert.equal(M.pctText(2),'100%');assert.equal(M.pctText(NaN),'0%');
  assert.equal(M.releaseNo('process-9.999'),'9.999');assert.equal(M.releaseNo(''),'');
});
test('service worker reports how many release files it has stored, with no content', ()=>{
  assert.match(sw,/postMessage\(\{ type: 'ps-sw-progress', release: CACHE, done, total \}\)/);
  assert.match(sw,/stats\.fetched\+\+; if \(stats\.tick\) stats\.tick\(\);/,'counts a file only after it is stored');
  assert.ok(sw.includes("'/studio/update-progress.js'"),'card script is in the release cache');
});
test('the shell loads the card early and drives it from the real update path', ()=>{
  assert.ok(app.indexOf('src="update-progress.js"')>0&&app.indexOf('src="update-progress.js"')<app.indexOf('<script>var __swT0'),'loaded before service worker messages can arrive');
  const go=app.slice(app.indexOf('function psAutoReloadWhenSafe('),app.indexOf('window.__psForceReload=function(m){'));
  assert.match(go,/prog\.saving\(/);assert.match(go,/prog\.reloading\(\)/);
  assert.match(go,/if\(manual\)prog\.failed\(message\);else prog\.ready\(\);/,'auto attempts fall back quietly; only a press shows why');
  assert.ok(go.indexOf('prog.reloading()')<go.indexOf('location.reload()'),'100% only after the save check passed');
  assert.match(app,/track\.seen=track\.seen\|\|\{\};track\.seen\[id\]=1;/);
});
test('the card API never throws without a DOM (worker/test contexts)', ()=>{
  for(const f of ['download','ready','saving','reloading','failed','close'])assert.doesNotThrow(()=>P[f](1,2,'process-9.999'));
  assert.equal(typeof P.state(),'string');
});

// 3.098 — 사용자 «업데이트 될때 몇퍼센트 되는지 · 막 깜박이고 그냥 막 나가지면 불안»
test('3.098 calm update: one card in one place, a countdown before an automatic restart, and the new release finishes the bar', ()=>{
  const src=R('studio/update-progress.js');
  assert.match(src,/#psUpdProg\{position:fixed;inset:0;[^}]*align-items:flex-end;justify-content:center;/,'every stage keeps the card at the bottom centre');
  assert.doesNotMatch(src,/#psUpdProg\.dl,#psUpdProg\.ready\{inset:auto/,'no jump from a bottom card to a centred one');
  assert.match(src,/#psUpdProg\.save,#psUpdProg\.done,#psUpdProg\.warn\{background:rgba\(10,14,22,\.24\);pointer-events:auto\}/,'applying dims the page behind but leaves the card where it is');
  assert.match(src,/var CD_SEC=5,CONT_KEY='ps_upd_cont_v1';/);
  assert.match(src,/shown=Math\.min\(target,shown\+speed\*dt\/1000\)/,'the number fills up instead of jumping');
  const go=app.slice(app.indexOf('function psAutoReloadWhenSafe('),app.indexOf('function psShowUpdBand('));
  assert.match(go,/window\.__psForceReload=function\(m\)\{var P=window\.PSUpdProg;if\(P&&P\.gate\)P\.gate\(m,go,psSafeToReload\);else go\(m\);\};/);
  assert.match(go,/if\(document\.hidden\|\|psSafeToReload\(w0\)\)window\.__psForceReload\(\);/,'the first automatic try also goes through the countdown');
  assert.match(app,/if\(window\.toast&&!window\.PSUpdProg\)toast\(/,'no extra toast on top of the card');
  assert.match(R('studio/storage-keys.js'),/\['ps_upd_cont_v1','device','ls','session','update-progress\.js'\]/);
});
test('3.098 gate: a press or a hidden tab goes now; a visible automatic update counts down and re-checks safety', ()=>{
  const vm=require('node:vm');
  const mk=(hidden)=>{
    const timers=[],ss={},els=[];
    const el=()=>({style:{},className:'',textContent:'',hidden:false,innerHTML:'',classList:{add(){},contains:()=>false},setAttribute(){},appendChild(c){els.push(c);},querySelector:()=>el(),remove(){},onclick:null});
    const body=Object.assign(el(),{contains:()=>true,classList:{contains:()=>false,add(){}}});
    const document={hidden,body,head:el(),documentElement:el(),getElementById:()=>null,createElement:el,addEventListener(){},removeEventListener(){}};
    const win={document,PS_BUILD:'9.001',sessionStorage:{getItem:k=>ss[k]??null,setItem:(k,v)=>{ss[k]=v;},removeItem:k=>{delete ss[k];}},navigator:{}};
    const ctx={window:win,module:{exports:{}},setInterval:(f)=>{timers.push(f);return timers.length;},clearInterval:(id)=>{timers[id-1]=null;},setTimeout:()=>0,clearTimeout(){},Date};
    vm.runInNewContext(R('studio/update-progress.js'),ctx);
    return {P:ctx.module.exports,timers,ss};
  };
  let calls=[];
  let t=mk(false);
  assert.equal(t.P.gate(true,m=>calls.push(['go',m]),()=>true),'go');assert.deepEqual(calls,[['go',true]],'a press goes at once');
  assert.match(t.ss.ps_upd_cont_v1,/"from":"9.001"/,'the new release can finish the same card');
  calls=[];t=mk(true);
  assert.equal(t.P.gate(false,m=>calls.push(m),()=>true),'go');assert.deepEqual(calls,[false],'a hidden tab is nobody\'s screen — go');
  calls=[];t=mk(false);let safe=true;
  assert.equal(t.P.gate(false,m=>calls.push(m),()=>safe),'counting');assert.deepEqual(calls,[],'visible: no sudden restart');
  assert.equal(t.P.gate(false,m=>calls.push(m),()=>safe),'counting','one countdown at a time');
  const tick=t.timers.find(Boolean);for(let i=0;i<4;i++)tick();assert.deepEqual(calls,[],'still counting');
  tick();assert.deepEqual(calls,[false],'goes after 5 seconds');
  calls=[];t=mk(false);safe=false;t.P.gate(false,m=>calls.push(m),()=>safe);const tk=t.timers.find(Boolean);for(let i=0;i<5;i++)tk();
  assert.deepEqual(calls,[],'typing when the count ends: wait for the next safe moment');
});
