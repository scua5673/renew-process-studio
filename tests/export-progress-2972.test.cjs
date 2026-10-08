'use strict';
/* 2.972 — 사용자 «애니메이션 내보내기 할 때 퍼센트가 나와서 저장되는 모습이 그려지게» · «원하는 폴더에».
   한 카드(PEP)가 만드는 % → 저장하는 중 → 저장됨 ✓ 를 말하고, «멈추기» 를 주고, 저장 창이 없는 아이폰·아이패드는 다 만든 뒤 «파일에 저장» 을 묻는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};

test('video export reports progress per frame, keeps the last few percent for saving, and can be stopped',()=>{
  const run=slice('async function _exportVideoRun(opts){','/* ===== 영상 내보내기 옵션 시트');
  assert.doesNotMatch(run,/toast\("영상 생성 중/,'«영상 생성 중…» 한 줄은 진행 카드로');
  assert.match(run,/if\(PEP\.cancelled\(\)\)throw _pepCancelErr\(\);/,'프레임마다 멈추기를 본다');
  assert.match(run,/PEP\.set\(\(k\+1\)\/_np,_unit\+/,'몇 번째 장면·몇 초 남았나');
  assert.match(run,/초 남음/);
  assert.match(run,/catch\(e\)\{ try\{rec\.stop\(\);\}catch\(_\)\{\} throw e; \}/,'멈추면 녹화를 끊는다');
  assert.ok(run.indexOf('PEP.saving()')>run.indexOf('rec.stop();await stopped'),'만들기가 끝난 뒤 «저장하는 중»');
  assert.match(run,/PEP\.done\(_K\+" 저장됨 ✓","고른 폴더에 «"\+_saved\+"»"\)/);
  const wrap=slice('async function exportVideo(opts){','async function _exportVideoRun(opts){');
  assert.match(wrap,/PEP\.open\(opts\.capN\?"미팅 영상 만드는 중":"영상 만드는 중"\)/);
  assert.match(wrap,/e&&e\.psCancel/,'멈추기는 실패가 아니다');
  assert.match(wrap,/if\(opts\.target&&!opts\.__saved\)await _animDropTarget\(opts\.target\)/,'멈추면 고른 자리의 빈 파일을 치운다');
  assert.match(wrap,/if\(PEP\.busy\(\)\)PEP\.close\(\)/,'앞에서 돌아가도 카드가 남지 않는다');
});

test('GIF export reports progress through _gifEncode and stops between frames',()=>{
  const enc=slice('async function _gifEncode(frames,o){','async function _exportGifRun(target){');
  assert.match(enc,/if\(o\.isCancelled&&o\.isCancelled\(\)\)throw _pepCancelErr\(\);/);
  assert.match(enc,/_made\+\+; if\(o\.onProgress\)/);
  const run=slice('async function _exportGifRun(target){','let toastT;');
  assert.match(run,/PEP\.open\("GIF 만드는 중"\)/);
  assert.match(run,/isCancelled:PEP\.cancelled,onProgress:/);
  assert.match(run,/PEP\.saving\(\);/);
  assert.match(run,/e&&e\.psCancel\?"내보내기를 멈췄어요":"GIF 생성에 실패했어요"/);
  const ppt=slice('function exportPPTX(){','window.__exportPPTX=exportPPTX;');
  assert.doesNotMatch(ppt,/onProgress/,'미팅 PPT 의 움직이는 그림은 진행 카드 없이(그대로)');
});

test('the progress card only climbs while making, then saving, then done',()=>{
  const code=slice('var PEP=(function(){','window.__psExpProg=PEP;');
  const el=()=>{const o={className:'',textContent:'',style:{},attrs:{},hidden:false,kids:[],onclick:null,
    setAttribute(k,v){this.attrs[k]=v;},appendChild(c){this.kids.push(c);return c;},remove(){this.gone=1;},set innerHTML(v){this.kids=[];}};return o;};
  const nodes={'.pep-t':el(),'.pep-sub':el(),'.pep-pct':el(),'.pep-bar':el(),'.pep-bar i':el(),'.pep-acts':el()};
  const ov=el();ov.querySelector=s=>nodes[s];
  const doc={getElementById:()=>({}),createElement:()=>ov,head:el(),body:{contains:()=>true,appendChild(){}}};
  const c=vm.createContext({document:doc,setTimeout:()=>1,clearTimeout(){},URL:{},navigator:{},File:function(){},window:{},Math,String});
  vm.runInContext(code+';this.PEP=PEP;',c);
  const P=c.PEP;
  P.open('영상 만드는 중');assert.equal(ov.className,'make');assert.equal(nodes['.pep-pct'].textContent,'0%');
  P.set(.5,'장면 1 / 2');assert.equal(nodes['.pep-pct'].textContent,'48%','만드는 동안은 96% 까지');
  P.set(1,'장면 2 / 2');assert.equal(nodes['.pep-pct'].textContent,'96%');
  P.saving();assert.equal(ov.className,'save');assert.equal(nodes['.pep-pct'].textContent,'98%');
  P.set(.2);assert.equal(nodes['.pep-pct'].textContent,'98%','저장 중엔 만드는 % 로 되돌아가지 않는다');
  P.done('MP4 저장됨 ✓','고른 폴더에 «a.mp4»');assert.equal(ov.className,'done');assert.equal(nodes['.pep-pct'].textContent,'100%');
  assert.equal(P.busy(),false);
});

test('Apple touch devices without a save dialog are asked after making (share sheet → Save to Files)',()=>{
  const fn=slice('function _animAskSaveIOS(){','\nasync function _animPickSaveTarget(');
  const run=(nav,win)=>{const c=vm.createContext({navigator:nav,window:win});vm.runInContext(fn+';this.r=_animAskSaveIOS();',c);return c.r;};
  const ipad='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
  assert.equal(run({maxTouchPoints:5,userAgent:ipad,share(){}},{}),true,'아이패드 사파리(데스크톱 UA)');
  assert.equal(run({maxTouchPoints:0,userAgent:ipad,share(){}},{}),false,'맥 사파리는 예전처럼 내려받기');
  assert.equal(run({maxTouchPoints:5,userAgent:ipad,share(){}},{showSaveFilePicker(){}}),false,'저장 창이 있으면 그것');
  assert.equal(run({maxTouchPoints:5,userAgent:'Mozilla/5.0 (Linux; Android 14)',share(){}},{}),false,'안드로이드는 내려받기');
  const save=slice('async function _animSaveBlob(blob,name,target){','/* 만들다 멈추면');
  assert.ok(save.indexOf('_animAskSaveIOS()')>save.indexOf('createWritable'),'고른 파일이 먼저');
  assert.match(save,/PEP\.offer\(blob,name,blob\.type\); return "offer";/);
});
