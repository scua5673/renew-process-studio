const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const start=html.indexOf('/* 2.607 — 아래 띠 자리 예약');
const source=html.slice(start,html.indexOf('</script>',start));

function harness(options={}){
  const geometry={width:1184,height:844,bottom:900,dockWidth:1160,dockHeight:108,dockTop:780,hidden:false,...options};
  const observers=[],resizes=[],queue=new Set(),timers=[],frames=[];
  let writes=0,views=0;
  function notify(target){for(const observer of observers)if(observer.target===target)queue.add(observer);}
  function style(target,initial={}){
    const values={...initial};
    const methods={getPropertyValue:k=>values[k]||'',setProperty(k,v){values[k]=v;writes++;notify(target);},removeProperty(k){delete values[k];writes++;notify(target);}};
    return new Proxy(methods,{get:(t,k)=>k in t?t[k]:values[k]||'',set(t,k,v){values[k]=v;writes++;notify(target);return true;}});
  }
  const stage={getBoundingClientRect:()=>({width:geometry.width,height:geometry.hidden?(parseFloat(stage.style.getPropertyValue('padding-bottom'))||104):geometry.height,bottom:geometry.hidden?(parseFloat(stage.style.getPropertyValue('padding-bottom'))||104):geometry.bottom})};
  const ctl={};stage.style=style(stage,{'padding-bottom':options.padding||''});ctl.style=style(ctl,{top:options.top||'',bottom:options.bottom||'',maxHeight:options.maxHeight||''});
  const dock={getBoundingClientRect:()=>({width:geometry.dockWidth,height:geometry.dockHeight,top:geometry.dockTop})};
  class MutationObserver{constructor(callback){this.callback=callback;observers.push(this);}observe(target){this.target=target;}}
  class ResizeObserver{constructor(callback){this.callback=callback;resizes.push(this);}observe(target){this.target=target;}}
  const context={document:{getElementById:id=>id==='boardStage'?stage:id==='ps-command-dock'?dock:null,querySelector:()=>ctl,body:{classList:{contains:()=>!!geometry.mobile}}},MutationObserver,ResizeObserver,getComputedStyle:()=>({display:geometry.dockDisplay||'block'}),setTimeout:callback=>timers.push(callback),requestAnimationFrame:callback=>frames.push(callback),applyView(){views++;stage.style.alignItems='flex-start';}};
  context.window=context;vm.runInNewContext(source,context);
  function drain(){let n=0;while(queue.size||frames.length){if(++n>50)throw Error('observer did not converge');for(const callback of frames.splice(0))callback();const callbacks=[...queue];queue.clear();for(const observer of callbacks)observer.callback([{target:observer.target,type:'attributes',attributeName:'style'}]);}return n;}
  return {stage,ctl,geometry,drain,stats:()=>({writes,views}),mutate:()=>notify(stage),resize(){for(const observer of resizes)observer.callback([{target:stage}]);},timers};
}

test('WebKit hidden iframe padding geometry does not self-amplify',()=>{
  const h=harness({width:0,hidden:true,dockWidth:0,dockHeight:0,dockTop:0});
  h.mutate();assert.doesNotThrow(h.drain);assert.deepEqual(h.stats(),{writes:0,views:0});
  for(const callback of h.timers)callback();assert.deepEqual(h.stats(),{writes:0,views:0});
});
test('revealing a hidden board recomputes its real dock overlap and converges',()=>{
  const h=harness({width:0,hidden:true});h.drain();
  Object.assign(h.geometry,{width:1184,hidden:false});h.resize();assert.ok(h.drain()<=2);
  assert.equal(h.stage.style.getPropertyValue('padding-bottom'),'132px');assert.equal(h.stats().views,1);
});
test('visible desktop overlap keeps its existing reservation and same-layout callbacks do no work',()=>{
  const h=harness();assert.ok(h.drain()<=2);assert.equal(h.stage.style.getPropertyValue('padding-bottom'),'132px');
  const before=h.stats();h.mutate();h.resize();for(const callback of h.timers)callback();h.drain();assert.deepEqual(h.stats(),before);
});
test('zero height or zero width dock cannot be counted as stage overlap',()=>{
  for(const geometry of [{dockWidth:0},{dockHeight:0}]){
    const h=harness({...geometry,dockTop:0});h.drain();assert.equal(h.stage.style.getPropertyValue('padding-bottom'),'12px');assert.equal(h.stats().views,1);
  }
});
test('zero height stage waits for layout without changing existing padding',()=>{
  const h=harness({height:0,padding:'88px'});h.mutate();h.drain();assert.equal(h.stage.style.getPropertyValue('padding-bottom'),'88px');assert.equal(h.stats().views,0);
  h.geometry.height=844;h.resize();h.drain();assert.equal(h.stage.style.getPropertyValue('padding-bottom'),'132px');
});
test('resized visible dock recomputes once and then converges',()=>{
  const h=harness();h.drain();h.geometry.dockTop=740;h.resize();h.drain();assert.equal(h.stage.style.getPropertyValue('padding-bottom'),'172px');assert.equal(h.stats().views,2);
});
test('desktop selection controls still clear obsolete inline positioning',()=>{
  const h=harness({top:'12px',bottom:'20px',maxHeight:'100px'});h.drain();assert.equal(h.ctl.style.top,'');assert.equal(h.ctl.style.bottom,'');assert.equal(h.ctl.style.maxHeight,'');
});
test('mobile dock keeps its padding and control positioning',()=>{
  const h=harness({mobile:true,padding:'140px',top:'12px'});h.mutate();h.resize();h.drain();assert.equal(h.stage.style.getPropertyValue('padding-bottom'),'140px');assert.equal(h.ctl.style.top,'12px');assert.deepEqual(h.stats(),{writes:0,views:0});
});
