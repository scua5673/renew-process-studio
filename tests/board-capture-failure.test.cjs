const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const code=src.slice(src.indexOf('function _boardLiveWriteNow(recovery){'),src.indexOf('function boardSaveLive(){'));
function harness(){
 const writes=[],messages=[],owner={id:'coach-test'};
 const ctx=vm.createContext({Promise,Date,JSON,Math,_vaultBoardContext:false,_vaultBoardRestoring:false,_bliveApplying:false,_bliveDirty:true,animPlaying:false,animActive:0,matchActive:0,anim:{slides:[],frames:[]},_boardPrivateOwner:owner,_boardPrivateLoaded:true,_boardPrivateRecord:{base:'previous'},_boardPrivateBase:'previous',document:{getElementById:()=>null,body:{classList:{contains:()=>false}}},captureSnap:()=>({players:[{id:1,name:'Kept',x:5,y:6}]}),boardPrivateOwner:()=>owner,boardPrivateSameAccount:()=>true,boardPrivateCurrent:()=>true,boardPrivateMake:(o,raw)=>({raw}),boardPrivatePersist:async(o,r)=>{writes.push(r);},boardPrivateSend:async()=>true,toast:m=>messages.push(m),parent:{postMessage(){}},location:{origin:'http://fixture'}});
 vm.runInContext('window=this;',ctx);ctx.__psPages={liveVal:()=>({pages:[{name:'One'},{name:'Two'}],idx:1})};ctx.__animFrames=()=>[{snap:{players:[{id:1}]}}];vm.runInContext(code,ctx);return {ctx,writes,messages};
}
for(const stage of ['board','pages','animation','serialization'])test(stage+' capture failure never replaces durable board and next save can recover',async()=>{
 const h=harness(),c=h.ctx,restore=[c.captureSnap,c.__psPages.liveVal,c.__animFrames];
 const fail=()=>{throw Error('injected failure');};
 if(stage==='board')c.captureSnap=fail;if(stage==='pages')c.__psPages.liveVal=fail;if(stage==='animation')c.__animFrames=fail;
 if(stage==='serialization')c.captureSnap=()=>{const x={};x.self=x;return x;};
 assert.equal(await c._boardLiveWriteNow(false),false);assert.equal(h.writes.length,0);assert.equal(c._boardPrivateRecord.base,'previous');assert.equal(c._bliveDirty,true);assert.equal(h.messages.length,1);
 [c.captureSnap,c.__psPages.liveVal,c.__animFrames]=restore;
 await c._boardLiveWriteNow(false);assert.equal(h.writes.length,1);const data=JSON.parse(h.writes[0].raw);assert.equal(data.snap.players[0].name,'Kept');assert.equal(data.boardPages.pages.length,2);assert.equal(data.animFrames.length,1);
});
test('strict page capture keeps prior page intact when animation capture fails',()=>{const a=src.indexOf('  function capture(strict){'),b=src.indexOf('  function ensure()',a);const page={snap:{name:'old'},thumb:'old',anim:{old:true}};const c=vm.createContext({pages:[page],idx:0,window:{captureSnap:()=>({name:'new'}),__animGet:()=>{throw Error('animation failure');}},_thumb:()=>'<svg/>'});vm.runInContext(src.slice(a,b),c);assert.throws(()=>c.capture(true),/animation failure/);assert.equal(page.snap.name,'old');assert.equal(page.thumb,'old');assert.equal(page.anim.old,true);});
test('durable animation save never invokes thumbnail or preview renderers',async()=>{
 const h=harness(),c=h.ctx;c.document.getElementById=()=>({classList:{contains:()=>true}});c.anim.frames=[{snap:{}},{snap:{}}];
 let previews=0;c.boardThumbSVG=()=>{previews++;throw Error('broken thumbnail');};c.renderAnimFrames=()=>{previews++;throw Error('broken preview');};
 await c._boardLiveWriteNow(false);assert.equal(h.writes.length,1);assert.equal(previews,0);assert.equal(JSON.parse(h.writes[0].raw).snap.players[0].name,'Kept');
});
test('strict animation serialization propagates failures instead of silently dropping frames',()=>{
 const a=src.indexOf('window.__animFrames=function('),b=src.indexOf('window.__animReset=',a);
 const c=vm.createContext({anim:{frames:[{},{}]},animActive:0,animPlaying:false,animHold:.6,document:{getElementById:()=>({classList:{contains:()=>true}}),body:{classList:{contains:()=>false}}},captureSnap:()=>{throw Error('capture failed');}});vm.runInContext('window=this;',c);vm.runInContext(src.slice(a,b),c);
 assert.throws(()=>c.__animFrames(true),/capture failed/);
});
