'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8'),start=source.indexOf('(function(){const ni=$("nameInput")');
const code=source.slice(start,source.indexOf('})();',start)+5);
function fixture(){
 let next=0,seq=0,renders=0,chosen;const timers=new Map(),handlers={},p={id:1,name:'original'},scenes=[{name:'original'},{name:'original'}];chosen=[p];
 const input={value:'',addEventListener:(kind,fn)=>handlers[kind]=fn,blur:()=>handlers.blur()};
 vm.runInNewContext(code,{$:()=>input,state:{players:[p]},selectedPlayers:()=>chosen,setTimeout(fn,ms){assert.equal(ms,40);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),renderTokens(){renders++;seq++;},positionSelCtl(){},updateDelUI(){},syncNameToScenes(player){scenes.forEach(s=>s.name=player.name);}});
 return {input,p,scenes,timers,fire:(kind,event={})=>handlers[kind](event),flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}},deselect:()=>chosen=[],get seq(){return seq;},get renders(){return renders;}};
}
test('committing a name cancels its already scheduled derived repaint before an exact save receipt',()=>{
 const h=fixture();h.fire('focus');h.input.value='  Complete saved name  ';h.fire('input');assert.equal(h.p.name,'  Complete saved name  ','real input updates data immediately');assert.equal(h.timers.size,1);
 h.fire('blur');const receiptSeq=h.seq;assert.equal(h.p.name,'Complete saved name');assert.deepEqual(h.scenes.map(s=>s.name),['Complete saved name','Complete saved name']);assert.equal(h.renders,1,'blur retains its immediate render');assert.equal(h.timers.size,0,'the redundant 40ms repaint must not survive commit');h.flush();assert.equal(h.seq,receiptSeq,'a duplicate derived repaint cannot invalidate the saved name receipt');
});
test('Enter preserves composition protection and commits the remembered player after selection leaves',()=>{
 const h=fixture();h.fire('focus');h.input.value=' Committed Korean name ';h.fire('input');h.deselect();let prevented=false;h.fire('compositionstart');h.fire('keydown',{key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,false);h.fire('compositionend');h.fire('keydown',{key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(h.p.name,'Committed Korean name');assert.deepEqual(h.scenes.map(s=>s.name),['Committed Korean name','Committed Korean name']);assert.equal(h.renders,1);
});
test('new typing after a commit still paints normally and updates the live name immediately',()=>{
 const h=fixture();h.fire('focus');h.input.value='first';h.fire('input');h.fire('blur');h.flush();const prior=h.renders;h.fire('focus');h.input.value='next real input';h.fire('input');assert.equal(h.p.name,'next real input');assert.equal(h.timers.size,1);h.flush();assert.equal(h.renders,prior+1);
});
