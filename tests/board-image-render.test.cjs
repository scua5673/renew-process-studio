const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('studio/board.html','utf8');
const start=html.indexOf('(function(){try{if(!window.BALL_IMG)return;var t=new Image();'),end=html.indexOf('})();',start)+5;
assert.ok(start>=0&&end>start);const callback=html.slice(start,end);
const saveStart=html.indexOf('function boardSaveLive(){'),saveEnd=html.indexOf('function restoreAnimBeforeCapture()',saveStart);
const save=html.slice(saveStart,saveEnd);
function fixture({dirty=false,edit=0,cap,ready=false,fail=false}={}){
 let image;const c={Image:function(){image=this;},URLSearchParams,location:{search:''},clearTimeout(){},document:{body:{classList:{contains:()=>false}},getElementById:()=>null},
 BALL_IMG:{white:'synthetic-ball.avif'},__capLock:cap,__boardReady:ready,__boardRestoring:7,__csView:'board',_vaultBoardContext:false,_vaultBoardRestoring:false,_bliveApplying:false,animPlaying:false,
 _boardPrivateLoaded:true,_boardPrivateOwner:{uid:'fixture'},boardPrivateCurrent:()=>true,_bliveDirty:false,_boardPrivateEditSeq:edit,_boardManualDirty:dirty,_bliveT:null,_boardDraftBar:false,
 kitPropagateIfChanged(){},captureSnap:()=>({synthetic:true}),boardDraftSchedule(){},boardManualStatus(){},renderPitchImg(){}};
 c.window=c;c.renderTokens=()=>{c.boardSaveLive();if(fail)throw Error('synthetic drawing failure');};vm.createContext(c);vm.runInContext(save+'\n'+callback,c);return {c,fire:()=>image.onload()};
}
test('a late ball image render during private GET creates no edit or view snapshot',()=>{
 const h=fixture();h.fire();assert.equal(h.c.__ballImgOK,true);assert.equal(h.c._boardManualDirty,false);assert.equal(h.c._boardPrivateEditSeq,0);assert.equal(h.c._bliveDirty,false);assert.equal(h.c.__viewSnaps,undefined);assert.equal(h.c.__capLock,undefined);
});
test('an image-only refresh after readiness is still not a user edit',()=>{const h=fixture({ready:true});h.fire();assert.equal(h.c._boardManualDirty,false);assert.equal(h.c._boardPrivateEditSeq,0);});
test('image refresh preserves existing user edits and the exact capture lock',()=>{for(const cap of [undefined,7]){const h=fixture({dirty:true,edit:9,cap});h.fire();assert.equal(h.c._boardManualDirty,true);assert.equal(h.c._boardPrivateEditSeq,9);assert.equal(h.c.__capLock,cap);}});
test('a failing image redraw restores its previous capture lock',()=>{for(const cap of [undefined,7]){const h=fixture({cap,fail:true});h.fire();assert.equal(h.c.__capLock,cap);assert.equal(h.c._boardManualDirty,false);}});
test('real edits can still be saved after the display-only callback returns',()=>{const h=fixture();h.fire();h.c.boardSaveLive();assert.equal(h.c._boardManualDirty,true);assert.equal(h.c._boardPrivateEditSeq,1);});
