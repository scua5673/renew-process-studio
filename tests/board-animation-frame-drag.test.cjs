'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const start=source.indexOf('/* 장면 드래그 순서 변경:');
const end=source.indexOf('/* 자막 입력 바인딩',start);
assert.ok(start>=0&&end>start);
const dragBlock=source.slice(start,end);

function classList(){
  const set=new Set();
  return {add:c=>set.add(c),remove:c=>set.delete(c),contains:c=>set.has(c)};
}
function setup(){
  const listeners={window:{},box:{}},moves=[],rafs=[];
  const box={id:'animFrames',scrollLeft:0,classList:classList(),children:[],style:{},
    contains(el){return this.children.includes(el);},
    getBoundingClientRect(){return {left:0,right:240,width:240,top:0,bottom:60,height:60};},
    querySelectorAll(sel){return sel==='.anim-frame'?this.children:[];},
    addEventListener(type,fn){(listeners.box[type]||(listeners.box[type]=[])).push(fn);},
    removeEventListener(type,fn){listeners.box[type]=(listeners.box[type]||[]).filter(x=>x!==fn);}
  };
  for(let i=0;i<5;i++){
    const child={classList:classList(),style:{},parentNode:box,setPointerCapture(){},releasePointerCapture(){},
      closest(sel){return sel==='.anim-frame'?this:null;},
      getBoundingClientRect(){const left=i*80-box.scrollLeft;return {left,right:left+72,width:72,top:0,bottom:44,height:44};}
    };
    box.children.push(child);
  }
  function fireBox(type,event){(listeners.box[type]||[]).forEach(fn=>fn(event));}
  function fireWindow(type,event){(listeners.window[type]||[]).slice().forEach(fn=>fn(event));}
  const context={document:{getElementById:id=>id==='animFrames'?box:null},
    window:{addEventListener(type,fn){(listeners.window[type]||(listeners.window[type]=[])).push(fn);},
      removeEventListener(type,fn){listeners.window[type]=(listeners.window[type]||[]).filter(x=>x!==fn);}},
    requestAnimationFrame(fn){rafs.push(fn);return rafs.length;},
    cancelAnimationFrame(){},
    renderAnimFrames(){},_afDragging:false,_afDirty:false,
    reorderAnimFrame(from,to){moves.push([from,to]);return true;},
    setTimeout(fn){fn();return 1;},Date};
  context.window.requestAnimationFrame=context.requestAnimationFrame;
  context.window.cancelAnimationFrame=context.cancelAnimationFrame;
  vm.runInNewContext(dragBlock,context);
  return {box,moves,rafs,fireBox,fireWindow};
}
function ev(target,props){return {target,pointerId:7,pointerType:'touch',clientX:36,clientY:20,button:0,prevented:false,preventDefault(){this.prevented=true;},...props};}

test('animation frame touch drag starts after short movement without long press',()=>{
  const h=setup(),first=h.box.children[0];
  h.fireBox('pointerdown',ev(first));
  h.fireWindow('pointermove',ev(first,{clientX:130}));
  h.fireWindow('pointerup',ev(first,{clientX:170}));
  assert.deepEqual(h.moves,[[0,2]]);
});

test('animation frame tap keeps selection click path intact',()=>{
  const h=setup(),first=h.box.children[0];
  h.fireBox('pointerdown',ev(first));
  h.fireWindow('pointermove',ev(first,{clientX:39,clientY:21}));
  h.fireWindow('pointerup',ev(first,{clientX:39,clientY:21}));
  assert.deepEqual(h.moves,[]);
});

test('animation frame drag autoscrolls near strip edge',()=>{
  const h=setup(),first=h.box.children[0];
  h.fireBox('pointerdown',ev(first));
  h.fireWindow('pointermove',ev(first,{clientX:232}));
  assert.ok(h.rafs.length>0);
  h.rafs.shift()();
  assert.ok(h.box.scrollLeft>0);
});
