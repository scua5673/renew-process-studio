'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const implementation=part('function renderAnimFrames()','/* ── 2.028')+'\n'+
  part('/* 장면 드래그 순서 변경:','/* 자막 입력 바인딩');

function setup(){
  const timers=new Map(),windowListeners=new Map(),selected=[],reorders=[];
  let timerId=0,renderCount=0,box,c;
  function element(tag){
    const listeners=new Map(),el={tagName:tag.toUpperCase(),className:'',children:[],parentElement:null,dataset:{},attributes:{},scrollLeft:0,captures:new Set()};
    el.classList={contains:name=>el.className.split(/\s+/).includes(name),
      add(name){if(!this.contains(name))el.className+=(el.className?' ':'')+name;},
      remove(name){el.className=el.className.split(/\s+/).filter(x=>x!==name).join(' ');}};
    el.setAttribute=(name,value)=>{el.attributes[name]=value;};
    el.appendChild=child=>{child.parentElement=el;el.children.push(child);return child;};
    el.closest=selector=>{for(let node=el;node;node=node.parentElement){if(selector.startsWith('.')&&node.classList.contains(selector.slice(1)))return node;}return null;};
    el.contains=node=>{for(;node;node=node.parentElement)if(node===el)return true;return false;};
    el.querySelectorAll=selector=>el.children.filter(child=>selector.startsWith('.')&&child.classList.contains(selector.slice(1)));
    el.addEventListener=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);};
    el.emit=(name,event)=>{for(const fn of [...(listeners.get(name)||[])])fn(event);};
    el.setPointerCapture=id=>el.captures.add(id);el.releasePointerCapture=id=>el.captures.delete(id);
    el.getBoundingClientRect=()=>{const i=box?box.children.indexOf(el):0,left=100+Math.max(0,i)*40;return {left,right:left+30,top:0,bottom:30,width:30,height:30};};
    Object.defineProperty(el,'innerHTML',{set(value){for(const child of el.children)child.parentElement=null;el.children=[];el.html=value;if(el===box)renderCount++;},get(){return el.html||'';}});
    Object.defineProperty(el,'isConnected',{get(){return !!box&&box.contains(el);}});
    return el;
  }
  box=element('div');
  const window={addEventListener(name,fn){if(!windowListeners.has(name))windowListeners.set(name,new Set());windowListeners.get(name).add(fn);},
    removeEventListener(name,fn){windowListeners.get(name)?.delete(fn);}};
  c=vm.createContext({document:{getElementById:()=>box,createElement:element},window,$:()=>box,
    anim:{frames:[{snap:{id:0},thumb:'0'},{snap:{id:1},thumb:'1'},{snap:{id:2},thumb:'2'}]},animActive:1,
    _afDragging:false,_afDirty:false,_afDragT:0,_afCtx:false,_afSel:new Set(),
    setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
    closeAnimFrameMenu(){},__afWindow(){},updateMotionPaths(){},syncAnimCap(){},syncBlinkBtn(){},syncHlBtn(){},_blinkDecor(){},syncAnimTitle(){},syncAnimTiming(){},__syncAnimBarHeight(){},afSelPaint(){},openAnimFrameMenu(){},PSTouchSort(){},
    selectAnimFrame(i,focus){selected.push([i,focus]);c.animActive=i;c.renderAnimFrames();},
    reorderAnimFrame(from,to,focus){reorders.push([from,to,focus]);const f=c.anim.frames.splice(from,1)[0];c.anim.frames.splice(to,0,f);c.renderAnimFrames();}
  });
  vm.runInContext(implementation,c,{filename:'board-animation-pointer.js'});c.renderAnimFrames();
  const event=(target,extra={})=>({target,pointerType:'mouse',pointerId:7,button:0,clientX:target.getBoundingClientRect().left+15,clientY:15,
    preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},...extra});
  const emit=(name,e)=>{for(const fn of [...(windowListeners.get(name)||[])])fn(e);};
  const flush=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());};
  const assertClean=()=>{assert.equal(c._afDragging,false);for(const type of ['pointermove','pointerup','pointercancel'])assert.equal(windowListeners.get(type)?.size||0,0,type+' listeners removed');};
  return {c,box,selected,reorders,event,emit,flush,timers,assertClean,get renderCount(){return renderCount;}};
}

test('a pending save redraw preserves the pressed frame through pointerup so its click still selects the scene',()=>{
  const h=setup(),target=h.box.children[0],e=h.event(target);
  h.box.emit('pointerdown',e);h.c.renderAnimFrames();
  assert.equal(h.c._afDirty,true);assert.equal(target.isConnected,true);
  h.emit('pointerup',e);h.assertClean();
  assert.equal(target.isConnected,true,'pointerup must not replace the click target');
  assert.equal(target.captures.size,0);
  target.onclick(h.event(target));
  assert.deepEqual(h.selected,[[0,false]]);assert.equal(h.c.animActive,0);
  assert.equal(h.c._afDirty,false,'the actual completed render clears the queued redraw');
  const renders=h.renderCount;h.flush();assert.equal(h.renderCount,renders,'the stale deferred redraw does not rebuild the strip again');
});

test('a deferred redraw still runs after pointerup when no click follows',()=>{
  const h=setup(),target=h.box.children[0],e=h.event(target);
  h.box.emit('pointerdown',e);h.c.renderAnimFrames();h.emit('pointerup',e);
  assert.equal(target.isConnected,true);assert.equal(h.timers.size,1);
  h.flush();assert.equal(target.isConnected,false);assert.equal(h.c._afDirty,false);
  assert.deepEqual(h.selected,[]);h.assertClean();
});

test('a real mouse drag reorders once and suppresses its following click',()=>{
  const h=setup(),target=h.box.children[0],e=h.event(target),end=h.event(target,{clientX:195});
  h.box.emit('pointerdown',e);h.emit('pointermove',end);
  assert.equal(target.classList.contains('dragging'),true);
  assert.equal(h.box.children[2].classList.contains('drop'),true);
  h.emit('pointerup',end);h.assertClean();
  assert.deepEqual(h.reorders,[[0,2,false]]);assert.equal(end.defaultPrevented,true);
  assert.deepEqual(Array.from(h.c.anim.frames,f=>f.snap.id),[1,2,0]);
  h.box.children[2].onclick(h.event(h.box.children[2]));
  assert.deepEqual(h.selected,[]);assert.equal(h.c._afDragT,0);
});

test('pointer cancellation clears drag state and listeners without reordering or losing a queued redraw',()=>{
  const h=setup(),target=h.box.children[0],e=h.event(target);
  h.box.emit('pointerdown',e);h.emit('pointermove',h.event(target,{clientX:195}));h.c.renderAnimFrames();
  h.emit('pointercancel',h.event(target,{pointerId:8}));assert.equal(h.c._afDragging,true,'another pointer cannot cancel this drag');
  h.emit('pointercancel',e);h.assertClean();
  assert.equal(h.c._afDirty,false);assert.deepEqual(h.reorders,[]);
  assert.ok(h.box.children.every(el=>!el.classList.contains('dragging')&&!el.classList.contains('drop')));
  h.emit('pointerup',h.event(target,{clientX:195}));assert.deepEqual(h.reorders,[]);
});

test('right and middle mouse buttons, touch input, and the menu button do not arm mouse reordering',()=>{
  for(const extra of [{button:2},{button:1},{pointerType:'touch'}]){
    const h=setup(),target=h.box.children[0];h.box.emit('pointerdown',h.event(target,extra));
    h.assertClean();assert.equal(target.captures.size,0);assert.deepEqual(h.reorders,[]);
  }
  const h=setup(),menu=h.box.children[0].children[0];h.box.emit('pointerdown',h.event(menu));h.assertClean();
});

test('a modifier click keeps multi-selection behavior when a pending redraw is deferred',()=>{
  const h=setup(),target=h.box.children[0],e=h.event(target);
  h.box.emit('pointerdown',e);h.c.renderAnimFrames();h.emit('pointerup',e);
  target.onclick(h.event(target,{ctrlKey:true}));
  assert.deepEqual(h.selected,[]);assert.deepEqual([...h.c._afSel],[0]);
  h.flush();assert.equal(h.c._afDirty,false);
  assert.equal(h.box.children[0].classList.contains('sel'),true);h.assertClean();
});
