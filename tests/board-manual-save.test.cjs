const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
function part(a,b){return src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)+a.length));}
test('library board input and lifecycle flush never queue an automatic save or recovery snapshot',()=>{
 const calls=[],c={window:null,curType:()=> 'board',_vaultAutoWriting:false,_vaultAutoT:null,_vaultAutoAgain:false,_vaultAutoStatus:t=>calls.push(t),clearTimeout(){},setTimeout(){throw Error('must not schedule save');},restoreAnimBeforeCapture(){throw Error('must not capture');},_vaultEmergencySnapshot(){throw Error('must not write recovery');}};c.window=c;c.__vaultEdit=true;c.__curVaultId='synthetic';vm.createContext(c);
 vm.runInContext(part('  window.__vaultAutoSaveSchedule=function(){','  try{var _boardSaveLiveAuto='),c);
 c.__vaultAutoSaveSchedule();c.__vaultAutoSaveFlush();assert.equal(c.__vaultManualDirty,true);assert.deepEqual(calls,['변경 사항 있음 · 저장 버튼을 눌러 주세요']);
});
test('private-board lifecycle flush only retries an already committed payload',async()=>{
 let retries=0;const c={window:null,_vaultBoardContext:null,_vaultBoardRestoring:false,location:{search:''},URLSearchParams,document:{body:{classList:{contains:()=>false}}},restoreAnimBeforeCapture(){},clearTimeout(){},_bliveT:null,boardPrivateRetry(){retries++;return Promise.resolve(true);},_boardLiveWriteNow(){throw Error('must not capture unsaved changes');}};c.window=c;vm.createContext(c);vm.runInContext(part('function boardFlushLive(){','try{window.__boardFlushLive='),c);await c.boardFlushLive();assert.equal(retries,1);
});
