const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
function setup(){
 const c=vm.createContext({console,sel:{ref:{id:1}},multiSel:[{id:2}],_vaultBoardContext:false,_vaultBoardRestoring:false,_bliveApplying:false,_boardPrivateLoaded:true,_boardPrivateOwner:{id:'test'},_boardPrivateEditSeq:0,_bliveT:null,animPlaying:false,location:{search:''},URLSearchParams,setTimeout:()=>1,clearTimeout:()=>{},document:{body:{classList:{contains:()=>false}}},captureSnap:()=>({players:[]}),boardPrivateCurrent:()=>true,psDragging:()=>false,_setSelRings:()=>{}});
 vm.runInContext('window=this; writes=0; thumbs=0; renders=0;',c);
 vm.runInContext(src.slice(src.indexOf('function boardThumbSVG(){'),src.indexOf('function _boardThumbSVGRaw()')),c);
 vm.runInContext(src.slice(src.indexOf('function boardSaveLive(){'),src.indexOf('function restoreAnimBeforeCapture()')),c);
 vm.runInContext(`function renderTokens(){renders++;boardSaveLive();} function _boardThumbSVGRaw(){if(++thumbs>8)throw Error('recursive thumbnail');const a=sel,b=multiSel;sel=null;multiSel=[];renderTokens();sel=a;multiSel=b;renderTokens();return '<svg/>';}
 function _boardLiveWriteNow(){writes++;return boardThumbSVG();}`,c);return c;
}
test('multi-page live save cannot recurse through selection thumbnail rendering',()=>{const c=setup();const selected=c.sel,multi=c.multiSel;c.boardSaveLive();assert.equal(c.writes,1);assert.equal(c.thumbs,1);assert.equal(c.sel,selected);assert.equal(c.multiSel,multi);assert.equal(c.__psThumbCapturing,false);c.boardSaveLive();assert.equal(c.writes,2);});
test('failed thumbnail restores selection and releases save suppression',()=>{const c=setup();const selected=c.sel,multi=c.multiSel;c._boardThumbSVGRaw=()=>{c.sel=null;c.multiSel=[];throw Error('serialization failed');};assert.throws(()=>c.boardThumbSVG(),/serialization failed/);assert.equal(c.sel,selected);assert.equal(c.multiSel,multi);assert.equal(c.__psThumbCapturing,false);});
test('nested thumbnail requests use the previous image without reentering renderer',()=>{const c=setup();c.__psLastThumb='cached';c._boardThumbSVGRaw=()=>c.boardThumbSVG();assert.equal(c.boardThumbSVG(),'cached');assert.equal(c.__psThumbCapturing,false);});
