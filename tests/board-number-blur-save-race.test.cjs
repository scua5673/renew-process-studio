'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const privateFile=require.resolve('./private-board-draft.test.cjs'),prefix=fs.readFileSync(privateFile,'utf8').split('function startupPageRestore')[0],scope={require:createRequire(privateFile),__dirname:require('node:path').dirname(privateFile),module:{exports:{}},console,URLSearchParams};
// Reuse the existing actual private-board helpers/writer/restore harness without
// registering its tests, and install the real number-input IIFE into that VM.
vm.runInNewContext(prefix+'\nmodule.exports={harness,deferred,ticks,snap};',scope,{filename:privateFile});
const {harness,deferred,ticks,snap}=scope.module.exports;
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8'),start=source.indexOf('(function(){const ni=$("numInput")'),end=source.indexOf('})();',start)+5;
assert.ok(start>=0&&end>start);const code=source.slice(start,end);
function numberInput(h){
 const handlers={},timers=new Map(),calls={paint:0,sync:0,undo:0};let next=0,selected=[h.c.state.players[0]];
 const input={value:String(selected[0].num||''),addEventListener:(kind,fn)=>handlers[kind]=fn,blur:()=>handlers.blur()};
 const lookup=h.c.$;h.c.$=id=>id==='numInput'?input:lookup(id);h.c.selectedPlayers=()=>selected;
 h.c.setTimeout=(fn,ms)=>{timers.set(++next,{fn,ms});return next;};h.c.clearTimeout=id=>timers.delete(id);
 // The real renderer ends in boardSaveLive. Preserve that production call into
// the actual writer's edit sequence rather than substituting ready/status.
 h.c.renderTokens=()=>{calls.paint++;h.c.boardSaveLive();};h.c.positionSelCtl=()=>{};h.c.updateDelUI=()=>{};
 h.c.pushUndo=()=>{calls.undo++;h.c._boardUserTouched=true;};h.c.psSyncTokenAll=()=>{calls.sync++;};
 vm.runInContext(code,h.c);
 return {input,calls,timers,fire:(kind,event={})=>handlers[kind](event),select:players=>selected=players,flushPaint(){for(const [id,t]of [...timers])if(t.ms===50){timers.delete(id);t.fn();}}};
}
async function started(){const h=harness();await h.boot();h.c.state=snap(345);h.c.state.players[0].num='7';h.c.boardSaveLive();return h;}
test('an unchanged number focus/blur cannot invalidate a clean ACK head receipt',async()=>{
 const h=await started(),n=numberInput(h),d=deferred(),verify=h.c.PSStorage.sharedVerified;let held=false;
 h.c.PSStorage.sharedVerified=async(k,raw)=>{await verify(k,raw);if(!held&&k===h.key()&&h.c.__psBoardPrivateReceipt?.source==='ack'&&!h.c._boardPrivateRecord.pending){held=true;await d.promise;}};
 n.fire('focus');const saving=h.c.boardSaveExplicit({quiet:true});await ticks();assert.equal(held,true,'the actual server ACK is followed by a held exact clean-head verification');
 const seq=h.c._boardPrivateEditSeq,before=JSON.stringify(h.c.captureSnap());n.fire('blur');const after=JSON.stringify(h.c.captureSnap()),afterSeq=h.c._boardPrivateEditSeq;d.resolve();const ok=await saving;
 assert.equal(after,before,'focus-only number blur must not change any board data');assert.equal(h.saves.length,1);const evidence=JSON.stringify({beforeSeq:seq,afterSeq,delta:afterSeq-seq,ok,modelUnchanged:after===before,pending:h.c._boardPrivateRecord.pending,durable:h.c._boardPrivateDurableToken===h.c._boardPrivateRecord.token});
 assert.equal(afterSeq,seq,evidence);assert.equal(ok,true,evidence);assert.equal(h.c._boardPrivateDurableToken,h.c._boardPrivateRecord.token);assert.equal(h.idb.get(h.key()),JSON.stringify(h.c._boardPrivateRecord));
});
test('real number input updates data immediately and still paints and synchronizes its commit',async()=>{
 const h=await started(),n=numberInput(h);n.fire('focus');n.input.value=' 12 34 ';n.fire('input');assert.equal(h.c.state.players[0].num,'123');assert.equal(n.input.value,'123');assert.equal([...n.timers.values()].filter(t=>t.ms===50).length,1);n.fire('blur');assert.ok(n.calls.paint>=1);assert.ok(n.calls.sync>=1);assert.equal(h.c.state.players[0].num,'123');assert.equal(await h.c.boardSaveExplicit(),true);assert.equal(JSON.parse(h.server().raw).snap.players[0].num,'123');
});
test('number composition keeps its visible text until composition ends and Enter commits afterwards',async()=>{
 const h=await started(),n=numberInput(h);n.fire('focus');n.fire('compositionstart');n.input.value=' 12 34 ';n.fire('input');assert.equal(n.input.value,' 12 34 ');assert.equal(h.c.state.players[0].num,'123');let prevented=false;n.fire('keydown',{key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,false);n.fire('compositionend');assert.equal(n.input.value,'123');n.fire('keydown',{key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.ok(n.calls.paint>=1);assert.ok(n.calls.sync>=1);
});
test('untouched multiple selection remains unchanged, while real input still updates all selected players',async()=>{
 const h=await started(),p=h.c.state.players[0],q={id:2,num:'9',x:30,y:40};h.c.state.players.push(q);const n=numberInput(h);n.select([p,q]);n.fire('focus');n.input.value='';const seq=h.c._boardPrivateEditSeq;n.fire('blur');assert.equal(p.num,'7');assert.equal(q.num,'9');assert.equal(h.c._boardPrivateEditSeq,seq);assert.equal(n.calls.paint,0);
 n.fire('focus');n.input.value='22';n.fire('input');assert.equal(p.num,'22');assert.equal(q.num,'22');n.select([]);n.fire('blur');n.flushPaint();assert.ok(n.calls.paint>=1,'deselecting after input must not discard its queued real paint');assert.equal(p.num,'22');assert.equal(q.num,'22');
});
