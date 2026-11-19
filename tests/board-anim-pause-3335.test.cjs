'use strict';
/* 3.335 — 작전판 «일시 정지»(제보 a076fa6e). 가짜 창 · 가짜 rt 로 board-anim-pause.js 의 판정과 감싸기를 본다.
   멈춤은 animPlaying 을 그대로 두고(rt.playing 참) 그림만 멈춘다 — 저장 · 편집 장치가 «재생 중»으로 계속 막게. */
const test=require('node:test'),assert=require('node:assert/strict');
const {decide,install}=require('../studio/board-anim-pause.js');

test('decide: idle plays, playing holds (or stops without a pose), held resumes',()=>{
  assert.equal(decide({playing:false,held:false}),'play');
  assert.equal(decide({playing:true,held:false,canHold:true}),'hold');
  assert.equal(decide({playing:true,held:false,canHold:false}),'stop');
  assert.equal(decide({playing:true,held:true,canHold:true}),'resume');
  assert.equal(decide(null),'play');
});

function el(id){
  const e={id,attrs:{},style:{props:{},setProperty(k,v){this.props[k]=v;},removeProperty(k){delete this.props[k];}},hidden:false,innerHTML:'',title:'',
    setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},parentNode:null};
  return e;
}
function fakeWin(){
  const calls=[],handlers={},nodes={};
  const play=el('animPlay'),bar={children:[play],insertBefore(n,ref){const i=ref?this.children.indexOf(ref):this.children.length;this.children.splice(i<0?this.children.length:i,0,n);n.parentNode=this;nodes[n.id]=n;}};
  play.parentNode=bar;nodes.animPlay=play;play.nextSibling=null;
  const doc={
    getElementById:id=>nodes[id]||null,
    createElement:()=>el(''),
    addEventListener:(type,fn,cap)=>{(handlers[type]=handlers[type]||[]).push({fn,cap});},
    body:{classList:{set:new Set(),toggle(c,on){if(on)this.set.add(c);else this.set.delete(c);}}}
  };
  const rt={on:false,pose:null,frozen:0,resumed:null,toasts:[],
    playing(){return this.on;},pauseState(){return this.pose;},freeze(){this.frozen++;},
    prepResume(h){this.resumed=h;this.on=false;},toast(t){this.toasts.push(t);}};
  const w={document:doc,
    playAnim(){calls.push('play');if(rt.on){w.stopAnim();return;}rt.on=true;rt.pose={s:0,phase:'move',elapsed:420,restore:{tag:'before'}};},
    stopAnim(){calls.push('stop');rt.on=false;rt.pose=null;w.updatePlayUI();},
    updatePlayUI(){calls.push('ui');}};
  return {w,rt,calls,handlers,nodes,doc};
}
const fire=(h,type,ev)=>{for(const x of h[type]||[])x.fn(ev);};
const target=(sel)=>({closest:s=>s.split(',').some(p=>sel.includes(p.trim()))?{}:null});

test('pause holds in place, resume continues from the held pose, stop clears the hold',()=>{
  const {w,rt,calls,nodes}=fakeWin();
  const api=install(w,rt);
  assert.ok(api);assert.equal(install(w,rt),api,'installs once');
  w.playAnim();assert.deepEqual(calls,['play']);assert.equal(rt.on,true);
  calls.length=0;
  w.playAnim();
  assert.deepEqual(calls,[],'the original play (which would stop) is not called');
  assert.equal(api.held(),true);assert.equal(rt.on,true,'still «playing» — save guards stay on');assert.equal(rt.frozen,1);
  assert.equal(nodes.animPlay.attrs['aria-label'],'이어서 재생');
  assert.ok(nodes.animStop,'a stop button is added next to play');assert.equal(nodes.animStop.hidden,false);
  w.playAnim();
  assert.deepEqual(rt.resumed,{s:0,phase:'move',elapsed:420,restore:{tag:'before'}},'resumes from the held pose with the original restore snapshot');
  assert.equal(api.held(),false);assert.deepEqual(calls,['play'],'then the original play continues');
  w.playAnim();assert.equal(api.held(),true);
  nodes.animStop.onclick({preventDefault(){}});
  assert.equal(api.held(),false);assert.equal(rt.on,false);assert.ok(calls.includes('stop'));
  assert.equal(nodes.animStop.hidden,true);assert.equal(nodes.animStop.style.props.display,'none','hidden even against !important dock rules');
});

test('without a pose yet (pressed before the first frame) it falls back to the old stop',()=>{
  const {w,rt,calls}=fakeWin();const api=install(w,rt);
  rt.on=true;rt.pose=null;
  w.playAnim();
  assert.equal(api.held(),false);assert.deepEqual(calls,['play','stop','ui']);assert.equal(rt.on,false);
});

test('while held: touching the pitch returns to the scene and swallows that touch; controls and other keys pass',()=>{
  const {w,rt,calls,handlers}=fakeWin();const api=install(w,rt);
  w.playAnim();w.playAnim();assert.equal(api.held(),true);calls.length=0;
  fire(handlers,'pointerdown',{target:target('#animPlay')});
  assert.equal(api.held(),true,'the play button itself is left alone');
  fire(handlers,'keydown',{key:'p',target:{}});
  assert.equal(api.held(),true,'the play shortcut is left to its own handler');
  let prevented=0,stopped=0;
  fire(handlers,'pointerdown',{target:target('svg.board'),preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;},stopPropagation(){}});
  assert.equal(api.held(),false);assert.ok(calls.includes('stop'));assert.equal(prevented,1);assert.equal(stopped,1);
  assert.match(rt.toasts[0],/재생 전 장면/);
  w.playAnim();w.playAnim();assert.equal(api.held(),true);
  let p2=0;fire(handlers,'pointerdown',{target:target('#bpBoardSettings'),preventDefault(){p2++;}});
  assert.equal(api.held(),false,'other controls also end the pause first');assert.equal(p2,0,'…and keep their click');
  w.playAnim();w.playAnim();
  fire(handlers,'keydown',{key:'ArrowLeft',target:{}});
  assert.equal(api.held(),false,'an arrow key (moves the selection) ends the pause first');
  const capture=(handlers.pointerdown||[]).every(x=>x.cap===true)&&(handlers.keydown||[]).every(x=>x.cap===true);
  assert.equal(capture,true,'listeners run in the capture phase, before the board handlers');
});

test('a document without the board functions installs nothing',()=>{
  assert.equal(install({document:null}),null);
  assert.equal(install(null),null);
});
