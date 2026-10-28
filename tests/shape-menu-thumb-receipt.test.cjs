'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const privateFile=require.resolve('./private-board-draft.test.cjs'),prefix=fs.readFileSync(privateFile,'utf8').split('function startupPageRestore')[0],scope={require:createRequire(privateFile),__dirname:require('node:path').dirname(privateFile),module:{exports:{}},console,URLSearchParams};
vm.runInNewContext(prefix+'\nmodule.exports={harness,deferred,ticks,snap};',scope,{filename:privateFile});
const {harness,deferred,ticks,snap}=scope.module.exports,source=fs.readFileSync(require.resolve('../studio/board-shape-menu.js'),'utf8');
function installShape(h,options={}){
 const c=h.c,draw={type:'rect',_sceneId:'synthetic-drawing',pts:[{x:1,y:2},{x:30,y:40}]},calls={thumb:0,paint:0,flags:[]};c.state.drawings=[draw];c.sel={type:'drawing',ref:draw};c.multiSel=[draw,c.state.players[0]];c.selPanelOpen=true;
 c.document.readyState='complete';c.document.head={appendChild(){}};c.document.createElement=()=>({style:{},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}});c.document.querySelector=()=>null;c.document.getElementById=()=>null;c.document.removeEventListener=()=>{};c.removeEventListener=()=>{};
 c.typeOfItem=o=>o.type?'drawing':'player';c._setSelRings=()=>{};c.updateAlignBar=()=>{};c.renderMultiGuides=()=>{};c.positionSelCtl=()=>{};
 // Match the production renderDrawings save hook, while retaining the actual
// private writer, edit sequence, CAS and receipt verification from the harness.
 c.renderDrawings=()=>{calls.paint++;calls.flags.push({thumb:c.__psThumbCapturing,cap:c.__capLock});c.boardSaveLive();};
 c.__snapToThumb=function(...args){
  calls.thumb++;calls.receiver=this;calls.args=args;calls.entryFlag=c.__psThumbCapturing;
  const previous=c.__psThumbCapturing,current=c.captureSnap();
  try{c.__psThumbCapturing=true;c.sel=null;c.multiSel=[];c.loadSnap(current);if(options.error)throw options.error;}
  finally{c.__psThumbCapturing=previous;}
  return '<svg data-synthetic="fresh"/>';
 };
 vm.runInContext(source,c);return {draw,calls};
}
async function started(){const h=harness();await h.boot();h.c.state=snap(345);h.c._boardUserTouched=true;h.c.boardSaveLive();return h;}
async function heldClean(h){
 const d=deferred(),verify=h.c.PSStorage.sharedVerified;let held=false;h.c.PSStorage.sharedVerified=async(k,raw)=>{await verify(k,raw);if(!held&&k===h.key()&&h.c.__psBoardPrivateReceipt?.source==='ack'&&!h.c._boardPrivateRecord.pending){held=true;await d.promise;}};
 const saving=h.c.boardSaveExplicit({quiet:true});await ticks();assert.equal(held,true);return {saving,release:()=>d.resolve()};
}
test('thumbnail selection repaint cannot invalidate an exact clean-head ACK receipt',async()=>{
 const h=await started(),shape=installShape(h),gate=await heldClean(h),seq=h.c._boardPrivateEditSeq,before=JSON.stringify(h.c.captureSnap());
 assert.equal(h.c.__snapToThumb({synthetic:'frame A'}),'<svg data-synthetic="fresh"/>');assert.equal(h.c.__snapToThumb({synthetic:'frame B'}),'<svg data-synthetic="fresh"/>');const afterSeq=h.c._boardPrivateEditSeq,unchanged=JSON.stringify(h.c.captureSnap())===before;gate.release();const ok=await gate.saving;
 assert.equal(unchanged,true);assert.equal(shape.calls.thumb,2);assert.equal(shape.calls.paint,2);assert.equal(h.c.sel.ref,shape.draw);assert.equal(h.c.state.drawings[0],shape.draw);assert.equal(h.c.multiSel[0],shape.draw);assert.equal(h.c.multiSel[1],h.c.state.players[0]);assert.equal(h.c.selPanelOpen,true);
 const evidence=JSON.stringify({beforeSeq:seq,afterSeq,delta:afterSeq-seq,ok,modelUnchanged:unchanged,thumbs:shape.calls.thumb});assert.equal(afterSeq,seq,evidence);assert.equal(ok,true,evidence);assert.equal(h.saves.length,1);assert.equal(h.idb.get(h.key()),JSON.stringify(h.c._boardPrivateRecord));assert.equal(h.c._boardPrivateDurableToken,h.c._boardPrivateRecord.token);
});
test('thumbnail wrapper preserves the prior capture flags and original receiver and arguments',async()=>{
 for(const previous of [undefined,false,true,'nested capture']){const h=await started(),shape=installShape(h),receiver={synthetic:'receiver'};h.c.__psThumbCapturing=previous;h.c.__capLock='unrelated outer capture';const seq=h.c._boardPrivateEditSeq;
  assert.equal(h.c.__snapToThumb.call(receiver,{frame:1},{option:2}),'<svg data-synthetic="fresh"/>');assert.equal(shape.calls.entryFlag,previous,'the original thumbnail must execute before any added repaint guard');assert.equal(shape.calls.receiver,receiver);assert.deepEqual(shape.calls.args,[{frame:1},{option:2}]);assert.equal(h.c.__psThumbCapturing,previous);assert.equal(h.c.__capLock,'unrelated outer capture');assert.equal(h.c._boardPrivateEditSeq,seq);assert.equal(h.c.sel.ref,shape.draw);
 }
});
test('a thumbnail exception still restores selection and capture flags without a private edit',async()=>{
 for(const previous of [undefined,false,true,'nested capture']){const h=await started(),failure=Error('synthetic original thumbnail error'),shape=installShape(h,{error:failure});h.c.__psThumbCapturing=previous;const seq=h.c._boardPrivateEditSeq;
  assert.throws(()=>h.c.__snapToThumb({frame:1}),e=>e===failure);assert.equal(h.c.__psThumbCapturing,previous);assert.equal(h.c._boardPrivateEditSeq,seq);assert.equal(h.c.sel.ref,shape.draw);assert.equal(h.c.state.drawings[0],shape.draw);assert.equal(h.c.multiSel[1],h.c.state.players[0]);
 }
});
test('a real edit during thumbnail work still advances the sequence and rejects the old receipt',async()=>{
 const h=await started(),shape=installShape(h),gate=await heldClean(h),seq=h.c._boardPrivateEditSeq;h.c.state.players[0].x=999;h.c.boardSaveLive();assert.ok(h.c._boardPrivateEditSeq>seq);h.c.__snapToThumb({frame:1});gate.release();assert.equal(await gate.saving,false);assert.equal(h.c.state.players[0].x,999);assert.equal(h.c._boardManualDirty,true);assert.equal(h.c.sel.ref,shape.draw);assert.equal(h.saves.length,1);assert.equal(JSON.parse(h.server().raw).snap.players[0].x,345,'an old acknowledgement never becomes the newer input');
});
