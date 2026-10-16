'use strict';
/* 3.055 — 오류 제보 «미팅»(10/16): 운동장 바탕을 슬라이드마다 하나씩 바꾸기 불편 → «모든 슬라이드에» 단추 · 되돌리기 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};

function harness(slides,cur,idx){
  const code=slice('  /* 3.055 — 오류 제보 «미팅»','  /* 2.974 — 예전에 만든 미팅도');
  const viewVal=slice('function _viewVal(sn,k){','function _viewSnapTo(');
  const btns=[],toasts=[];let saved=0,timer=null;
  const t={style:{},children:[],appendChild(b){this.children.push(b);btns.push(b);},setAttribute(){},set textContent(v){this.children=[];toasts.push(v);}};
  const c={document:{body:{classList:{contains:k=>k==='meet-mode'}},getElementById:id=>id==='cs-ftoast'?t:null,
      createElement:()=>{const b={listeners:{},addEventListener(k,f){this.listeners[k]=f;},remove(){},click(){this.listeners.click({stopPropagation(){}});}};return b;}},
    anim:{slides,frames:[]},window:{__snapToThumb:()=>'T'},captureSnap:()=>JSON.parse(JSON.stringify(cur)),
    toast:m=>{toasts.push(m);},boardSaveLive(){saved++;},communityBoardReadOnly:()=>false,meetInShow:()=>false,
    setTimeout:(f)=>{timer=f;return 1;},clearTimeout(){},normPitchView:v=>v,PITCH_SPECS:{fifa:1},Object,String,Array,JSON};
  vm.createContext(c);vm.runInContext(viewVal+'var meetBound=null,meetIdx='+idx+';'+code,c);
  return {c,btns,toasts,get saved(){return saved;},flush(){const f=timer;timer=null;f&&f();}};
}

test('one click applies the pitch look to every other slide and scene; orientation and players stay; undo restores',()=>{
  const s0={snap:{pitchTheme:'calm',pitchCustom:null,pitchImg:null,orientation:'v',players:[1]}};
  const s1={snap:{pitchTheme:'',pitchImg:null,orientation:'h',players:[2]}};
  const s2={snap:{pitchTheme:'white',pitchImg:'@real',grassTone:'b|p',orientation:'v'},frames:[{snap:{pitchTheme:'white',pitchImg:'@real'},thumb:'x'},{snap:{pitchTheme:'white'},thumb:'y'}]};
  const s3={snap:{pitchTheme:'calm',pitchCustom:null,pitchImg:null}};
  const h=harness([s0,s1,s2,s3],{pitchTheme:'calm',pitchCustom:null,pitchImg:null,orientation:'v'},0);
  h.c.window.__meetPitchOffer();h.flush();
  assert.equal(h.btns.length,1);assert.equal(h.btns[0].textContent,'모든 슬라이드에 (2장)','slide 4 already matches');
  assert.equal(s1.snap.pitchTheme,'','nothing changes before the click (부분 적용)');
  h.btns[0].click();
  assert.equal(s1.snap.pitchTheme,'calm');assert.equal(s1.snap.orientation,'h','orientation per slide');assert.deepEqual(s1.snap.players,[2]);
  assert.equal(s2.snap.pitchImg,null);assert.equal('grassTone' in s2.snap,false);
  assert.ok(s2.frames.every(f=>f.snap.pitchTheme==='calm'&&!f.snap.pitchImg),'every scene');
  assert.equal(s2.thumb,'T');assert.equal(s2.frames[0].thumb,'T');assert.equal(s2.frames[1].thumb,undefined);
  assert.ok(h.saved>=1);
  assert.equal(h.btns[1].textContent,'되돌리기');
  h.btns[1].click();
  assert.equal(s1.snap.pitchTheme,'');assert.equal(s2.snap.pitchTheme,'white');assert.equal(s2.snap.pitchImg,'@real');assert.equal(s2.snap.grassTone,'b|p');
  assert.equal(s2.frames[0].snap.pitchImg,'@real');assert.equal(s2.frames[1].snap.pitchTheme,'white');
});

test('no offer when every slide already matches, outside meeting, or after moving to another slide',()=>{
  const a={snap:{pitchTheme:'calm'}},b={snap:{pitchTheme:'calm'}};
  const h=harness([a,b],{pitchTheme:'calm'},0);h.c.window.__meetPitchOffer();h.flush();assert.equal(h.btns.length,0);
  const x={snap:{pitchTheme:'calm'}},y={snap:{pitchTheme:''}};
  const h2=harness([x,y],{pitchTheme:'calm'},0);h2.c.window.__meetPitchOffer();h2.flush();
  vm.runInContext('meetIdx=1',h2.c);h2.btns[0].click();assert.equal(y.snap.pitchTheme,'','slide changed before the click → nothing spread');
});

test('pitch buttons, colour picker and grass tone all ask',()=>{
  assert.equal((source.match(/window\.__meetPitchOffer&&window\.__meetPitchOffer\(\)/g)||[]).length,3);
});
