'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Draft=require('../studio/board-draft.js');
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const save=source.slice(source.indexOf('function boardSaveLive(){'),source.indexOf('function restoreAnimBeforeCapture(){'));
function fixture(view,classes=[]){
 const calls={preview:0,draft:0,capture:0,editor:0},cl=new Set(classes);
 const w={PSBoardDraft:Draft,__csView:view,document:{body:{classList:{contains:k=>cl.has(k)}}},location:{search:''},URLSearchParams,kitPropagateIfChanged(){},_vaultBoardContext:null,_vaultBoardRestoring:false,_bliveApplying:false,_boardPrivateLoaded:true,_boardPrivateOwner:{uid:'synthetic',wid:'synthetic'},boardPrivateCurrent:()=>true,_boardPrivateEditSeq:7,_bliveDirty:false,_boardManualDirty:false,_boardUserTouched:true,animPlaying:false,boardSchedulePreview(){calls.preview++;},captureSnap(){calls.capture++;return {players:[]};},clearTimeout(){},_bliveT:null,_boardDraftBar:null,boardManualChanged:()=>false,boardDraftBarHide(){},boardDraftSchedule(){calls.draft++;},boardManualStatus(){},_schedEditorDraft(){calls.editor++;}};
 w.window=w;vm.runInNewContext(save,w);return {w,calls};
}
test('a borrowed meeting edit still schedules its current-slide preview without becoming a private edit',()=>{
 const {w,calls}=fixture('meeting',['meet-mode']);w.boardSaveLive();assert.equal(calls.preview,1,'the active meeting slide must still receive its normal delayed capture');assert.equal(w._boardPrivateEditSeq,7);assert.equal(w._bliveDirty,false);assert.equal(w._boardManualDirty,false);assert.equal(calls.draft,0);assert.equal(calls.capture,0);
});
test('other borrowed views do not schedule a meeting capture or create a private draft',()=>{
 for(const view of ['session','vault','analysis']){const {w,calls}=fixture(view);w.boardSaveLive();assert.deepEqual(calls,{preview:0,draft:0,capture:0,editor:0});assert.equal(w._boardPrivateEditSeq,7);assert.equal(w._boardManualDirty,false);}
});
test('working board edits retain the ordinary private sequence, full snapshot and draft path',()=>{
 for(const view of ['board','match']){const {w,calls}=fixture(view);w.boardSaveLive();assert.equal(calls.preview,1);assert.equal(calls.capture,1);assert.equal(calls.draft,1);assert.equal(w._boardPrivateEditSeq,8);assert.equal(w._boardManualDirty,true);assert.equal(w._bliveDirty,true);}
});
test('capture lock and training editor boundaries remain ahead of borrowed preview scheduling',()=>{
 const locked=fixture('meeting',['meet-mode']);locked.w.__capLock=1;locked.w.boardSaveLive();assert.equal(locked.calls.preview,0);assert.equal(locked.w._boardPrivateEditSeq,7);
 const editor=fixture('session',['editing']);editor.w.boardSaveLive();assert.equal(editor.calls.editor,1);assert.equal(editor.calls.preview,0);assert.equal(editor.calls.draft,0);assert.equal(editor.w._boardPrivateEditSeq,7);
});
