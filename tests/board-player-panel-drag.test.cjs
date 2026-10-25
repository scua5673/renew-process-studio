'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const drag=require('../studio/board-player-panel-drag.js');
function fixture(){
 const target=()=>({listeners:{},addEventListener(k,f){(this.listeners[k]??=[]).push(f);},fire(k,e={}){for(const f of this.listeners[k]||[])f(e);}});
 const classes=()=>({s:new Set(),add(x){this.s.add(x);},remove(x){this.s.delete(x);},contains(x){return this.s.has(x);}});
 const values=new Map(),style={setProperty(k,v){values.set(k,v);},getPropertyValue(k){return values.get(k)||'';},removeProperty(k){values.delete(k);}};
 const hd=Object.assign(target(),{classList:classes(),attrs:{},setAttribute(k,v){this.attrs[k]=v;},contains(x){return x===this||x===button;},focus(){},captures:new Set(),setPointerCapture(id){this.captures.add(id);},hasPointerCapture(id){return this.captures.has(id);},releasePointerCapture(id){this.captures.delete(id);}});
 hd.closest=()=>null;
 const button={closest(){return this;}};
 const rect={left:600,top:76,width:288,height:400};
 const ctl={style,offsetHeight:400,getBoundingClientRect(){return {...rect};},querySelector(){return hd;}};
 const body={classList:classes()};body.classList.add('ps-insp-on');
 let on=true,paints=0,queue=[];
 const win=Object.assign(target(),{innerWidth:1000,innerHeight:800,getComputedStyle(){return {width:rect.width+'px',height:rect.height+'px',boxSizing:'border-box'};},document:{body,head:{appendChild(){}},querySelector(){return ctl;},createElement(){return {};}}});
 win.requestAnimationFrame=f=>(queue.push(f),queue.length);
 win.__psInspector={active:()=>on,paint(){paints++;const p=win.__psPlayerPanelDrag.position(ctl);if(p)Object.assign(rect,p);}};
 const api=drag.install(win);
 const event=(o={})=>({target:hd,pointerId:1,isPrimary:true,button:0,clientX:650,clientY:95,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...o});
 const flush=()=>{const q=queue;queue=[];q.forEach(f=>f());};
 return {win,ctl,hd,button,api,rect,event,flush,style,setActive:v=>on=v,get paints(){return paints;},get queued(){return queue.length;}};
}
test('clamp keeps the whole card in the visual viewport, including zoom offsets',()=>{
 const v={left:40,top:100,width:500,height:450},r={width:288,height:400};
 assert.deepEqual(drag.clamp({left:-200,top:-200},r,v),{left:48,top:108});
 assert.deepEqual(drag.clamp({left:9999,top:9999},r,v),{left:244,top:142});
 assert.deepEqual(drag.clamp({left:9999,top:9999},{width:800,height:900},v),{left:48,top:108});
 assert.deepEqual(drag.viewport({visualViewport:{offsetLeft:22,offsetTop:33,width:200,height:300}}),{left:22,top:33,width:200,height:300});
});
test('initial placement is untouched; header ignores buttons, secondary pointers, and tiny taps',()=>{
 const f=fixture();assert.equal(f.api.position(f.ctl),null);assert.equal(f.paints,0);
 for(const extra of [{target:f.button},{button:2},{isPrimary:false}]){
  const e=f.event(extra);f.hd.fire('pointerdown',e);assert.equal(e.prevented,undefined);
 }
 f.hd.fire('pointerdown',f.event());assert.equal(f.hd.captures.has(1),true);
 f.win.fire('pointermove',f.event({pointerId:2,clientX:800}));
 f.win.fire('pointermove',f.event({clientX:652,clientY:96}));f.flush();
 assert.equal(f.api.position(f.ctl),null);assert.equal(f.paints,0);
 f.win.fire('pointerup',f.event());assert.equal(f.hd.captures.size,0);
});
test('a captured drag coalesces movement, survives repaint, clamps, and cancels cleanly',()=>{
 const f=fixture();f.hd.fire('pointerdown',f.event());
 f.win.fire('pointermove',f.event({clientX:400,clientY:150}));
 f.win.fire('pointermove',f.event({clientX:350,clientY:160}));assert.equal(f.queued,1);
 f.flush();assert.deepEqual(f.api.position(f.ctl),{left:300,top:141,scaleX:1,scaleY:1});
 assert.equal(f.style.getPropertyValue('--ps-insp-drag-height'),'400px');
 f.win.__psInspector.paint();assert.equal(f.rect.left,300);
 f.win.fire('pointermove',f.event({clientX:9999,clientY:9999}));f.flush();
 assert.deepEqual(f.api.position(f.ctl),{left:704,top:392,scaleX:1,scaleY:1});
 f.win.fire('pointercancel',f.event());assert.equal(f.hd.captures.size,0);assert.equal(f.hd.classList.contains('ps-panel-dragging'),false);
 const p=f.api.position(f.ctl);f.win.fire('pointermove',f.event({clientX:0}));f.flush();assert.deepEqual(f.api.position(f.ctl),p);
});
test('keyboard moves only the header, resets with Home, and ignores input descendants',()=>{
 const f=fixture();const ignored=f.event({key:'ArrowLeft',target:f.button});f.hd.fire('keydown',ignored);assert.equal(ignored.prevented,undefined);
 f.hd.fire('keydown',f.event({key:'ArrowLeft'}));assert.equal(f.rect.left,592);
 f.hd.fire('keydown',f.event({key:'ArrowDown',shiftKey:true}));assert.equal(f.rect.top,108);
 f.hd.fire('keydown',f.event({key:'Home'}));assert.equal(f.api.position(f.ctl),null);assert.equal(f.style.getPropertyValue('--ps-insp-drag-height'),'');
});
test('resize and an interrupted/hidden inspector never leave an active board gesture',()=>{
 const f=fixture();f.hd.fire('keydown',f.event({key:'ArrowRight'}));
 f.win.innerWidth=500;f.win.innerHeight=600;f.win.fire('resize');f.flush();
 assert.deepEqual(f.api.position(f.ctl),{left:204,top:76,scaleX:1,scaleY:1});
 f.hd.fire('pointerdown',f.event());f.setActive(false);
 f.win.fire('pointermove',f.event({clientX:400}));assert.equal(f.hd.captures.size,0);
 const before=f.api.position(f.ctl);f.setActive(true);f.win.fire('pointermove',f.event({clientX:100}));f.flush();assert.deepEqual(f.api.position(f.ctl),before);
});
test('fractional CSS height does not oscillate through rounded offsetHeight; transforms use the CSS box',()=>{
 const f=fixture();f.rect.height=400.25;f.ctl.offsetHeight=400;
 f.hd.fire('keydown',f.event({key:'ArrowLeft'}));
 assert.equal(f.style.getPropertyValue('--ps-insp-drag-height'),'400.25px');
 for(let i=0;i<5;i++){f.win.fire('resize');f.flush();assert.equal(f.style.getPropertyValue('--ps-insp-drag-height'),'400.25px');}
 assert.equal(f.api.position(f.ctl).scaleY,1);
 f.win.getComputedStyle=()=>({width:'320px',height:'500.3125px',boxSizing:'border-box'});
 const p=f.api.position(f.ctl);assert.equal(p.scaleX,.9);assert.equal(p.scaleY,.8);
});
